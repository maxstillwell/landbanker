import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLockup } from "@/components/brand-lockup";
import { MarketingNav } from "./navigation";
import s from "./marketing.module.css";

export const marketingLinks = [
  { href: "/features", label: "Features" },
  { href: "/layers", label: "Layers" },
  { href: "/solutions", label: "Solutions" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
] as const;

export function Arrow() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 12h15m-6-6 6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Action({
  href,
  children,
  secondary = false,
}: {
  href: string;
  children: ReactNode;
  secondary?: boolean;
}) {
  return (
    <Link
      prefetch={false}
      href={href}
      className={secondary ? s.secondaryAction : s.action}
    >
      {children}
      <Arrow />
    </Link>
  );
}

export function TextLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link prefetch={false} className={s.textLink} href={href}>
      {children}
      <Arrow />
    </Link>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className={s.eyebrow}>{children}</p>;
}

export function SectionHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className={s.sectionHeading}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </div>
  );
}

export function PageIntro({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className={s.pageIntro}>
      <div className={s.container}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1>{title}</h1>
        <p className={s.lead}>{children}</p>
      </div>
    </section>
  );
}

export function CallToAction() {
  return (
    <section className={s.cta}>
      <div className={s.container}>
        <div>
          <Eyebrow>A workspace of your own</Eyebrow>
          <h2>
            Make your next move
            <br />
            with more context.
          </h2>
          <p>
            Bring your properties, research and spatial information together.
          </p>
        </div>
        <div className={s.ctaActions}>
          <Action href="/signup">Create your workspace</Action>
          <Link prefetch={false} href="/login" className={s.quietLink}>
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}

export function MarketingSite({ children }: { children: ReactNode }) {
  return (
    <div className={s.site} lang="en-AU">
      <a href="#marketing-content" className={s.skipLink}>
        Skip to content
      </a>
      <MarketingNav links={marketingLinks} />
      <main id="marketing-content" tabIndex={-1}>
        {children}
      </main>
      <footer className={s.footer}>
        <div className={`${s.container} ${s.footerGrid}`}>
          <div className={s.footerBrand}>
            <BrandLockup href="/" />
            <p>
              Your land. Your research.
              <br />
              Your intelligence.
            </p>
            <span>Australian land intelligence platform</span>
          </div>
          <div>
            <p className={s.footerLabel}>Explore</p>
            <nav aria-label="Footer product navigation">
              {marketingLinks.slice(0, 3).map((link) => (
                <Link prefetch={false} key={link.href} href={link.href}>
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <div>
            <p className={s.footerLabel}>LandOS</p>
            <nav aria-label="Footer company navigation">
              <Link prefetch={false} href="/about">
                About
              </Link>
              <Link prefetch={false} href="/pricing">
                Pricing
              </Link>
              <Link prefetch={false} href="/contact">
                Contact
              </Link>
            </nav>
          </div>
          <div>
            <p className={s.footerLabel}>Your workspace</p>
            <nav aria-label="Footer account navigation">
              <Link prefetch={false} href="/signup">
                Create an account
              </Link>
              <Link prefetch={false} href="/login">
                Sign in
              </Link>
            </nav>
          </div>
        </div>
        <div className={`${s.container} ${s.footerBottom}`}>
          <span>© {new Date().getFullYear()} LandOS</span>
          <span>Land research starts with context.</span>
        </div>
      </footer>
    </div>
  );
}
