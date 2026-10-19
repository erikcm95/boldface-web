"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCloudKit } from "./CloudKitProvider";
import { type Deck, loadCards, loadDecks } from "@/lib/cards";
import { type AnyCard, DECK_STYLES, createDeck, deleteDeck, exportDeck, fromUserCard, gradientOf, loadBuiltInCards, updateDeck } from "@/lib/decks";
import s from "./DeckEditor.module.css";

const errText = (e: any) => e?.reason || e?.message || "Something went wrong talking to iCloud.";
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

type FormState = { deck: Deck | null; name: string; description: string; colors: string[] };

export default function DeckEditor() {
  const { database: db } = useCloudKit();
  const [decks, setDecks] = useState<Deck[] | null>(null);
  const [cards, setCards] = useState<Map<string, AnyCard>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removeMode, setRemoveMode] = useState(false);
  const [toRemove, setToRemove] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!db) return;
    setLoadError(null);
    try {
      const [d, userCards, builtIn] = await Promise.all([loadDecks(db), loadCards(db), loadBuiltInCards()]);
      const map = new Map<string, AnyCard>();
      for (const c of builtIn) map.set(c.id, c);
      for (const c of userCards) map.set(c.id, fromUserCard(c));
      setCards(map);
      setDecks(d);
    } catch (e) { console.error(e); setLoadError(errText(e)); }
  }, [db]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(null), 4000); return () => clearTimeout(t); }, [notice]);

  const deck = useMemo(() => decks?.find((d) => d.id === openId) ?? null, [decks, openId]);
  const deckCards = useMemo(() => (deck ? deck.cardIDs.map((id) => cards.get(id)).filter((c): c is AnyCard => !!c) : []), [deck, cards]);

  async function run(label: string, fn: () => Promise<void>) {
    if (!db) return;
    setBusy(true); setError(null);
    try { await fn(); setNotice(label); await load(); }
    catch (e) { console.error(e); setError(errText(e)); }
    finally { setBusy(false); }
  }

  const saveForm = () => form && run(form.deck ? "Deck updated. It will sync to your devices." : "Deck created. It will sync to your devices.", async () => {
    if (form.deck) await updateDeck(db, form.deck, { name: form.name.trim(), description: form.description.trim(), gradientColors: form.colors });
    else { const d = await createDeck(db, form.name, form.description, form.colors); setOpenId(d.id); }
    setForm(null);
  });

  const addCards = (ids: string[]) => deck && run(`${plural(ids.length, "card")} added.`, async () => {
    await updateDeck(db, deck, { cardIDs: [...deck.cardIDs, ...ids.filter((id) => !deck.cardIDs.includes(id))] });
    setAdding(false);
  });

  const removeCards = (ids: Set<string>) => deck && run(`${plural(ids.size, "card")} removed from the deck.`, async () => {
    await updateDeck(db, deck, { cardIDs: deck.cardIDs.filter((id) => !ids.has(id)) });
    setRemoveMode(false); setToRemove(new Set());
  });

  const doDelete = () => deck && run(`“${deck.name}” deleted.`, async () => {
    await deleteDeck(db, deck);
    setConfirmDelete(false); setOpenId(null);
  });

  async function download() {
    if (!db || !deck) return;
    setBusy(true); setError(null);
    try {
      const { blob, fileName, missingImages } = await exportDeck(db, deck, deckCards);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setNotice(missingImages ? `Downloaded ${fileName}. ${plural(missingImages, "image")} couldn’t be included.` : `Downloaded ${fileName}. Open it on your iPhone or iPad to import it.`);
    } catch (e) { console.error(e); setError(errText(e)); }
    finally { setBusy(false); }
  }

  if (loadError) return (
    <div className="gate">
      <h2 className="gate-title">Couldn’t load your decks</h2>
      <p className="error">{loadError}</p>
      <button type="button" className="btn btn-ghost" onClick={load}>Try again</button>
    </div>
  );
  if (!decks) return <p className="muted" aria-live="polite">Loading your decks from iCloud…</p>;

  const newForm = () => setForm({ deck: null, name: "", description: "", colors: DECK_STYLES[0].colors });

  return (
    <>
      {notice && <p className={s.notice} role="status">{notice}</p>}
      {error && <p className="error" role="alert" style={{ marginBottom: 14 }}>Couldn’t finish that: {error}</p>}

      {!deck ? (
        <>
          <div className={s.toolbar}>
            <h2 className={s.sectionTitle}>My Decks</h2>
            <span className={s.count}>{plural(decks.length, "deck")}</span>
            <button type="button" className="btn btn-ghost" onClick={load} disabled={busy}>Refresh</button>
          </div>
          {decks.length === 0 ? (
            <div className={s.empty}>
              <h2 className={s.emptyTitle}>No Custom Decks Yet</h2>
              <p className="muted" style={{ margin: 0 }}>Create your first deck to organize cards for focused study sessions</p>
              <button type="button" className="btn btn-accent" onClick={newForm}>Create Deck</button>
            </div>
          ) : (
            <ul className={s.grid}>
              {decks.map((d) => (
                <li key={d.id}>
                  <button type="button" className={s.tile} style={{ background: gradientOf(d.gradientColors) }} onClick={() => { setOpenId(d.id); setRemoveMode(false); }}>
                    <span className={s.tileShade} aria-hidden="true" />
                    <span className={s.tileText}>
                      <span className={s.tileName}>{d.name}</span>
                      {d.description && <span className={s.tileDesc}>{d.description}</span>}
                      <span className={s.tileCount}>{plural(d.cardIDs.filter((id) => cards.has(id)).length, "card")}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className={s.fabWrap}>
            <button type="button" className={s.fab} aria-label="Create a new deck" onClick={newForm}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            </button>
          </div>
        </>
      ) : (
        <>
          <button type="button" className={s.back} onClick={() => { setOpenId(null); setRemoveMode(false); }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>
            My Decks
          </button>
          <div className={s.hero} style={{ background: gradientOf(deck.gradientColors) }}>
            <span className={s.tileShade} aria-hidden="true" />
            <div className={s.tileText}>
              <h2 className={s.heroName}>{deck.name}</h2>
              {deck.description && <span className={s.tileDesc}>{deck.description}</span>}
              <span className={s.tileCount}>{plural(deckCards.length, "card")}</span>
            </div>
          </div>

          <div className={s.actions}>
            <button type="button" className="btn btn-accent" onClick={() => setAdding(true)} disabled={busy}>Add Cards</button>
            {deckCards.length > 0 && !removeMode && (
              <button type="button" className="btn btn-ghost" onClick={() => { setRemoveMode(true); setToRemove(new Set()); }} disabled={busy}>Remove Cards</button>
            )}
            <button type="button" className="btn btn-ghost" onClick={() => setForm({ deck, name: deck.name, description: deck.description, colors: deck.gradientColors })} disabled={busy}>Edit Deck</button>
            <button type="button" className="btn btn-ghost" onClick={download} disabled={busy || deckCards.length === 0} title={deckCards.length === 0 ? "Add cards before sharing" : undefined}>Download .boldface</button>
            <button type="button" className={s.dangerBtn} onClick={() => setConfirmDelete(true)} disabled={busy}>Delete Deck</button>
          </div>

          {removeMode && (
            <div className={s.removeBar} role="region" aria-label="Remove cards">
              <span>{toRemove.size ? `${plural(toRemove.size, "card")} selected` : "Select cards to remove"}</span>
              <button type="button" className="btn btn-ghost" onClick={() => setRemoveMode(false)}>Cancel</button>
              <button type="button" className={s.confirmDelete} disabled={!toRemove.size || busy} onClick={() => removeCards(toRemove)}>Remove ({toRemove.size})</button>
            </div>
          )}

          {deckCards.length === 0 ? (
            <div className={s.empty}>
              <h2 className={s.emptyTitle}>No Cards Yet</h2>
              <p className="muted" style={{ margin: 0 }}>Add cards to this deck to start studying</p>
              <button type="button" className="btn btn-accent" onClick={() => setAdding(true)}>Add Cards</button>
            </div>
          ) : (
            <ul className={s.list}>
              {deckCards.map((c) => {
                const selected = toRemove.has(c.id);
                const toggle = () => setToRemove((prev) => { const n = new Set(prev); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; });
                return (
                  <li key={c.id} className={s.row}>
                    {removeMode ? (
                      <label className={s.rowMain}>
                        <input type="checkbox" className={s.check} checked={selected} onChange={toggle} />
                        <CardSummary c={c} />
                      </label>
                    ) : (
                      <>
                        <div className={s.rowMain}><CardSummary c={c} /></div>
                        <button type="button" className={s.rowRemove} aria-label={`Remove from deck: ${c.question}`} onClick={() => removeCards(new Set([c.id]))} disabled={busy}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 12h8" /></svg>
                        </button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {form && <DeckForm form={form} setForm={setForm} onSave={saveForm} busy={busy} />}
      {adding && deck && <AddCardsDialog deck={deck} cards={cards} onCancel={() => setAdding(false)} onAdd={addCards} busy={busy} />}
      {confirmDelete && deck && (
        <Modal labelledBy="del-title" onClose={() => setConfirmDelete(false)} narrow>
          <div className="dialog-body" style={{ textAlign: "center" }}>
            <h2 id="del-title" className="dialog-title" style={{ fontSize: 22 }}>Delete Deck?</h2>
            <p className="muted" style={{ margin: 0, fontSize: 15 }}>This will permanently delete “{deck.name}” and cannot be undone. The cards themselves are kept.</p>
            <button type="button" className={s.confirmDelete} onClick={doDelete} disabled={busy}>{busy ? "Deleting…" : "Delete"}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(false)} disabled={busy}>Cancel</button>
          </div>
        </Modal>
      )}
    </>
  );
}

function CardSummary({ c }: { c: AnyCard }) {
  return (
    <span className={s.summary}>
      <span className={s.question}>{c.question}</span>
      <span className={s.chips}>
        {c.categories.map((k) => <span key={k} className={s.chip}>{k}</span>)}
        {c.userMade && <span className={s.mine}>Your card</span>}
      </span>
    </span>
  );
}

/** Native <dialog> shown as a modal while mounted. */
function Modal({ children, labelledBy, onClose, narrow, wide }: { children: React.ReactNode; labelledBy: string; onClose: () => void; narrow?: boolean; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal(); return () => d?.close(); }, []);
  return (
    <dialog ref={ref} className={`dialog ${wide ? s.wideDialog : ""}`} style={narrow ? { maxWidth: 420 } : undefined} aria-labelledby={labelledBy}
      onCancel={(e) => { e.preventDefault(); onClose(); }}>
      {children}
    </dialog>
  );
}

function DeckForm({ form, setForm, onSave, busy }: { form: FormState; setForm: (f: FormState | null) => void; onSave: () => void; busy: boolean }) {
  const valid = form.name.trim() !== "";
  return (
    <Modal labelledBy="deck-form-title" onClose={() => setForm(null)}>
      <form onSubmit={(e) => { e.preventDefault(); if (valid) onSave(); }} className="dialog-body">
        <div className={s.formHead}>
          <button type="button" className={s.textBtn} onClick={() => setForm(null)} disabled={busy}>Cancel</button>
          <h2 id="deck-form-title" className={s.formTitle}>{form.deck ? "Edit Deck" : "Create Deck"}</h2>
          <button type="submit" className={`btn ${valid ? "btn-accent" : s.saveOff}`} disabled={!valid || busy}>{busy ? "Saving…" : form.deck ? "Save" : "Create"}</button>
        </div>
        <div className="field">
          <label htmlFor="deck-name" className={s.label}>Deck Name</label>
          <input id="deck-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Piper Warrior" autoFocus />
        </div>
        <div className="field">
          <label htmlFor="deck-desc" className={s.label}>Description (optional)</label>
          <textarea id="deck-desc" className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ minHeight: 80 }} />
        </div>
        <fieldset className={s.group}>
          <legend className={s.label}>Style</legend>
          <div className={s.swatches}>
            {DECK_STYLES.map((st) => {
              const on = st.colors.join() === form.colors.join();
              return (
                <button key={st.name} type="button" className={`${s.swatch}${on ? ` ${s.swatchOn}` : ""}`} style={{ background: gradientOf(st.colors) }}
                  aria-pressed={on} aria-label={st.name} onClick={() => setForm({ ...form, colors: st.colors })}>
                  {on && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>}
                </button>
              );
            })}
          </div>
          <span className={s.help}>Choose a color scheme for your deck</span>
        </fieldset>
        <div className={s.group}>
          <span className={s.label}>Preview</span>
          <div className={s.tile} style={{ background: gradientOf(form.colors), cursor: "default" }}>
            <span className={s.tileShade} aria-hidden="true" />
            <span className={s.tileText}>
              <span className={s.tileName}>{form.name.trim() || "Deck Name"}</span>
              {form.description.trim() && <span className={s.tileDesc}>{form.description.trim()}</span>}
              <span className={s.tileCount}>{form.deck ? plural(form.deck.cardIDs.length, "card") : "0 cards"}</span>
            </span>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function AddCardsDialog({ deck, cards, onCancel, onAdd, busy }: { deck: Deck; cards: Map<string, AnyCard>; onCancel: () => void; onAdd: (ids: string[]) => void; busy: boolean }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const all = useMemo(() => [...cards.values()], [cards]);
  const categories = useMemo(() => {
    const order = ["User Made", "Plane and Pilot", "Aircraft Systems", "Weather", "Regulations", "Airspace and Navigation"];
    const present = new Set(all.flatMap((c) => c.categories));
    return order.filter((k) => present.has(k));
  }, [all]);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((c) =>
      (!category || c.categories.includes(category)) &&
      (!q || [c.question, c.answer, c.ref ?? "", c.categories.join(" ")].join(" ").toLowerCase().includes(q)));
  }, [all, search, category]);
  const inDeck = new Set(deck.cardIDs);
  const toggle = (id: string) => setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <Modal labelledBy="add-title" onClose={onCancel} wide>
      <div className={s.addWrap}>
        <div className={s.formHead}>
          <button type="button" className={s.textBtn} onClick={onCancel} disabled={busy}>Cancel</button>
          <h2 id="add-title" className={s.formTitle}>Add Cards to {deck.name}</h2>
          <button type="button" className={`btn ${selected.size ? "btn-accent" : s.saveOff}`} disabled={!selected.size || busy} onClick={() => onAdd([...selected])}>
            {busy ? "Adding…" : `Add (${selected.size})`}
          </button>
        </div>
        <label htmlFor="add-search" className="sr-only">Search cards</label>
        <input id="add-search" type="search" className="input" placeholder="Search cards..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className={s.pills} role="group" aria-label="Filter by category">
          <button type="button" className={`${s.pill}${category === null ? ` ${s.pillOn}` : ""}`} aria-pressed={category === null} onClick={() => setCategory(null)}>All</button>
          {categories.map((k) => (
            <button key={k} type="button" className={`${s.pill}${category === k ? ` ${s.pillOn}` : ""}`} aria-pressed={category === k} onClick={() => setCategory(k)}>{k}</button>
          ))}
        </div>
        <span className={s.count}>{selected.size ? `${plural(selected.size, "card")} selected` : `${plural(shown.length, "card")}`}</span>
        <ul className={s.addList}>
          {shown.length === 0 && <li className="muted" style={{ padding: 20 }}>No cards match “{search}”.</li>}
          {shown.map((c) => {
            const already = inDeck.has(c.id);
            return (
              <li key={c.id} className={s.row}>
                <label className={`${s.rowMain}${already ? ` ${s.disabled}` : ""}`}>
                  <input type="checkbox" className={s.check} checked={already || selected.has(c.id)} disabled={already} onChange={() => toggle(c.id)} />
                  <CardSummary c={c} />
                  {already && <span className={s.already}>Already in deck</span>}
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}
