"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useCloudKit } from "./CloudKitProvider";
import SignInDialog, { type SignInDialogHandle } from "./SignInDialog";
import { navLinks } from "@/lib/site";

export default function SiteNav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const signIn = useRef<SignInDialogHandle>(null);
  const { status, registerSignIn } = useCloudKit();

  useEffect(() => registerSignIn(() => signIn.current?.open()), [registerSignIn]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="nav-wrap">
      <nav aria-label="Main" className={`nav${scrolled ? " scrolled" : ""}${open ? " open" : ""}`}>
        <Link href="/" className="nav-brand">BoldFace</Link>
        <button
          type="button"
          className="nav-toggle"
          aria-expanded={open}
          aria-controls="nav-links"
          onClick={() => setOpen((o) => !o)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
          Menu
        </button>
        <div id="nav-links" className="nav-links">
          {navLinks.map((l) => (
            <Link key={l.href} href={l.href} className="nav-link" aria-current={isActive(l.href) ? "page" : undefined}>
              {l.label}
            </Link>
          ))}
          {status !== "unavailable" && (
            <button type="button" className="nav-signin" onClick={() => signIn.current?.open()}>
              {status === "signedIn" ? "Synced ✓" : "Sign in"}
            </button>
          )}
        </div>
      </nav>
      <SignInDialog ref={signIn} />
    </div>
  );
}
