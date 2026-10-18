import fs from "node:fs";
import path from "node:path";

export type Block =
  | { type: "h2" | "h3" | "p" | "label"; text: string }
  | { type: "ul"; items: string[] };

export type Section = { title: string; blocks: Block[] };

/**
 * Reads content/privacy-policy.md (a copy of the app's PRIVACY_POLICY.md).
 * Only the policy itself is used: everything after the first "---" line
 * (App Store summary and nutrition-label notes) is ignored.
 */
export function loadPolicy() {
  const raw = fs.readFileSync(path.join(process.cwd(), "content", "privacy-policy.md"), "utf8");
  const policy = raw.split(/\n---\n/)[0];
  const lines = policy.split("\n");

  let updated = "";
  let intro = "";
  const sections: Section[] = [];
  let current: Section | null = null;
  let inIntro = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const m = line.match(/^\*Last Updated:\s*(.+?)\*?$/i);
    if (m) { updated = m[1]; continue; }
    if (line.startsWith("## ")) {
      const title = line.slice(3);
      if (title === "Introduction") { inIntro = true; current = null; continue; }
      inIntro = false;
      current = { title, blocks: [] };
      sections.push(current);
      continue;
    }
    if (inIntro) { intro += (intro ? " " : "") + line; continue; }
    if (!current) continue; // title line
    if (line.startsWith("### ")) { current.blocks.push({ type: "h3", text: line.slice(4) }); continue; }
    if (line.startsWith("- ")) {
      const last = current.blocks[current.blocks.length - 1];
      if (last && last.type === "ul") last.items.push(line.slice(2));
      else current.blocks.push({ type: "ul", items: [line.slice(2)] });
      continue;
    }
    if (line === "Important Details:") { current.blocks.push({ type: "label", text: line.replace(/:$/, "") }); continue; }
    current.blocks.push({ type: "p", text: line });
  }
  return { updated, intro, sections };
}
