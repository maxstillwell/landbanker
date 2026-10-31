-- Private user annotations, separate from official layers and all existing content.
create table public.workspace_markers (
 id uuid primary key, workspace_id uuid not null references public.workspaces(id),
 created_by uuid not null default auth.uid() references auth.users(id),
 latitude double precision not null check(latitude between -85.051129 and 85.051129),longitude double precision not null check(longitude between -180 and 180),
 icon text not null check(icon in ('school','university','library','community','sports','shopping','retail','supermarket','cafe','restaurant','commercial','hospital','medical','pharmacy','emergency','train','bus','airport','parking','access','electricity','water','residential','development','industrial','warehouse','construction','opportunity','park','waterway','forest','agriculture','important')),
 name text not null check(length(trim(name)) between 1 and 160),description text not null default '' check(length(description)<=2000),
 color text not null check(color in ('lime','blue','red','orange','neutral')),size text not null check(size in ('small','medium','large')),show_label boolean not null default false,
 status text not null check(status in ('existing','proposed','planned','research_note')),
 linked_property_id uuid,linked_research_area_id uuid,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz,
 unique(workspace_id,id),
 foreign key(workspace_id,linked_property_id) references public.land_parcels(workspace_id,id),
 foreign key(workspace_id,linked_research_area_id) references public.spatial_layers(workspace_id,id)
);
create index workspace_markers_list on public.workspace_markers(workspace_id,id) where deleted_at is null;
create index workspace_markers_property on public.workspace_markers(workspace_id,linked_property_id) where deleted_at is null;
create index workspace_markers_research on public.workspace_markers(workspace_id,linked_research_area_id) where deleted_at is null;
alter table public.workspace_markers enable row level security;
revoke all on public.workspace_markers from public,anon,authenticated;
grant select,insert,update on public.workspace_markers to authenticated;
grant all on public.workspace_markers to service_role;
create policy marker_read on public.workspace_markers for select to authenticated using(private.has_workspace_role(workspace_id,array['owner','admin','editor','viewer']));
create policy marker_create on public.workspace_markers for insert to authenticated with check(created_by=(select auth.uid()) and private.has_workspace_role(workspace_id,array['owner','admin','editor']));
create policy marker_update on public.workspace_markers for update to authenticated using(private.has_workspace_role(workspace_id,array['owner','admin','editor'])) with check(private.has_workspace_role(workspace_id,array['owner','admin','editor']));
create function private.guard_workspace_marker() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if new.id<>old.id or new.workspace_id<>old.workspace_id or new.created_by<>old.created_by or new.created_at<>old.created_at then raise exception 'Marker identity and ownership are immutable';end if;
 end if;
 if new.linked_research_area_id is not null and not exists(select 1 from public.spatial_layers l where l.id=new.linked_research_area_id and l.workspace_id=new.workspace_id and l.layer_kind='research_area') then raise exception 'Research Area unavailable in this Workspace';end if;
 new.updated_at=clock_timestamp();return new;
end $$;
revoke all on function private.guard_workspace_marker() from public,anon,authenticated;
create trigger workspace_marker_guard before insert or update on public.workspace_markers for each row execute function private.guard_workspace_marker();
