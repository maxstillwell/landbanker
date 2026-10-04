"use client";
/* eslint-disable @next/next/no-location-assign-relative-destination -- Full navigation discards private authenticated route cache on logout. */
import { browserClient } from "@/lib/supabase/browser";
export function SignOut() {
  return (
    <button
      onClick={async () => {
        const { error } = await browserClient().auth.signOut();
        if (!error) location.assign("/login");
        else alert(error.message);
      }}
    >
      Sign out
    </button>
  );
}
