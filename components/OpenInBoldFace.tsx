"use client";

import { useEffect, useState } from "react";
import { site } from "@/lib/site";
import s from "./OpenInBoldFace.module.css";

/**
 * "Open in BoldFace" + "Download". On iPhone/iPad the first button opens boldface://library/<id>;
 * the app downloads the deck and imports it. Elsewhere it's greyed out.
 */
export default function OpenInBoldFace({ deckId, downloadUrl, fileName }: { deckId: string; downloadUrl: string; fileName: string }) {
  const [ios, setIos] = useState<boolean | null>(null);
  const [notInstalled, setNotInstalled] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    // iPadOS reports itself as a Mac; touch support gives it away.
    setIos(/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1));
  }, []);

  function open() {
    setNotInstalled(false);
    let left = false;
    const onHide = () => { if (document.visibilityState === "hidden") left = true; };
    document.addEventListener("visibilitychange", onHide);
    window.location.href = `boldface://library/${deckId}`;
    // If the app opened, the page went to the background. If not, offer the App Store.
    setTimeout(() => {
      document.removeEventListener("visibilitychange", onHide);
      if (!left && document.visibilityState === "visible") setNotInstalled(true);
    }, 1800);
  }

  return (
    <div className={s.wrap}>
      <div className={s.row}>
        <button type="button" className={`btn btn-accent btn-lg ${s.open}`} onClick={open} disabled={!ios}
          aria-describedby={ios === false ? "open-hint" : undefined}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="3" /><path d="M11 18h2" /></svg>
          Open in BoldFace
        </button>
        <a className="btn btn-ghost btn-lg" href={downloadUrl} download={fileName}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v12M7 11l5 5 5-5M5 20h14" /></svg>
          Download
        </a>
      </div>
      {ios === false && <p id="open-hint" className={s.hint}>Open this page on your iPhone or iPad to send the deck straight to BoldFace.</p>}
      {notInstalled && (
        <p className={s.hint} role="status">
          Didn’t open? Make sure you have the latest version of BoldFace. <a href={site.appStoreUrl}>Get it on the App Store</a>, or use Download instead.
        </p>
      )}
    </div>
  );
}
