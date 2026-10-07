-- Commit-ordered, per-Workspace insert/update/delete invalidation. LandOS only.
begin;
create table public.workspace_sync_state (
 workspace_id uuid primary key references public.workspaces(id) on delete cascade,
 revision bigint not null default 0 check(revision>=0)
);
create table public.workspace_changes (
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 revision bigint not null, kind text not null check(kind in ('parcels','observations','features','layers')),
 object_id uuid not null, operation text not null check(operation in ('upsert','delete')),
 recorded_at timestamptz not null default now(), primary key(workspace_id,revision)
);
alter table public.workspace_sync_state enable row level security;
alter table public.workspace_changes enable row level security;
revoke all on public.workspace_sync_state,public.workspace_changes from public,anon,authenticated;
grant select on public.workspace_sync_state,public.workspace_changes to authenticated;
grant all on public.workspace_sync_state,public.workspace_changes to service_role;
create policy sync_state_read on public.workspace_sync_state for select to authenticated
 using(private.has_workspace_role(workspace_id,array['owner','admin','editor','viewer']));
create policy changes_read on public.workspace_changes for select to authenticated
 using(private.has_workspace_role(workspace_id,array['owner','admin','editor','viewer']));
create function private.record_workspace_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare w uuid; object uuid; next_revision bigint;
begin
 if tg_op='UPDATE' and (to_jsonb(new)-'updated_at')=(to_jsonb(old)-'updated_at') then return new; end if;
 if tg_op='DELETE' then w:=old.workspace_id; object:=old.id; else w:=new.workspace_id; object:=new.id; end if;
 if tg_argv[1]='observation_id' then if tg_op='DELETE' then object:=old.observation_id;else object:=new.observation_id;end if;end if;
 if auth.uid() is not null and not private.has_workspace_role(w,array['owner','admin','editor']) then raise exception 'Workspace change not authorized'; end if;
 insert into public.workspace_sync_state(workspace_id) values(w) on conflict do nothing;
 -- Row lock is held until transaction end. Revision allocation therefore serializes
 -- same-Workspace writes in commit order, unlike a global sequence/timestamp.
 update public.workspace_sync_state set revision=revision+1 where workspace_id=w returning revision into next_revision;
 insert into public.workspace_changes(workspace_id,revision,kind,object_id,operation)
 values(w,next_revision,tg_argv[0],object,case when tg_op='DELETE' then 'delete' else 'upsert' end);
 if tg_op='DELETE' then return old; else return new; end if;
end;$$;
revoke all on function private.record_workspace_change() from public,anon,authenticated;
create trigger record_parcel_change after insert or update or delete on public.land_parcels for each row execute function private.record_workspace_change('parcels');
create trigger record_observation_change after insert or update or delete on public.field_observations for each row execute function private.record_workspace_change('observations');
create trigger record_media_change after insert or update or delete on public.field_observation_media for each row execute function private.record_workspace_change('observations','observation_id');
create trigger record_feature_change after insert or update or delete on public.spatial_features for each row execute function private.record_workspace_change('features');
create trigger record_layer_change after insert or update or delete on public.spatial_layers for each row execute function private.record_workspace_change('layers');
create function public.landos_workspace_changes(p_workspace uuid,p_after bigint default null,p_until bigint default null,p_limit integer default 100)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare head bigint; upper_bound bigint; last_revision bigint; events jsonb;
begin
 if not private.has_workspace_role(p_workspace,array['owner','admin','editor','viewer']) then raise exception 'Workspace access denied'; end if;
 if p_limit is null or p_limit<1 or p_limit>500 or p_after<0 or p_until<0 then raise exception 'Invalid sync cursor'; end if;
 select coalesce(s.revision,0) into head from public.workspace_sync_state s where s.workspace_id=p_workspace;
 head:=coalesce(head,0);
 if p_after is null then return jsonb_build_object('events','[]'::jsonb,'cursor',head::text,'watermark',head::text,'has_more',false);end if;
 upper_bound:=coalesce(p_until,head);
 if p_after>head or upper_bound>head or p_after>upper_bound then raise exception 'Invalid sync boundary';end if;
 select coalesce(jsonb_agg(jsonb_build_object('revision',c.revision::text,'kind',c.kind,'id',c.object_id,'operation',c.operation) order by c.revision),'[]'::jsonb),max(c.revision)
 into events,last_revision from (select revision,kind,object_id,operation from public.workspace_changes where workspace_id=p_workspace and revision>p_after and revision<=upper_bound order by revision limit p_limit) c;
 last_revision:=coalesce(last_revision,upper_bound);
 return jsonb_build_object('events',events,'cursor',last_revision::text,'watermark',upper_bound::text,'has_more',last_revision<upper_bound);
end;$$;
revoke all on function public.landos_workspace_changes(uuid,bigint,bigint,integer) from public,anon;
grant execute on function public.landos_workspace_changes(uuid,bigint,bigint,integer) to authenticated;
commit;
