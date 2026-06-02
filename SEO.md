# SEO Roadmap — uiuxskills.com

_Last updated: 2026-06-02_

---

## ✅ Done

- [x] `robots.ts` — crawl directives + sitemap pointer
- [x] `sitemap.ts` — dynamic sitemap over all published bundles from DB
- [x] Per-bundle `generateMetadata` — unique title, description, OG, Twitter card, canonical on every `/library/[slug]` page
- [x] `/library` page metadata — keyword-optimised static title + OG + canonical
- [x] Root `layout.tsx` — `metadataBase`, title template (`%s — UIUXskills`), site-wide OG + Twitter defaults
- [x] Google Search Console — domain property verified, sitemap submitted
- [x] BreadcrumbList JSON-LD on every `/library/[slug]` page — breadcrumb trail (`uiuxskills.com › Library › {title}`) in Google results (`fc58b0f`, 2026-06-02)

---

## 🔴 High priority

### 1. ~~BreadcrumbList JSON-LD on bundle pages~~ ✅ Done
**What:** Add `<script type="application/ld+json">` with `BreadcrumbList` schema to each `/library/[slug]` page.  
**Why:** Google renders the trail (`uiuxskills.com › Library › Linear`) directly in search results — improves click-through rate without any ranking change needed.  
**Where:** `src/app/(public)/library/[slug]/page.tsx` — add JSON-LD alongside `generateMetadata`.  
**Effort:** ~30 min.

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Library", "item": "https://uiuxskills.com/library" },
    { "@type": "ListItem", "position": 2, "name": "{bundle.title}", "item": "https://uiuxskills.com/library/{slug}" }
  ]
}
```

---

- [x] Vercel OG image route (`/api/og`) — palette swatches + brand name card, 1200×630; `twitter:card` upgraded to `summary_large_image` on all bundle pages (`74aafc4`, 2026-06-02)

### 2. ~~Open Graph image (`og:image`) on bundle pages~~ ✅ Done
**What:** Generate or serve a per-bundle OG image (palette strip + bundle name) used when links are shared on X, LinkedIn, Slack, iMessage.  
**Why:** Text-only OG cards get ignored in feeds. A palette-based card with the bundle name is immediately recognisable and shareable — each share becomes a free impression.  
**Options (pick one):**
- **Static:** Use Vercel OG (`@vercel/og`) with a route at `/api/og?slug=linear` — renders palette colours + title as a PNG at share time. ~2 hrs.
- **Stored:** Save a screenshot from the existing pipeline and store the URL in the `bundles` table. Reuses existing Firecrawl screenshot. ~half day.

**Once done:** Upgrade `twitter:card` from `summary` to `summary_large_image` in `generateMetadata`.

---

## 🟡 Medium priority

### 3. Category URL segments
**What:** Convert `/library?category=saas` filter state into real routable pages: `/library/saas`, `/library/fintech`, `/library/ecommerce`, etc.  
**Why:** Each category becomes a standalone indexable page targeting cluster queries like "SaaS design system," "fintech UI tokens," "e-commerce design tokens." 9 categories = 9 new rankable pages with natural keyword density from their bundle listings.  
**Effort:** ~half day (new route `src/app/(public)/library/[category]/page.tsx` + static metadata per category + redirect from `?category=` param).

---

### 4. `CollectionPage` / `ItemList` structured data on `/library`
**What:** Add JSON-LD marking the library page as a `CollectionPage` with an `ItemList` of bundles (name + URL for top N).  
**Why:** Signals to Google that this is a curated list — can surface as a rich result for "design system library" type queries.  
**Effort:** ~30 min. Add server-side in `library/page.tsx` fetching top 10 published bundles.

---

### 5. Homepage keyword content
**What:** The homepage currently has minimal crawlable text (hero copy + three links). Add a short "How it works" or "What's in the library" section with natural keyword presence.  
**Why:** The homepage is the strongest page for authority — it should mention brands (Linear, Stripe, Vercel), use cases (Claude, Cursor, Lovable), and the category (design system, design tokens, DESIGN.md) at least once each.  
**Effort:** ~1 hr (copy + component, no schema changes needed).

---

## 🟢 Low priority / nice to have

### 6. Internal linking on bundle detail pages
**What:** Add a "More design systems" or "Related bundles" section at the bottom of each `/library/[slug]` page linking to 3–4 bundles in the same category.  
**Why:** Distributes page authority across the catalog, keeps users in the library, and gives Googlebot more crawl paths.  
**Effort:** ~1 hr (query same-category bundles in `generateMetadata` or as a client-side fetch).

---

### 7. Core Web Vitals check
**What:** Run Lighthouse / PageSpeed Insights against `/`, `/library`, and a bundle detail page once traffic picks up.  
**Targets:** LCP < 2.5s, INP < 200ms, CLS < 0.1.  
**Likely issues to check:** Font preload (JetBrains Mono + Inter), logo image dimensions declared, no layout shift from client-hydration.  
**Effort:** Audit ~30 min. Fixes vary.

---

### 8. `SoftwareSourceCode` / `Dataset` schema on bundle pages
**What:** Mark each bundle as a `SoftwareSourceCode` item (name, description, programmingLanguage: YAML, url).  
**Why:** Speculative — no established rich result for this type yet, but signals content type to Google and future-proofs against schema expansions.  
**Effort:** ~20 min once BreadcrumbList (item 1) is in place — add to same JSON-LD block.

---

### 9. `sitelinks` search box (optional)
**What:** Add `WebSite` schema with `potentialAction: SearchAction` pointing to `/library?q={search_term_string}`.  
**Why:** Can trigger a search box directly in Google's result for a branded query ("uiuxskills.com design system").  
**Effort:** ~15 min. Add to root layout or homepage.

---

## Notes

- **Check Search Console in 48 hrs** → Sitemaps tab should show bundle count discovered (e.g. "42 submitted, 42 discovered"). If errors appear, investigate.
- **First rankings** for branded queries ("linear design system", "stripe color palette") expected within 2–4 weeks of indexing.
- **Biggest compounding lever** once indexing is confirmed: item 3 (category pages) + item 2 (OG image) — one drives discovery, the other drives shares.
