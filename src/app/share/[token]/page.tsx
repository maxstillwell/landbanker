import SharedMap from "@/components/shared-map-loader";
import { notFound } from "next/navigation";
import { resolveShare } from "@/lib/share-resolver";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Shared land intelligence · LandOS",
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
    <main className="shared-page">
      <header>
        <strong>LandOS</strong>
        <span>Read-only shared view</span>
      </header>
      <h1>{share.view?.name || "Shared land intelligence"}</h1>
      <SharedMap share={share} />
      <p>
        Only explicitly shared objects are visible. Private observations, photos
        and notes are excluded.
      </p>
      <ul>
        {share.resources.map((resource) => (
          <li key={resource.id}>
            {resource.title || resource.name || "Shared property"}
          </li>
        ))}
      </ul>
    </main>
  );
}
