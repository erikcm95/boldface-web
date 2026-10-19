import type { Metadata } from "next";
import Image from "next/image";
import header from "@/public/images/sunset-band.jpg";
import RequireSignIn from "@/components/RequireSignIn";
import DeckEditor from "@/components/DeckEditor";

export const metadata: Metadata = { title: "Deck Editor" };

export default function EditorPage() {
  return (
    <>
      <header className="page-head">
        <Image src={header} alt="" fill sizes="100vw" priority style={{ objectFit: "cover", objectPosition: "center 55%" }} placeholder="blur" />
        <div className="shade" aria-hidden="true" />
        <div className="container">
          <h1 className="display page-title">Deck Editor</h1>
          <p className="soft" style={{ margin: 0, maxWidth: 640 }}>
            Build and organize your decks, then share them as .boldface files. Changes sync with BoldFace on your iPhone and iPad.
          </p>
        </div>
      </header>
      <div className="container" style={{ paddingTop: 8, paddingBottom: 56 }}>
        <RequireSignIn feature="Deck Editor">
          <DeckEditor />
        </RequireSignIn>
      </div>
    </>
  );
}
