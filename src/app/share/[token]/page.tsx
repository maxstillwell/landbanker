import { notFound } from "next/navigation";
import { resolveShare } from "@/lib/share-resolver";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Shared land intelligence · Land Banker",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const share = await resolveShare(token);
  if (!share) notFound();
  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">LAND BANKER · READ ONLY</p>
        <h1>Shared intelligence.</h1>
        <p>
          Only explicitly selected records are included. Private notes and
          contact information are excluded.
        </p>
        <pre>{JSON.stringify(share.resources, null, 2)}</pre>
      </section>
    </main>
  );
}
