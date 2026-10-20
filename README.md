# Kernel2Cloud website

Astro static site (marketing page + blog).

    npm install
    npm run dev      # http://localhost:4321, shows draft posts
    npm run build    # type-checks, builds to dist/
    npm run preview

## Blog
Add `src/content/blog/<slug>.md` (frontmatter: title, description 50-170 chars, pubDate, optional
updatedDate, tags, image, draft). The slug becomes `/blog/<slug>/`. `draft: true` posts are
dev-only: not built, not in sitemap or RSS.

## SEO
Per-page title/description/canonical/Open Graph/Twitter in `src/layouts/Base.astro`; JSON-LD
(Organization, WebSite, FAQPage on home; BlogPosting + BreadcrumbList on posts); `/sitemap-index.xml`,
`/rss.xml`, `/robots.txt`. Pages: /, /compute/, /host-a-rack/, /platform/, /company/, /contact/, /blog/. Default share image: `public/og-default.png` (regenerate with
`node tools/make-og.mjs`). Site URL lives in `astro.config.mjs` and `src/consts.ts`.
FAQ answers are in `src/data/faq.ts` (used by both the page and its JSON-LD).
