"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { site } from "@/lib/site";

export type SupportDialogHandle = { open: () => void };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const SupportDialog = forwardRef<SupportDialogHandle>(function SupportDialog(_, ref) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [error, setError] = useState("");
  const [state, setState] = useState<"form" | "sending" | "sent">("form");

  useImperativeHandle(ref, () => ({
    open: () => {
      setError("");
      if (state === "sent") setState("form");
      dialog.current?.showModal();
    },
  }));

  const close = () => dialog.current?.close();

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const em = email.trim();
    const msg = message.trim();
    if (!EMAIL_RE.test(em)) return setError("Enter a valid email address so we can reply.");
    if (!msg) return setError("Write a message first.");
    setError("");
    setState("sending");
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em, message: msg, website }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "send failed");
      setMessage("");
      setState("sent");
    } catch {
      setState("form");
      setError(`We couldn’t send that right now. Please email ${site.contactEmail} directly.`);
    }
  }

  return (
    <dialog ref={dialog} className="dialog" aria-labelledby="support-title">
      <div className="dialog-body">
        <div className="dialog-head">
          <h2 id="support-title" className="dialog-title">{state === "sent" ? "Message sent" : "Contact support"}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={close}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        {state === "sent" ? (
          <>
            <p className="soft" style={{ margin: 0 }}>Thanks. Your message is on its way, and we’ll reply to {email.trim()}.</p>
            <button type="button" className="btn btn-ghost" onClick={close}>Close</button>
          </>
        ) : (
          <form onSubmit={send} noValidate className="dialog-body">
            <p className="muted" style={{ margin: 0 }}>
              Questions, bug reports or card corrections. Your message goes to {site.contactEmail} and we’ll reply to the email you enter.
            </p>
            <div className="field">
              <label htmlFor="sup-email">Your email</label>
              <input id="sup-email" className="input" type="email" autoComplete="email" placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="sup-msg">Message</label>
              <textarea id="sup-msg" className="input" rows={6} placeholder="How can we help?" maxLength={5000}
                value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
            <div className="hp" aria-hidden="true">
              <label htmlFor="sup-website">Website</label>
              <input id="sup-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>
            {error && <p role="alert" className="error">{error}</p>}
            <button type="submit" className="btn btn-accent btn-lg" disabled={state === "sending"}>
              {state === "sending" ? "Sending…" : "Send message"}
            </button>
          </form>
        )}
      </div>
    </dialog>
  );
});

export default SupportDialog;
