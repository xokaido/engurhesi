We're modernizing an outdated website, engurhesi.ge, into a fast, modern, easy-to-navigate site with a clean admin panel for content management.
Step 1 — Audit: Explore the current live site and inventory everything on it: pages, content types, navigation structure, media/assets, any forms or interactive features, and anything that looks like it's pulling from a database or CMS. Note what's outdated (design, UX, tech) versus what's core content worth preserving.
Step 2 — Plan: Based on the audit, produce a full upgrade plan as two documents:

DESIGN.md — visual/UX direction: information architecture, page-by-page layout, navigation, component list, responsive behavior, and how it applies modern UI/UX best practices (accessibility, visual hierarchy, performance-conscious design, etc.)
AGENTS.md — technical/system plan: architecture, data model, admin panel functionality (what content editors can manage and how), API structure, and deployment plan

Constraints:

Target stack: Cloudflare Workers, with D1 (database) and R2 (object storage); suggest other Cloudflare or edge-compatible tools if they'd meaningfully help
Preferred frontend: Svelte + Vite — but suggest alternatives if something else is clearly better suited for this use case (e.g., SvelteKit for routing/SSR)
Priority: performance ("lightning fast" load times, minimal JS where possible, edge-first architecture)
Admin panel should be simple enough for a non-technical person to update content

Deliverable: Don't start building yet — just deliver the audit findings plus DESIGN.md and AGENTS.md so I can review and tell you which parts to keep, cut, or change before implementation begins.
