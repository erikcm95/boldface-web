"use client";

import { useCloudKit } from "./CloudKitProvider";

/** Shows its children only to signed-in users; everyone else gets a sign-in prompt. */
export default function RequireSignIn({ feature, children }: { feature: string; children: React.ReactNode }) {
  const { status, requestSignIn } = useCloudKit();

  if (status === "signedIn") return <>{children}</>;

  return (
    <div className="gate">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#F2B544" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </svg>
      <h2 className="gate-title">Sign in to use the {feature}</h2>
      <p className="gate-text">
        The {feature} works with the cards and decks in your private iCloud, so you’ll need to sign in with the same Apple ID you use in the BoldFace app.
        Your data goes straight between your browser and iCloud. BoldFace never stores a copy.
      </p>
      {status === "loading" && <p className="muted" style={{ margin: 0 }} aria-live="polite">Checking your sign-in…</p>}
      {status === "error" && <p className="error">Couldn’t reach iCloud. Check your connection and reload the page.</p>}
      {status === "unavailable" && <p className="muted" style={{ margin: 0 }}>Sign-in isn’t available right now.</p>}
      {(status === "signedOut" || status === "loading") && (
        <button type="button" className="btn btn-light btn-lg" onClick={requestSignIn} disabled={status === "loading"}>
          Sign in with your Apple ID
        </button>
      )}
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>
        Just browsing? The <a href="/library">Deck Library</a> is open to everyone, no sign-in needed.
      </p>
    </div>
  );
}
