import { MarketingSite } from "@/components/marketing/site";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MarketingSite>{children}</MarketingSite>;
}
