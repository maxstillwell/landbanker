import { randomBytes, createHmac } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
const existingApp = await readFile(".env.local", "utf8").catch(() => null);
if (existingApp !== null)
  throw new Error(
    "Refusing to overwrite .env.local. Preserve any cloud credentials and use a separate local checkout.",
  );
const existingLocal = await readFile("infra/local/.env", "utf8").catch(
  () => "",
);
const secret =
  existingLocal.match(/^JWT_SECRET=(.+)$/m)?.[1] ||
  randomBytes(32).toString("hex");
const encode = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");
function key(role) {
  const message =
    encode({ alg: "HS256", typ: "JWT" }) +
    "." +
    encode({
      role,
      iss: "supabase",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400 * 7,
    });
  return (
    message +
    "." +
    createHmac("sha256", secret).update(message).digest("base64url")
  );
}
const anon = key("anon"),
  service = key("service_role");
await writeFile(
  "infra/local/.env",
  `JWT_SECRET=${secret}\nANON_KEY=${anon}\nSERVICE_KEY=${service}\n`,
  { mode: 0o600 },
);
await writeFile(
  ".env.local",
  `NEXT_PUBLIC_APP_URL=http://localhost:3000\nLAND_BANKER_APP_URL=http://localhost:3000\nNEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${anon}\nLAND_BANKER_SUPABASE_SECRET_KEY=${service}\n`,
  { mode: 0o600 },
);
console.log(
  "Independent LOCAL credentials written to ignored files. Never use this compose environment for production.",
);
