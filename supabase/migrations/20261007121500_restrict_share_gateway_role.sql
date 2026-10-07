-- Supabase may retain an authenticated function grant through hosted default
-- privileges. The server uses a sessionless publishable client (anon role), so
-- signed-in browsers do not need direct gateway execution.
revoke execute on function public.landos_share_gateway(text,text,text)
  from authenticated;
