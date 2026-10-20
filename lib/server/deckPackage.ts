import "server-only";
import { strFromU8, unzipSync } from "fflate";

/** What the review email, review page and Deck Library show about a submitted deck. */
export type DeckSummary = {
  deckId: string;
  name: string;
  description: string;
  cardCount: number;
  userCardCount: number;
  imageCount: number;
  categories: string[];
  ratings: string[];
  gradientColors: string[];
  sample: { question: string; answer: string }[];
};

export const MAX_DECK_BYTES = 50 * 1024 * 1024;
const MAX_UNZIPPED = 200 * 1024 * 1024;
const str = (v: unknown, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/**
 * Checks that a file is a real .boldface deck (a ZIP with deck.json, optionally inside one folder,
 * the way the app exports it) and summarizes it. Throws an Error with a user-facing message.
 */
export function readDeckPackage(data: Uint8Array): DeckSummary {
  if (data.length < 22 || data[0] !== 0x50 || data[1] !== 0x4b) throw new Error("That file isn’t a .boldface deck.");
  if (data.length > MAX_DECK_BYTES) throw new Error("Decks can be up to 50 MB.");

  let total = 0;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(data, {
      filter: (f) => {
        total += f.originalSize;
        if (total > MAX_UNZIPPED) throw new Error("too big");
        return !f.name.startsWith("__MACOSX/") && !f.name.endsWith("/");
      },
    });
  } catch {
    throw new Error("That file isn’t a .boldface deck, or it’s damaged.");
  }

  const jsonPath = Object.keys(files)
    .filter((n) => n === "deck.json" || /^[^/]+\/deck\.json$/.test(n))
    .sort((a, b) => a.length - b.length)[0];
  if (!jsonPath) throw new Error("That file is missing its deck data (deck.json).");
  const root = jsonPath.slice(0, -"deck.json".length);

  let pkg: any;
  try { pkg = JSON.parse(strFromU8(files[jsonPath])); } catch { throw new Error("The deck data in that file can’t be read."); }
  const deck = pkg?.deck;
  if (!deck || typeof deck !== "object" || !Array.isArray(pkg.cards)) throw new Error("The deck data in that file can’t be read.");

  const name = str(deck.name, 120);
  if (!name) throw new Error("That deck has no name.");
  const cards: any[] = pkg.cards.filter((c: any) => c && typeof c === "object" && !c.isDeleted);
  const cardIDs = strs(deck.cardIDs);
  const cardCount = Math.max(cardIDs.length, cards.length);
  if (!cardCount) throw new Error("That deck has no cards.");

  const userCards = cards.filter((c) => strs(c.categories).includes("User Made"));
  const imageCount = Object.keys(files).filter((n) => n.startsWith(`${root}images/`)).length;
  const categories = [...new Set(cards.flatMap((c) => strs(c.categories)).filter((c) => c !== "User Made"))].slice(0, 12);
  const ratings = ["PPL", "IR", "CPL"].filter((r) => cards.some((c) => strs(c.ratings).includes(r)));
  const gradientColors = strs(deck.gradientColors).filter((c) => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 2);

  return {
    deckId: str(deck.id, 64),
    name,
    description: str(deck.description ?? deck.deckDescription, 1000),
    cardCount,
    userCardCount: userCards.length,
    imageCount,
    categories,
    ratings,
    gradientColors: gradientColors.length === 2 ? gradientColors : ["#007AFF", "#0051D5"],
    sample: cards.slice(0, 5).map((c) => ({ question: str(c.question, 400), answer: str(c.answer, 400) })),
  };
}

/** One card as shown on the review page. */
export type ReviewCard = {
  id: string;
  question: string;
  answer: string;
  categories: string[];
  ratings: string[];
  ref: string;
  questionImage: string | null; // file name inside the deck's images/ folder, if present
  answerImage: string | null;
  builtIn: boolean;             // a BoldFace built-in card referenced by the deck
  missing: boolean;             // in the deck's card list but not in the file or the built-in set
};

type BuiltIn = { id: string; question: string; answer: string; categories?: string[]; ratings?: string[]; ref?: string };

function unzipDeck(data: Uint8Array, only?: (name: string) => boolean) {
  let total = 0;
  const files = unzipSync(data, {
    filter: (f) => {
      if (f.name.startsWith("__MACOSX/") || f.name.endsWith("/")) return false;
      if (only && !only(f.name)) return false;
      total += f.originalSize;
      if (total > MAX_UNZIPPED) throw new Error("too big");
      return true;
    },
  });
  return files;
}

/** Every card in a deck, in deck order, with built-in cards filled in from BoldFace's card set. */
export function readDeckCards(data: Uint8Array, builtIns: Map<string, BuiltIn>): { cards: ReviewCard[]; imageNames: string[] } {
  const files = unzipDeck(data);
  const jsonPath = Object.keys(files)
    .filter((n) => n === "deck.json" || /^[^/]+\/deck\.json$/.test(n))
    .sort((a, b) => a.length - b.length)[0];
  if (!jsonPath) throw new Error("deck.json is missing.");
  const root = jsonPath.slice(0, -"deck.json".length);
  const pkg = JSON.parse(strFromU8(files[jsonPath]));
  const imageNames = Object.keys(files).filter((n) => n.startsWith(`${root}images/`)).map((n) => n.slice(`${root}images/`.length));
  const have = new Set(imageNames);

  const inFile = new Map<string, any>();
  for (const c of Array.isArray(pkg.cards) ? pkg.cards : []) if (c && typeof c === "object" && !c.isDeleted && c.id) inFile.set(String(c.id), c);
  const order = strs(pkg?.deck?.cardIDs);
  const ids = [...order, ...[...inFile.keys()].filter((id) => !order.includes(id))];

  const cards = ids.map((id): ReviewCard => {
    const c = inFile.get(id);
    const b = builtIns.get(id);
    const src: any = c ?? b;
    if (!src) return { id, question: "", answer: "", categories: [], ratings: [], ref: "", questionImage: null, answerImage: null, builtIn: false, missing: true };
    const img = (n: unknown) => (typeof n === "string" && n && have.has(n) ? n : null);
    return {
      id,
      question: str(src.question, 5000),
      answer: str(src.answer, 10000),
      categories: strs(src.categories),
      ratings: strs(src.ratings),
      ref: str(src.ref, 500),
      questionImage: c ? img(c.questionImageName) : null,
      answerImage: c ? img(c.imageName) : null,
      builtIn: !!b && !strs(src.categories).includes("User Made"),
      missing: false,
    };
  });
  return { cards, imageNames };
}

/** One image from a deck's images/ folder, or null. */
export function readDeckImage(data: Uint8Array, name: string): Uint8Array | null {
  if (!/^[A-Za-z0-9._-]+$/.test(name)) return null;
  const files = unzipDeck(data, (n) => n === `images/${name}` || /^[^/]+\/images\//.test(n) && n.endsWith(`/images/${name}`));
  const key = Object.keys(files)[0];
  return key ? files[key] : null;
}
