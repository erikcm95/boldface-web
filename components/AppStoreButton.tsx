import { site } from "@/lib/site";

/**
 * Temporary App Store button.
 * To use Apple's official badge: download "Download on the App Store" (black, SVG) from
 * https://tools.applemarketingtools.com, save it as public/app-store-badge.svg,
 * and set USE_OFFICIAL_BADGE to true.
 */
const USE_OFFICIAL_BADGE = false;

export default function AppStoreButton() {
  if (USE_OFFICIAL_BADGE) {
    return (
      <a className="appstore-badge" href={site.appStoreUrl} target="_blank" rel="noopener noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/app-store-badge.svg" alt="Download on the App Store" />
      </a>
    );
  }
  return (
    <a className="appstore" href={site.appStoreUrl} target="_blank" rel="noopener noreferrer" aria-label="Download BoldFace on the App Store">
      <span>
        <small>Download on the</small>
        <strong>App Store</strong>
      </span>
    </a>
  );
}
