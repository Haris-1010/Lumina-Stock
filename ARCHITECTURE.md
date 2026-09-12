# Lumina Stock — Architecture & Tech Stack

A complete reference for the stack, architecture, design choices, and the trade-offs behind them. Covers frontend, backend, database, AI, auth, deployment, and why each piece was picked over alternatives.

---

## 1. What is Lumina Stock?

A multi-tenant SaaS inventory management platform aimed at Pakistani SMEs and wholesale traders. Combines:

- **Core inventory** — products, stock, suppliers, purchase orders, sales, customers, expiry tracking, dead-stock detection
- **Cashier / POS** — offline-capable point-of-sale flow
- **AI assistant** — natural-language queries, stock adjustments, market price lookups, demand forecasting
- **Voice agent** — wake-word ("Hey Lumina") + continuous voice conversation
- **Wholesale mode** — price groups, B2B order workflow
- **Enterprise features** — audit logs, governance webhooks, SSO-ready
- **Billing** — Stripe + Pakistani gateways (JazzCash, EasyPaisa)
- **Bilingual** — English + Urdu (RTL-ready)

---

## 2. Tech stack at a glance

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.1 |
| UI runtime | React | 19.2.4 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 4.x |
| UI primitives | Radix UI (dialog, popover, dropdown, select, tabs, toast, tooltip) | 1.x–2.x |
| Animations | Framer Motion | 12.x |
| Charts | Recharts | 3.x |
| Icons | lucide-react | 1.x |
| ORM | Prisma | 6.19 |
| Database | PostgreSQL (Supabase) | 15+ |
| Auth | jose (JWT) + bcryptjs + httpOnly cookies | 6.x / 3.x |
| Schema validation | Zod | 4.x |
| AI provider | Google Gemini 2.5 Flash (primary) + Groq Llama 3.3 (fallback / vision) | via `openai` SDK 6.33 |
| Payments | Stripe + PayPal + JazzCash + EasyPaisa | 22.x |
| Email | Nodemailer + SMTP | 8.x |
| WhatsApp | Meta Cloud API (REST) | — |
| PDF/QR | jspdf, jspdf-autotable, qrcode | — |
| CSV | papaparse | 5.x |
| HTML scraping | cheerio (where structured), regex (DDG search) | 1.x |
| Hosting | Vercel | — |
| DB hosting | Supabase (Postgres + connection pooler) | — |

---

## 3. High-level architecture

```
┌──────────────────────────────────────────────────────────┐
│                         CLIENT                            │
│  React 19 + Next.js App Router (RSC + Client Components)  │
│  Tailwind 4 · Radix UI · Framer Motion · Recharts         │
└────────────────────┬─────────────────────────────────────┘
                     │ HTTPS
                     ▼
┌──────────────────────────────────────────────────────────┐
│                  VERCEL EDGE / NODE                       │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Next.js Server                                     │  │
│  │  ├── React Server Components (data fetch)           │  │
│  │  ├── Server Actions ("use server" — ~30 files)      │  │
│  │  └── Route Handlers (api/**/route.ts)               │  │
│  └────────────────────────────────────────────────────┘  │
│           │              │                │              │
│           ▼              ▼                ▼              │
│  ┌──────────────┐ ┌────────────┐ ┌─────────────────┐     │
│  │  Prisma 6    │ │ AI clients │ │ External APIs   │     │
│  │ (singleton)  │ │ Gemini/Groq│ │ Stripe/Meta/etc │     │
│  └──────┬───────┘ └────────────┘ └─────────────────┘     │
└─────────┼────────────────────────────────────────────────┘
          │ Postgres wire (pgbouncer pooler)
          ▼
┌──────────────────────────────────────────────────────────┐
│              SUPABASE (Managed Postgres)                  │
│   24 models · 15+ enums · `organizationId` on every row   │
│   Soft deletes via `deletedAt` on critical entities       │
└──────────────────────────────────────────────────────────┘
```

---

## 4. Frontend architecture

### Routing — Next.js App Router (file-based)

```
src/app/
├── (auth)/              ← route group (no URL segment): login, register
├── (dashboard)/         ← route group: all authenticated pages
│   ├── inventory/
│   ├── cashier/
│   ├── ai-assistant/
│   ├── analytics/
│   └── …
├── api/                 ← Route Handlers
├── onboard/             ← onboarding wizard
├── store/               ← public storefront
└── suspended/           ← suspended-org page
```

Route groups `(auth)` / `(dashboard)` share layouts without affecting URLs.

### Rendering model

- **React Server Components by default** — pages fetch data directly with Prisma (no client API call needed). Less JS shipped, faster first paint.
- **Client Components** marked with `"use client"` — only where state, hooks, or events are needed (e.g. `ai-assistant-client.tsx`, `voice-agent.tsx`).
- **Server Actions** for mutations — typed RPC into server functions. No hand-written API client.

### Component organization

`src/components/` is **domain-organized**, not type-organized:

```
components/
├── ai/              ← chat, voice agent, inline assistants
├── cashier/         ← POS UI
├── inventory/       ← product table, stock adjustment
├── analytics/       ← charts, KPIs
├── layout/          ← nav, sidebar, topbar
├── providers/       ← React context providers (i18n, theme)
└── …                (one folder per business domain)
```

This makes it easier to delete or extract a feature wholesale and avoids the typical "where does this go?" question.

### Styling — Tailwind 4

- Utility-first, dark-mode via `dark:` variant.
- Tailwind 4's new engine (CSS-first, no `tailwind.config.ts` needed) — significantly faster build.
- Radix UI for behavior; Tailwind handles all visuals (no shadcn coupling).

### State management

No Redux / Zustand / Jotai. State strategy:

- **Server state** lives on the server (RSC fetches it; Server Actions mutate it; revalidation handled by Next).
- **Local UI state** in `useState` / `useRef`.
- **Cross-component state** via React Context (i18n, theme).
- **localStorage** for persistent client preferences (voice-agent toggle, theme).

### Internationalization

- `i18n.ts` — single 76KB object with English + Urdu translations.
- `i18n-provider.tsx` — client-side context, language switching live.
- `i18n-server.ts` — reads language cookie, returns translator on server.
- Currency formatting handled in the same module (PKR, comma grouping).

---

## 5. Backend architecture

### Two patterns, picked deliberately

| Pattern | When | Examples |
|---|---|---|
| **Server Actions** (`"use server"`) | Internal mutations called from your own UI | All inventory/sales/customer/auth mutations (~30 files in `src/lib/actions/`) |
| **Route Handlers** (`api/**/route.ts`) | Webhooks, file uploads, third-party callbacks, AI streaming, public endpoints | Stripe webhook, Meta WhatsApp webhook, CSV upload, AI agent, payment reconciliation, 3rd-party proxies (Adevolve, ReachFlow) |

**Why both?** Server Actions give you typed RPC for free — no client API layer, no DTOs, no fetch wrappers. But they can't be called from outside your UI (webhooks, mobile apps, partners). Route Handlers cover that gap.

### Server Actions example

```
src/lib/actions/
├── auth.ts              ← signIn, signOut, register
├── inventory.ts         ← createProduct, updateStock, bulkImport
├── invoices.ts          ← issueInvoice, recordPayment
├── customers.ts         ← CRUD
├── forecasting.ts       ← demand forecast trigger
├── notifications.ts     ← createNotificationForOrganization
├── enterprise.ts        ← audit log emission
└── …                    (~30 modules total)
```

Each action is a typed function. The client just imports and calls it — Next.js handles serialization, CSRF, the works.

### API routes example

```
src/app/api/
├── ai/
│   ├── agent/route.ts           ← function-calling agent loop
│   ├── inventory-chat/route.ts  ← legacy chat
│   ├── scan-product/route.ts    ← Groq vision (image → product)
│   └── starter-catalog/route.ts ← seed inventory from category
├── billing/checkout/route.ts    ← Stripe Checkout creation
├── csv-upload/route.ts          ← multipart upload
├── forecast/route.ts            ← async forecast endpoint
├── adevolve/[...route]/route.ts ← proxy to 3rd-party
└── reachflow/[...route]/route.ts
```

### Database access — Prisma singleton

`src/lib/db.ts` exports a single `db` instance, reused everywhere. In dev it's attached to `globalThis` to survive hot-reload (avoiding "too many connections" errors).

### No background queue (yet)

`inngest` is in dependencies but **not currently wired up**. Async work runs on Vercel functions directly. Long-running jobs (forecasting, bulk imports) live in their own routes with `maxDuration` extended.

---

## 6. Database design

### Hosting — Supabase (managed Postgres)

Two URLs in env:
- `DATABASE_URL` — points to **Supabase pooler** (pgbouncer transaction mode). Used by the app at runtime. Handles thousands of short serverless connections without exhausting Postgres.
- `DIRECT_URL` — direct Postgres connection. Used only by `prisma migrate` (which needs prepared statements pgbouncer doesn't support in transaction mode).

### Multi-tenancy — column-scoped

Every business entity has `organizationId String`. There is **no row-level security policy in DB** — tenant scoping is enforced in app code by always including `where: { organizationId, ... }`. Combined with permission checks, this is sufficient for a SaaS at this scale.

### Soft deletes

Critical tables have `deletedAt DateTime?`:

> Product · SalesOrder · Supplier · InventoryLog · PurchaseOrder · Customer · Invoice · WholesaleOrder

Queries always filter `where: { deletedAt: null }`. The Recycle Bin page surfaces soft-deleted rows for restore.

### Models (24 total)

**Core:** User, Organization, UserPermission

**Inventory:** Product, InventoryLog, Supplier

**Sales:** SalesOrder, OrderItem, Customer

**Procurement:** PurchaseOrder, PurchaseOrderItem

**Wholesale/B2B:** PriceGroup, PriceGroupProductOverride, WholesaleOrder, WholesaleOrderItem

**Billing:** Invoice, InvoiceItem, InvoicePayment, AccountTransaction

**Platform:** Notification, EnterpriseAuditLog, ApiKey

### Enums (15+)

`SubscriptionStatus` (FREE/PRO/ENTERPRISE), `BusinessType`, `BusinessMode`, `WholesaleOrderStatus`, `CustomerType`, `InventoryChangeType` (MANUAL/SALE/RETURN/RESTOCK), `UnitType`, `UserRole` (OWNER/ADMIN/MEMBER), `OrganizationStatus`, `InvoiceType`, `InvoiceStatus`, `PaymentMethodType`, `PaymentGateway`, `PaymentStatus`, `TransactionDirection`, `TransactionSource`.

### Permissions — JSON in a row

Instead of normalizing every permission, `UserPermission.permissions` is a JSON column with structured shape (`{ actions: { aiAssistantAccess: true, …}, pages: { … } }`). `permission-definitions.ts` provides the type and role defaults.

**Pro:** schema change for new permission = no migration.
**Con:** can't query "all users with X permission" with a normal where clause; must scan + parse.

---

## 7. AI integration

### Provider strategy — primary/fallback

`src/lib/ai-client.ts` returns whichever client is configured:

```
GEMINI_API_KEY set?  →  Gemini 2.5 Flash (via OpenAI-compatible endpoint)
                     fallback ↓
GROQ_API_KEY set?    →  Llama 3.3 70B (via Groq's OpenAI-compatible endpoint)
                     ↓
                     null  (AI features disabled, error fallback)
```

Both providers expose an OpenAI-compatible API, so the **`openai` npm SDK works for both** — no provider-specific client code.

### Files

| File | Purpose |
|---|---|
| `ai-client.ts` | Factory returning the configured client |
| `ai-actions.ts` | Function-calling agent loop (`runAgentLoop`) — multi-turn, max 4 turns |
| `ai-agent-tools.ts` | 9 tool schemas + executors (search_products, adjust_stock, create_purchase_order, get_sales_summary, search_market_prices, etc.) |
| `ai-inventory-chat.ts` | Legacy chat endpoint (kept for backward compat) |
| `ai-forecast.ts` | Demand forecasting (Groq-only for speed) |
| `market-search.ts` | DuckDuckGo HTML web search + page fetching |

### Function-calling loop

```
1. User sends question  →  /api/ai/agent
2. Server builds system prompt (org context + Pakistani market info + history)
3. Loop (max 4 turns):
   a. Send messages to Gemini with tool schemas
   b. If model returns tool_calls → execute against Prisma → push results back as tool messages
   c. If model returns text → return as final answer
4. Response: { answer, toolsUsed: ["search_products", ...] }
```

The loop has a **9-second race timeout** at the route level so Vercel never returns raw HTML 504s (which would break `response.json()` on the client).

### Vision

Product image scanning uses Groq's Llama 3.2 Vision model (Gemini Flash also supports vision but Groq is faster for this single-shot use case).

### Voice agent

`src/components/ai/voice-agent.tsx` — client-side. Uses Web Speech API for STT + wake word ("Hey Lumina"), Web Speech Synthesis for TTS, and the same `/api/ai/agent` endpoint. Continuous session loop with conversation history (multi-turn).

### Market search

DuckDuckGo HTML page scraping (`html.duckduckgo.com/html/`) — not the Instant Answer JSON API, which doesn't return useful results for product price queries. Single page fetched (top result) with a 2-second timeout for actual price extraction.

---

## 8. Auth & security

### Strategy — stateless JWT in httpOnly cookie

- **Sign-in flow:** email + password → bcryptjs verify → `jose.SignJWT` creates HS256 token → set in `lumina-session` httpOnly cookie (7-day expiry).
- **Each request:** `getSession()` reads the cookie, `jose.jwtVerify` checks signature, returns `{ userId, organizationId, role }`.
- **No DB session table** — JWTs are self-contained. Faster (no extra DB read), but **invalidation requires changing `AUTH_SECRET`** or short expiry.

### Authorization — RBAC + permissions

- **Role enum** (`OWNER` / `ADMIN` / `MEMBER`) on `User`.
- **Granular permissions** in `UserPermission.permissions` (JSON). Defaults derived from role; admins can override per-user.
- **`getCurrentUserWithPermissions()`** — single helper used in every API route and server action to fetch the user + their resolved permission set.
- **Soft-suspend orgs** — `Organization.status = SUSPENDED` redirects users to `/suspended`.

### Other security pieces

- **Token encryption** — `TOKEN_ENCRYPTION_KEY` for encrypting OAuth tokens stored in DB (Meta, TikTok, etc. social tokens).
- **Webhook secrets** — Stripe, Meta, governance — verified before processing.
- **Rate limiting** — currently relies on Vercel's built-in protections; no custom rate limiter.
- **CSRF** — Server Actions are CSRF-safe by default in Next.js (origin check + action ID).

### What's NOT here (conscious choices)

- **No NextAuth / Auth.js** — overkill for the email/password use case; jose + bcrypt is 50 lines of code with full control.
- **No middleware.ts** — auth checks happen in actions/routes, not in middleware. Lower runtime overhead, easier to reason about.

---

## 9. Deployment — Vercel + Supabase

### Vercel

- Next.js builds and deploys natively. RSC streaming, route handlers, edge config — all turn-key.
- **`vercel.json`** sets `maxDuration: 30s` for `api/**` (Pro plan; hobby caps at 10s regardless).
- The AI agent route bumps it to **60s** explicitly via `export const maxDuration = 60`.

### Supabase

- Managed Postgres + connection pooler.
- We use **only the Postgres** part — not Supabase Auth, not Realtime, not Storage. Auth is custom (jose); storage isn't needed yet.

### Why Vercel + Supabase together

- Both are zero-ops for a startup. No K8s, no RDS configuration, no VPC peering.
- Both have generous free tiers for development.
- Both scale automatically.

---

## 10. Why this stack — pros & cons

### Next.js App Router (vs. Remix / SvelteKit / plain React+Express)

**Pros**
- RSC ships less JS to the client → faster mobile experience, important for Pakistani users on low-bandwidth.
- Server Actions eliminate the typed-RPC layer most teams hand-roll (tRPC, GraphQL, OpenAPI codegen).
- File-based routing scales without route config files.
- Best-in-class Vercel deploy story.

**Cons**
- App Router is still maturing; Next.js 16 introduced breaking changes the assistant has to read docs for.
- RSC mental model is non-obvious — new contributors trip over what runs where.
- Vendor lock-in is real: leaving Vercel means giving up edge functions, ISR, image optimization, and rebuilding deploy infra.

### React 19 + Tailwind 4

**Pros**
- React 19's `useActionState`, `useFormStatus`, `use()` make Server Actions ergonomic.
- Tailwind 4's CSS-first engine is dramatically faster than v3 + JIT.

**Cons**
- Bleeding-edge — some libraries lag (Radix shipped React 19 support quickly; not all do).
- Tailwind 4 dropped some plugins; needs manual migration.

### Prisma + Postgres (vs. Drizzle / Kysely / raw SQL)

**Pros**
- Best DX: schema-first, type-safe queries, migrations, Studio GUI.
- Postgres is the right default — JSON columns, full-text search, transactions, Pakistan timezone support.

**Cons**
- Prisma has historically had cold-start latency on serverless (less true now with Prisma 6, but still real).
- Generated client is large (~5–10 MB) — build time impact on Vercel.
- Drizzle would be lighter and SQL-closer; we accepted the trade for migration tooling.

### Supabase Postgres (vs. Neon / PlanetScale / RDS)

**Pros**
- True Postgres (Neon also; PlanetScale is MySQL).
- Managed pooler included.
- Easy promotion path: if we later want Supabase Auth/Storage/Realtime, they're a flip.

**Cons**
- Single-region by default — Pakistani users hit a US/EU region with ~150–250ms RTT. Mitigation: read-heavy paths cached / RSC streaming masks it; write paths are infrequent.
- Cold-start of pooler on the free tier can spike first query latency.

### jose JWT cookies (vs. NextAuth / Clerk / Auth0)

**Pros**
- ~80 lines of code, total control, no vendor.
- Self-contained tokens = one less DB hit per request.

**Cons**
- Logout-everywhere requires rotating `AUTH_SECRET` or maintaining a revocation list.
- We'd have to build social login, MFA, magic links ourselves if needed (currently not needed).

### Gemini 2.5 Flash + Groq fallback (vs. OpenAI GPT-4o / Claude)

**Pros**
- Gemini Flash is cheap (~$0.075 per 1M input tokens), fast (~1s typical), and supports tool calling.
- Groq Llama 3.3 is *extremely* fast for simple queries (sub-second).
- Both expose OpenAI-compatible APIs → same SDK, easy provider swap.

**Cons**
- Gemini Flash is weaker at long-form reasoning than GPT-4o or Claude.
- Tool-calling reliability on Gemini is good but not as bulletproof as OpenAI's.
- Pakistani-language nuance is sometimes off in Gemini Flash.

### Server Actions (vs. tRPC / GraphQL / REST)

**Pros**
- Typed end-to-end with no codegen step.
- No API client to maintain.
- Ideal for monolith SaaS with no public API surface.

**Cons**
- Tightly couples client and server — hard to expose to mobile or partners later (must rewrite as API routes).
- Hard to test in isolation (no HTTP boundary).
- Debugging RSC + Server Action pipelines is still rough compared to "fetch a JSON".

### DuckDuckGo HTML scraping (vs. SerpAPI / Brave Search API)

**Pros**
- Free, no API key.
- Returns relevant Pakistani results when given the right `kl=pk-en` locale.

**Cons**
- Brittle — HTML format can change.
- Risk of rate limiting from cloud IPs.
- No SLA, no support.
- For production scale we'd switch to a paid search API ($0.001/query is fine at this point).

---

## 11. File structure (annotated)

```
lumina-stock/
├── prisma/
│   ├── schema.prisma           ← 24 models, multi-tenant by organizationId
│   └── seed/                   ← seed scripts
├── public/                     ← static assets (logos, favicons)
├── scripts/                    ← local dev scripts (db-local.ps1)
├── src/
│   ├── app/
│   │   ├── (auth)/             ← public auth pages (login/register)
│   │   ├── (dashboard)/        ← all authenticated pages
│   │   ├── api/                ← Route Handlers (webhooks, AI, uploads)
│   │   ├── onboard/            ← onboarding wizard
│   │   ├── store/              ← public storefront
│   │   ├── suspended/          ← suspended-org page
│   │   └── layout.tsx          ← root layout (providers, fonts)
│   ├── components/             ← domain-organized React components
│   │   ├── ai/                 ← chat, voice agent
│   │   ├── cashier/            ← POS UI
│   │   ├── inventory/
│   │   ├── analytics/
│   │   ├── layout/             ← sidebar, topbar
│   │   ├── providers/          ← i18n, theme contexts
│   │   └── …                   (one folder per domain)
│   └── lib/
│       ├── actions/            ← ~30 server-action modules
│       ├── ai-client.ts
│       ├── ai-actions.ts
│       ├── ai-agent-tools.ts
│       ├── ai-inventory-chat.ts
│       ├── ai-forecast.ts
│       ├── market-search.ts
│       ├── auth.ts             ← jose JWT + cookie helpers
│       ├── session.ts          ← getSession()
│       ├── permissions.ts      ← getCurrentUserWithPermissions()
│       ├── permission-definitions.ts
│       ├── db.ts               ← Prisma singleton
│       ├── i18n.ts             ← translation strings
│       ├── i18n-provider.tsx
│       ├── i18n-server.ts
│       ├── stripe.ts
│       ├── invoice-gateways.ts ← JazzCash/EasyPaisa/PayPal
│       ├── whatsapp.ts
│       └── speech-api.ts       ← Web Speech typings
├── .env                        ← secrets (gitignored)
├── .env.example                ← documented placeholders (committed)
├── next.config.ts
├── vercel.json                 ← maxDuration for api/**
├── tsconfig.json
└── package.json
```

---

## 12. Environment variables (grouped)

**Database** — `DATABASE_URL`, `DIRECT_URL`

**Auth** — `AUTH_SECRET`, `TOKEN_ENCRYPTION_KEY`, `ENTERPRISE_AUDIT_EXPORT_SIGNING_SECRET`, `SOFTWARE_OWNER_EMAILS`, `ENTERPRISE_ADMIN_EMAILS`

**AI** — `GEMINI_API_KEY`, `GEMINI_MODEL`, `GROQ_API_KEY`, `GROQ_MODEL`, `GROQ_BASE_URL`, `GROQ_VISION_MODEL`, `OPENAI_API_KEY`

**Platform** — `NEXT_PUBLIC_APP_DOMAIN`, `NEXT_PUBLIC_APP_URL`, `NODE_ENV`

**Email** — `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `ALERT_EMAIL_TO`

**Payments** — Stripe (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, `STRIPE_ENTERPRISE_PRICE_ID`), PayPal (`PAYPAL_CLIENT_ID/SECRET/BASE_URL`), JazzCash (`JAZZCASH_MERCHANT_ID/PASSWORD/INTEGRITY_SALT`), EasyPaisa (`EASYPAISA_STORE_ID/HASH_KEY`)

**WhatsApp** — `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_VERIFY_TOKEN`

**Social OAuth** — Meta, TikTok, X, Google, LinkedIn, Pinterest (client ID + secret each)

**3rd-party services** — `REACHFLOW_BASE_URL`, `REACHFLOW_API_KEY`, governance webhooks

---

## 13. Trade-offs we're carrying

Honest list of debt / future moves:

1. **Single-region DB** — Pakistani users have RTT to Supabase region. Future: read replicas in APAC.
2. **No background queue** — Inngest is in deps but unused. Long jobs (forecasting, bulk imports) push against Vercel timeouts. Future: wire up Inngest for true async work.
3. **DDG HTML scraping** — fragile. Future: paid search API once usage volume justifies cost.
4. **JWT can't be invalidated quickly** — acceptable for now; if we add admin "force logout" we'll need a revocation list.
5. **Permissions in JSON column** — flexible, but can't index. Future: if we need permission-based queries, normalize.
6. **Tenant isolation in app code** — column scoping is correct but not enforced by DB. Future: row-level security policies in Postgres for defense-in-depth.
7. **No middleware.ts** — works, but if we add many gated routes, a middleware-based redirect would be DRYer.
8. **Generated Prisma client is large** — adds to cold-start. Future: try `prisma generate --no-engine` with Edge runtime where possible.

---

*Doc generated 2026-05-01 from a snapshot of the codebase. Updates the architecture? Update this file in the same PR.*
