# Deployment Guide: Vercel + Supabase

This guide walks you through making **Lumina Stock** live on **Vercel** with a **Supabase** PostgreSQL database.

---

## 1. Supabase Database Setup

### Step 1.1: Create Project & Get Connection Strings
1. Go to [Supabase](https://supabase.com) and create a new project.
2. Go to **Project Settings** → **Database** → **Connection strings**.
3. Copy the two connection strings:
   - **Transaction Pooler** (Port `6543`) → Used for `DATABASE_URL`:
     ```
     postgresql://postgres.[PROJECT-REF]:[PASSWORD]@[POOLER-HOST]:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require
     ```
   - **Session Pooler** (Port `5432`) or Direct → Used for `DIRECT_URL`:
     ```
     postgresql://postgres.[PROJECT-REF]:[PASSWORD]@[POOLER-HOST]:5432/postgres?sslmode=require
     ```
   > ⚠️ **Note:** If your database password contains special characters (like `@`, `#`, `$`), URL-encode them.

### Step 1.2: Apply the Database Schema
You have two easy ways to apply the schema to your Supabase database:

#### Option A: Via Supabase SQL Editor (Recommended - Easiest)
1. In your Supabase Dashboard, click on **SQL Editor** → **New query**.
2. Open the file [`supabase-complete-schema.sql`](./supabase-complete-schema.sql) in this project.
3. Copy its entire content, paste it into the Supabase SQL Editor, and click **Run**.
4. All tables, relations, enums, and indexes will be created instantly.

#### Option B: Via Prisma CLI
1. Temporarily create a `.env.local` file with your Supabase credentials:
   ```env
   DATABASE_URL="your-supabase-transaction-pooler-url"
   DIRECT_URL="your-supabase-session-pooler-url"
   ```
2. Run schema push:
   ```bash
   npm run db:push
   ```

### Step 1.3: Create Initial Store & Admin User
Run the admin creation script to set up your store owner credentials:
```bash
npm run db:create-admin -- --email "your-email@example.com" --password "YourStrongPassword" --name "Owner Name" --org "Your Store Name"
```
*(Or if you want a complete demo catalog with sample products and orders, run `npm run db:seed` instead).*

---

## 2. Vercel Deployment

### Step 2.1: Push Code to GitHub
```bash
# Add your GitHub remote (replace with your repo URL)
git remote add origin https://github.com/YOUR_USERNAME/lumina-stock.git

# Push main branch
git push -u origin main
```

### Step 2.2: Import Project in Vercel
1. Go to [Vercel Dashboard](https://vercel.com/dashboard) → **Add New...** → **Project**.
2. Select your `lumina-stock` repository and click **Import**.
3. Framework Preset will auto-detect as **Next.js**.

### Step 2.3: Configure Environment Variables in Vercel
Under **Environment Variables**, add the following:

| Variable | Value | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://postgres.[REF]:[PASS]@[HOST]:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require` | Supabase Transaction Pooler |
| `DIRECT_URL` | `postgresql://postgres.[REF]:[PASS]@[HOST]:5432/postgres?sslmode=require` | Supabase Session Pooler |
| `AUTH_SECRET` | *(Generate with: `openssl rand -base64 32`)* | Minimum 32-character random key |
| `NEXT_PUBLIC_APP_URL` | `https://your-project.vercel.app` | Production app URL |
| `NEXT_PUBLIC_APP_DOMAIN` | `your-project.vercel.app` | Production domain |
| `ENTERPRISE_ADMIN_EMAILS` | `your-email@example.com` | (Optional) platform superadmin |

### Step 2.4: Deploy
Click **Deploy**. Vercel will run `prisma generate && next build` and deploy your application live!

### Function region

Vercel Functions run in `iad1` by default. This project uses Supabase in Mumbai
(`ap-south-1`), so `vercel.json` sets the function region to Mumbai (`bom1`).
If the Function Regions control is unavailable in the Vercel dashboard, keep
this setting in `vercel.json` and redeploy after pushing the change.
After connecting or reconnecting the Git repository in Vercel, push a new commit
to `main` to trigger a production deployment; reconnecting does not deploy
commits that were pushed before the connection was active.

---

## 3. Branch & Update Strategy

```
main          → Client's production (only tested, stable code)
dev/release   → Your development branch (new features, experiments)
```

## Development Flow

```bash
# 1. Start on dev/release branch
git checkout dev/release

# 2. Make changes, commit, push
git add .
git commit -m "feat: add new feature"
git push origin dev/release

# 3. Vercel auto-deploys to preview URL (safe - client unaffected)
# Test on preview URL

# 4. When ready: merge to main
git checkout main
git merge dev/release
git push origin main

# 5. Go to Vercel Dashboard → lumina-stock → Deployments
# Find latest deployment → ⋮ → "Promote to Production"
```

## Hotfix Flow (Emergency)

```bash
# 1. Go directly to main
git checkout main

# 2. Make fix, commit, push
git add .
git commit -m "fix: critical bug fix"
git push origin main

# 3. Vercel auto-deploys to preview
# Go to Vercel Dashboard → lumina-stock → Deployments
# Find latest deployment → ⋮ → "Promote to Production"

# 4. Client gets fix immediately
```

## Custom Domain Setup

When you buy a domain (e.g., `lumina-stock.com`):

### Step 1: Add Domain to Vercel

1. Vercel Dashboard → `lumina-stock` → Settings → Domains
2. Add `lumina-stock.com`
3. Add `www.lumina-stock.com`
4. Vercel shows DNS records to add

### Step 2: Configure DNS at Registrar

At your registrar (Namecheap/Cloudflare/GoDaddy):

**For root domain:**
- **A Record**: `@` → `76.76.21.21`

**For www subdomain:**
- **CNAME**: `www` → `cname.vercel-dns.com`

**For wildcard subdomains (client names):**
- **A Record**: `*` → `76.76.21.21`

### Step 3: Environment Variables

In Vercel Dashboard → `lumina-stock` → Settings → Environment Variables:

```
NEXT_PUBLIC_APP_DOMAIN=lumina-stock.com
NEXT_PUBLIC_APP_URL=https://lumina-stock.com
```

### Step 4: Wait for Propagation

- DNS propagation: 5-30 minutes
- SSL certificate: Automatic (Vercel provisions instantly)
- Subdomains work immediately after DNS propagates

## Subdomain System

Your app already has subdomain support built:

- `proxy.ts` detects subdomains (e.g., `client.lumina-stock.com`)
- Rewrites to `/store/client` internally
- Loads organization by subdomain from database
- Renders storefront with products, branding, theme

### How to Enable Subdomain for a Client

1. Go to Settings → Subdomain
2. Enter subdomain (e.g., `myclient`)
3. Save (validates uniqueness, format)
4. Client accesses via `myclient.lumina-stock.com`

## Troubleshooting

### Build Fails on Vercel

1. Check build logs in Vercel Dashboard → Deployments → click deployment → Building
2. Common issues:
   - Missing environment variables
   - Prisma generate fails
   - TypeScript errors

### Client Sees Old Version

1. Verify you promoted the correct deployment to production
2. Clear browser cache (Ctrl+Shift+R)
3. Check service worker: DevTools → Application → Service Workers → Unregister

### Subdomain Not Working

1. Verify custom domain is added to Vercel
2. Verify wildcard DNS record exists (`*` → Vercel IP)
3. Verify `NEXT_PUBLIC_APP_DOMAIN` env var is set correctly
4. Check proxy.ts is working (should rewrite `/store/[subdomain]`)

### Preview URL Shows Wrong Code

1. Verify you're on correct branch (`git branch`)
2. Push to remote (`git push origin dev/release`)
3. Wait for Vercel build to complete
4. Use incognito mode to avoid cache issues
