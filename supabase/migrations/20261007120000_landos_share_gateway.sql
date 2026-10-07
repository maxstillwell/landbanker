-- Server-controlled public share gateway. The Vercel server uses the public
-- Supabase credential plus a separate high-entropy capability whose hash is
-- stored here. Raw caller addresses and gateway secrets are never persisted.
create table private.share_gateway_credentials (
  id boolean primary key default true check (id),
  secret_hash text not null check (secret_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  rotated_at timestamptz not null default now(),
  disabled_at timestamptz
);

create table private.share_rate_buckets (
  scope text not null check (scope in ('caller','token')),
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  expires_at timestamptz not null,
  primary key (scope,key_hash,window_started_at)
);
create index share_rate_buckets_expiry_idx
  on private.share_rate_buckets(expires_at);

revoke all on table private.share_gateway_credentials from public,anon,authenticated;
revoke all on table private.share_rate_buckets from public,anon,authenticated;

create function private.consume_share_budget(
  p_scope text,
  p_key_hash text,
  p_limit integer
) returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare
  started timestamptz:=date_trunc('minute',clock_timestamp());
  consumed integer;
begin
  if p_scope not in ('caller','token') or p_key_hash !~ '^[0-9a-f]{64}$'
     or p_limit<1 then
    return false;
  end if;
  insert into private.share_rate_buckets(
    scope,key_hash,window_started_at,request_count,expires_at
  ) values(p_scope,p_key_hash,started,1,started+interval '2 minutes')
  on conflict(scope,key_hash,window_started_at) do update
    set request_count=private.share_rate_buckets.request_count+1
    where private.share_rate_buckets.request_count<p_limit
  returning request_count into consumed;
  return consumed is not null;
end;
$$;
revoke all on function private.consume_share_budget(text,text,integer)
  from public,anon,authenticated;

create function public.landos_share_gateway(
  p_token text,
  p_gateway_secret text,
  p_caller_hash text
) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare
  projection jsonb;
  share_status text;
  token_key text;
begin
  if p_gateway_secret is null or length(p_gateway_secret)<32 or not exists(
    select 1 from private.share_gateway_credentials
    where id and disabled_at is null
      and secret_hash=encode(sha256(convert_to(p_gateway_secret,'UTF8')),'hex')
  ) then
    raise exception 'Share gateway denied' using errcode='42501';
  end if;
  if p_caller_hash is null or p_caller_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid caller key' using errcode='22023';
  end if;
  if not private.consume_share_budget('caller',p_caller_hash,120) then
    raise exception 'Share rate limited' using errcode='P0001';
  end if;
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then
    return jsonb_build_object('status','unavailable','projection',null);
  end if;
  token_key:=encode(sha256(convert_to(p_token,'UTF8')),'hex');
  if not private.consume_share_budget('token',token_key,60) then
    raise exception 'Share rate limited' using errcode='P0001';
  end if;
  projection:=public.resolve_landos_share(p_token);
  if projection is not null then
    return jsonb_build_object('status','active','projection',projection);
  end if;
  share_status:=public.landos_share_status(p_token);
  return jsonb_build_object(
    'status',case when share_status='expired' then 'expired' else 'unavailable' end,
    'projection',null
  );
end;
$$;
revoke all on function public.landos_share_gateway(text,text,text) from public;
grant execute on function public.landos_share_gateway(text,text,text) to anon;

comment on function public.landos_share_gateway(text,text,text) is
  'Server-only capability gateway for a minimal frozen share projection with distributed Postgres budgets.';
