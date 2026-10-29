"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { BrandLockup } from "@/components/brand-lockup";
import s from "./marketing.module.css";

export function MarketingNav({
  links,
}: {
  links: readonly { href: string; label: string }[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  function close() {
    setOpen(false);
  }
  return (
    <header
      className={s.header}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          close();
          toggle.current?.focus();
        }
      }}
    >
      <div className={`${s.container} ${s.headerInner}`}>
        <div className={s.headerBrand}>
          <BrandLockup href="/" />
        </div>
        <button
          ref={toggle}
          className={s.menuToggle}
          aria-expanded={open}
          aria-controls="marketing-navigation"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Close" : "Menu"}
          <span aria-hidden="true">{open ? "×" : "+"}</span>
        </button>
        <nav
          id="marketing-navigation"
          className={s.navigation}
          data-open={open}
          aria-label="Main navigation"
        >
          <div className={s.navLinks}>
            {links.map((link) => (
              <Link
                prefetch={false}
                key={link.href}
                href={link.href}
                aria-current={pathname === link.href ? "page" : undefined}
                onClick={close}
              >
                {link.label}
              </Link>
            ))}
            <Link prefetch={false} href="/contact" onClick={close}>
              Contact
            </Link>
          </div>
          <div className={s.navAccount}>
            <Link prefetch={false} href="/login" onClick={close}>
              Sign in
            </Link>
            <Link
              prefetch={false}
              href="/signup"
              onClick={close}
              className={s.navSignup}
            >
              Create workspace <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
