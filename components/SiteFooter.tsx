"use client";

import Link from "next/link";
import { useRef } from "react";
import SupportDialog, { type SupportDialogHandle } from "./SupportDialog";
import { site } from "@/lib/site";

export default function SiteFooter() {
  const support = useRef<SupportDialogHandle>(null);
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <span className="footer-brand">BoldFace</span>
        <div className="footer-links">
          <button type="button" className="linklike" onClick={() => support.current?.open()}>Support</button>
          <Link href="/privacy">Privacy Policy</Link>
          <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>
        </div>
        <span>Study aid only. Always verify with current FAA publications.</span>
      </div>
      <SupportDialog ref={support} />
    </footer>
  );
}
