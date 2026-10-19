/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Deck editing against the user's private iCloud (CloudKit JS), matching the app:
 *  - CustomDeck records use the same fields as CloudKitSyncManager.swift
 *  - every change stamps lastModified = now (last-write-wins)
 *  - deleting a deck stores a tombstone (isDeleted = 1); nothing is hard-deleted
 *  - .boldface export matches DeckSharingManager.swift (ZIP: deck.json + images/)
 */
import { zipSync, strToU8 } from "fflate";
import { type Card, type Deck, imageUrls, saveWithRetry, uuid } from "./cards";

/** Same 8 styles as DeckStyle.presets in the app. */
export const DECK_STYLES = [
  { name: "Blue", colors: ["#007AFF", "#0051D5"] },
  { name: "Orange", colors: ["#FF9500", "#FF6B00"] },
  { name: "Gold", colors: ["#FFCC00", "#FF9500"] },
  { name: "Red", colors: ["#FF3B30", "#C7001E"] },
  { name: "Purple", colors: ["#AF52DE", "#7C2FA3"] },
  { name: "Green", colors: ["#34C759", "#248A3D"] },
  { name: "Teal", colors: ["#00C7BE", "#008B87"] },
  { name: "Indigo", colors: ["#5856D6", "#3634A3"] },
];

export const gradientOf = (colors: string[]) =>
  `linear-gradient(135deg, ${colors[0] ?? "#007AFF"}, ${colors[1] ?? colors[0] ?? "#0051D5"})`;

/** A card shown in the deck editor: built-in (from flashcards.json) or the user's own. */
export type AnyCard = { id: string; question: string; answer: string; categories: string[]; ratings?: string[]; ref?: string; imageName?: string | null; questionImageName?: string | null; userMade: boolean; modifiedDate?: number };

let builtInCache: Promise<AnyCard[]> | null = null;
export function loadBuiltInCards(): Promise<AnyCard[]> {
  builtInCache ??= fetch("/data/flashcards.json")
    .then((r) => r.json())
    .then((d) => (d.cards as any[]).map((c) => ({ ...c, userMade: false })));
  return builtInCache;
}

export const fromUserCard = (c: Card): AnyCard => ({ ...c, userMade: true });

function deckRecord(deck: Deck, extra: Partial<Record<string, any>> = {}) {
  return {
    recordType: "CustomDeck",
    recordName: deck.id,
    ...(deck.changeTag ? { recordChangeTag: deck.changeTag } : {}),
    fields: {
      id: { value: deck.id, type: "STRING" },
      name: { value: deck.name, type: "STRING" },
      deckDescription: { value: deck.description, type: "STRING" },
      cardIDs: { value: deck.cardIDs, type: "STRING_LIST" },
      iconName: { value: deck.iconName, type: "STRING" },
      gradientColors: { value: deck.gradientColors, type: "STRING_LIST" },
      createdDate: { value: deck.createdDate, type: "TIMESTAMP" },
      lastModified: { value: Date.now(), type: "TIMESTAMP" },
      isDeleted: { value: 0, type: "INT64" },
      ...extra,
    },
  };
}

async function save(db: any, deck: Deck, extra?: Partial<Record<string, any>>): Promise<Deck> {
  const [saved] = await saveWithRetry(db, [deckRecord(deck, extra)]);
  return { ...deck, lastModified: Date.now(), changeTag: saved?.recordChangeTag };
}

export function createDeck(db: any, name: string, description: string, colors: string[]) {
  const now = Date.now();
  return save(db, {
    id: uuid(), name: name.trim(), description: description.trim(), cardIDs: [],
    iconName: "", gradientColors: colors, createdDate: now, lastModified: now,
  });
}

export function updateDeck(db: any, deck: Deck, changes: Partial<Pick<Deck, "name" | "description" | "gradientColors" | "cardIDs">>) {
  return save(db, { ...deck, ...changes });
}

export function deleteDeck(db: any, deck: Deck) {
  return save(db, deck, { isDeleted: { value: 1, type: "INT64" } });
}

/** Swift's .iso8601 date decoding rejects fractional seconds, so drop them. */
const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");

/**
 * Builds a .boldface file the app can import. Built-in cards are included by reference
 * (the app links them to its own copy); images are included for the user's own cards.
 */
export async function exportDeck(db: any, deck: Deck, cards: AnyCard[]): Promise<{ blob: Blob; fileName: string; missingImages: number }> {
  const files: Record<string, Uint8Array> = {};
  const names = [...new Set(cards.filter((c) => c.userMade).flatMap((c) => [c.imageName, c.questionImageName]).filter((n): n is string => !!n))];
  let missingImages = 0;
  if (names.length) {
    const urls = await imageUrls(db, names);
    for (const n of names) {
      try {
        const res = await fetch(urls[n]);
        if (!res.ok) throw new Error(String(res.status));
        files[`images/${n}`] = new Uint8Array(await res.arrayBuffer());
      } catch { missingImages++; }
    }
  }
  const pkg = {
    deck: {
      id: deck.id, name: deck.name, description: deck.description, cardIDs: deck.cardIDs,
      createdDate: iso(deck.createdDate || Date.now()), lastModified: iso(deck.lastModified || Date.now()),
      iconName: deck.iconName, gradientColors: deck.gradientColors, isDeleted: false,
    },
    cards: cards.map((c) => ({
      id: c.id, question: c.question, answer: c.answer, categories: c.categories, ratings: c.ratings ?? ["PPL"],
      ...(c.ref ? { ref: c.ref } : {}),
      ...(c.imageName ? { imageName: c.imageName } : {}),
      ...(c.questionImageName ? { questionImageName: c.questionImageName } : {}),
      modifiedDate: iso(c.modifiedDate || Date.now()), isDeleted: false,
    })),
    version: "1.0",
    exportDate: iso(Date.now()),
  };
  files["deck.json"] = strToU8(JSON.stringify(pkg, null, 2));
  const zip = zipSync(files, { level: 6 });
  const safe = deck.name.replace(/[^A-Za-z0-9 _-]/g, "").trim() || "Deck";
  return { blob: new Blob([zip], { type: "application/x-boldface-deck" }), fileName: `${safe}.boldface`, missingImages };
}
