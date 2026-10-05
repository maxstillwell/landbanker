-- Public reference catalog, tenant-scoped user preferences. No MaxQI dependency.
create table public.layer_catalog (
 id text primary key, name text not null, state text not null check(state in ('VIC','NSW','AU')),
 category text not null check(category in ('Base','Property','Planning','Risk','Growth')),
 provider text not null, service_url text not null check(service_url like 'https://%'),
 renderer text not null check(renderer in ('arcgis_export','tile')), layer_ids text,
 description text not null, attribution text not null, usage_notes text not null,
 source_url text not null, update_frequency text, premium_tier text not null default 'free' check(premium_tier in ('free','pro','team')),
 min_zoom integer not null default 8, enabled boolean not null default false, updated_at timestamptz not null default now()
);
alter table public.layer_catalog enable row level security;
revoke all on public.layer_catalog from anon,authenticated;
grant select on public.layer_catalog to authenticated;
grant all on public.layer_catalog to service_role;
create policy catalog_read on public.layer_catalog for select to authenticated using(true);
create table public.active_map_layers (
 workspace_id uuid not null, user_id uuid not null default auth.uid(), catalog_id text not null references public.layer_catalog(id),
 visible boolean not null default true, opacity numeric not null default 0.65 check(opacity between 0 and 1), position integer not null default 0 check(position between 0 and 100),
 updated_at timestamptz not null default now(), primary key(workspace_id,user_id,catalog_id),
 foreign key(workspace_id,user_id) references public.workspace_memberships(workspace_id,user_id) on delete cascade
);
alter table public.active_map_layers enable row level security;
revoke all on public.active_map_layers from anon,authenticated;
grant select,insert,update,delete on public.active_map_layers to authenticated;
grant all on public.active_map_layers to service_role;
create policy preference_access on public.active_map_layers for all to authenticated
 using(user_id=auth.uid() and private.has_workspace_role(workspace_id,array['owner','admin','editor','viewer']))
 with check(user_id=auth.uid() and private.has_workspace_role(workspace_id,array['owner','admin','editor','viewer']));
create trigger immutable_workspace before update on public.active_map_layers for each row execute function private.lock_workspace();
create table public.workspace_entitlements (
 workspace_id uuid primary key references public.workspaces(id), tier text not null default 'free' check(tier in ('free','pro','team')),
 updated_at timestamptz not null default now()
);
alter table public.workspace_entitlements enable row level security;
revoke all on public.workspace_entitlements from anon,authenticated;
grant select on public.workspace_entitlements to authenticated;
grant all on public.workspace_entitlements to service_role;
create policy entitlement_read on public.workspace_entitlements for select to authenticated using(private.has_workspace_role(workspace_id,array['owner','admin','editor','viewer']));

insert into public.layer_catalog(id,name,state,category,provider,service_url,renderer,layer_ids,description,attribution,usage_notes,source_url,premium_tier,min_zoom,enabled) values
('vic-zoning','Victoria zoning','VIC','Planning','Victorian Government','https://spatial.planning.vic.gov.au/gis/rest/services/planning_scheme_zones/MapServer','arcgis_export','0','Planning scheme zones. Consult current planning scheme for decisions.','Victorian Government · Planning Scheme Zones','Provider terms apply; not a planning certificate.','https://www.planning.vic.gov.au/schemes-and-amendments/browse-planning-schemes','free',8,true),
('vic-flood','Victoria flood planning overlays','VIC','Risk','Victorian Government','https://plan-gis.mapshare.vic.gov.au/arcgis/rest/services/Planning/Vicplan_PlanningSchemeOverlays/MapServer','arcgis_export','14,15,16,32','FO, LSIO, SBO and RFO planning overlays; not complete flood modelling.','Victorian Government · Flood Planning Overlays','Planning overlays only; absence is not evidence of no flood risk.','https://www.planning.vic.gov.au/schemes-and-amendments/browse-planning-schemes','pro',9,true),
('vic-bushfire','Victoria bushfire management overlay','VIC','Risk','Victorian Government','https://plan-gis.mapshare.vic.gov.au/arcgis/rest/services/Planning/Vicplan_PlanningSchemeOverlays/MapServer','arcgis_export','19','Bushfire Management Overlay. Not the complete bushfire-prone-area dataset.','Victorian Government · BMO','Provider terms apply; obtain appropriate assessment.','https://www.planning.vic.gov.au/schemes-and-amendments/browse-planning-schemes','pro',9,true),
('vic-heritage','Victoria heritage overlay','VIC','Risk','Victorian Government','https://plan-gis.mapshare.vic.gov.au/arcgis/rest/services/Planning/Vicplan_PlanningSchemeOverlays/MapServer','arcgis_export','9','Heritage planning overlay.','Victorian Government · Heritage Overlay','Provider terms apply; consult current scheme.','https://www.planning.vic.gov.au/schemes-and-amendments/browse-planning-schemes','pro',9,true),
('vic-parcels','Victoria cadastral parcels','VIC','Property','Victorian Government','https://plan-gis.mapshare.vic.gov.au/arcgis/rest/services/Planning/VicPlan_PropertyAndParcel/MapServer','arcgis_export','4','Official parcel outlines; use Property search to save a specific parcel.','Victorian Government · Vicmap Parcels','Indicative mapping, not legal survey.','https://www.land.vic.gov.au/maps-and-spatial/spatial-data','free',13,true),
('nsw-zoning','NSW zoning','NSW','Planning','NSW Government','https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Planning/EPI_Primary_Planning_Layers/MapServer','arcgis_export','2','Environmental Planning Instrument land zoning.','NSW Government · EPI Land Zoning','Provider terms apply; consult current instrument.','https://www.planningportal.nsw.gov.au/spatialviewer','free',8,true),
('nsw-heritage','NSW heritage','NSW','Risk','NSW Government','https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Planning/EPI_Primary_Planning_Layers/MapServer','arcgis_export','0','EPI heritage mapping; not all heritage registers.','NSW Government · EPI Heritage','Provider terms apply; scope is EPI heritage.','https://www.planningportal.nsw.gov.au/spatialviewer','pro',9,true),
('nsw-parcels','NSW cadastral parcels','NSW','Property','NSW Spatial Services','https://portal.spatial.nsw.gov.au/server/rest/services/NSW_Land_Parcel_Property_Theme/MapServer','arcgis_export','8','Official cadastral parcel outlines.','NSW Spatial Services · Cadastre','Indicative mapping, not legal survey.','https://www.spatial.nsw.gov.au/products_and_services/web_services','free',13,true);
