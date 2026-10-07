-- Bound fixed-window bucket storage without a separate scheduler. The expiry
-- index makes the no-row case cheap and deletion remains inside the database.
create or replace function private.consume_share_budget(
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
  delete from private.share_rate_buckets
    where expires_at<clock_timestamp()-interval '10 minutes';
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
