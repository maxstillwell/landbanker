-- LandOS only. Media deletion invalidates the surviving Observation, never tombstones it.
begin;
create or replace function private.record_workspace_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare w uuid; object uuid; next_revision bigint;
begin
 if tg_op='UPDATE' and (to_jsonb(new)-'updated_at')=(to_jsonb(old)-'updated_at') then return new; end if;
 if tg_op='DELETE' then w:=old.workspace_id; object:=old.id; else w:=new.workspace_id; object:=new.id; end if;
 if tg_argv[1]='observation_id' then if tg_op='DELETE' then object:=old.observation_id;else object:=new.observation_id;end if;end if;
 -- A cascading Workspace deletion has no surviving consumer or parent log row.
 if not exists(select 1 from public.workspaces where id=w) then
  if tg_op='DELETE' then return old;else return new;end if;
 end if;
 if auth.uid() is not null and not private.has_workspace_role(w,array['owner','admin','editor']) then raise exception 'Workspace change not authorized'; end if;
 insert into public.workspace_sync_state(workspace_id) values(w) on conflict do nothing;
 -- Row lock is held until transaction end. Revision allocation therefore serializes
 -- same-Workspace writes in commit order, unlike a global sequence/timestamp.
 update public.workspace_sync_state set revision=revision+1 where workspace_id=w returning revision into next_revision;
 insert into public.workspace_changes(workspace_id,revision,kind,object_id,operation)
 values(w,next_revision,tg_argv[0],object,case when tg_op='DELETE' and tg_argv[1] is distinct from 'observation_id' then 'delete' else 'upsert' end);
 if tg_op='DELETE' then return old; else return new; end if;
end;$$;
revoke all on function private.record_workspace_change() from public,anon,authenticated;
commit;
