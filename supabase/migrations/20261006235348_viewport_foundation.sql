-- Additive LandOS-only viewport candidates. Existing GeoJSON, API and RLS stay usable.
create function private.geojson_box(p_geometry jsonb) returns box
language sql immutable strict security invoker set search_path='' as $$
  with recursive nodes(v) as (
    select coalesce(p_geometry->'geometry'->'coordinates',p_geometry->'coordinates')
    union all
    select child.value from nodes n cross join lateral jsonb_array_elements(
      case when jsonb_typeof(n.v)='array' and jsonb_typeof(n.v->0)='array' then n.v else '[]'::jsonb end
    ) child
  ), bounds as (
    select min((v->>0)::double precision) west,min((v->>1)::double precision) south,
      max((v->>0)::double precision) east,max((v->>1)::double precision) north
    from nodes where jsonb_typeof(v->0)='number' and jsonb_typeof(v->1)='number'
  ) select case when west is null then null else box(point(west,south),point(east,north)) end from bounds;
$$;
revoke all on function private.geojson_box(jsonb) from public;
grant execute on function private.geojson_box(jsonb) to authenticated,service_role;
alter table public.land_parcels add column viewport_box box generated always as
  (coalesce(private.geojson_box(geometry),box(point(longitude,latitude),point(longitude,latitude)))) stored;
alter table public.field_observations add column viewport_box box generated always as
  (box(point(longitude,latitude),point(longitude,latitude))) stored;
alter table public.spatial_features add column viewport_box box generated always as (private.geojson_box(feature)) stored;
create index land_parcels_viewport_gist on public.land_parcels using gist(viewport_box);
create index field_observations_viewport_gist on public.field_observations using gist(viewport_box);
create index spatial_features_viewport_gist on public.spatial_features using gist(viewport_box);
create index land_parcels_delta_idx on public.land_parcels(workspace_id,updated_at,id);
create index field_observations_delta_idx on public.field_observations(workspace_id,updated_at,id);
create index spatial_features_delta_idx on public.spatial_features(workspace_id,updated_at,id);

-- Candidate envelopes are indexed; exact line/polygon/hole intersection is checked by the API.
create function public.landos_viewport_candidates(p_workspace uuid,p_kind text,p_bbox double precision[],p_limit integer default 500,p_after uuid default null,p_updated_since timestamptz default null)
returns setof jsonb language plpgsql stable security invoker set search_path='' as $$
declare viewport box;
begin
  if p_kind not in ('parcels','observations','features') or p_limit not between 1 and 500
    or array_length(p_bbox,1) is distinct from 4 or p_bbox[1] < -180 or p_bbox[3] > 180
    or p_bbox[2] < -90 or p_bbox[4] > 90 or p_bbox[1]>=p_bbox[3] or p_bbox[2]>=p_bbox[4]
    or exists(select 1 from unnest(p_bbox) n where n is null or n::text in ('NaN','Infinity','-Infinity'))
  then raise exception 'Invalid viewport query'; end if;
  viewport:=box(point(p_bbox[1],p_bbox[2]),point(p_bbox[3],p_bbox[4]));
  if p_kind='parcels' then
    return query select (to_jsonb(p)-'metadata'-'viewport_box') || jsonb_build_object(
      'source_url',p.metadata->>'source_url','lot',p.metadata->>'lot','plan',p.metadata->>'plan','retrieved_at',p.metadata->>'retrieved_at')
      from public.land_parcels p where p.workspace_id=p_workspace and p.viewport_box && viewport
      and (p_after is null or p.id>p_after) and (p_updated_since is null or p.updated_at>p_updated_since)
      order by p.id limit p_limit;
  elsif p_kind='observations' then
    return query select (to_jsonb(o)-'metadata'-'viewport_box') || jsonb_build_object('field_observation_media',
      coalesce((select jsonb_agg(to_jsonb(m)-'metadata') from public.field_observation_media m
        where m.workspace_id=p_workspace and m.observation_id=o.id),'[]'::jsonb))
      from public.field_observations o where o.workspace_id=p_workspace and o.viewport_box && viewport
      and (p_after is null or o.id>p_after) and (p_updated_since is null or o.updated_at>p_updated_since)
      order by o.id limit p_limit;
  else
    return query select to_jsonb(f)-'viewport_box' from public.spatial_features f
      where f.workspace_id=p_workspace and f.viewport_box && viewport
      and (p_after is null or f.id>p_after) and (p_updated_since is null or f.updated_at>p_updated_since)
      order by f.id limit p_limit;
  end if;
end;
$$;
revoke all on function public.landos_viewport_candidates(uuid,text,double precision[],integer,uuid,timestamptz) from public,anon;
grant execute on function public.landos_viewport_candidates(uuid,text,double precision[],integer,uuid,timestamptz) to authenticated;
