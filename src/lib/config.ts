const blocked = ["kcdzzbmkqtuwfzbeqcks", "xlrtlqhhzhmdhrmuoyot"];
export function assertIndependentBackend(url: string) {
  const parsed = new URL(url);
  if (blocked.some((ref) => parsed.hostname.includes(ref)))
    throw new Error(
      "LandOS must use its own Supabase project. Existing projects are blocked.",
    );
  if (!["https:", "http:"].includes(parsed.protocol))
    throw new Error("Invalid backend protocol");
  if (
    parsed.protocol === "http:" &&
    !["localhost", "127.0.0.1"].includes(parsed.hostname)
  )
    throw new Error("Backend requires HTTPS");
  return url;
}
export function configured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new Error("Independent LandOS backend is not configured.");
  assertIndependentBackend(url);
  if (key.startsWith("sb_secret_"))
    throw new Error("Secret keys cannot be used in the client");
  if (key.split(".").length === 3) {
    try {
      if (JSON.parse(atob(key.split(".")[1])).role !== "anon")
        throw new Error("Only an anon or publishable key is allowed");
    } catch {
      throw new Error("Invalid public credential");
    }
  }
  return { url, key };
}
export function appUrl() {
  const value =
    process.env.LAND_BANKER_APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (value) return new URL(value).origin;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
export function safeNext(value: string | null) {
  return value?.startsWith("/app") &&
    !value.startsWith("//") &&
    !value.includes("\\")
    ? value
    : "/app/map";
}
