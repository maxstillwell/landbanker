import Image from "next/image";
import Link from "next/link";

export function BrandLockup({
  href,
  tagline,
  compact = false,
}: {
  href?: string;
  tagline?: string;
  compact?: boolean;
}) {
  const content = (
    <>
      <Image
        className="brand-mark"
        src="/brand/landos-mark.svg"
        width={compact ? 26 : 32}
        height={compact ? 26 : 32}
        alt=""
        priority
      />
      <span className="brand-name">
        Land<span>OS</span>
        {tagline ? <small>{tagline}</small> : null}
      </span>
    </>
  );

  return href ? (
    <Link className={`brand-lockup${compact ? " compact" : ""}`} href={href}>
      {content}
    </Link>
  ) : (
    <div className={`brand-lockup${compact ? " compact" : ""}`}>{content}</div>
  );
}
