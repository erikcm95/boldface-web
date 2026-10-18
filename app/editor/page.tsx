import type { Metadata } from "next";
import ComingSoon from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Deck Editor" };

export default function EditorPage() {
  return (
    <ComingSoon
      title="Deck Editor"
      lede="Build and organize decks from your browser, then share them as .boldface files or submit them to the Deck Library."
      body="Soon you’ll be able to sign in with your Apple ID to edit your decks here, with every change syncing to BoldFace on your iPhone and iPad. Until then, build and share decks in the app."
    />
  );
}
