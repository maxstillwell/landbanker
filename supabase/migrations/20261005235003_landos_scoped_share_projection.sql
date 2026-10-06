-- Narrow, token-scoped public read path. Business-table anon grants remain absent.
alter table public.share_links add column manifest jsonb not null default '{}';
create function private.shared_geometry(p_geometry jsonb)
returns jsonb language sql immutable set search_path='' as $$
 select case when p_geometry->>'type'=any(array['Point','MultiPoint','LineString','MultiLineString','Polygon','MultiPolygon'])
  and jsonb_typeof(p_geometry->'coordinates')='array'
  and not jsonb_path_exists(p_geometry->'coordinates','strict $.** ? (@.type() != "number" && @.type() != "array")')
 then jsonb_build_object('type',p_geometry->'type','coordinates',p_geometry->'coordinates') else null end;
$$;
revoke all on function private.shared_geometry(jsonb) from public,anon,authenticated;
create function private.shared_geojson(p_geojson jsonb,p_feature_ids jsonb default null)
returns jsonb language sql immutable set search_path='' as $$
 select case when jsonb_typeof(p_geojson->'features')='array' then jsonb_build_object('type','FeatureCollection','features',coalesce((
  select jsonb_agg(jsonb_build_object('type','Feature','id',f->'id','geometry',private.shared_geometry(f->'geometry'),'properties',jsonb_strip_nulls(jsonb_build_object(
   'name',case when jsonb_typeof(f->'properties'->'name')='string' then left(f->'properties'->>'name',160) end,
   'label',case when jsonb_typeof(f->'properties'->'label')='string' then left(f->'properties'->>'label',160) end))))
  from jsonb_array_elements(p_geojson->'features') f where p_feature_ids is null or p_feature_ids ? (f->>'id')
 ),'[]'::jsonb)) else null end;
$$;
revoke all on function private.shared_geojson(jsonb,jsonb) from public,anon,authenticated;

create function public.resolve_landos_share(p_token text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare link public.share_links%rowtype; parcels jsonb; layers jsonb; official jsonb;
begin
 if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then return null;end if;
 select * into link from public.share_links where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and revoked_at is null and expires_at>now();
 if not found or cardinality(link.resource_ids)>100 then return null;end if;
 if link.resource_type in ('parcel','parcels') then
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'title',p.title,'latitude',p.latitude,'longitude',p.longitude,'geometry',
   case when p.geometry->>'type'='FeatureCollection' then private.shared_geojson(p.geometry) when p.geometry->>'type'='Feature' then jsonb_build_object('type','Feature','geometry',private.shared_geometry(p.geometry->'geometry'),'properties','{}'::jsonb) else private.shared_geometry(p.geometry) end,
   'hectares',p.hectares,'status',p.status)),'[]'::jsonb) into parcels from public.land_parcels p where p.workspace_id=link.workspace_id and p.id=any(link.resource_ids);
  return jsonb_build_object('type','parcels','resources',parcels);
 elsif link.resource_type='spatial_layer' then
  select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'name',l.name,'geojson',private.shared_geojson(l.geojson))),'[]'::jsonb) into layers from public.spatial_layers l where l.workspace_id=link.workspace_id and l.id=any(link.resource_ids);
  return jsonb_build_object('type','layers','resources',layers);
 elsif link.resource_type='saved_view' then
  if jsonb_typeof(link.manifest->'parcel_ids') is distinct from 'array' or jsonb_typeof(link.manifest->'layer_ids') is distinct from 'array' or jsonb_typeof(link.manifest->'official_layers') is distinct from 'array' then return null;end if;
  if jsonb_array_length(link.manifest->'parcel_ids')>100 or jsonb_array_length(link.manifest->'layer_ids')>100 or jsonb_array_length(link.manifest->'official_layers')>30 then return null;end if;
  select coalesce(jsonb_agg(jsonb_build_object('kind','parcel','id',p.id,'title',p.title,'latitude',p.latitude,'longitude',p.longitude,'geometry',
   case when p.geometry->>'type'='FeatureCollection' then private.shared_geojson(p.geometry) when p.geometry->>'type'='Feature' then jsonb_build_object('type','Feature','geometry',private.shared_geometry(p.geometry->'geometry'),'properties','{}'::jsonb) else private.shared_geometry(p.geometry) end,'hectares',p.hectares)),'[]'::jsonb) into parcels from public.land_parcels p
   where p.workspace_id=link.workspace_id and p.id::text in(select jsonb_array_elements_text(link.manifest->'parcel_ids'));
  select coalesce(jsonb_agg(jsonb_build_object('kind','layer','id',l.id,'name',l.name,'geojson',private.shared_geojson(l.geojson,coalesce(link.manifest->'feature_ids'->l.id::text,'[]'::jsonb)))),'[]'::jsonb) into layers from public.spatial_layers l
   where l.workspace_id=link.workspace_id and l.id::text in(select jsonb_array_elements_text(link.manifest->'layer_ids'));
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'service_url',c.service_url,'layer_ids',c.layer_ids,'renderer',c.renderer,'attribution',c.attribution,'min_zoom',c.min_zoom,'opacity',s->'opacity')),'[]'::jsonb) into official from public.layer_catalog c cross join jsonb_array_elements(link.manifest->'official_layers') s where c.id=s->>'catalog_id' and c.enabled;
  return jsonb_build_object('type','view','resources',parcels||layers,'view',jsonb_build_object('name',link.manifest->>'name','latitude',link.manifest->'latitude','longitude',link.manifest->'longitude','zoom',link.manifest->'zoom'),'official_layers',official);
 end if;
 return null;
end $$;
revoke all on function public.resolve_landos_share(text) from public;
grant execute on function public.resolve_landos_share(text) to anon,authenticated;
