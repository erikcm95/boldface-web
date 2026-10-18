import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container" style={{ paddingTop: 160, paddingBottom: 120, display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-start" }}>
      <div className="eyebrow">404</div>
      <h1 className="display page-title">Off course.</h1>
      <p className="soft" style={{ margin: 0 }}>That page doesn’t exist. Let’s get you back on the centerline.</p>
      <Link href="/" className="btn btn-light">Back to Home</Link>
    </div>
  );
}
