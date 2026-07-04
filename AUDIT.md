# engurhesi.ge — Site Audit

*Audit date: 2026-07-04. Method: live crawl of the public site (Georgian + English versions), raw HTML/asset inspection, HTTP header analysis.*

## 1. What the site is

Official website of **შპს „ენგურჰესი" (Engurhesi LLC)** — the state-owned operator of the Enguri Hydro Power Plant (1,300 MW, the largest HPP in the Caucasus, operating since 1978) and the Vardnili cascade. The site serves as:

- A corporate/institutional presence (history, management, technical data, quality policy)
- A news outlet (press releases, announcements, publications)
- A **procurement notice board** (tenders and auctions — legally significant content for a state enterprise)
- A transparency channel (financial audit reports, legal framework)
- A media archive (photo albums, videos)

Languages: Georgian (primary, default at `/ka`) and English (`/en`).

## 2. Current technology

| Layer | Finding |
|---|---|
| Backend | **Laravel** (PHP) — identified by `laravel_session` / `XSRF-TOKEN` cookies. Custom CMS built by vendor "SmartWeb"; admin panel exists at `/admin` (HTTP 200) |
| Server | **Microsoft IIS 10** — unusual/expensive host for a PHP app; HTML served `cache-control: no-cache, private` (no edge caching at all) |
| Frontend | Server-rendered Blade templates + **jQuery 3.3.1** (2018), **Chart.js v2** (legacy `xAxes` syntax), Swiper, gauge.js, Font Awesome 5.10 via cdnjs |
| CSS | Hand-written `reset.css` + `main.css` (~109 KB) + separate `responsive.css` |
| Fonts | Multiple families (Gotham Pro, FiraGO, BPG DejaVu/Arial) shipped as **TTF/EOT/OTF** — no WOFF2, no subsetting, no `font-display` |
| SEO | Page `<title>` is just "მთავარი" ("Home"); no meta description, no Open Graph tags, **no sitemap.xml** (404); robots.txt is empty-allow |

The homepage loads charts/gauges whose data is server-embedded in DOM attributes (`dataobject`) — there is a concept of operational stats (generation, water level) but no live API.

## 3. Content inventory

### Navigation structure (from the site's own sitemap page)

- **Home** — hero slider, latest-news teasers (4), partner-logo strip (8 partners), stats/chart section, footer
- **About Us**
  - History: Construction (`page/24`), Operation (`page/25`), Rehabilitation (`page/26`)
  - Management: org structure (`/ka/structure` — ~30+ positions as a text hierarchy, no photos), Partner (`page/30`)
  - Subsidiaries: Vardnili HPP Cascade LLC (`page/41`), Enguri Pumped-Storage LLC (`page/42`)
  - Activities (`page/6`), Technical indicators (`page/47`), Quality policy / ISO (`page/35`)
  - Reports: financial audit page with **PDF downloads** (KA + EN versions), Legal framework (`page/34`)
- **News** (`/ka/news`) — 3 categories: News, Announcements, Publications; 10 items/page, ≥10 pages (**~100+ articles**); article = title, date, body, 1 image; no share buttons, no related articles
- **Offers / Procurement** — Tenders (ongoing/completed) and Auctions (ongoing/completed). **~20 auction notices exist as generic static pages** (`page/122`–`141`)
- **Projects** — 3 long-form pages: Rehabilitation Phase IV (EBRD-funded), Pumped-Storage Power Station, Tourist Center
- **Media** — Photo gallery (4 albums under `/uploads/PhotoGallery/`), Video gallery (12 videos, thumbnail + description), HTML sitemap
- **Contact** — "Write to us" form, Google Maps embed, address / phone / email
- Site search exists at `/ka/search`

### Content types actually in play

pages (rich text + attachments) · news articles (3 categories) · projects · tenders & auctions (with status + deadlines) · photo albums/photos · videos · documents/reports (PDFs) · partners (logo + URL) · hero slides · org-structure entries · contact submissions · menu structure · 2 locales.

## 4. What's outdated

**Performance (worst offender):**
- Hero slider image: **1.4 MB single JPEG**, no `srcset`, no modern formats, no lazy loading
- ~600 KB of JS: jQuery 87 KB, Chart.js 157 KB, **unminified Swiper 263 KB**
- TTF/EOT fonts, multiple redundant families, blocking CDN CSS (Font Awesome)
- Zero edge caching; every request hits origin (Laravel on IIS)

**UX / design:**
- 2018-era template look; 13-slide carousel; dead `#!` anchor links throughout
- Enormous percent-encoded URLs (`/ka/page/135-შპს-„ენგურჰესი"...` → 300+ char encoded strings)
- Auctions/tenders modeled as static pages — no deadline, status, or filtering; expired notices pile up in the nav
- News: no search-by-category surfacing, no related items, no social share
- Org structure rendered as an indented text list — hard to read

**i18n:** English version is **partially translated** — navigation is English, but procurement/auction content and many items remain Georgian-only.

**SEO/accessibility:** no meta descriptions/OG tags, no sitemap.xml, generic titles, tiny 9–10 px chart labels, icon-font dependency, unclear alt-text coverage.

## 5. What's core content worth preserving

1. **All institutional content** — history (3 pages), activities, technical indicators, quality policy, legal framework, subsidiaries
2. **~100+ news articles** with images and dates (Georgian; English where translated)
3. **Financial/audit report PDFs** (transparency obligation)
4. **Procurement notices** — active ones migrate as first-class tenders/auctions; expired ones as archive
5. **The 3 project pages** (EBRD rehabilitation content is substantive)
6. **Photo albums, videos, partner logos, org structure data, contact details**
7. **The operational-stats concept** (charts/gauges) — the one genuinely distinctive homepage feature; worth rebuilding properly as a lightweight stats band
8. Bilingual KA/EN model (keep, with clearer fallback behavior)

## 6. Migration notes

- All media lives under predictable paths (`/uploads/News/`, `/uploads/Partner/`, `/uploads/PhotoGallery/`, `/uploads/Slider/`, `/uploads/menu/files/`) — easy to crawl and re-upload to R2
- Content is fully server-rendered → a scripted crawl can extract every page body reliably
- Old URLs (`/ka/page/{id}-{slug}`, `/ka/news_in/{id}-{slug}`) should get 301 redirects keyed on the numeric ID
