import type { Metadata } from "next";
import Link from "next/link";
import { checkToken, listLibrary, listPending, reviewToken, type LibraryDeck } from "@/lib/server/submissions";
import s from "./review.module.css";

export const metadata: Metadata = { title: "Deck submissions", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" }) : "");

function Rows({ decks, date }: { decks: LibraryDeck[]; date: (d: LibraryDeck) => string | undefined }) {
  return (
    <ul className={s.list}>
      {decks.map((d) => (
        <li key={d.id}>
          <Link href={`/review/${d.id}?t=${reviewToken(d.id)}`}>
            <span>{d.summary.name} <span className={s.meta}>· {d.summary.cardCount} cards{d.author ? ` · ${d.author}` : ""}</span></span>
            <span className={s.meta}>{day(date(d))}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function ReviewList({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  if (!checkToken("admin", t)) {
    return (
      <div className={`container ${s.wrap}`}>
        <h1 className="display page-title">Link not valid</h1>
        <p className="soft">Open the “All pending decks” link from a submission email.</p>
      </div>
    );
  }
  const [pending, library] = await Promise.all([listPending(), listLibrary()]);
  return (
    <div className={`container ${s.wrap}`}>
      <p className="eyebrow" style={{ margin: "0 0 10px" }}>Deck review</p>
      <h1 className="display page-title" style={{ marginBottom: 28 }}>Submissions</h1>
      <h2 className={s.h}>Waiting for review ({pending.length})</h2>
      {pending.length ? <Rows decks={pending} date={(d) => d.submittedAt} /> : <p className="muted" style={{ marginBottom: 30 }}>Nothing waiting.</p>}
      <h2 className={s.h}>In the Deck Library ({library.length})</h2>
      {library.length ? <Rows decks={library} date={(d) => d.approvedAt} /> : <p className="muted">No approved decks yet.</p>}
    </div>
  );
}
