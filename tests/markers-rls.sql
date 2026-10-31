begin;
insert into auth.users(id,raw_user_meta_data) values('88111111-1111-4111-8111-111111111111','{}'),('88222222-2222-4222-8222-222222222222','{}');
select set_config('test.ma',(select id::text from public.workspaces where personal_owner_id='88111111-1111-4111-8111-111111111111'),true);
select set_config('test.mb',(select id::text from public.workspaces where personal_owner_id='88222222-2222-4222-8222-222222222222'),true);
set local role authenticated;
select set_config('request.jwt.claim.sub','88111111-1111-4111-8111-111111111111',true);
insert into public.land_parcels(id,workspace_id,title) values('88333333-3333-4333-8333-333333333333',current_setting('test.ma')::uuid,'Property');
insert into public.workspace_markers(id,workspace_id,latitude,longitude,icon,name,color,size,status,linked_property_id) values('88444444-4444-4444-8444-444444444444',current_setting('test.ma')::uuid,-37,145,'school','Manual school','lime','medium','proposed','88333333-3333-4333-8333-333333333333');
update public.workspace_markers set deleted_at=now() where id='88444444-4444-4444-8444-444444444444';
update public.workspace_markers set deleted_at=null where id='88444444-4444-4444-8444-444444444444';
do $$begin
 begin update public.workspace_markers set created_by='88222222-2222-4222-8222-222222222222' where id='88444444-4444-4444-8444-444444444444';raise exception 'Ownership changed';exception when raise_exception then if sqlerrm<>'Marker identity and ownership are immutable' then raise;end if;end;
 if not exists(select 1 from public.workspace_markers where deleted_at is null) then raise exception 'Soft-delete restore failed';end if;
end$$;
select set_config('request.jwt.claim.sub','88222222-2222-4222-8222-222222222222',true);
do $$begin
 if exists(select 1 from public.workspace_markers where id='88444444-4444-4444-8444-444444444444') then raise exception 'Marker read leak';end if;
 begin insert into public.workspace_markers(id,workspace_id,latitude,longitude,icon,name,color,size,status) values(gen_random_uuid(),current_setting('test.ma')::uuid,0,0,'school','Bad','lime','medium','planned');raise exception 'Cross workspace insert';exception when insufficient_privilege then null;end;
 begin insert into public.workspace_markers(id,workspace_id,latitude,longitude,icon,name,color,size,status,linked_property_id) values(gen_random_uuid(),current_setting('test.mb')::uuid,0,0,'school','Bad link','lime','medium','planned','88333333-3333-4333-8333-333333333333');raise exception 'Cross workspace link';exception when foreign_key_violation then null;end;
 update public.workspace_markers set name='Attack' where id='88444444-4444-4444-8444-444444444444'; if found then raise exception 'Cross workspace update';end if;
end$$;
reset role;
update public.workspace_memberships set role='viewer' where workspace_id=current_setting('test.ma')::uuid and user_id='88111111-1111-4111-8111-111111111111';
set local role authenticated;
select set_config('request.jwt.claim.sub','88111111-1111-4111-8111-111111111111',true);
do $$begin
 if not exists(select 1 from public.workspace_markers where id='88444444-4444-4444-8444-444444444444') then raise exception 'Viewer cannot read';end if;
 update public.workspace_markers set name='Viewer edit' where id='88444444-4444-4444-8444-444444444444'; if found then raise exception 'Viewer can edit';end if;
end$$;
rollback;
