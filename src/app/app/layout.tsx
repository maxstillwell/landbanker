import { redirect } from "next/navigation";
import { configured } from "@/lib/config";
import { serverClient } from "@/lib/supabase/server";
import { SetupNeeded } from "@/components/setup-needed";
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!configured()) return <SetupNeeded />;
  const client = await serverClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect("/login");
  return children;
}
