"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { SIGN_IN_BUTTON_ID, SIGN_OUT_BUTTON_ID, useCloudKit } from "./CloudKitProvider";

export type SignInDialogHandle = { open: () => void };

const SignInDialog = forwardRef<SignInDialogHandle>(function SignInDialog(_, ref) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { status, summary, summaryError, refresh } = useCloudKit();
  useImperativeHandle(ref, () => ({ open: () => dialog.current?.showModal() }));

  const signedIn = status === "signedIn";
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

  // The CloudKit-rendered button containers must stay in the DOM at all times,
  // so they are hidden with CSS rather than unmounted.
  return (
    <dialog ref={dialog} className="dialog" aria-labelledby="signin-title" style={{ maxWidth: 440 }}>
      <div className="dialog-body">
        <div className="dialog-head">
          <h2 id="signin-title" className="dialog-title">{signedIn ? "You’re signed in" : "Sign in to sync"}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={() => dialog.current?.close()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <div hidden={signedIn} className="dialog-body">
          <p className="muted" style={{ margin: 0, fontSize: 16 }}>
            Use the same Apple ID you use in the BoldFace app. Your decks and custom cards sync both ways, so anything you build here shows up on your iPhone and iPad.
          </p>
          {status === "loading" && <p className="muted" style={{ margin: 0 }}>Connecting to iCloud…</p>}
          {status === "error" && <p className="error">Couldn’t reach iCloud. Check your connection and reload the page.</p>}
          <div id={SIGN_IN_BUTTON_ID} className="ck-button" />
          <div className="signin-notes">
            <div><span>—</span><span>Custom cards and decks sync with the app</span></div>
            <div><span>—</span><span>Your data stays in your private iCloud. BoldFace never stores a copy</span></div>
          </div>
        </div>

        <div hidden={!signedIn} className="dialog-body">
          <div className="sync-status">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6FCF9B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.8A6 6 0 0 0 4.5 12a3.5 3.5 0 0 0 .5 7z" /><path d="m9 14 2 2 4-4" /></svg>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontWeight: 600 }}>Connected to your iCloud</span>
              <span className="muted" style={{ fontSize: 14 }} aria-live="polite">
                {summaryError
                  ? "Signed in, but your cards couldn’t be read yet."
                  : summary
                    ? `${plural(summary.cards, "custom card")} · ${plural(summary.decks, "deck")}`
                    : "Reading your cards and decks…"}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <button type="button" className="btn btn-accent" style={{ flex: "1 1 140px" }} onClick={refresh}>Sync now</button>
            <div id={SIGN_OUT_BUTTON_ID} className="ck-button" style={{ flex: "1 1 140px" }} />
          </div>
        </div>
      </div>
    </dialog>
  );
});

export default SignInDialog;
