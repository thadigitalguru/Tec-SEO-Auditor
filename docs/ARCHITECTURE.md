# Architecture

```
User → Clerk Auth → /api/audit (Edge POST)
  ↓ Vercel Queue
Crawler (Crawlee/Playwright) → Sitemap/links (max 500)
  ↓ Parallel LH audits (lighthouse)
  ↓ Aggregate JSONB → Prisma Audit
  ↓ AI SDK summarizes priorities
UI: Tremor charts, Recharts CWV, PDF export

DB: Vercel Postgres (audits JSONB)
```
Serverless: Edge APIs, no state except DB.
