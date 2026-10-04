import { randomBytes, createHash } from "node:crypto";
export function newShareToken() {
  return randomBytes(32).toString("base64url");
}
export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export function validShareToken(token: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}
export function activeShare(
  link: { expires_at: string; revoked_at: string | null },
  now = Date.now(),
) {
  return !link.revoked_at && Date.parse(link.expires_at) > now;
}
