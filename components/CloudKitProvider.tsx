"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { cloudkit } from "@/lib/site";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window { CloudKit?: any }
}

const SCRIPT_SRC = "https://cdn.apple-cloudkit.com/ck/2/cloudkit.js";
const CONTAINER_ID = process.env.NEXT_PUBLIC_CLOUDKIT_CONTAINER || cloudkit.containerId;
const API_TOKEN = process.env.NEXT_PUBLIC_CLOUDKIT_API_TOKEN || cloudkit.apiToken;
const ENVIRONMENT = process.env.NEXT_PUBLIC_CLOUDKIT_ENV || cloudkit.environment;

export const SIGN_IN_BUTTON_ID = "ck-sign-in-button";
export const SIGN_OUT_BUTTON_ID = "ck-sign-out-button";

export type AuthStatus = "unavailable" | "loading" | "signedOut" | "signedIn" | "error";
export type SyncSummary = { cards: number; decks: number; checkedAt: Date } | null;

type Ctx = {
  status: AuthStatus;
  userRecordName: string | null;
  summary: SyncSummary;
  summaryError: string | null;
  refresh: () => void;
  /** The private CloudKit database for the signed-in user (null when signed out). */
  database: any | null;
  /** Opens the sign-in window from anywhere on the site. */
  requestSignIn: () => void;
  /** Used by the nav to register the function that opens its sign-in window. */
  registerSignIn: (fn: () => void) => void;
};

const CloudKitContext = createContext<Ctx>({
  status: "unavailable", userRecordName: null, summary: null, summaryError: null, refresh: () => {}, database: null,
  requestSignIn: () => {}, registerSignIn: () => {},
});

export const useCloudKit = () => useContext(CloudKitContext);

function loadScript(): Promise<any> {
  if (window.CloudKit) return Promise.resolve(window.CloudKit);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const s = existing ?? document.createElement("script");
    s.addEventListener("load", () => (window.CloudKit ? resolve(window.CloudKit) : reject(new Error("CloudKit JS missing"))));
    s.addEventListener("error", () => reject(new Error("Could not load CloudKit JS")));
    if (!existing) { s.src = SCRIPT_SRC; s.async = true; document.head.appendChild(s); }
  });
}

/** Counts active (non-tombstoned) records of a type in the user's private default zone. */
async function countActive(db: any, recordType: string): Promise<number> {
  let count = 0;
  let response = await db.performQuery({ recordType }, { resultsLimit: 200 });
  for (;;) {
    if (response.hasErrors) throw response.errors[0];
    for (const r of response.records) if (!r.fields?.isDeleted?.value) count++;
    if (!response.moreComing) break;
    response = await db.performQuery(response);
  }
  return count;
}

export default function CloudKitProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(API_TOKEN ? "loading" : "unavailable");
  const [userRecordName, setUserRecordName] = useState<string | null>(null);
  const [summary, setSummary] = useState<SyncSummary>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const container = useRef<any>(null);
  const [database, setDatabase] = useState<any>(null);
  const opener = useRef<() => void>(() => {});
  const requestSignIn = useCallback(() => opener.current(), []);
  const registerSignIn = useCallback((fn: () => void) => { opener.current = fn; }, []);

  const loadSummary = useCallback(async () => {
    const db = container.current?.privateCloudDatabase;
    if (!db) return;
    setSummaryError(null);
    try {
      const [cards, decks] = await Promise.all([countActive(db, "UserFlashcard"), countActive(db, "CustomDeck")]);
      setSummary({ cards, decks, checkedAt: new Date() });
    } catch (e: any) {
      console.error("CloudKit query failed", e);
      setSummaryError(e?.ckErrorCode || e?.message || "Could not read your iCloud data.");
    }
  }, []);

  useEffect(() => {
    if (!API_TOKEN) return;
    let cancelled = false;

    const signedOut = () => {
      if (cancelled) return;
      setStatus("signedOut"); setUserRecordName(null); setSummary(null); setDatabase(null);
      container.current.whenUserSignsIn().then(signedIn).catch((e: unknown) => console.error(e));
    };
    const signedIn = (user: any) => {
      if (cancelled) return;
      setStatus("signedIn"); setUserRecordName(user?.userRecordName ?? null);
      setDatabase(container.current.privateCloudDatabase);
      loadSummary();
      container.current.whenUserSignsOut().then(signedOut).catch((e: unknown) => console.error(e));
    };

    loadScript()
      .then((CloudKit) => {
        if (cancelled) return;
        CloudKit.configure({
          containers: [{
            containerIdentifier: CONTAINER_ID,
            apiTokenAuth: {
              apiToken: API_TOKEN,
              persist: true,
              signInButton: { id: SIGN_IN_BUTTON_ID, theme: "white" },
              signOutButton: { id: SIGN_OUT_BUTTON_ID, theme: "black" },
            },
            environment: ENVIRONMENT,
          }],
        });
        container.current = CloudKit.getDefaultContainer();
        return container.current.setUpAuth().then((user: any) => (user ? signedIn(user) : signedOut()));
      })
      .catch((e) => { console.error("CloudKit setup failed", e); if (!cancelled) setStatus("error"); });

    return () => { cancelled = true; };
  }, [loadSummary]);

  return (
    <CloudKitContext.Provider value={{ status, userRecordName, summary, summaryError, refresh: loadSummary, database, requestSignIn, registerSignIn }}>
      {children}
    </CloudKitContext.Provider>
  );
}
