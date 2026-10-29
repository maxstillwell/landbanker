begin;
insert into auth.users(id,raw_user_meta_data) values('77111111-1111-4111-8111-111111111111','{}'),('77222222-2222-4222-8222-222222222222','{}');
select set_config('test.a',(select id::text from public.workspaces where personal_owner_id='77111111-1111-4111-8111-111111111111'),true);
select set_config('test.b',(select id::text from public.workspaces where personal_owner_id='77222222-2222-4222-8222-222222222222'),true);
set local role authenticated;
select set_config('request.jwt.claim.sub','77111111-1111-4111-8111-111111111111',true);
insert into public.land_parcels(id,workspace_id,title) values('77333333-3333-4333-8333-333333333333',current_setting('test.a')::uuid,'Test property');
select public.save_spatial_import(current_setting('test.a')::uuid,'77444444-4444-4444-8444-444444444444','Research','{"type":"FeatureCollection","features":[]}','research_area','{"landos_import_fingerprint":"release-test"}');
insert into public.research_property_links values(current_setting('test.a')::uuid,'77444444-4444-4444-8444-444444444444','77333333-3333-4333-8333-333333333333');
insert into public.field_observations(workspace_id,title,latitude,longitude,linked_research_area_id) values(current_setting('test.a')::uuid,'Research visit',-37,144,'77444444-4444-4444-8444-444444444444');
do $$begin
 begin
 perform public.save_spatial_import(current_setting('test.a')::uuid,'77555555-5555-4555-8555-555555555555','Duplicate','{"type":"FeatureCollection","features":[]}','research_area','{"landos_import_fingerprint":"release-test"}');
 raise exception 'Duplicate accepted'; exception when unique_violation then null; end;
 if exists(select 1 from public.spatial_layers where id='77555555-5555-4555-8555-555555555555') then raise exception 'Non-atomic import'; end if;
end$$;
select set_config('request.jwt.claim.sub','77222222-2222-4222-8222-222222222222',true);
do $$begin
 if exists(select 1 from public.research_property_links where workspace_id=current_setting('test.a')::uuid) then raise exception 'Cross-workspace read'; end if;
 begin insert into public.research_property_links values(current_setting('test.b')::uuid,'77444444-4444-4444-8444-444444444444','77333333-3333-4333-8333-333333333333'); raise exception 'Cross-workspace write'; exception when insufficient_privilege or foreign_key_violation then null; end;
 begin insert into public.field_observations(workspace_id,title,latitude,longitude,linked_research_area_id) values(current_setting('test.b')::uuid,'Invalid',-37,144,'77444444-4444-4444-8444-444444444444'); raise exception 'Cross-workspace observation'; exception when foreign_key_violation then null; end;
end$$;
rollback;
