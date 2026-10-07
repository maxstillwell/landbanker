"use client";
import { useEffect } from "react";
import Link from "next/link";
import { reportClientFailure } from "@/lib/client-failure";
export default function WorkspaceError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    reportClientFailure("frontend_fatal");
  }, [error]);
  return (
    <main className="auth-page">
      <h1>LandOS</h1>
      <p role="alert">The workspace could not be displayed.</p>
      <button onClick={() => retry()}>Try again</button>
      <Link href="/app/map">Return to map</Link>
    </main>
  );
}
