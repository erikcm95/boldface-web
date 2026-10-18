import type { Metadata } from "next";
import Image from "next/image";
import header from "@/public/images/builder-header.jpg";
import RequireSignIn from "@/components/RequireSignIn";
import CardBuilder from "@/components/CardBuilder";

export const metadata: Metadata = { title: "Card Builder" };

export default function BuilderPage() {
  return (
    <>
      <header className="page-head">
        <Image src={header} alt="" fill sizes="100vw" priority style={{ objectFit: "cover", objectPosition: "center 60%" }} placeholder="blur" />
        <div className="shade" aria-hidden="true" />
        <div className="container">
          <h1 className="display page-title">Card Builder</h1>
          <p className="soft" style={{ margin: 0, maxWidth: 640 }}>
            All of your custom cards in one place. Changes sync with BoldFace on your iPhone and iPad.
          </p>
        </div>
      </header>
      <div className="container" style={{ paddingTop: 8, paddingBottom: 56 }}>
        <RequireSignIn feature="Card Builder">
          <CardBuilder />
        </RequireSignIn>
      </div>
    </>
  );
}
