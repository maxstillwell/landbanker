begin;
insert into auth.users(id,raw_user_meta_data) values('11111111-1111-4111-8111-111111111111','{"display_name":"Alice","role":"owner"}'),('22222222-2222-4222-8222-222222222222','{"display_name":"Bob","role":"owner"}');
select set_config('test.alice',(select id::text from public.workspaces where personal_owner_id='11111111-1111-4111-8111-111111111111'),true);
select set_config('test.bob',(select id::text from public.workspaces where personal_owner_id='22222222-2222-4222-8222-222222222222'),true);
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$begin if (select count(*) from public.workspaces)<>1 or (select count(*) from public.workspace_memberships)<>1 or (select count(*) from public.profiles)<>1 then raise exception 'bootstrap/isolation failed';end if;end$$;
insert into public.land_parcels(id,workspace_id,title) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',current_setting('test.alice')::uuid,'Alice');
insert into public.field_observations(id,workspace_id,title,latitude,longitude,linked_parcel_id) values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',current_setting('test.alice')::uuid,'Visit',-37,144,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.field_observation_media(id,workspace_id,observation_id,mime_type,original_filename,size_bytes,storage_path) values('cccccccc-cccc-4ccc-8ccc-cccccccccccc',current_setting('test.alice')::uuid,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','image/png','test.png',40,current_setting('test.alice')||'/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/cccccccc-cccc-4ccc-8ccc-cccccccccccc.png');
insert into storage.objects(bucket_id,name) select 'field-media',storage_path from public.field_observation_media;
insert into public.spatial_layers(workspace_id,name) values(current_setting('test.alice')::uuid,'Layer');
insert into public.saved_views(workspace_id,name,view) values(current_setting('test.alice')::uuid,'View','{}');
insert into public.share_links(workspace_id,token_hash,resource_type,expires_at) values(current_setting('test.alice')::uuid,repeat('a',64),'parcel',now()+interval '1 day');
do $$declare failed boolean;begin
 failed:=false;begin update public.share_links set resource_ids=array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid];exception when insufficient_privilege then failed:=true;end;if not failed then raise exception 'share scope mutable';end if;
 failed:=false;begin update public.share_links set token_hash=repeat('b',64);exception when insufficient_privilege then failed:=true;end;if not failed then raise exception 'share token mutable';end if;
 update public.share_links set revoked_at=now();
 if not exists(select 1 from public.share_links where revoked_at is not null) then raise exception 'share revoke failed';end if;
end$$;
reset role;
do $$declare failed boolean;begin
 failed:=false;begin update public.land_parcels set workspace_id=current_setting('test.bob')::uuid where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';exception when raise_exception then if sqlerrm='workspace_id is immutable' then failed:=true;else raise;end if;end;
 if not failed then raise exception 'workspace mutable';end if;
end$$;
set local role authenticated;
insert into public.active_map_layers(workspace_id,user_id,catalog_id) values(current_setting('test.alice')::uuid,'11111111-1111-4111-8111-111111111111','vic-zoning');
select public.save_layer_features(current_setting('test.alice')::uuid,'dddddddd-dddd-4ddd-8ddd-dddddddddddd','Drawing','{"type":"FeatureCollection","features":[{"type":"Feature","id":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","properties":{"name":"Public drawing","note":"PRIVATE NOTE"},"geometry":{"type":"Point","coordinates":[144,-37],"secret":"PRIVATE GEOMETRY"}}]}');
do $$begin if (select count(*) from public.spatial_features)<>1 then raise exception 'feature persistence';end if;end$$;
insert into public.share_links(workspace_id,token_hash,resource_type,resource_ids,expires_at,manifest) values
(current_setting('test.alice')::uuid,encode(sha256(convert_to(repeat('Q',43),'UTF8')),'hex'),'saved_view',array['ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid],now()+interval '1 day',jsonb_build_object('name','Explicit test view','latitude',-37,'longitude',144,'zoom',12,'parcel_ids',jsonb_build_array('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'layer_ids',jsonb_build_array('dddddddd-dddd-4ddd-8ddd-dddddddddddd'),'official_layers','[]'::jsonb,'feature_ids',jsonb_build_object('dddddddd-dddd-4ddd-8ddd-dddddddddddd',jsonb_build_array('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'))));
update public.spatial_layers set geojson=jsonb_set(geojson,'{features}',(geojson->'features')||'{"type":"Feature","id":"99999999-9999-4999-8999-999999999999","properties":{"name":"Future unshared feature"},"geometry":{"type":"Point","coordinates":[145,-38]}}'::jsonb) where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$declare failed boolean;begin
 if (select count(*) from public.land_parcels)<>0 or (select count(*) from public.field_observations)<>0 or (select count(*) from public.field_observation_media)<>0 or (select count(*) from public.spatial_layers)<>0 or (select count(*) from public.saved_views)<>0 or (select count(*) from public.share_links)<>0 or (select count(*) from storage.objects)<>0 then raise exception 'cross tenant read leak';end if;
 failed:=false;begin insert into public.land_parcels(workspace_id,title) values(current_setting('test.alice')::uuid,'Attack');exception when insufficient_privilege then failed:=true;end;if not failed then raise exception 'cross tenant insert';end if;
 failed:=false;begin insert into public.field_observations(workspace_id,title,latitude,longitude,linked_parcel_id) values(current_setting('test.bob')::uuid,'Bad link',0,0,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');exception when foreign_key_violation then failed:=true;end;if not failed then raise exception 'cross workspace FK';end if;
 failed:=false;begin insert into public.workspace_memberships values(current_setting('test.alice')::uuid,'22222222-2222-4222-8222-222222222222','owner','active',now());exception when insufficient_privilege then failed:=true;end;if not failed then raise exception 'role escalation';end if;
 failed:=false;begin insert into storage.objects(bucket_id,name) values('field-media',current_setting('test.alice')||'/attack.png');exception when insufficient_privilege then failed:=true;end;if not failed then raise exception 'storage leak';end if;
end$$;
do $$declare failed boolean:=false;begin
 if (select count(*) from public.spatial_features)<>0 then raise exception 'feature isolation';end if;
 if (select count(*) from public.active_map_layers)<>0 then raise exception 'preference isolation';end if;
 begin perform public.save_layer_features(current_setting('test.alice')::uuid,'dddddddd-dddd-4ddd-8ddd-dddddddddddd','Attack','{"type":"FeatureCollection","features":[]}');exception when insufficient_privilege then failed:=true;end;
 if not failed then raise exception 'cross tenant RPC';end if;
end$$;
reset role;
insert into public.workspace_memberships(workspace_id,user_id,role) values(current_setting('test.alice')::uuid,'22222222-2222-4222-8222-222222222222','viewer');
set local role authenticated;
do $$declare failed boolean;begin
 if (select count(*) from public.land_parcels)<>1 then raise exception 'viewer read failed';end if;
 failed:=false;begin insert into public.land_parcels(workspace_id,title) values(current_setting('test.alice')::uuid,'Viewer');exception when insufficient_privilege then failed:=true;end;if not failed then raise exception 'viewer write';end if;
 if (select count(*) from public.share_links)<>0 then raise exception 'viewer share leak';end if;
end$$;
reset role;
update public.workspace_memberships set status='suspended' where user_id='22222222-2222-4222-8222-222222222222' and workspace_id=current_setting('test.alice')::uuid;
set local role authenticated;
do $$begin if (select count(*) from public.land_parcels)<>0 then raise exception 'suspended read';end if;end$$;
reset role;
insert into private.share_gateway_credentials(id,secret_hash) values(
 true,encode(sha256(convert_to(repeat('G',43),'UTF8')),'hex')
);
set local role anon;
do $$declare failed boolean;begin failed:=false;begin perform * from public.land_parcels;exception when insufficient_privilege then failed:=true;end;if not failed then raise exception 'anonymous leak';end if;end$$;
do $$declare result jsonb; blocked boolean:=false;begin
 result:=public.landos_share_gateway(repeat('Q',43),repeat('G',43),repeat('1',64));
 if result->>'status'<>'active' or result->'projection'->>'type'<>'view' then raise exception 'gateway projection';end if;
 begin perform public.landos_share_gateway(repeat('Q',43),repeat('X',43),repeat('1',64));exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'gateway secret bypass';end if;
 blocked:=false;
 begin perform * from private.share_rate_buckets;exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'gateway bucket table exposed';end if;
end$$;
do $$declare projection jsonb; result jsonb;begin
 result:=public.landos_share_gateway(repeat('Q',43),repeat('G',43),repeat('2',64));
 projection:=result->'projection';
 if projection is null or projection->>'type'<>'view' or jsonb_array_length(projection->'resources')<>2 then raise exception 'explicit projection';end if;
 if projection::text like '%PRIVATE%' or projection::text like '%Future unshared%' then raise exception 'share projection leak';end if;
 if (public.landos_share_gateway(repeat('Z',43),repeat('G',43),repeat('2',64))->>'projection') is not null or (public.landos_share_gateway(encode(sha256(convert_to(repeat('Q',43),'UTF8')),'hex'),repeat('G',43),repeat('2',64))->>'projection') is not null then raise exception 'invalid token/hash credential';end if;
end$$;
do $$declare blocked boolean:=false;begin
 begin perform public.resolve_landos_share(repeat('Q',43));exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'direct share projection still public';end if;
 blocked:=false;
 begin perform public.landos_share_status(repeat('Q',43));exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'direct share status still public';end if;
end$$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
update public.share_links set revoked_at=now() where token_hash=encode(sha256(convert_to(repeat('Q',43),'UTF8')),'hex');
set local role anon;
do $$declare result jsonb;begin result:=public.landos_share_gateway(repeat('Q',43),repeat('G',43),repeat('3',64));if result->>'status'<>'unavailable' or result->>'projection' is not null then raise exception 'revoked token';end if;end$$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
insert into public.share_links(workspace_id,token_hash,resource_type,resource_ids,expires_at) values
(current_setting('test.alice')::uuid,encode(sha256(convert_to(repeat('E',43),'UTF8')),'hex'),'parcel',array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid],now()-interval '1 day');
do $$begin
 if (select count(*) from public.landos_viewport_candidates(current_setting('test.alice')::uuid,'features',array[143.0,-38.0,145.0,-36.0]))<>1 then raise exception 'viewport positive'; end if;
end$$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$begin
 if (select count(*) from public.landos_viewport_candidates(current_setting('test.alice')::uuid,'features',array[143.0,-38.0,145.0,-36.0]))<>0 then raise exception 'viewport suspended leak'; end if;
end$$;
set local role anon;
do $$declare blocked boolean:=false;begin
 begin perform * from public.landos_viewport_candidates(current_setting('test.alice')::uuid,'features',array[143.0,-38.0,145.0,-36.0]); exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'viewport anon execution';end if;
 if (public.landos_share_gateway(repeat('E',43),repeat('G',43),repeat('4',64))->>'status')<>'expired' then raise exception 'expired status';end if;
 if (public.landos_share_gateway(repeat('Q',43),repeat('G',43),repeat('4',64))->>'status')<>'unavailable' or (public.landos_share_gateway(repeat('Z',43),repeat('G',43),repeat('4',64))->>'status')<>'unavailable' then raise exception 'revoked/unknown status';end if;
end$$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$declare w uuid:=current_setting('test.alice')::uuid; start_revision bigint; first jsonb; second jsonb; watermark bigint; blocked boolean:=false;begin
 start_revision:=(public.landos_workspace_changes(w)->>'cursor')::bigint;
 insert into public.land_parcels(id,workspace_id,title) values('abababab-abab-4bab-8bab-abababababab',w,'Sync create');
 update public.land_parcels set title='Sync update' where id='abababab-abab-4bab-8bab-abababababab';
 delete from public.land_parcels where id='abababab-abab-4bab-8bab-abababababab';
 first:=public.landos_workspace_changes(w,start_revision,null,2);watermark:=(first->>'watermark')::bigint;
 if jsonb_array_length(first->'events')<>2 or not (first->>'has_more')::boolean then raise exception 'sync stable page';end if;
 second:=public.landos_workspace_changes(w,(first->>'cursor')::bigint,watermark,2);
 if jsonb_array_length(second->'events')<>1 or second->'events'->0->>'operation'<>'delete' or (second->>'has_more')::boolean then raise exception 'sync deletion or watermark';end if;
 begin insert into public.workspace_changes(workspace_id,revision,kind,object_id,operation) values(w,999,'parcels','abababab-abab-4bab-8bab-abababababab','delete');exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'client can forge change log';end if;
end$$;
do $$declare w uuid:=current_setting('test.alice')::uuid; o uuid; m uuid; head bigint; changes jsonb;begin
 select id into o from public.field_observations where workspace_id=w limit 1;
 insert into public.field_observation_media(workspace_id,observation_id,mime_type,original_filename,size_bytes,upload_status) values(w,o,'image/jpeg','synthetic.jpg',1,'pending') returning id into m;
 head:=(public.landos_workspace_changes(w)->>'cursor')::bigint;
 delete from public.field_observation_media where id=m;
 changes:=public.landos_workspace_changes(w,head);
 if changes->'events'->0->>'kind'<>'observations' or changes->'events'->0->>'id'<>o::text or changes->'events'->0->>'operation'<>'upsert' then raise exception 'media deletion removed parent';end if;
 if not exists(select 1 from public.field_observations where id=o) then raise exception 'parent lost';end if;
end$$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$declare blocked boolean:=false;begin
 begin perform public.landos_workspace_changes(current_setting('test.alice')::uuid);exception when raise_exception then if sqlerrm='Workspace access denied' then blocked:=true;else raise;end if;end;
 if not blocked or exists(select 1 from public.workspace_changes where workspace_id=current_setting('test.alice')::uuid) then raise exception 'nonmember change leak';end if;
end$$;
set local role anon;
do $$declare blocked boolean:=false;begin
 begin perform public.landos_workspace_changes(current_setting('test.alice')::uuid);exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'anon change feed execution';end if;
end$$;
reset role;
select 'RLS signup, isolation, viewer, suspended, anonymous, FK, storage escalation, immutable workspace/share scope and revoke tests passed' as result;
rollback;
