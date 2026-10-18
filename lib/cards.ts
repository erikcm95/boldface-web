/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Reads and writes the BoldFace app's CloudKit records from the browser (CloudKit JS),
 * following the same last-write-wins rules as the app:
 *  - every save sets modifiedDate (cards) / lastModified (decks) to "now"
 *  - saves include the record's change tag; on a conflict we re-fetch and save again (ours is newest)
 *  - deleted cards become tombstones (isDeleted = 1), never hard-deleted
 * Record layouts match CloudKitSyncManager.swift in the app.
 */

export const CATEGORIES = ["Plane and Pilot", "Aircraft Systems", "Weather", "Regulations", "Airspace and Navigation"] as const;
export const USER_MADE = "User Made";
export const RATINGS = ["PPL", "IR", "CPL"] as const;

export type Card = {
  id: string;
  question: string;
  answer: string;
  ref: string;
  categories: string[];
  ratings: string[];
  imageName: string | null;
  questionImageName: string | null;
  modifiedDate: number;
  changeTag?: string;
};

export type Deck = { id: string; name: string; cardIDs: string[]; changeTag?: string };

const uuid = () => crypto.randomUUID().toUpperCase();

async function queryAll(db: any, recordType: string): Promise<any[]> {
  const out: any[] = [];
  let res = await db.performQuery({ recordType }, { resultsLimit: 200 });
  for (;;) {
    if (res.hasErrors) throw res.errors[0];
    out.push(...res.records);
    if (!res.moreComing) break;
    res = await db.performQuery(res);
  }
  return out;
}

function toCard(r: any): Card | null {
  const f = r.fields || {};
  if (f.isDeleted?.value) return null;
  return {
    id: f.id?.value ?? r.recordName,
    question: f.question?.value ?? "",
    answer: f.answer?.value ?? "",
    ref: f.ref?.value ?? "",
    categories: f.categories?.value ?? [USER_MADE],
    ratings: f.ratings?.value ?? ["PPL"],
    imageName: f.imageName?.value ?? null,
    questionImageName: f.questionImageName?.value ?? null,
    modifiedDate: f.modifiedDate?.value ?? 0,
    changeTag: r.recordChangeTag,
  };
}

export async function loadCards(db: any): Promise<Card[]> {
  const recs = await queryAll(db, "UserFlashcard");
  return recs.map(toCard).filter((c): c is Card => !!c).sort((a, b) => b.modifiedDate - a.modifiedDate);
}

export async function loadDecks(db: any): Promise<Deck[]> {
  const recs = await queryAll(db, "CustomDeck");
  return recs
    .filter((r) => !r.fields?.isDeleted?.value)
    .map((r) => ({ id: r.fields?.id?.value ?? r.recordName, name: r.fields?.name?.value ?? "Untitled deck", cardIDs: r.fields?.cardIDs?.value ?? [], changeTag: r.recordChangeTag }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Saves records, retrying once per record with a fresh change tag if CloudKit reports a conflict. */
async function saveWithRetry(db: any, records: any[]): Promise<any[]> {
  const res = await db.saveRecords(records);
  if (!res.hasErrors) return res.records;
  const conflicts = res.errors.filter((e: any) => e.ckErrorCode === "CONFLICT" && e.recordName);
  const other = res.errors.filter((e: any) => !(e.ckErrorCode === "CONFLICT" && e.recordName));
  if (other.length) throw other[0];
  const names = conflicts.map((e: any) => e.recordName);
  const latest = await db.fetchRecords(names);
  const tags: Record<string, string> = {};
  for (const r of latest.records) tags[r.recordName] = r.recordChangeTag;
  const retry = records.filter((r) => names.includes(r.recordName)).map((r) => ({ ...r, recordChangeTag: tags[r.recordName] }));
  const res2 = await db.saveRecords(retry);
  if (res2.hasErrors) throw res2.errors[0];
  return [...res.records, ...res2.records];
}

/** Converts any picked image to a JPEG (max 2048 px, quality 0.8) like the app does. */
export async function toJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Image conversion failed"))), "image/jpeg", 0.8));
}

export async function uploadImage(db: any, blob: Blob): Promise<string> {
  const name = `${uuid()}.jpg`;
  const file = new File([blob], name, { type: "image/jpeg" });
  await saveWithRetry(db, [{
    recordType: "CardImage",
    recordName: name,
    fields: {
      imageName: { value: name, type: "STRING" },
      imageAsset: { value: file },
      uploadDate: { value: Date.now(), type: "TIMESTAMP" },
    },
  }]);
  return name;
}

export async function deleteImages(db: any, names: (string | null | undefined)[]) {
  const list = names.filter((n): n is string => !!n);
  if (!list.length) return;
  try { await db.deleteRecords(list); } catch (e) { console.warn("Image cleanup failed", e); }
}

/** Returns a temporary download URL for each image name that exists. */
export async function imageUrls(db: any, names: string[]): Promise<Record<string, string>> {
  if (!names.length) return {};
  const res = await db.fetchRecords(names);
  const out: Record<string, string> = {};
  for (const r of res.records || []) {
    const url = r.fields?.imageAsset?.value?.downloadURL;
    if (url) out[r.recordName] = url;
  }
  return out;
}

function cardRecord(card: Card, isDeleted = false) {
  const fields: Record<string, { value: any; type: string }> = {
      id: { value: card.id, type: "STRING" },
      question: { value: card.question, type: "STRING" },
      answer: { value: card.answer, type: "STRING" },
      categories: { value: card.categories, type: "STRING_LIST" },
      ratings: { value: card.ratings, type: "STRING_LIST" },
      ref: { value: card.ref || null, type: "STRING" },
      imageName: { value: card.imageName, type: "STRING" },
      questionImageName: { value: card.questionImageName, type: "STRING" },
      modifiedDate: { value: Date.now(), type: "TIMESTAMP" },
      isDeleted: { value: isDeleted ? 1 : 0, type: "INT64" },
  };
  // New records: leave empty optional fields out. Updates: send null to clear them.
  if (!card.changeTag) for (const k of Object.keys(fields)) if (fields[k].value === null) delete fields[k];
  return {
    recordType: "UserFlashcard",
    recordName: card.id,
    ...(card.changeTag ? { recordChangeTag: card.changeTag } : {}),
    fields,
  };
}

export type CardDraft = Omit<Card, "id" | "modifiedDate" | "changeTag"> & { id?: string; changeTag?: string };

export async function saveCard(db: any, draft: CardDraft): Promise<Card> {
  const categories = draft.categories.filter((c) => c !== USER_MADE).concat(USER_MADE);
  const card: Card = {
    ...draft,
    id: draft.id || uuid(),
    question: draft.question.trim(),
    answer: draft.answer.trim(),
    ref: draft.ref.trim(),
    categories,
    ratings: draft.ratings.length ? draft.ratings : ["PPL"],
    modifiedDate: Date.now(),
  };
  const [saved] = await saveWithRetry(db, [cardRecord(card)]);
  return { ...card, changeTag: saved?.recordChangeTag };
}

export async function tombstoneCards(db: any, cards: Card[]) {
  for (let i = 0; i < cards.length; i += 100) {
    await saveWithRetry(db, cards.slice(i, i + 100).map((c) => cardRecord(c, true)));
  }
  await deleteImages(db, cards.flatMap((c) => [c.imageName, c.questionImageName]));
}

/** Adds/removes a card from decks so its membership matches `wanted`. */
export async function setDeckMembership(db: any, decks: Deck[], cardId: string, wanted: Set<string>) {
  const changed = decks.filter((d) => d.cardIDs.includes(cardId) !== wanted.has(d.id));
  if (!changed.length) return;
  const records = changed.map((d) => ({
    recordType: "CustomDeck",
    recordName: d.id,
    ...(d.changeTag ? { recordChangeTag: d.changeTag } : {}),
    fields: {
      cardIDs: { value: wanted.has(d.id) ? [...d.cardIDs, cardId] : d.cardIDs.filter((x) => x !== cardId), type: "STRING_LIST" },
      lastModified: { value: Date.now(), type: "TIMESTAMP" },
    },
  }));
  await saveWithRetry(db, records);
}
