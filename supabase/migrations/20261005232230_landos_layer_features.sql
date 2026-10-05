-- Independent LandOS only. Preserve existing layer snapshots and import identities.
create policy editor_delete on public.spatial_features for delete to authenticated
using(private.has_workspace_role(workspace_id,array['editor']));

create function public.save_layer_features(p_workspace uuid,p_id uuid,p_name text,p_geojson jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare f jsonb;
begin
  if not private.has_workspace_role(p_workspace,array['owner','admin','editor']) then
    raise exception 'Workspace is read-only' using errcode='42501';
  end if;
  if length(trim(p_name)) not between 1 and 160 or p_geojson->>'type' <> 'FeatureCollection'
    or jsonb_typeof(p_geojson->'features') <> 'array' or jsonb_array_length(p_geojson->'features') > 5000
    or octet_length(p_geojson::text) > 3000000 then raise exception 'Invalid layer'; end if;
  insert into public.spatial_layers(id,workspace_id,name,layer_kind,geojson,created_by)
    values(p_id,p_workspace,trim(p_name),'geojson',p_geojson,auth.uid())
    on conflict(id) do update set name=excluded.name,geojson=excluded.geojson,updated_at=now();
  for f in select value from jsonb_array_elements(p_geojson->'features') loop
    if f->>'type' <> 'Feature' or not (f->'geometry'->>'type' = any(array['Point','MultiPoint','LineString','MultiLineString','Polygon','MultiPolygon'])) then raise exception 'Invalid feature'; end if;
    insert into public.spatial_features(id,workspace_id,layer_id,feature)
      values((f->>'id')::uuid,p_workspace,p_id,f)
      on conflict(id) do update set feature=excluded.feature,updated_at=now()
      where public.spatial_features.workspace_id=p_workspace and public.spatial_features.layer_id=p_id;
    if not found then raise exception 'Feature belongs to another layer' using errcode='42501'; end if;
  end loop;
  delete from public.spatial_features where workspace_id=p_workspace and layer_id=p_id
    and id not in(select (value->>'id')::uuid from jsonb_array_elements(p_geojson->'features'));
  return p_id;
end $$;
revoke all on function public.save_layer_features(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.save_layer_features(uuid,uuid,text,jsonb) to authenticated;
