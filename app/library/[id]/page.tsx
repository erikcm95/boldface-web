import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import bg from "@/public/images/library-bg.jpg";
import DeckCards from "@/components/DeckCards";
import OpenInBoldFace from "@/components/OpenInBoldFace";
import { readDeckCards, type ReviewCard } from "@/lib/server/deckPackage";
import { builtInCards, deckBytes } from "@/lib/server/reviewDeck";
import { getSubmission } from "@/lib/server/submissions";
import s from "./deck.module.css";

export const dynamic = "force-dynamic";

async function load(id: string) {
  const found = await getSubmission(id).catch(() => null);
  return found && found.status === "approved" ? found.sub : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const deck = await load((await params).id);
  if (!deck) return { title: "Deck not found" };
  return { title: `${deck.summary.name} · Deck Library`, description: deck.summary.description || `${deck.summary.cardCount} flashcards for BoldFace.` };
}

export default async function LibraryDeckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deck = await load(id);
  if (!deck) notFound();
  const d = deck.summary;

  let cards: ReviewCard[] = [];
  let error = "";
  try { cards = readDeckCards(await deckBytes(deck.file), await builtInCards()).cards; }
  catch (e) { console.error("Library: could not read deck", e); error = "The cards in this deck couldn’t be shown right now. You can still download it."; }
  const imageUrl = (name: string) => `/api/library/${id}/image?name=${encodeURIComponent(name)}`;

  return (
    <div className={s.page}>
      <div aria-hidden="true" className={s.bg}>
        <Image src={bg} alt="" fill sizes="100vw" style={{ objectFit: "cover", objectPosition: "center 55%" }} placeholder="blur" />
        <div className={s.bgShade} />
      </div>

      <div className={`container ${s.body}`}>
        <Link href="/library" className={s.back}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>
          Deck Library
        </Link>

        <header className={s.hero} style={{ background: `linear-gradient(135deg, ${d.gradientColors[0]}, ${d.gradientColors[1]})` }}>
          <span className={s.count}>{d.cardCount} {d.cardCount === 1 ? "card" : "cards"}</span>
          <h1 className={s.name}>{d.name}</h1>
          <span className={s.by}>{deck.author ? `By ${deck.author}` : "Shared by the community"}</span>
        </header>

        {d.description && <p className={s.desc}>{d.description}</p>}
        {(d.ratings.length > 0 || d.categories.length > 0) && (
          <div className={s.chips}>
            {d.ratings.map((r) => <span key={r} className={s.rating}>{r}</span>)}
            {d.categories.map((c) => <span key={c} className={s.chip}>{c}</span>)}
          </div>
        )}

        <h2 className={s.h}>Cards</h2>
        {error ? <p className="error">{error}</p> : <DeckCards cards={cards} imageUrl={imageUrl} />}

        <div className={s.bar}>
          <OpenInBoldFace deckId={id} downloadUrl={deck.file.downloadUrl} fileName={deck.fileName} />
        </div>
      </div>
    </div>
  );
}
