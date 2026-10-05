import { supabaseConfig, appUrl } from "../src/lib/config";
const { url } = supabaseConfig();
console.log({
  appUrl: appUrl(),
  backendHost: new URL(url).hostname,
  independent: true,
  secretPresent: Boolean(process.env.LAND_BANKER_SUPABASE_SECRET_KEY),
});
