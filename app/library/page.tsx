import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import bg from "@/public/images/library-bg.jpg";
import s from "./library.module.css";

export const metadata: Metadata = {
  title: "Deck Library",
  description: "Decks built and shared by pilots and CFIs. Download one and open it in BoldFace.",
};

export default function LibraryPage() {
  return (
    <div className={s.page}>
      <div aria-hidden="true" className={s.bg}>
        <Image src={bg} alt="" fill sizes="100vw" style={{ objectFit: "cover", objectPosition: "center 55%" }} placeholder="blur" />
        <div className={s.bgShade} />
      </div>

      <header className={`container ${s.head}`}>
        <div className="eyebrow">Deck Library</div>
        <h1 className="display page-title">Find your next deck.</h1>
        <p className="soft" style={{ margin: 0, maxWidth: 640 }}>
          Decks built and shared by pilots and CFIs. Download one and open it in BoldFace, or copy it into the Deck Editor to make it your own.
        </p>
      </header>

      <div className={`container ${s.body}`}>
        <div className={s.empty}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#F2B544" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="6" width="14" height="14" rx="2" /><path d="M7 2h12a2 2 0 0 1 2 2v12" /><path d="M7 11h6M7 15h4" /></svg>
          <h2 className={s.emptyTitle}>The first decks are on their way.</h2>
          <p className={s.emptyText}>
            Decks built by pilots and CFIs show up here once they’ve been submitted and approved. Have a deck worth sharing? Build it in the Deck Editor and submit it for review.
          </p>
          <div className={s.actions}>
            <Link href="/editor" className="btn btn-light">Submit a deck</Link>
            <Link href="/builder" className="btn btn-ghost">Open the Card Builder</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
