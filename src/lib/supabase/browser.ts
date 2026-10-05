import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "../config";
import { timeoutFetch } from "../network";
export function browserClient() {
  const { url, key } = supabaseConfig();
  return createBrowserClient(url, key, {
    global: { fetch: (input, init) => timeoutFetch(input, init, 120000) },
  });
}
