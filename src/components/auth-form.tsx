"use client";
/* eslint-disable @next/next/no-location-assign-relative-destination -- Full navigation clears cached private RSC responses when authentication changes. */
import Link from "next/link";
import { useState } from "react";
import { browserClient } from "@/lib/supabase/browser";
export function AuthForm({
  mode,
  enabled,
}: {
  mode: "login" | "signup" | "forgot-password" | "reset-password";
  enabled: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const titles = {
    login: "Welcome back.",
    signup: "Your workspace starts here.",
    "forgot-password": "Reset your password.",
    "reset-password": "Choose a new password.",
  };
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");
    try {
      const client = browserClient();
      if (mode === "signup") {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: String(form.get("name") || "") },
            emailRedirectTo: `${location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        if (data.session) location.assign("/app/map");
        else
          setMessage(
            "Check your email to confirm your account. Your personal workspace is ready.",
          );
      }
      if (mode === "login") {
        const { error } = await client.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        location.assign("/app/map");
      }
      if (mode === "forgot-password") {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${location.origin}/auth/callback?next=/app/reset-password`,
        });
        if (error) throw error;
        setMessage(
          "If an account exists, a recovery email will arrive shortly.",
        );
      }
      if (mode === "reset-password") {
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        location.assign("/app/map");
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <Link className="wordmark" href="/">
        LandOS
      </Link>
      <section className="auth-card">
        <p className="eyebrow">YOUR PRIVATE FIELD WORKSPACE</p>
        <h1>{titles[mode]}</h1>
        {!enabled ? (
          <p role="status" className="notice">
            The independent LandOS backend is awaiting infrastructure setup.
            Account creation will open once it is connected.
          </p>
        ) : null}
        <form onSubmit={submit}>
          {mode === "signup" ? (
            <label>
              Your name
              <input name="name" maxLength={80} autoComplete="name" required />
            </label>
          ) : null}
          {mode !== "reset-password" ? (
            <label>
              Email
              <input name="email" type="email" autoComplete="email" required />
            </label>
          ) : null}
          {mode !== "forgot-password" ? (
            <label>
              Password
              <input
                name="password"
                type="password"
                minLength={10}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
              />
            </label>
          ) : null}
          <button className="primary" disabled={busy || !enabled}>
            {busy
              ? "Please wait…"
              : mode === "login"
                ? "Sign in"
                : mode === "signup"
                  ? "Create account"
                  : mode === "forgot-password"
                    ? "Send recovery email"
                    : "Save password"}
          </button>
        </form>
        {message ? (
          <p role="status" className="notice">
            {message}
          </p>
        ) : null}
        <nav>
          {mode === "login" ? (
            <>
              <Link href="/forgot-password">Forgot password?</Link>
              <Link href="/signup">Create account ↗</Link>
            </>
          ) : (
            <Link href="/login">Back to sign in</Link>
          )}
        </nav>
      </section>
    </main>
  );
}
