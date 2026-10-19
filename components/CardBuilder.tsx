"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCloudKit } from "./CloudKitProvider";
import {
  CATEGORIES, RATINGS, USER_MADE, type Card, type CardDraft, type Deck,
  deleteImages, imageUrls, loadCards, loadDecks, saveCard, setDeckMembership, toJpeg, tombstoneCards, uploadImage,
} from "@/lib/cards";
import s from "./CardBuilder.module.css";

const RATING_STYLE: Record<string, React.CSSProperties> = {
  PPL: { background: "#17283D", color: "#9CCBFF" },
  IR: { background: "#2A2140", color: "#D2B6FF" },
  CPL: { background: "#3A2E14", color: "#F2C766" },
};

/** One image slot in the editor: the stored name, plus a newly picked file if any. */
type ImgSlot = { name: string | null; url: string | null; file: File | null; removed: boolean };
const emptySlot = (): ImgSlot => ({ name: null, url: null, file: null, removed: false });

type Editor = {
  card: Card | null; // null = new card
  question: string; answer: string; ref: string;
  ratings: string[]; categories: string[]; decks: Set<string>;
  qImg: ImgSlot; aImg: ImgSlot;
};

function errText(e: any) {
  const code = e?.ckErrorCode || e?.serverErrorCode;
  const msg = e?.reason || e?.message || "Something went wrong talking to iCloud.";
  return code && !String(msg).includes(code) ? `${msg} (${code})` : msg;
}

/** Fails a stalled iCloud call instead of leaving Save spinning forever. */
function withTimeout<T>(p: Promise<T>, what: string, ms = 30000): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`iCloud didn’t respond while ${what}. Check your connection and try again.`)), ms))]);
}

export default function CardBuilder() {
  const { database: db, refresh: refreshSummary } = useCloudKit();
  const [cards, setCards] = useState<Card[] | null>(null);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [confirm, setConfirm] = useState<Card | "all" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const editorRef = useRef<HTMLDialogElement>(null);
  const confirmRef = useRef<HTMLDialogElement>(null);

  const load = useCallback(async () => {
    if (!db) return;
    setLoadError(null);
    try {
      const [c, d] = await Promise.all([loadCards(db), loadDecks(db)]);
      setCards(c); setDecks(d);
    } catch (e) { console.error(e); setLoadError(errText(e)); }
  }, [db]);

  useEffect(() => { load(); }, [load]);

  // Keep the list in step with the app: re-sync from iCloud whenever the tab comes back into view.
  useEffect(() => {
    const onShow = () => { if (document.visibilityState === "visible" && !editorRef.current?.open) load(); };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", onShow);
    return () => { document.removeEventListener("visibilitychange", onShow); window.removeEventListener("focus", onShow); };
  }, [load]);

  // Errors appear right under the Save bar; make sure they're on screen.
  useEffect(() => {
    if (saveError || tried) editorRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [saveError, tried]);

  useEffect(() => { if (editor) { if (!editorRef.current?.open) editorRef.current?.showModal(); } else editorRef.current?.close(); }, [editor]);
  useEffect(() => { if (confirm) { if (!confirmRef.current?.open) confirmRef.current?.showModal(); } else confirmRef.current?.close(); }, [confirm]);
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(null), 4000); return () => clearTimeout(t); }, [notice]);

  const deckNames = useMemo(() => Object.fromEntries(decks.map((d) => [d.id, d.name])), [decks]);
  const decksFor = useCallback((id: string) => decks.filter((d) => d.cardIDs.includes(id)), [decks]);

  const shown = useMemo(() => {
    if (!cards) return [];
    const q = search.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((c) =>
      [c.question, c.answer, c.ref, c.categories.join(" "), decksFor(c.id).map((d) => d.name).join(" ")].join(" ").toLowerCase().includes(q));
  }, [cards, search, decksFor]);

  async function openEditor(card: Card | null) {
    setSaveError(null); setTried(false);
    const base: Editor = card
      ? {
          card, question: card.question, answer: card.answer, ref: card.ref,
          ratings: [...card.ratings], categories: card.categories.filter((c) => c !== USER_MADE),
          decks: new Set(decksFor(card.id).map((d) => d.id)),
          qImg: { ...emptySlot(), name: card.questionImageName }, aImg: { ...emptySlot(), name: card.imageName },
        }
      : { card: null, question: "", answer: "", ref: "", ratings: [], categories: [], decks: new Set(), qImg: emptySlot(), aImg: emptySlot() };
    setEditor(base);
    const names = [card?.questionImageName, card?.imageName].filter((n): n is string => !!n);
    if (db && names.length) {
      try {
        const urls = await imageUrls(db, names);
        setEditor((e) => e && e.card?.id === card?.id ? {
          ...e,
          qImg: e.qImg.file || e.qImg.removed ? e.qImg : { ...e.qImg, url: e.qImg.name ? urls[e.qImg.name] ?? null : null },
          aImg: e.aImg.file || e.aImg.removed ? e.aImg : { ...e.aImg, url: e.aImg.name ? urls[e.aImg.name] ?? null : null },
        } : e);
      } catch (err) { console.warn("Could not load images", err); }
    }
  }

  const patch = (p: Partial<Editor>) => setEditor((e) => (e ? { ...e, ...p } : e));
  const toggle = (key: "ratings" | "categories", v: string) =>
    setEditor((e) => e ? { ...e, [key]: e[key].includes(v) ? e[key].filter((x) => x !== v) : [...e[key], v] } : e);
  const toggleDeck = (id: string) => setEditor((e) => {
    if (!e) return e;
    const next = new Set(e.decks); if (next.has(id)) next.delete(id); else next.add(id);
    return { ...e, decks: next };
  });
  const pickImage = (slot: "qImg" | "aImg", file: File | undefined) => {
    if (!file) return;
    setEditor((e) => e ? { ...e, [slot]: { ...e[slot], file, url: URL.createObjectURL(file), removed: false } } : e);
  };
  const removeImage = (slot: "qImg" | "aImg") =>
    setEditor((e) => e ? { ...e, [slot]: { ...e[slot], file: null, url: null, removed: true } } : e);

  const valid = !!editor && editor.question.trim() !== "" && editor.answer.trim() !== "";

  async function save() {
    if (!editor) return;
    if (!valid) { setTried(true); return; }
    if (!db) { setSaveError("You’re not signed in to iCloud. Sign in again and retry."); return; }
    setSaving(true); setSaveError(null);
    try {
      const resolve = async (slot: ImgSlot) => {
        if (slot.file) return withTimeout(uploadImage(db, await toJpeg(slot.file)), "uploading an image", 90000);
        return slot.removed ? null : slot.name;
      };
      const [questionImageName, imageName] = await Promise.all([resolve(editor.qImg), resolve(editor.aImg)]);
      const draft: CardDraft = {
        id: editor.card?.id, changeTag: editor.card?.changeTag,
        question: editor.question, answer: editor.answer, ref: editor.ref,
        ratings: editor.ratings, categories: editor.categories,
        questionImageName, imageName,
      };
      const saved = await withTimeout(saveCard(db, draft), "saving the card");
      // Read it back so we only report success once iCloud really has it.
      const check: any = await withTimeout<any>(db.fetchRecords([saved.id]), "confirming the save");
      if (check?.hasErrors || !check?.records?.length) throw check?.errors?.[0] || new Error("iCloud didn’t confirm the save.");
      await withTimeout(setDeckMembership(db, decks, saved.id, editor.decks), "updating decks");
      // Clean up images this card no longer uses.
      if (editor.card) {
        await deleteImages(db, [
          editor.card.questionImageName !== questionImageName ? editor.card.questionImageName : null,
          editor.card.imageName !== imageName ? editor.card.imageName : null,
        ]);
      }
      // Show it right away, then sync everything from iCloud.
      setCards((list) => [saved, ...(list || []).filter((c) => c.id !== saved.id)]);
      setEditor(null);
      setNotice(editor.card ? "Card updated in iCloud. Your devices will sync it automatically." : "Card saved to iCloud. Your devices will sync it automatically.");
      await load();
      refreshSummary();
    } catch (e) {
      console.error("Card save failed", e); setSaveError(errText(e));
    } finally { setSaving(false); }
  }

  async function doDelete() {
    if (!db || !cards || !confirm) return;
    setSaving(true);
    try {
      const targets = confirm === "all" ? cards : [confirm];
      await tombstoneCards(db, targets);
      setConfirm(null); setEditor(null);
      setNotice(targets.length === 1 ? "Card deleted." : `${targets.length} cards deleted.`);
      await load();
    } catch (e) {
      console.error(e); setNotice(`Delete failed: ${errText(e)}`); setConfirm(null);
    } finally { setSaving(false); }
  }

  if (loadError) return (
    <div className="gate">
      <h2 className="gate-title">Couldn’t load your cards</h2>
      <p className="error">{loadError}</p>
      <button type="button" className="btn btn-ghost" onClick={load}>Try again</button>
    </div>
  );
  if (!cards) return <p className="muted" aria-live="polite">Loading your custom cards from iCloud…</p>;

  const pill = (on: boolean) => `${s.pill}${on ? ` ${s.pillOn}` : ""}`;

  return (
    <>
      <div className={s.toolbar}>
        <label htmlFor="card-search" className="sr-only">Search cards</label>
        <div className={s.search}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A3A9B3" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input id="card-search" type="search" placeholder="Search cards" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <span className={s.count}>{cards.length} custom card{cards.length === 1 ? "" : "s"}</span>
        <button type="button" className="btn btn-ghost" onClick={load}>Refresh</button>
        {cards.length > 0 && (
          <button type="button" className={s.dangerBtn} onClick={() => setConfirm("all")}>
            <TrashIcon /> Delete all
          </button>
        )}
      </div>

      {notice && <p className={s.notice} role="status">{notice}</p>}

      {cards.length === 0 ? (
        <div className={s.empty}>
          <h2 className={s.emptyTitle}>No Custom Cards</h2>
          <p className="muted" style={{ margin: 0 }}>Create your own flashcards to practice alongside the built-in cards.</p>
          <button type="button" className="btn btn-accent" onClick={() => openEditor(null)}>Build your first card</button>
        </div>
      ) : shown.length === 0 ? (
        <div className={s.empty}>
          <h2 className={s.emptyTitle}>No results for “{search}”</h2>
          <p className="muted" style={{ margin: 0 }}>Search looks at questions, answers, categories, references and deck names.</p>
        </div>
      ) : (
        <ul className={s.list}>
          {shown.map((c) => (
            <li key={c.id} className={s.row}>
              <button type="button" className={s.rowMain} onClick={() => openEditor(c)}>
                <span className={s.question}>{c.question}</span>
                <span className={s.chips}>
                  {c.ratings.map((r) => <span key={r} className={`${s.chip} ${s.mono}`} style={RATING_STYLE[r]}>{r}</span>)}
                  {[USER_MADE, ...c.categories.filter((k) => k !== USER_MADE)].map((k) => <span key={k} className={`${s.chip} ${s.outline}`}>{k}</span>)}
                  {decksFor(c.id).map((d) => <span key={d.id} className={`${s.chip} ${s.deck}`}>{d.name}</span>)}
                  {(c.imageName || c.questionImageName) && <span className={`${s.chip} ${s.plain}`}>Image</span>}
                </span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B717C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
              </button>
              <button type="button" className={s.rowDelete} aria-label={`Delete card: ${c.question}`} onClick={() => setConfirm(c)}>
                <TrashIcon />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={s.fabWrap}>
        <button type="button" className={s.fab} aria-label="Build a new card" onClick={() => openEditor(null)}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        </button>
      </div>

      {/* Editor */}
      <dialog ref={editorRef} className={`dialog ${s.editor}`} aria-labelledby="editor-title" onCancel={(e) => { if (saving) e.preventDefault(); else setEditor(null); }}>
        {editor && (
          <form noValidate onSubmit={(e) => { e.preventDefault(); save(); }}>
            <div className={s.editorHead}>
              <button type="button" className={s.textBtn} onClick={() => setEditor(null)} disabled={saving}>Cancel</button>
              <h2 id="editor-title" className={s.editorTitle}>{editor.card ? "Edit Card" : "New Card"}</h2>
              <button type="submit" className={`btn ${valid ? "btn-accent" : s.saveOff}`} disabled={saving} onClick={(e) => { e.preventDefault(); save(); }}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
            {((tried && !valid) || saveError) && (
              <p className={s.saveAlert} role="alert">
                {saveError ? `Couldn’t save: ${saveError}` : "Add a question and an answer to save this card."}
              </p>
            )}
            <div className={s.editorBody}>
              <div className="field">
                <label htmlFor="e-q" className={s.label}>Question</label>
                <textarea id="e-q" className="input" rows={3} placeholder="What do you want to be asked?" value={editor.question} onChange={(e) => patch({ question: e.target.value })} />
              </div>
              <ImageField label="Question Image (Optional)" help="Add an image to display on the question side of the card." addText="Add Image to Question"
                slot={editor.qImg} onPick={(f) => pickImage("qImg", f)} onRemove={() => removeImage("qImg")} />
              <div className="field">
                <label htmlFor="e-a" className={s.label}>Answer</label>
                <textarea id="e-a" className="input" rows={5} placeholder="The answer you’d give a DPE." value={editor.answer} onChange={(e) => patch({ answer: e.target.value })} />
              </div>
              <ImageField label="Answer Image (Optional)" help="Add an image to display on the answer side of the card." addText="Add Image to Answer"
                slot={editor.aImg} onPick={(f) => pickImage("aImg", f)} onRemove={() => removeImage("aImg")} />
              <div className="field">
                <label htmlFor="e-r" className={s.label}>Reference (Optional)</label>
                <input id="e-r" className={`input ${s.mono}`} placeholder="e.g. 14 CFR 91.155, AIM 5-4-5, PA.I.B.K1" value={editor.ref} onChange={(e) => patch({ ref: e.target.value })} />
                <span className={s.help}>Enter ACS Code, FAR/AIM Section, or other reference pointers that apply to this question.</span>
              </div>
              <fieldset className={s.group}>
                <legend className={s.label}>Pilot Ratings</legend>
                <div className={s.pills}>
                  {RATINGS.map((r) => <button key={r} type="button" className={pill(editor.ratings.includes(r))} aria-pressed={editor.ratings.includes(r)} onClick={() => toggle("ratings", r)}>{r}</button>)}
                </div>
                <span className={s.help}>Select which pilot certificate ratings this card applies to. Defaults to PPL if none selected.</span>
              </fieldset>
              <fieldset className={s.group}>
                <legend className={s.label}>{editor.card ? "Decks (Optional)" : "Add to Decks (Optional)"}</legend>
                {decks.length === 0 ? <span className={s.help}>Create a Deck to add cards.</span> : (
                  <div className={s.pills}>
                    {decks.map((d) => <button key={d.id} type="button" className={pill(editor.decks.has(d.id))} aria-pressed={editor.decks.has(d.id)} onClick={() => toggleDeck(d.id)}>{deckNames[d.id]}</button>)}
                  </div>
                )}
                <span className={s.help}>{editor.card ? "Add or remove this card from custom decks." : "Optionally add this card directly to one or more custom decks."}</span>
              </fieldset>
              <fieldset className={s.group}>
                <legend className={s.label}>Categories (Optional)</legend>
                <div className={s.pills}>
                  {CATEGORIES.map((c) => <button key={c} type="button" className={pill(editor.categories.includes(c))} aria-pressed={editor.categories.includes(c)} onClick={() => toggle("categories", c)}>{c}</button>)}
                </div>
                <span className={s.help}>All user-made cards are automatically added to the “User Made” category. You can optionally add additional categories.</span>
              </fieldset>
              {editor.card && (
                <button type="button" className={s.deleteCard} onClick={() => setConfirm(editor.card)} disabled={saving}>Delete Card</button>
              )}
            </div>
          </form>
        )}
      </dialog>

      {/* Delete confirmation */}
      <dialog ref={confirmRef} className="dialog" style={{ maxWidth: 420 }} aria-labelledby="confirm-title" onCancel={() => setConfirm(null)}>
        {confirm && (
          <div className="dialog-body" style={{ textAlign: "center" }}>
            <h2 id="confirm-title" className="dialog-title" style={{ fontSize: 22 }}>{confirm === "all" ? "Delete All Custom Cards?" : "Delete this card?"}</h2>
            <p className="muted" style={{ margin: 0, fontSize: 15 }}>
              {confirm === "all"
                ? `This will permanently delete all ${cards.length} custom card${cards.length === 1 ? "" : "s"} from the website and your devices. This action cannot be undone.`
                : `“${confirm.question}” will be deleted from the website and your devices.`}
            </p>
            <button type="button" className={s.confirmDelete} onClick={doDelete} disabled={saving}>
              {saving ? "Deleting…" : confirm === "all" ? "Delete All Cards" : "Delete Card"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirm(null)} disabled={saving}>Cancel</button>
          </div>
        )}
      </dialog>
    </>
  );
}

function ImageField({ label, help, addText, slot, onPick, onRemove }: {
  label: string; help: string; addText: string; slot: ImgSlot; onPick: (f: File | undefined) => void; onRemove: () => void;
}) {
  const has = !!slot.file || (!!slot.name && !slot.removed);
  return (
    <div className="field">
      <span className={s.label}>{label}</span>
      {has ? (
        <div className={s.imageRow}>
          {slot.url ? <img src={slot.url} alt="" className={s.thumb} /> : <span className={s.thumb} aria-hidden="true" />}
          <button type="button" className={s.dangerBtn} onClick={onRemove}>Remove Image</button>
        </div>
      ) : (
        <label className={s.addImage}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m3 16 5-5 4 4 3-3 6 6" /><path d="M18 2v6M15 5h6" /></svg>
          {addText}
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      )}
      <span className={s.help}>{help}</span>
    </div>
  );
}

function TrashIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>;
}
