"use client";

import { useRef, useState } from "react";
import { strFromU8, unzip } from "fflate";
import { site } from "@/lib/site";
import s from "./SubmitDeck.module.css";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MAX = 50 * 1024 * 1024;
type Picked = { file: File; name: string; cards: number };

const mb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/** Reads deck.json in the browser so the person sees which deck they picked before sending it. */
function inspect(file: File): Promise<Picked> {
  return new Promise((resolve, reject) => {
    if (!file.name.toLowerCase().endsWith(".boldface")) return reject(new Error("Choose a .boldface file. Export one from the BoldFace app or the Deck Editor."));
    if (file.size > MAX) return reject(new Error("Decks can be up to 50 MB."));
    file.arrayBuffer().then((buf) => {
      unzip(new Uint8Array(buf), { filter: (f) => /(^|\/)deck\.json$/.test(f.name) && f.name.split("/").length <= 2 }, (err, files) => {
        const key = files && Object.keys(files).sort((a, b) => a.length - b.length)[0];
        if (err || !key) return reject(new Error("That file isn’t a .boldface deck, or it’s damaged."));
        try {
          const pkg = JSON.parse(strFromU8(files[key]));
          const name = String(pkg?.deck?.name || "").trim();
          const cards = Math.max(pkg?.deck?.cardIDs?.length || 0, pkg?.cards?.length || 0);
          if (!name || !cards) throw new Error();
          resolve({ file, name, cards });
        } catch { reject(new Error("The deck data in that file can’t be read.")); }
      });
    }, () => reject(new Error("That file couldn’t be read.")));
  });
}

export default function SubmitDeckButton({ className = "btn btn-light", label = "Submit a deck" }: { className?: string; label?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [drag, setDrag] = useState(false);
  const [email, setEmail] = useState("");
  const [author, setAuthor] = useState("");
  const [notes, setNotes] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot
  const [error, setError] = useState("");
  const [state, setState] = useState<"form" | "sending" | "sent">("form");
  const [progress, setProgress] = useState(0);

  function open() {
    setError("");
    if (state === "sent") { setState("form"); setPicked(null); setNotes(""); setConsent(false); }
    dialog.current?.showModal();
  }
  const close = () => { if (state !== "sending") dialog.current?.close(); };

  async function choose(file: File | undefined) {
    if (!file) return;
    setError("");
    try { setPicked(await inspect(file)); } catch (e) { setPicked(null); setError((e as Error).message); }
    if (input.current) input.current.value = "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!picked) return setError("Choose a .boldface file first.");
    if (!EMAIL_RE.test(email.trim())) return setError("Enter a valid email address so we can reach you about your deck.");
    if (!consent) return setError("Please confirm the deck can be shared publicly.");
    setError("");
    setState("sending");
    setProgress(0);
    try {
      const cfg = await fetch("/api/submissions", { cache: "no-store" }).then((r) => r.json());
      const fields = { email: email.trim(), author: author.trim(), notes: notes.trim(), consent: true, website, fileName: picked.file.name };
      let res: Response;
      if (cfg.mode === "blob") {
        const { upload } = await import("@vercel/blob/client");
        const base = picked.name.replace(/[^A-Za-z0-9 _-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "Deck";
        const blob = await upload(`decks/${base}.boldface`, picked.file, {
          access: "public",
          handleUploadUrl: "/api/submissions/upload",
          contentType: "application/octet-stream",
          multipart: picked.file.size > 8 * 1024 * 1024,
          onUploadProgress: (p) => setProgress(Math.round(p.percentage)),
        });
        res = await fetch("/api/submissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...fields, pathname: blob.pathname }),
        });
      } else if (cfg.mode === "local") {
        const form = new FormData();
        Object.entries(fields).forEach(([k, v]) => form.append(k, String(v)));
        form.append("file", picked.file);
        res = await fetch("/api/submissions", { method: "POST", body: form });
      } else {
        throw new Error(`Deck submissions aren’t open yet. You can email your deck to ${site.contactEmail}.`);
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Your deck couldn’t be sent. Try again.");
      setState("sent");
    } catch (err) {
      setState("form");
      setError((err as Error).message || `Your deck couldn’t be sent. You can email it to ${site.contactEmail}.`);
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={open}>{label}</button>
      <dialog ref={dialog} className={`dialog ${s.dialog}`} aria-labelledby="submit-title" onCancel={(e) => { if (state === "sending") e.preventDefault(); }}>
        <div className="dialog-body">
          <div className="dialog-head">
            <h2 id="submit-title" className="dialog-title">{state === "sent" ? "Deck submitted" : "Submit a deck"}</h2>
            <button type="button" className="icon-btn" aria-label="Close" onClick={close} disabled={state === "sending"}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>

          {state === "sent" ? (
            <>
              <p className="soft" style={{ margin: 0 }}>
                Thanks! <strong>{picked?.name}</strong> is in the review queue. Once it’s approved it will appear in the Deck Library for anyone to download. We’ll email {email.trim()} if there are any questions.
              </p>
              <button type="button" className="btn btn-ghost" onClick={close}>Close</button>
            </>
          ) : (
            <form onSubmit={submit} noValidate className="dialog-body">
              <p className="muted" style={{ margin: 0 }}>
                Share a deck with other pilots. Every deck is reviewed before it appears in the Deck Library.
              </p>

              <div
                className={`${s.drop} ${drag ? s.dragOver : ""} ${picked ? s.hasFile : ""}`}
                role="button"
                tabIndex={0}
                aria-label={picked ? `Selected ${picked.name}. Choose a different file` : "Choose a .boldface file"}
                onClick={() => input.current?.click()}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.current?.click(); } }}
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); choose(e.dataTransfer.files?.[0]); }}
              >
                {picked ? (
                  <>
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#6fcf9b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></svg>
                    <span className={s.dropTitle}>{picked.name}</span>
                    <span className={s.dropMeta}>{picked.cards} {picked.cards === 1 ? "card" : "cards"} · {picked.file.name} · {mb(picked.file.size)}</span>
                    <span className={s.dropHint}>Choose a different file</span>
                  </>
                ) : (
                  <>
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#F2B544" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>
                    <span className={s.dropTitle}>Drag your .boldface file here</span>
                    <span className={s.dropHint}>or click to choose one · up to 50 MB</span>
                  </>
                )}
                <input ref={input} type="file" accept=".boldface" hidden onChange={(e) => choose(e.target.files?.[0])} />
              </div>
              <p className={s.help}>Export a deck from the BoldFace app, or download one from the Deck Editor.</p>

              <div className="field">
                <label htmlFor="sd-email">Your email</label>
                <input id="sd-email" className="input" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                <span className={s.help}>Only used to contact you about this deck. It isn’t shown publicly.</span>
              </div>
              <div className="field">
                <label htmlFor="sd-author">Name to show in the Library (optional)</label>
                <input id="sd-author" className="input" maxLength={60} placeholder="e.g. Erik M., CFI" value={author} onChange={(e) => setAuthor(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="sd-notes">Note for the reviewer (optional)</label>
                <textarea id="sd-notes" className="input" rows={3} maxLength={2000} style={{ minHeight: 90 }} placeholder="Who it’s for, sources you used…" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <label className={s.consent}>
                <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); if (e.target.checked) setError((m) => (m.includes("shared publicly") ? "" : m)); }} />
                <span>I made this deck or have the right to share it. Once approved, anyone can download it from the Deck Library.</span>
              </label>
              <div className="hp" aria-hidden="true">
                <label htmlFor="sd-website">Website</label>
                <input id="sd-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </div>

              {error && <p role="alert" className="error">{error}</p>}
              <button type="submit" className="btn btn-accent btn-lg" disabled={state === "sending"}>
                {state === "sending" ? (progress > 0 && progress < 100 ? `Uploading… ${progress}%` : "Sending…") : "Submit for review"}
              </button>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
