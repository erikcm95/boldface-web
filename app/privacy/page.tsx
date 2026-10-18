import type { Metadata } from "next";
import { Fragment } from "react";
import { loadPolicy } from "@/lib/policy";
import { site } from "@/lib/site";
import s from "./privacy.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How BoldFace handles your information in the iOS app and on the website.",
};

function smart(t: string) {
  return t
    .replace(/(^|[\s(])"/g, "$1“")
    .replace(/"/g, "”")
    .replace(/'/g, "’")
    .replace(/ > /g, " › ");
}

/** Renders **bold** and the contact email as a link. */
function Inline({ text }: { text: string }) {
  const parts = smart(text).split(/(\*\*[^*]+\*\*|[\w.+-]+@[\w-]+\.[\w.]+)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
        if (p === site.contactEmail) return <a key={i} href={`mailto:${p}`}>{p}</a>;
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

function formatDate(d: string) {
  return d.replace(/^(\w+) 0?(\d+),/, "$1 $2,");
}

export default function PrivacyPage() {
  const { updated, intro, sections } = loadPolicy();
  return (
    <>
      <header className={`container ${s.head}`}>
        <div className="eyebrow">Last updated {formatDate(updated)}</div>
        <h1 className="display page-title">Privacy Policy</h1>
        <p className={s.intro}><Inline text={intro} /></p>
      </header>

      <div className={`container ${s.layout}`}>
        <aside className={s.summary} aria-label="Summary">
          <div className={s.summaryLabel}>IN SHORT</div>
          <div><strong>In the app.</strong> What you create stays on your device and in your private iCloud. We can’t see it.</div>
          <div><strong>On the website.</strong> We receive only what you send: Support messages, your Sign in with Apple name and email, and decks you submit, plus standard hosting logs.</div>
          <div><strong>No selling or tracking.</strong> No ads, analytics or tracking in the app or on the website.</div>
          <div><strong>Deck Library.</strong> Approved decks are public, and copies people have downloaded can’t be pulled back.</div>
        </aside>

        <article className={s.article}>
          {sections.map((sec) => (
            <section key={sec.title} className={sec.title === "Contact" ? `${s.section} ${s.contact}` : s.section}>
              <h2 className={s.h2}>{smart(sec.title)}</h2>
              {sec.blocks.map((b, i) => {
                if (b.type === "h3") return <h3 key={i} className={s.h3}>{smart(b.text)}</h3>;
                if (b.type === "label") return <p key={i} className={s.label}>{smart(b.text)}</p>;
                if (b.type === "ul") return <ul key={i} className={s.ul}>{b.items.map((it, j) => <li key={j}><Inline text={it} /></li>)}</ul>;
                return <p key={i} className={s.p}><Inline text={b.text} /></p>;
              })}
            </section>
          ))}
        </article>
      </div>
    </>
  );
}
