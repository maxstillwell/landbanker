import SharedMap from "@/components/shared-map-loader";
import { notFound } from "next/navigation";
import { resolveShare } from "@/lib/share-resolver";
import { ShareRateLimit } from "@/lib/share-budget";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Shared land view · LandOS",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let resolution;
  try {
    resolution = await resolveShare(token);
  } catch (e) {
    if (!(e instanceof ShareRateLimit)) throw e;
    return (
      <main className="shared-page">
        <h1>LandOS</h1>
        <p>{e.message}</p>
      </main>
    );
  }
  const { share, status } = resolution;
  if (!share) {
    if (status === "expired")
      return (
        <main className="shared-page">
          <h1>LandOS</h1>
          <p>This shared view has expired.</p>
        </main>
      );
    notFound();
  }
  return (
    <main className="shared-page">
      <header>
        <strong>LandOS</strong>
        <span>Shared land view</span>
      </header>
      <h1>{share.view?.name || "Shared land view"}</h1>
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
