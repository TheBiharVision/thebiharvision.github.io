# The Bihar Vision — Website

Official website for The Bihar Vision YouTube podcast (Hindi/Bhojpuri — Interview, Culture, Education, Entertainment).

## Stack
Semantic HTML5 + modern CSS + vanilla JS. No framework/build step required to run locally.
A lightweight Node pipeline (scripts/) generates episode pages from JSON data and can optionally
pull live data from the YouTube Data API v3 at build time via GitHub Actions.

## Quick Start (local preview)
1. Clone the repo.
2. Serve the folder with any static server, e.g.:
   npx serve .
   (Opening index.html directly via file:// will break fetch() calls to /data/*.json — use a local server.)

## Rebranding
Edit **assets/js/config.js** — this is the single source of truth for site name, URLs, social links,
navigation, contact email, and footer content used by the header/footer components.
Legal pages and per-page <title>/meta/JSON-LD must still be edited individually (documented limitation
of a no-build static site — see "Known Limitations" below).

## Adding a New Episode
### Option A — Manual (recommended until API key is configured)
1. Add a new object to `data/episodes.json` following the existing schema.
2. Run `node scripts/generate-pages.js` to generate the static page and update sitemap.xml.
3. Commit and push — GitHub Pages redeploys automatically.

### Option B — Automatic via YouTube Data API
1. Create a YouTube Data API v3 key in Google Cloud Console (restrict it to the API + your repo's
   Actions IP range is not possible, so restrict by API only; it is used server-side only).
2. Add it as a GitHub repo secret named `YOUTUBE_API_KEY` (Settings → Secrets → Actions).
3. The included GitHub Actions workflow (`.github/workflows/build-and-deploy.yml`) runs on a schedule,
   fetches new uploads, merges metadata from `data/episodes-manual.json` (host/guests/topics/chapters
   you maintain by hand), regenerates episode pages + sitemap, and deploys.
4. If the key is missing or the API quota is exceeded, the script **safely skips** the fetch and keeps
   the last known good dataset (fallback mode) — the build never fails because of this.

**The API key is never exposed to the browser.** It only exists as an encrypted GitHub Actions secret
used in a server-side build step.

## Adding/Editing Team or Guest Profiles
- Team: edit `data/team.json` and the corresponding `team/<slug>.html` page (header/bio copied from JSON).
- Guests: add only verified guests to `data/guests.json` plus a `guests/<slug>.html` page. Do not add
  empty or unverified profiles — see `/legal/editorial-policy.html`.

## Contact Form
By default, the contact form (`contact.html`) falls back to a `mailto:` link (no backend configured).
To enable in-browser submission, set `contactForm.provider` to `"formspree"` (or another provider) and
add your **public** form endpoint ID in `assets/js/config.js`. Never put a secret API key there.

## SEO / Structured Data
Every page has a unique `<title>`, meta description, canonical URL, Open Graph tags, and relevant
JSON-LD (Organization, WebSite, BreadcrumbList, VideoObject, ProfilePage, ContactPage, FAQPage).
`scripts/generate-pages.js` keeps episode VideoObject schema and sitemap.xml in sync with `data/episodes.json`.

## Known Limitations (please read before launch)
- This is a no-backend static site: GitHub Pages cannot run server code at request time. All
  "dynamic" behavior (search, filtering, YouTube data loading) runs client-side against JSON files
  generated at build time.
- Because there is no templating engine at runtime, each static page's `<title>`/meta/JSON-LD is
  hardcoded HTML. The `config.js` file centralizes branding for JS-rendered components (header,
  footer, cards) but **does not** retroactively rewrite already-generated static HTML files —
  re-run `scripts/generate-pages.js` after changing episode data, and manually update titles on
  hand-authored pages (about/contact/faq/legal) if rebranding.
- Legal pages are structured templates with clearly marked `PLACEHOLDER` fields (effective dates,
  governing law, specific statutory rights). **Have them reviewed by a qualified lawyer before launch.**
- Guest directory starts empty by design — populate only with verified information.
- View-count-based "Popular Episodes" ranking is not implemented (requires API quota for `statistics`
  part); the current implementation uses a manually curated `featured`/ordering approach instead.
- Analytics is disabled by default. Enable only with proper disclosure + consent mechanism.

## Deployment (GitHub Pages)
1. Push to the `main` branch of `TheBiharVision/thebiharvision.github.io`.
2. In repo Settings → Pages, set source to "GitHub Actions" (the included workflow handles build + deploy).
3. Since this repo is a **user/organization page** (`thebiharvision.github.io`), it serves from the
   repository root at the domain root — no base-path adjustments are needed for asset URLs (`/assets/...`).
4. Custom domain (optional): add a `CNAME` file with your domain and configure DNS per GitHub's docs.

## Testing & Launch Checklist
- [ ] Replace all `VIDEO_ID_xxx` placeholders with real YouTube video IDs.
- [ ] Replace placeholder bios/images for team and guests with verified content.
- [ ] Set legal page effective/revision dates and have pages reviewed by counsel.
- [ ] Configure `YOUTUBE_API_KEY` secret (optional) or commit real `data/episodes.json`.
- [ ] Configure a real contact form provider or confirm the mailto fallback is acceptable.
- [ ] Run Lighthouse (mobile + desktop) and fix any flagged performance/accessibility issues.
- [ ] Validate all JSON-LD via https://validator.schema.org/.
- [ ] Check all internal links resolve (no 404s) and canonical URLs are correct per page.
- [ ] Test keyboard navigation, screen reader labels, and focus visibility across all pages.
- [ ] Test at 320px, 375px, 768px, 1024px, 1440px, 1600px+ viewports.
- [ ] Confirm robots.txt and sitemap.xml are reachable and correctly reference live URLs.
