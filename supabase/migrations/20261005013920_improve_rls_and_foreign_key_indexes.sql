-- Independent Land Banker only. Never apply to MaxQI or PROS.

-- Avoid evaluating auth.uid() once per row in the three policies flagged by
-- the Supabase performance advisor.
alter policy own_profile_read on public.profiles
  using (id = (select auth.uid()));

alter policy own_profile_update on public.profiles
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

alter policy manager_share_insert on public.share_links
  with check (
    private.has_workspace_role(workspace_id, array['owner', 'admin'])
    and created_by = (select auth.uid())
  );

-- Cover foreign-key columns used for relationship checks and cleanup. The
-- leading workspace_id also supports the tenant-scoped access pattern.
create index if not exists field_observation_media_created_by_idx
  on public.field_observation_media(created_by);
create index if not exists field_observation_media_observation_idx
  on public.field_observation_media(workspace_id, observation_id);
create index if not exists field_observations_created_by_idx
  on public.field_observations(created_by);
create index if not exists field_observations_parcel_idx
  on public.field_observations(workspace_id, linked_parcel_id);
create index if not exists land_parcels_created_by_idx
  on public.land_parcels(created_by);
create index if not exists saved_views_created_by_idx
  on public.saved_views(created_by);
create index if not exists share_links_created_by_idx
  on public.share_links(created_by);
create index if not exists share_links_workspace_idx
  on public.share_links(workspace_id);
create index if not exists spatial_features_layer_idx
  on public.spatial_features(workspace_id, layer_id);
create index if not exists spatial_layers_created_by_idx
  on public.spatial_layers(created_by);
create index if not exists workspaces_created_by_idx
  on public.workspaces(created_by);

