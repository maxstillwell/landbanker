alter table public.field_observations add column linked_research_area_id uuid;
alter table public.field_observations add constraint observation_research_workspace_fk foreign key(workspace_id,linked_research_area_id) references public.spatial_layers(workspace_id,id);
create index observation_research_idx on public.field_observations(workspace_id,linked_research_area_id);
create table public.research_property_links (
 workspace_id uuid not null references public.workspaces(id), research_area_id uuid not null, property_id uuid not null,
 primary key(workspace_id,research_area_id,property_id),
 foreign key(workspace_id,research_area_id) references public.spatial_layers(workspace_id,id) on delete cascade,
 foreign key(workspace_id,property_id) references public.land_parcels(workspace_id,id) on delete cascade
);
alter table public.research_property_links enable row level security;
grant select,insert,delete on public.research_property_links to authenticated;
create policy link_read on public.research_property_links for select to authenticated using(private.has_workspace_role(workspace_id,array['owner','admin','editor','viewer']));
create policy link_insert on public.research_property_links for insert to authenticated with check(private.has_workspace_role(workspace_id,array['owner','admin','editor']) and exists(select 1 from public.spatial_layers l where l.workspace_id=research_property_links.workspace_id and l.id=research_area_id and l.layer_kind='research_area'));
create policy link_delete on public.research_property_links for delete to authenticated using(private.has_workspace_role(workspace_id,array['owner','admin','editor']));
create unique index property_import_fingerprint on public.land_parcels(workspace_id,(metadata->>'landos_import_fingerprint')) where metadata ? 'landos_import_fingerprint';
create unique index layer_import_fingerprint on public.spatial_layers(workspace_id,(metadata->>'landos_import_fingerprint')) where metadata ? 'landos_import_fingerprint';
create function public.save_spatial_import(p_workspace uuid,p_id uuid,p_name text,p_geojson jsonb,p_kind text,p_metadata jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
begin
 if p_kind not in ('geojson','research_area') then raise exception 'Invalid destination'; end if;
 perform public.save_layer_features(p_workspace,p_id,p_name,p_geojson);
 update public.spatial_layers set layer_kind=p_kind,metadata=p_metadata where workspace_id=p_workspace and id=p_id;
 if not found then raise exception 'Import unavailable'; end if;
 return p_id;
end $$;
revoke all on function public.save_spatial_import(uuid,uuid,text,jsonb,text,jsonb) from public,anon;
grant execute on function public.save_spatial_import(uuid,uuid,text,jsonb,text,jsonb) to authenticated;
