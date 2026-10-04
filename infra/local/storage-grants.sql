-- Managed Supabase supplies these schema grants. Standalone Storage needs them locally.
grant usage on schema storage to authenticated, anon, service_role;
grant select,insert,update,delete on storage.objects to authenticated;
grant select on storage.buckets to authenticated;
grant all on all tables in schema storage to service_role;
grant all on all tables in schema public to service_role;
