import type { ReviewCard } from "@/lib/server/deckPackage";
import s from "./DeckCards.module.css";

/** Every card in a deck: question, answer, photos, ratings, categories and reference. */
export default function DeckCards({ cards, imageUrl }: { cards: ReviewCard[]; imageUrl: (name: string) => string }) {
  const photo = (name: string | null, alt: string) =>
    name ? (
      <a href={imageUrl(name)} target="_blank" rel="noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={s.photo} src={imageUrl(name)} alt={alt} loading="lazy" />
      </a>
    ) : null;
  return (
    <ol className={s.list}>
      {cards.map((c, i) => (
        <li key={c.id + i} className={`${s.card} ${c.missing ? s.missing : ""}`}>
          <div className={s.top}>
            <span className={s.num}>{i + 1}</span>
            {c.missing ? <span className={`${s.tag} ${s.warn}`}>Missing from file</span>
              : c.builtIn ? <span className={s.tag}>BoldFace built-in</span>
              : <span className={`${s.tag} ${s.custom}`}>Custom</span>}
            {c.ratings.map((r) => <span key={r} className={`${s.tag} ${s.rating}`}>{r}</span>)}
            {c.categories.filter((k) => k !== "User Made").map((k) => <span key={k} className={s.tag}>{k}</span>)}
          </div>
          {c.missing ? (
            <p className={s.muted}>The deck lists card <code>{c.id}</code>, but it isn’t in the file or BoldFace’s built-in set.</p>
          ) : (
            <div className={s.qa}>
              <div>
                <p className={s.label}>Question</p>
                <p className={s.text}>{c.question || <em className={s.muted}>(empty)</em>}</p>
                {photo(c.questionImage, "Question photo")}
              </div>
              <div>
                <p className={s.label}>Answer</p>
                <p className={s.text}>{c.answer || <em className={s.muted}>(empty)</em>}</p>
                {photo(c.answerImage, "Answer photo")}
              </div>
            </div>
          )}
          {c.ref && <p className={s.ref}>Reference: {c.ref}</p>}
        </li>
      ))}
    </ol>
  );
}
