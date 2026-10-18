# boldface-web

Website for BoldFace (https://boldfaceaviation.com). Next.js 15 (App Router), hosted on Vercel.

## Pages

| Path | Status |
|---|---|
| `/` | Home: hero, app screenshots, Deck Library teaser, 3 steps, App Store links |
| `/privacy` | Privacy Policy, rendered from `content/privacy-policy.md` |
| `/library` | Deck Library: "first decks are on their way" placeholder |
| `/editor`, `/builder` | Coming soon (Phase 2: Sign in with Apple + CloudKit sync) |
| `/api/support` | Support form → email via Resend |
| Sign in (nav) | Apple ID sign-in via CloudKit JS; shows the user's custom card and deck counts from their private iCloud |

## Run locally

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build check
```

## Environment variables (Vercel → Project → Settings → Environment Variables)

| Name | Value |
|---|---|
| `RESEND_API_KEY` | API key from resend.com |
| `SUPPORT_FROM` | `BoldFace Support <support@boldfaceaviation.com>` (domain must be verified in Resend) |
| `SUPPORT_TO` | `boldfaceaviation@gmail.com` |
| `NEXT_PUBLIC_CLOUDKIT_API_TOKEN` | API token from CloudKit Console (Tokens & Keys). Without it the Sign in button is hidden. |
| `NEXT_PUBLIC_CLOUDKIT_ENV` | `production` |

Without these, the Support form tells visitors to email boldfaceaviation@gmail.com directly.

## Keeping the privacy policy in sync

`content/privacy-policy.md` is a copy of the app's `PRIVACY_POLICY.md`. When you change one, copy it to the other. Only the text above the first `---` line appears on the website.

## App Store badge

`components/AppStoreButton.tsx` uses a temporary button. Download Apple's official "Download on the App Store" badge (black, SVG) from https://tools.applemarketingtools.com, save it as `public/app-store-badge.svg`, and set `USE_OFFICIAL_BADGE = true`.

## Sync rules for Phase 2 (CloudKit JS)

Match the app's last-write-wins model: always set `modifiedDate` (cards) / `lastModified` (decks); write only if newer; save with the record change tag and re-resolve on conflict; delete by setting `isDeleted`, never hard-delete.
