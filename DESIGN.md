# DESIGN.md — engurhesi.ge Redesign: Visual & UX Direction

## 1. Design goals

1. **Institutional trust, modern execution.** This is the public face of Georgia's flagship power plant — the design should feel like modern government/energy-sector sites (clean, spacious, photographic), not a corporate template from 2018.
2. **Lightning fast.** Design decisions are performance decisions: system-lean typography, few images per view, no carousels, no icon fonts, minimal JS.
3. **Content-first.** The dam itself is visually spectacular — one great hero photo beats a 13-slide carousel. Data (1,300 MW, 4.3 B kWh/yr, since 1978) is the brand.
4. **Trilingual by design.** Georgian is the primary script and source language; English and Russian are full site locales. Every layout must work with Georgian's longer words, and the KA/EN/RU switcher must never dead-end — a missing translation falls back to Georgian with a notice, not a broken page.

## 2. Information architecture

Flatten the current 4-level menu into 6 top-level sections; kill the "page/{id}" grab-bag by giving every content type a real home.

```
/                     Home
/about                About (landing with sub-nav)
  /about/history      History (Construction · Operation · Rehabilitation as tabs/sections)
  /about/management   Management & org structure
  /about/subsidiaries Subsidiaries (Vardnili Cascade, Pumped-Storage)
  /about/technical    Technical indicators
  /about/quality      Quality policy (ISO)
  /about/reports      Reports & legal (financial audits, legal framework — document library)
/news                 News (filterable: News · Announcements · Publications)
  /news/{slug}        Article
/procurement          Procurement (Tenders · Auctions, filterable by status)
  /procurement/{slug} Notice detail (deadline, status, documents)
/projects             Projects
  /projects/{slug}    Project detail
/media                Media (Photos · Videos as tabs)
  /media/{album-slug} Album
/contact              Contact
```

- URLs: short latin slugs (`/ka/news/energy-day-2025`), locale prefix for all three languages (`/ka/…`, `/en/…`, `/ru/…`). **Root behavior is explicit**: `/` permanently redirects (308) to `/ka` — Georgian is the default, matching the current site; no Accept-Language negotiation (keeps the redirect edge-cacheable and analytics clean), and `x-default` hreflang points to the `/ka` version. 301 redirects map every old `page/{id}` / `news_in/{id}` URL by numeric ID.
- HTML sitemap page is dropped; replaced by real `sitemap.xml` + clean footer nav.
- Site-wide search kept, reachable from the header.

## 3. Page-by-page layout

### Home
1. **Hero** — single full-width photograph of the arch dam, one-line mission statement, two CTAs ("About the plant", "Procurement"). No carousel.
2. **Stats band** — 4 large figures (installed capacity 1,300 MW · annual output ~4.3 B kWh · dam height/head 404 m · operating since 1978). Optionally live daily-generation figure (see AGENTS.md); rendered as plain HTML numbers, animated only with CSS.
3. **Latest news** — 3 cards (image, category tag, date, title) + "All news".
4. **Active procurement** — compact list of open tenders/auctions with deadlines (differentiator: today this is buried).
5. **Projects strip** — 3 project cards.
6. **Partners** — single-row logo strip (grayscale, color on hover), no slider.
7. **Footer** — nav, contact block, subsidiary links.

### News list
Card grid (image, tag, date, title, excerpt), category filter as pill tabs, paginated (server-rendered, real `?page=` URLs). Article page: title, date, category, cover image, prose body, inline gallery if present, "More news" (3 latest), share via native `share` API / plain links (no SDK embeds).

### Procurement
This becomes a proper module: tabs **Tenders / Auctions**, status filter **Open / Closed**, each item shows title, publish date, **deadline with "days left" badge**, attached documents. Closed items collapse into an archive year-by-year. Detail page = notice body + document download list.

### About pages
Shared two-column layout: sticky section sub-nav (left, collapses to horizontal scroller on mobile), prose content (right). Specific treatments:
- **Technical indicators**: replace the text blob with a spec table per facility + highlight cards for record figures.
- **Management**: org structure as a proper visual hierarchy (nested cards/tree, pure CSS), not an indented text list.
- **Reports & legal**: document library — year, title, language badges (KA/EN/RU, per available PDF version), file size, one-click PDF download.

### Projects
Landing: 3 large feature cards. Detail: hero image, structured sections (Financing · Civil works · Electromechanical · Infrastructure), fact box (budget, funder, timeline), photo gallery.

### Media
Tabs Photos / Videos. Albums: masonry-free simple grid, native `<dialog>` lightbox, images lazy-loaded with width/height set. Videos: thumbnail grid → embed on click (facade pattern — no YouTube iframe until interaction; self-hosted files stream from R2).

### Contact
Split layout: contact details + static map image linking to Google Maps (no live map embed on load — saves ~500 KB), and the "Write to us" form (name, email, subject, message + Turnstile anti-spam). Success/error states inline.

## 4. Visual language

- **Color**: deep water-blue primary (e.g. `#0B3C5D` family) with a teal/cyan accent for data and links — but defined as a **full restrained palette up front** (primary + accent + 2 warm neutrals + semantic green/amber/red + surface tones), not a one-note "blue energy site." The palette is specified early as design tokens and contrast-tested with real Georgian, English, and Russian strings before any page is built. Semantic green/red reserved for open/closed procurement badges. All pairs meet WCAG AA (4.5:1).
- **Typography**: **FiraGO** (already licensed on the current site) or Noto Sans — either covers Georgian, Latin, **and Cyrillic** in one family, so all three locales share one typeface. Self-hosted, **WOFF2, subset per script, `font-display: swap`**, 2 weights (regular/bold) + optional display weight. This alone replaces ~6 font families currently shipped.
- **Iconography**: small inline SVG set (~15 icons), no icon font.
- **Imagery**: the plant's own photography, treated large and uncropped; AVIF/WebP with JPEG fallback; blur-up or dominant-color placeholders.
- **Density**: generous whitespace, max prose width ~70ch, 8-pt spacing scale.

## 5. Component inventory

Header (logo, nav, locale toggle, search) · mobile nav (details/summary or minimal JS drawer) · breadcrumbs · hero · stat card · news card · procurement row (with deadline badge) · project card · partner logo strip · document row · spec table · org-tree node · tabs/pills filter · pagination · image grid + `<dialog>` lightbox · video facade · contact form (+ Turnstile) · alert/notice banner (for urgent announcements) · footer · 404/empty states.

## 6. Responsive behavior

- Mobile-first; breakpoints ~640 / 1024 / 1280 px.
- Header collapses to drawer under 1024 px; locale toggle stays visible.
- Stats band 4→2→1 columns; card grids 3→2→1; spec tables scroll horizontally in a wrapper on small screens.
- Sticky sub-nav on About becomes a horizontal scroll-snap pill bar on mobile.
- Touch targets ≥44 px; no hover-only affordances.
- **Locale-length testing**: navigation, cards, buttons, and badges are reviewed with all three locales' real strings — Russian labels typically run longer than English and Georgian compounds run longer still; components must wrap or truncate gracefully rather than assume English-length text.

## 7. UX best practices applied

- **Accessibility (WCAG 2.1 AA)**: semantic landmarks, skip-link, `lang="ka"/"en"` set correctly per locale, alt text required by the CMS (see AGENTS.md), visible focus rings, keyboard-operable lightbox/nav, reduced-motion respected.
- **Performance-conscious design**: no carousels/autoplay, one hero image per page, facade pattern for video/maps, CSS-only animation, fonts subset. Budget (**public visitor routes only** — the admin panel has its own, more generous budget in AGENTS.md): **≤ 50 KB JS, ≤ 60 KB CSS (gzipped), LCP < 1.5 s on throttled 4G from a realistic (European/Caucasus) vantage, CLS ≈ 0** (all images with intrinsic dimensions).
- **Visual hierarchy**: one H1 per page, stat/deadline data visually promoted, consistent card grammar across content types.
- **SEO**: per-page titles + meta descriptions (CMS fields), OG/Twitter cards, `hreflang` triplets (ka/en/ru + `x-default`), sitemap.xml, structured data (`Organization`, `NewsArticle`).
- **i18n honesty**: if an EN or RU translation is missing, show the KA content with a clear "available in Georgian only" note instead of a broken/empty page. Machine-translated content that hasn't been human-reviewed carries an unobtrusive "automatic translation" label, and legal/procurement pages state that **the Georgian version is the controlling one**. The header switcher is a compact ქა / EN / РУ control, visible at all breakpoints.
