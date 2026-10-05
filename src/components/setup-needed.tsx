import Link from "next/link";
export function SetupNeeded() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">LandOS</p>
        <h1>Independent by design.</h1>
        <p>
          The new backend is awaiting setup. LandOS will never fall back to
          the MaxQI database.
        </p>
        <Link className="primary" href="/">
          Back home
        </Link>
      </section>
    </main>
  );
}
