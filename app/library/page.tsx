import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import bg from "@/public/images/library-bg.jpg";
import SubmitDeckButton from "@/components/SubmitDeck";
import { listLibrary, type LibraryDeck } from "@/lib/server/submissions";
import s from "./library.module.css";

export const metadata: Metadata = {
  title: "Deck Library",
  description: "Decks built and shared by pilots and CFIs. Download one and open it in BoldFace.",
};

// Approving a deck refreshes this page right away; this is a fallback.
export const revalidate = 300;

async function load(): Promise<LibraryDeck[]> {
  try { return await listLibrary(); } catch (e) { console.error("Deck Library: could not list decks", e); return []; }
}

export default async function LibraryPage() {
  const decks = await load();
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
          Decks built and shared by pilots and CFIs. Download one and open it in BoldFace on your iPhone or iPad.
        </p>
        {decks.length > 0 && (
          <div className={s.headActions}>
            <SubmitDeckButton className="btn btn-light" />
          </div>
        )}
      </header>

      <div className={`container ${s.body}`}>
        {decks.length === 0 ? (
          <div className={s.empty}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#F2B544" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="6" width="14" height="14" rx="2" /><path d="M7 2h12a2 2 0 0 1 2 2v12" /><path d="M7 11h6M7 15h4" /></svg>
            <h2 className={s.emptyTitle}>The first decks are on their way.</h2>
            <p className={s.emptyText}>
              Decks built by pilots and CFIs show up here once they’ve been submitted and approved. Have a deck worth sharing? Submit it for review.
            </p>
            <div className={s.actions}>
              <SubmitDeckButton className="btn btn-light" />
              <Link href="/editor" className="btn btn-ghost">Open the Deck Editor</Link>
            </div>
          </div>
        ) : (
          <>
            <p className={s.count}>{decks.length} {decks.length === 1 ? "deck" : "decks"}</p>
            <ul className={s.grid}>
              {decks.map((d) => (
                <li key={d.id} className={s.card}>
                  <Link href={`/library/${d.id}`} className={s.cardTop} style={{ background: `linear-gradient(135deg, ${d.summary.gradientColors[0]}, ${d.summary.gradientColors[1]})` }}>
                    <span className={s.cardName}>{d.summary.name}</span>
                    <span className={s.cardCount}>{d.summary.cardCount} {d.summary.cardCount === 1 ? "card" : "cards"} · View cards ›</span>
                  </Link>
                  <div className={s.cardBody}>
                    {d.summary.description && <p className={s.cardDesc}>{d.summary.description}</p>}
                    {(d.summary.ratings.length > 0 || d.summary.categories.length > 0) && (
                      <div className={s.chips}>
                        {d.summary.ratings.map((r) => <span key={r} className={s.rating}>{r}</span>)}
                        {d.summary.categories.slice(0, 4).map((c) => <span key={c} className={s.chip}>{c}</span>)}
                      </div>
                    )}
                    {d.summary.sample[0]?.question && (
                      <p className={s.sample}><span>Sample</span> {d.summary.sample[0].question}</p>
                    )}
                    <div className={s.cardFoot}>
                      <span className={s.by}>{d.author ? `By ${d.author}` : "Shared by the community"}<br /><Link href={`/library/${d.id}`} className={s.viewLink}>See all cards</Link></span>
                      <a className="btn btn-accent" href={d.file.downloadUrl} download={d.fileName}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v12M7 11l5 5 5-5M5 20h14" /></svg>
                        Download
                      </a>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <p className={s.howto}>
              On iPhone or iPad, tap Download, then open the file and choose BoldFace. On a computer, AirDrop or email the file to your device.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
