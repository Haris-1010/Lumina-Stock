# Lumina Stock

AI-powered inventory optimization platform built with Next.js, Prisma, and PostgreSQL.

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables in `.env`:

```bash
DATABASE_URL="postgresql://admin@localhost:5433/lumina_stock?schema=public"
AUTH_SECRET="replace-with-a-long-random-secret"

# Stripe billing (optional until you enable checkout)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRO_PRICE_ID="price_..."
# Optional if you offer direct Enterprise checkout
STRIPE_ENTERPRISE_PRICE_ID="price_..."

# Optional allowlist for enterprise tenant control center
# Comma-separated admin emails. If omitted in local/dev, OWNER users are allowed (bootstrap mode).
ENTERPRISE_ADMIN_EMAILS="owner@yourcompany.com,ops@yourcompany.com"

# Optional governance webhook for tenant and export lifecycle events
ENTERPRISE_GOVERNANCE_WEBHOOK_URL="https://hooks.yourcompany.com/lumina-governance"
# Optional HMAC secret for X-Lumina-Signature header
ENTERPRISE_GOVERNANCE_WEBHOOK_SECRET="replace-with-a-random-secret"

# Optional free-tier AI for smart forecast insights (Groq)
# If omitted, app falls back to deterministic local insight text.
GROQ_API_KEY="gsk_..."
# Optional overrides
GROQ_MODEL="llama-3.3-70b-versatile"
GROQ_BASE_URL="https://api.groq.com/openai/v1"
```

3. Start the bundled local PostgreSQL cluster (required for `localhost:5433` setups):

```bash
npm run db:start-local
npm run db:status-local
```

4. Generate Prisma client and sync schema:

```bash
npm run db:generate
npm run db:push
```

5. Seed demo data (optional):

```bash
npm run db:seed
```

6. Start the app:

```bash
npm run dev
```

If you want one command that ensures DB is up before launching Next.js:

```bash
npm run dev:local
```

## Demo credentials

- Email: `demo@lumina.com`
- Password: `DemoPassword123`

## Billing integration

This project includes Stripe checkout and webhook sync:

- Checkout route: `/api/billing/checkout?plan=PRO`
- Webhook route: `/api/webhooks/stripe`

To test webhooks locally with Stripe CLI:

```bash
stripe listen --forward-to http://localhost:3000/api/webhooks/stripe
```

Use the printed signing secret as `STRIPE_WEBHOOK_SECRET`.

## Invoice payments (local wallets)

Invoice checkout supports Stripe, PayPal, JazzCash, and EasyPaisa.

For merchant-grade JazzCash/EasyPaisa integration, add these env vars:

```bash
# JazzCash merchant config
JAZZCASH_MERCHANT_ID="..."
JAZZCASH_PASSWORD="..."
JAZZCASH_INTEGRITY_SALT="..."
# Optional overrides
JAZZCASH_API_URL="https://sandbox.jazzcash.com.pk/ApplicationAPI/API/Payment/DoTransaction"
JAZZCASH_RETURN_URL="http://localhost:3000/api/payments/confirm?gateway=JAZZCASH"

# EasyPaisa merchant config
EASYPAISA_STORE_ID="..."
EASYPAISA_HASH_KEY="..."
# Optional overrides
EASYPAISA_API_URL="https://easypaystg.easypaisa.com.pk/easypay-service/rest/v4/initiate-ma-transaction"
EASYPAISA_RETURN_URL="http://localhost:3000/api/payments/confirm?gateway=EASYPAISA"

# PayPal (already used by invoice checkout)
PAYPAL_CLIENT_ID="..."
PAYPAL_CLIENT_SECRET="..."
# Optional
PAYPAL_BASE_URL="https://api-m.sandbox.paypal.com"
```

Webhook endpoints for wallet verification and settlement:

- JazzCash: `/api/webhooks/jazzcash`
- EasyPaisa: `/api/webhooks/easypaisa`

Configure these in each gateway dashboard so server-to-server callbacks can verify signatures, reconcile invoice payments, and record incoming transaction notifications.

## Plan limits

Plan enforcement is implemented in `src/lib/subscription.ts`:

- FREE: 100 products, 2 active API keys, 10 req/min
- PRO: 5000 products, 20 active API keys, 60 req/min
- ENTERPRISE: unlimited products/API keys, 300 req/min

Enforced paths include CSV import, API key creation, and forecast/dead-stock API rate limiting.

## Enterprise tenant control center

Enterprise management views are available at `/enterprise/tenants`.

Features:

- Cross-tenant overview metrics (tenant count, users, products, active API keys, 30-day revenue)
- Tenant health and plan-capacity visibility
- Per-tenant management page with user/product/activity/order visibility
- Plan governance controls (FREE/PRO/ENTERPRISE) with instant revalidation
- Tenant lifecycle controls (ACTIVE/SUSPENDED) with reason capture
- Two-step tenant reactivation workflow (request + separate admin approval)
- Reactivation rejection workflow with enterprise audit logging
- Enterprise audit trail for plan and lifecycle governance actions
- Audit trail search/filtering (actor/action/date window) and CSV export
- Global enterprise audit page at `/enterprise/audit` for cross-tenant review and export
- Server-side compliance export endpoint: `/api/enterprise/audit/export`
- Server exports produce immutable signed snapshots (SHA-256 digest + HMAC signature metadata)
- Enterprise audit UI now validates signatures and flags invalid snapshot metadata
- Optional governance webhooks for tenant status/plan/reactivation and server export events
- Suspended tenant lockout with a dedicated `/suspended` access experience

Optional hardening:

- Set `ENTERPRISE_AUDIT_EXPORT_SIGNING_SECRET` in production to rotate export-signing keys independently from `AUTH_SECRET`.

Access control:

- Production recommendation: set `ENTERPRISE_ADMIN_EMAILS` with explicit admin emails.
- Local/dev bootstrap behavior: if `ENTERPRISE_ADMIN_EMAILS` is unset, OWNER users can access the module.
