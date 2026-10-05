-- Independent LandOS only. Additive; existing legacy records remain valid.
begin;
alter table public.land_parcels
 add column address text,
 add column state text check (state in ('VIC','NSW')),
 add column source text,
 add column source_parcel_id text,
 add column source_updated_at timestamptz,
 add column saved_at timestamptz not null default now();
create unique index parcel_workspace_source_identity on public.land_parcels(workspace_id,source,source_parcel_id);
alter table public.field_observations add column observed_at_source text not null default 'device' check(observed_at_source in ('device','user','photo','legacy'));
commit;
