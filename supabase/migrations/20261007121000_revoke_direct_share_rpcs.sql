-- The server gateway is deployed and accepted before this migration is
-- applied. Keep the functions for internal gateway composition but remove the
-- original browser-callable token-only perimeter.
revoke execute on function public.resolve_landos_share(text)
  from anon,authenticated;
revoke execute on function public.landos_share_status(text)
  from anon,authenticated;

comment on function public.resolve_landos_share(text) is
  'Internal frozen share projection. Public callers must use the LandOS server gateway.';
comment on function public.landos_share_status(text) is
  'Internal share status lookup. Public callers must use the LandOS server gateway.';
