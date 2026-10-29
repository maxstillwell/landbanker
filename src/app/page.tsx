import { HomePage } from "@/components/marketing/home";
import { MarketingSite } from "@/components/marketing/site";
import { pageMetadata } from "@/components/marketing/seo";

export const metadata = pageMetadata(
  "/",
  "Australian Land Intelligence Platform",
  "Your land. Your research. Your intelligence. Bring Properties, Research Areas and spatial Layers together in your own LandOS workspace.",
);

export default function Home() {
  return (
    <MarketingSite>
      <HomePage />
    </MarketingSite>
  );
}
