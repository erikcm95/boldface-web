"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { approve, checkToken, remove, validId } from "@/lib/server/submissions";

/** Approve / reject / remove a deck. Only works with the signed token from the review email. */
export async function reviewAction(form: FormData) {
  const id = String(form.get("id") || "");
  const t = String(form.get("t") || "");
  const action = String(form.get("op") || "");
  if (!validId(id) || !checkToken(id, t)) redirect("/review/denied");
  let done = "";
  if (action === "approve") done = (await approve(id)) ? "approved" : "missing";
  else if (action === "reject" || action === "remove") done = (await remove(id)) ? (action === "reject" ? "rejected" : "removed") : "missing";
  revalidatePath("/library");
  redirect(`/review/${id}?t=${encodeURIComponent(t)}&done=${done}`);
}
