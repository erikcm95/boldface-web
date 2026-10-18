export const site = {
  name: "BoldFace",
  url: "https://boldfaceaviation.com",
  appStoreUrl: "https://apps.apple.com/us/app/boldface-aviation/id6798727941",
  contactEmail: "boldfaceaviation@gmail.com",
  description:
    "BoldFace turns general aviation knowledge into simple, cited flashcards for student, private and commercial pilots.",
};

/**
 * CloudKit JS API token for iCloud.com.BoldFace.BoldFaceApp (CloudKit Console → Tokens & Keys).
 * Public by design: it only works from the token's Allowed Origins and every user still signs in
 * with their own Apple ID. NEXT_PUBLIC_CLOUDKIT_API_TOKEN overrides it if set.
 */
export const cloudkit = {
  containerId: "iCloud.com.BoldFace.BoldFaceApp",
  apiToken: "994ff10d65410fad77b70a1fca0a5b74cb90a38f38d3b2ffabc49642a962ce6c",
  environment: "production",
};

export const navLinks = [
  { href: "/", label: "Home" },
  { href: "/library", label: "Deck Library" },
  { href: "/editor", label: "Deck Editor" },
  { href: "/builder", label: "Card Builder" },
];
