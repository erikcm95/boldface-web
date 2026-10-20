import type { Metadata } from "next";
import Link from "next/link";
import { checkToken, getSubmission, reviewToken } from "@/lib/server/submissions";
import { readDeckCards, type ReviewCard } from "@/lib/server/deckPackage";
import { builtInCards, deckBytes } from "@/lib/server/reviewDeck";
import { reviewAction } from "../actions";
import s from "../review.module.css";

export const metadata: Metadata = { title: "Review deck", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const mb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC" : "");

const DONE: Record<string, [string, boolean]> = {
  approved: ["Approved. The deck is now in the Deck Library.", true],
  rejected: ["Rejected. The deck and its file were deleted.", true],
  removed: ["Removed from the Deck Library. The file was deleted.", true],
  missing: ["That deck was already handled or no longer exists.", false],
};

export default async function ReviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string; done?: string }> }) {
  const { id } = await params;
  const { t = "", done = "" } = await searchParams;

  if (!checkToken(id, t)) {
    return (
      <div className={`container ${s.wrap}`}>
        <h1 className="display page-title">Link not valid</h1>
        <p className="soft">Open the review link from the submission email.</p>
      </div>
    );
  }

  const found = await getSubmission(id);
  const banner = DONE[done];
  const adminList = `/review?t=${reviewToken("admin")}`;

  if (!found) {
    return (
      <div className={`container ${s.wrap}`}>
        {banner && <p className={`${s.banner} ${banner[1] ? s.ok : s.warn}`}>{banner[0]}</p>}
        <h1 className="display page-title">Nothing to review</h1>
        <p className="soft">This deck has been rejected or removed. <Link href={adminList}>See all submissions</Link>.</p>
      </div>
    );
  }

  const { sub, status } = found;
  const d = sub.summary;
  let cards: ReviewCard[] = [];
  let cardsError = "";
  try { cards = readDeckCards(await deckBytes(sub.file), await builtInCards()).cards; }
  catch (e) { console.error("Review: could not read deck", e); cardsError = "The deck file couldn’t be read. Download it and open it in BoldFace to review it."; }
  const img = (name: string) => `/api/review/${id}/image?name=${encodeURIComponent(name)}&t=${encodeURIComponent(t)}`;
  const custom = cards.filter((c) => !c.builtIn && !c.missing).length;
  const builtIn = cards.filter((c) => c.builtIn).length;
  const missing = cards.filter((c) => c.missing).length;
  return (
    <div className={`container ${s.wrap}`}>
      {banner && <p className={`${s.banner} ${banner[1] ? s.ok : s.warn}`}>{banner[0]}</p>}
      <p className="eyebrow" style={{ margin: "0 0 10px" }}>Deck review</p>
      <div className={s.panel}>
        <div className={s.top} style={{ background: `linear-gradient(135deg, ${d.gradientColors[0]}, ${d.gradientColors[1]})` }}>
          <span className={s.status}>{status === "approved" ? `In the Library since ${when(sub.approvedAt)}` : "Waiting for review"}</span>
          <h1 className={s.name}>{d.name}</h1>
        </div>
        <div className={s.inner}>
          {d.description && <p style={{ margin: 0 }}>{d.description}</p>}
          <dl className={s.facts}>
            <dt>Cards</dt><dd>{d.cardCount} ({d.userCardCount} custom, {d.imageCount} images)</dd>
            {d.categories.length > 0 && (<><dt>Categories</dt><dd>{d.categories.join(", ")}</dd></>)}
            {d.ratings.length > 0 && (<><dt>Ratings</dt><dd>{d.ratings.join(", ")}</dd></>)}
            <dt>Shown as</dt><dd>{sub.author ? `By ${sub.author}` : "Shared by the community"}</dd>
            <dt>File</dt><dd>{sub.fileName} ({mb(sub.size)}) · <a href={sub.file.downloadUrl} download={sub.fileName}>Download</a></dd>
            <dt>Submitted</dt><dd>{when(sub.submittedAt)}</dd>
          </dl>
          {sub.notes && (<div><p className={s.label}>Note from the submitter</p><p className={s.notes}>{sub.notes}</p></div>)}
          {cards.length > 0 && (
            <p style={{ margin: 0 }}><a href="#cards">Review all {cards.length} cards ↓</a> <span className="muted">({[`${custom} written by the submitter`, builtIn && `${builtIn} BoldFace built-in`, missing && `${missing} missing from the file`].filter(Boolean).join(", ")})</span></p>
          )}
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>The submitter’s email address is in the review email (reply to it to reach them). It isn’t stored on the website.</p>
          <div className={s.actions}>
            {status === "pending" ? (
              <>
                <form action={reviewAction}>
                  <input type="hidden" name="id" value={id} /><input type="hidden" name="t" value={t} /><input type="hidden" name="op" value="approve" />
                  <button className="btn btn-accent btn-lg">Approve and publish</button>
                </form>
                <details className={s.reject}>
                  <summary>Reject…</summary>
                  <form action={reviewAction}>
                    <input type="hidden" name="id" value={id} /><input type="hidden" name="t" value={t} /><input type="hidden" name="op" value="reject" />
                    <button className={s.confirm}>Reject and delete the file</button>
                  </form>
                </details>
              </>
            ) : (
              <>
                <Link className="btn btn-ghost" href="/library">View the Deck Library</Link>
                <details className={s.reject}>
                  <summary>Remove from Library…</summary>
                  <form action={reviewAction}>
                    <input type="hidden" name="id" value={id} /><input type="hidden" name="t" value={t} /><input type="hidden" name="op" value="remove" />
                    <button className={s.confirm}>Remove and delete the file</button>
                  </form>
                </details>
              </>
            )}
          </div>
        </div>
      </div>
      <section id="cards" className={s.cardSection}>
        <h2 className={s.h}>All cards ({cards.length})</h2>
        {cardsError && <p className="error">{cardsError}</p>}
        <ol className={s.cardList}>
          {cards.map((c, i) => (
            <li key={c.id + i} className={`${s.card} ${c.missing ? s.cardMissing : ""}`}>
              <div className={s.cardTop}>
                <span className={s.cardNum}>{i + 1}</span>
                {c.missing ? <span className={`${s.tag} ${s.tagWarn}`}>Missing from file</span>
                  : c.builtIn ? <span className={s.tag}>BoldFace built-in</span>
                  : <span className={`${s.tag} ${s.tagCustom}`}>Custom</span>}
                {c.ratings.map((r) => <span key={r} className={`${s.tag} ${s.tagRating}`}>{r}</span>)}
                {c.categories.filter((k) => k !== "User Made").map((k) => <span key={k} className={s.tag}>{k}</span>)}
              </div>
              {c.missing ? (
                <p className="muted" style={{ margin: 0 }}>The deck lists card <code>{c.id}</code>, but it isn’t in the file or BoldFace’s built-in set.</p>
              ) : (
                <div className={s.qa}>
                  <div>
                    <p className={s.label}>Question</p>
                    <p className={s.text}>{c.question || <em className="muted">(empty)</em>}</p>
                    {c.questionImage && <a href={img(c.questionImage)} target="_blank" rel="noreferrer"><img className={s.photo} src={img(c.questionImage)} alt="Question photo" loading="lazy" /></a>}
                  </div>
                  <div>
                    <p className={s.label}>Answer</p>
                    <p className={s.text}>{c.answer || <em className="muted">(empty)</em>}</p>
                    {c.answerImage && <a href={img(c.answerImage)} target="_blank" rel="noreferrer"><img className={s.photo} src={img(c.answerImage)} alt="Answer photo" loading="lazy" /></a>}
                  </div>
                </div>
              )}
              {c.ref && <p className={s.ref}>Reference: {c.ref}</p>}
            </li>
          ))}
        </ol>
        {cards.length > 3 && (
          <div className={s.bottomActions}>
          <div className={s.actions}>
            {status === "pending" ? (
              <>
                <form action={reviewAction}>
                  <input type="hidden" name="id" value={id} /><input type="hidden" name="t" value={t} /><input type="hidden" name="op" value="approve" />
                  <button className="btn btn-accent btn-lg">Approve and publish</button>
                </form>
                <details className={s.reject}>
                  <summary>Reject…</summary>
                  <form action={reviewAction}>
                    <input type="hidden" name="id" value={id} /><input type="hidden" name="t" value={t} /><input type="hidden" name="op" value="reject" />
                    <button className={s.confirm}>Reject and delete the file</button>
                  </form>
                </details>
              </>
            ) : (
              <>
                <Link className="btn btn-ghost" href="/library">View the Deck Library</Link>
                <details className={s.reject}>
                  <summary>Remove from Library…</summary>
                  <form action={reviewAction}>
                    <input type="hidden" name="id" value={id} /><input type="hidden" name="t" value={t} /><input type="hidden" name="op" value="remove" />
                    <button className={s.confirm}>Remove and delete the file</button>
                  </form>
                </details>
              </>
            )}
          </div>
          </div>
        )}
      </section>
      <p style={{ marginTop: 20 }}><Link href={adminList}>All submissions</Link></p>
    </div>
  );
}
