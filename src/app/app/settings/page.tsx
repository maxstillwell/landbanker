import Link from "next/link";
import { workspaceContext } from "@/lib/workspace";
import { SignOut } from "@/components/sign-out";
export default async function Settings() {
  const c = await workspaceContext();
  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">LandOS · SETTINGS</p>
        <h1>Your workspace.</h1>
        <p>{c.user.email}</p>
        <p>Role: {c.role}</p>
        <p className="mono">Workspace ID: {c.workspaceId}</p>
        <p>Your private data lives in the independent LandOS backend.</p>
        <Link href="/app/map">← Back to map</Link>
        <SignOut />
      </section>
    </main>
  );
}
