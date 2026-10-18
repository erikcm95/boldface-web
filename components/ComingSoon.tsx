import Image from "next/image";
import Link from "next/link";
import header from "@/public/images/builder-header.jpg";
import AppStoreButton from "./AppStoreButton";

export default function ComingSoon({ title, lede, body }: { title: string; lede: string; body: string }) {
  return (
    <>
      <header className="page-head">
        <Image src={header} alt="" fill sizes="100vw" style={{ objectFit: "cover", objectPosition: "center 60%" }} placeholder="blur" />
        <div className="shade" aria-hidden="true" />
        <div className="container">
          <div className="eyebrow">Coming soon</div>
          <h1 className="display page-title">{title}</h1>
          <p className="soft" style={{ margin: 0, maxWidth: 640 }}>{lede}</p>
        </div>
      </header>
      <div className="container" style={{ paddingTop: 8, paddingBottom: 96 }}>
        <div style={{ padding: "40px 28px", borderRadius: 20, background: "var(--surface)", border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 16, maxWidth: 720 }}>
          <p style={{ margin: 0 }} className="soft">{body}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            <AppStoreButton />
            <Link href="/" className="btn btn-ghost btn-lg">Back to Home</Link>
          </div>
        </div>
      </div>
    </>
  );
}
