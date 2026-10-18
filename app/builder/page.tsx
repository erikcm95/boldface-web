import type { Metadata } from "next";
import ComingSoon from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Card Builder" };

export default function BuilderPage() {
  return (
    <ComingSoon
      title="Card Builder"
      lede="All of your custom cards in one place, editable from any browser."
      body="Soon you’ll be able to sign in with your Apple ID and create, edit and delete your custom cards here. Every change syncs to BoldFace on your iPhone and iPad. Until then, build cards in the app."
    />
  );
}
