import Link from "next/link";
import { BrandLockup } from "@/components/brand-lockup";
export default function Home() {
  return (
    <main className="landing">
      <BrandLockup tagline="MAP · ANALYSE · MANAGE LAND" />
      <div className="landing-copy">
        <p className="eyebrow">GROUND YOUR NEXT MOVE</p>
        <h1>
          The operating system
          <br />
          for land.
        </h1>
        <p>
          Your parcels, observations and spatial layers.
          <br />
          One private workspace, on every screen.
        </p>
        <div className="actions">
          <Link className="primary" href="/signup">
            Create your workspace ↗
          </Link>
          <Link className="secondary" href="/login">
            Sign in
          </Link>
        </div>
        <small>
          Independent land intelligence · Built for iPhone, iPad and web
        </small>
      </div>
      <div className="contours" aria-hidden="true">
        <div />
        <div />
        <div />
        <div />
      </div>
    </main>
  );
}
