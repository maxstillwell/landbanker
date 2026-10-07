-- No workspace identifiers or resource metadata are exposed by this token-only status path.
create function public.landos_share_status(p_token text) returns text
language plpgsql stable security definer set search_path='' as $$
declare link public.share_links%rowtype;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then return 'unavailable'; end if;
  select * into link from public.share_links where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
  if not found or link.revoked_at is not null then return 'unavailable'; end if;
  if link.expires_at<=now() then return 'expired'; end if;
  return 'active';
end;
$$;
revoke all on function public.landos_share_status(text) from public;
grant execute on function public.landos_share_status(text) to anon,authenticated;
