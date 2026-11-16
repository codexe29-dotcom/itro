# ITRO Platform — Free Tier Deployment & Security Hardening Guide

> **Target Version:** ITRO v1.0.0 (Production Release Candidate)  
> **Target Environments:** Free Tier Deployment (Vercel + Render + Supabase + Cloudflare R2)  
> **Security Baseline:** Hardened against OWASP Top 10, Layer 7 Floods, Brute-Force, and IDOR (Moderate to Below-High Threat Level)

---

## 1. Project Version & Duplicate Folder Resolution

### Clarification: Which Folder is the Final Project Version?

You may notice two parallel directory structures in the repository:
1. **The Root Workspace** (`./server`, `./web`, `./package.json`, `./Jenkinsfile`, etc.)
2. **The Subdirectory** (`./ITRO-development/`)

### The Verdict: **The Root Workspace is the Final Source of Truth**

| Characteristic | Root Workspace (`./server`, `./web`) | Subfolder (`./ITRO-development`) |
|---|---|---|
| **Status** | **ACTIVE / FINAL VERSION (v1.0.0)** | **OUTDATED DUPLICATE (Obsolete)** |
| **npm Workspaces** | Root `package.json` links directly to `./server` and `./web` | Standalone sub-tree, unlinked to root npm |
| **Security Fixes** | Includes HTTP security headers, Bearer auth, hardened payment bypass safeguards | Missing recent security patches |
| **Automated Tests** | 29 passing Vitest tests (6 backend suites + 2 frontend suites) | Zero test files |
| **Dependency Audits** | 0 CVE vulnerabilities across all runtime packages | Unpatched dependencies |
| **Prisma Migrations** | Includes all 20 migrations (including `20261106133000_schema_reconciliation`) | Older migration snapshot |

### Why Did This Duplication Happen?
During the initial repository setup (Git commit `ea7b35f`), the author unpacked the project archive and accidentally committed both the root repository files and an unzipped extraction folder named `ITRO-development/`.

### Recommended Action
To avoid deployment confusion and prevent tools from scanning duplicate code, remove the redundant folder from Git tracking:
```bash
git rm -r ITRO-development
git commit -m "chore: remove redundant ITRO-development duplicate snapshot"
```
*(All deployment steps in this guide strictly target the **root** `server/` and `web/` directories).*

---

## 2. Free Tier Architecture Overview

To run ITRO with high performance, zero hosting cost, and enterprise security, we decouple the architecture across specialized free-tier providers:

```
                            ┌──────────────────────────────────────────┐
                            │        Cloudflare (Free Tier DNS)        │
                            │  DDoS Shield • SSL/TLS • Bot Protection  │
                            └────────────────────┬─────────────────────┘
                                                 │
                     ┌───────────────────────────┴───────────────────────────┐
                     ▼                                                       ▼
        ┌─────────────────────────┐                             ┌─────────────────────────┐
        │      Vercel (Hobby)     │                             │    Render.com (Free)    │
        │      Frontend SPA       │ ──── HTTPS API Requests ──► │       Backend API       │
        │   React 18 + Vite CDN   │                             │  Express 4 + Node 20    │
        └─────────────────────────┘                             └────────────┬────────────┘
                                                                             │
                                       ┌─────────────────────────────────────┴─────────────────────────────────────┐
                                       ▼                                                                           ▼
                          ┌─────────────────────────┐                                                 ┌─────────────────────────┐
                          │   Supabase (Free Tier)  │                                                 │  Cloudflare R2 Storage  │
                          │   PostgreSQL Database   │                                                 │   S3-Compatible Object  │
                          │   (Pooled Port 6543)    │                                                 │   (10 GB Free, $0 Egress)│
                          └─────────────────────────┘                                                 └─────────────────────────┘
```

### Free Tier Specification & Quota Breakdown

| Service | Free Provider | Free Tier Allowance | Role in ITRO |
|---|---|---|---|
| **Frontend** | **Vercel** (Hobby) | 100 GB Bandwidth/mo, Global Edge Network, SSL | Hosts React SPA, handles client routing |
| **Backend API** | **Render.com** (Free) | 750 free instance hours/mo, 512 MB RAM | Runs Express API, handles business logic |
| **Database** | **Supabase** | 500 MB PostgreSQL, Supavisor connection pooling | Stores all multi-tenant relational data |
| **File Storage** | **Cloudflare R2** | 10 GB Storage, 1M write/mo, 10M read/mo, **$0 egress fees** | Stores public images & private test reports |
| **Edge Security** | **Cloudflare DNS** | Unlimited DDoS protection, Universal SSL, Web Application Firewall | Mitigates Layer 7 attacks, caches static assets |

---

## 3. Step-by-Step Free Tier Deployment Guide

### Phase 1: Database Setup on Supabase (PostgreSQL)

1. **Create a Supabase Project:**
   - Sign up at [supabase.com](https://supabase.com).
   - Click **New Project**.
   - Set **Name**: `itro-production` (or `itro-staging`).
   - Set a strong **Database Password** (store this securely).
   - Select your closest region (e.g., `ap-south-1` Mumbai or `us-east-1`).
   - Choose the **Free Plan**.

2. **Retrieve Database Connection Strings:**
   - In Supabase, go to **Project Settings** → **Database** → **Connection String**.
   - Note down two strings:
     - **Session / Pooled URL (Port 6543):**
       `postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true`
     - **Direct URL (Port 5432):**
       `postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres`

3. **Deploy Database Schema & Migrations:**
   Run the Prisma migration from your local workstation root terminal to deploy all 45 tables, 33 indexes, and constraints into Supabase:
   ```bash
   # On Windows PowerShell
   $env:DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
   $env:DIRECT_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"
   npx prisma migrate deploy --schema=server/prisma/schema.prisma
   ```

4. **Seed Initial Platform Data (Optional but Recommended):**
   ```bash
   npx tsx server/src/seed.ts
   ```

---

### Phase 2: Object Storage Setup on Cloudflare R2

Cloudflare R2 provides an S3-compatible API with **10 GB of free storage and zero egress bandwidth fees** (unlike AWS S3, which charges for bandwidth).

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com) → **R2 Object Storage**.
2. Click **Create Bucket**:
   - Bucket name: `itro-storage`
   - Region: Automatic or closest region.
3. **Generate S3 API Credentials:**
   - Go to **Manage R2 API Tokens** → **Create API Token**.
   - Permissions: **Object Read & Write**.
   - Copy:
     - `Access Key ID`
     - `Secret Access Key`
     - `Endpoint URL` (e.g., `https://<account_id>.r2.cloudflarestorage.com`)
4. **Bucket Public Access (for catalog images):**
   - Under bucket settings, enable **R2.dev subdomain** or connect a custom subdomain like `media.yourdomain.com`.
   - Set `STORAGE_PUBLIC_BASE_URL=https://pub-<hash>.r2.dev` (or your custom media domain).

*(Alternative: If you prefer Supabase Storage, Supabase also provides an S3-compatible endpoint under Project Settings → Storage → S3 Connection).*

---

### Phase 3: Backend Deployment on Render.com

Render offers a free Web Service tier that natively runs Node.js long-running processes.

1. **Create Web Service:**
   - Sign up at [render.com](https://render.com) and link your GitHub repository.
   - Click **New** → **Web Service**.
   - Select your ITRO repository.
2. **Configure Service Settings:**
   - **Name:** `itro-api`
   - **Region:** Closest to your Supabase DB region (e.g., Singapore or Frankfurt).
   - **Branch:** `main`
   - **Root Directory:** `server`
   - **Runtime:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start`
   - **Instance Type:** `Free`
3. **Configure Environment Variables:**
   Under **Environment** in Render, add the following key-value pairs:

   | Key | Value / Description |
   |---|---|
   | `NODE_ENV` | `production` |
   | `PORT` | `4000` |
   | `DATABASE_URL` | Your Supabase pooled URL (`port 6543?pgbouncer=true`) |
   | `DIRECT_URL` | Your Supabase direct URL (`port 5432`) |
   | `JWT_SECRET` | Generate a strong 64-character random string (e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
   | `JWT_EXPIRES_IN` | `7d` |
   | `CORS_ORIGIN` | `https://your-frontend.vercel.app` (replace with your Vercel URL) |
   | `PUBLIC_API_URL` | `https://itro-api.onrender.com` |
   | `PUBLIC_WEB_URL` | `https://your-frontend.vercel.app` |
   | `STORAGE_DRIVER` | `s3` |
   | `S3_BUCKET_NAME` | `itro-storage` |
   | `S3_ENDPOINT` | `https://<account_id>.r2.cloudflarestorage.com` |
   | `S3_ACCESS_KEY_ID` | Your Cloudflare R2 Access Key ID |
   | `S3_SECRET_ACCESS_KEY` | Your Cloudflare R2 Secret Access Key |
   | `S3_REGION` | `auto` |
   | `STORAGE_PUBLIC_BASE_URL` | `https://pub-<hash>.r2.dev` |

4. **Deploy & Verify Health Check:**
   - Click **Deploy Web Service**.
   - Once deployed, visit: `https://itro-api.onrender.com/api/health`
   - Expected response:
     ```json
     {
       "status": "ok",
       "database": "connected",
       "timestamp": "2026-11-15T..."
     }
     ```

> [!NOTE]
> **Free Tier Cold Starts:** Free instances on Render spin down after 15 minutes of inactivity. The first request after idle can take ~30-45 seconds to wake up. To keep it warm for client demos, you can set up a free uptime monitor (e.g., [cron-job.org](https://cron-job.org) or [UptimeRobot](https://uptimerobot.com)) calling `/api/health` every 10 minutes.

---

### Phase 4: Frontend Deployment on Vercel

Vercel provides edge hosting with automatic global SSL and zero cold-start latency for React SPAs.

1. **Import Repository to Vercel:**
   - Sign up at [vercel.com](https://vercel.com).
   - Click **Add New...** → **Project**.
   - Select your ITRO GitHub repository.
2. **Configure Project Settings:**
   - **Framework Preset:** `Vite`
   - **Root Directory:** Click Edit and select `web`
   - **Build Command:** `npm run build:compile`  
     *(Note: `build:compile` executes `tsc -b && vite build`. If you want full SEO pre-rendering of all 399 static routes, use `npm run build:release` after your backend API is online).*
   - **Output Directory:** `dist`
3. **Configure Environment Variables:**
   Add these in the Vercel project settings:
   - `VITE_API_URL`: `https://itro-api.onrender.com/api`
   - `VITE_SITE_URL`: `https://your-itro-app.vercel.app`
4. **Client Routing Configuration (`vercel.json`):**
   The repository includes [`web/vercel.json`](file:///D:/CODEXE%20Technologies/Projects/Proj_FlD_01_7-11-26_ITRO/ITRO/web/vercel.json):
   ```json
   {
     "rewrites": [
       {
         "source": "/(.*)",
         "destination": "/index.html"
       }
     ]
   }
   ```
   This guarantees that direct navigation and page reloads on deep paths (e.g., `/buyer/orders`, `/admin/catalog`, `/exchange`) load the React SPA instead of throwing `404 Not Found`.
5. **Deploy:**
   - Click **Deploy**. Vercel will build and assign an HTTPS URL (e.g., `https://itro-platform.vercel.app`).

---

## 4. Security Hardening & Attack Resistance

To ensure the platform reliably withstands **moderate to below-high cybersecurity attacks** (such as automated scanning, credential stuffing, scraping floods, XSS, CSRF, SQLi, and tenant data tampering), the following defenses are active in the application code and deployment pipeline:

### 1. Layer 7 DDoS & Scraping Flood Defense
- **Free Tier Risk:** A free Render instance has 512 MB RAM; a flood of HTTP requests can crash the container or exhaust its CPU quota.
- **Active Defense:**
  - Route your domain through **Cloudflare Free DNS** with the orange cloud (Proxy) enabled.
  - Enable **Cloudflare "Bot Fight Mode"** and set **Security Level: Medium**.
  - Cloudflare's Edge absorbs volumetric Layer 3/4 SYN floods and Layer 7 HTTP request storms before traffic ever touches Render or Vercel.

### 2. Brute-Force & Credential Stuffing Defense
- **Implementation:** [`server/src/routes/auth.ts`](file:///D:/CODEXE%20Technologies/Projects/Proj_FlD_01_7-11-26_ITRO/ITRO/server/src/routes/auth.ts#L14-L20)
- **Mechanisms:**
  - `express-rate-limit` enforces a strict rate limit of **10 authentication requests per 15-minute window** per client IP.
  - Exceeding the threshold returns `429 Too Many Requests` with standard retry headers (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`).
  - Passwords are encrypted with **Bcrypt (10 salt rounds)**, resisting offline GPU cracking.
  - Password complexity is enforced via Zod (minimum 10 characters, at least 1 uppercase letter, at least 1 digit).

### 3. Cross-Site Scripting (XSS) & Clickjacking Defense
- **Implementation:** [`server/src/index.ts`](file:///D:/CODEXE%20Technologies/Projects/Proj_FlD_01_7-11-26_ITRO/ITRO/server/src/index.ts#L14-L25)
- **Active Headers:**
  - `X-Content-Type-Options: nosniff`: Prevents MIME-sniffing attacks.
  - `X-Frame-Options: SAMEORIGIN`: Blocks iframe embedding, preventing UI redressing / clickjacking.
  - `Referrer-Policy: strict-origin-when-cross-origin`: Prevents leaking sensitive URL query parameters across origins.
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`: Enforces HTTPS transport.
  - `app.disable("x-powered-by")`: Suppresses server fingerprinting.
  - React 18 frontend uses declarative JSX data binding, automatically escaping HTML entities in buyer and provider content.

### 4. Cross-Site Request Forgery (CSRF) Defense
- **Cookie Security:** Auth session cookies (`rix_session`) are explicitly configured with:
  - `HttpOnly: true` (inaccessible to JavaScript).
  - `Secure: true` (only transmitted over TLS/HTTPS).
  - `SameSite: strict` (browsers refuse to send the cookie in cross-site contexts).
- **Bearer Token Support:** [`server/src/middleware/auth.ts`](file:///D:/CODEXE%20Technologies/Projects/Proj_FlD_01_7-11-26_ITRO/ITRO/server/src/middleware/auth.ts#L22-L37) supports explicit `Authorization: Bearer <token>` headers, rendering cross-site request forgery impossible for API clients.

### 5. SQL Injection (SQLi) Defense
- **Implementation:** Parameterized queries via Prisma ORM across all 45 database models.
- No string-concatenated or raw SQL queries exist in route handlers.
- All incoming payloads (`req.body`, `req.query`, `req.params`) are validated through strict Zod schemas before database queries execute.

### 6. Broken Object Level Authorization (BOLA / IDOR) Defense
- **Implementation:** Multi-tenant access controls in [`server/src/middleware/auth.ts`](file:///D:/CODEXE%20Technologies/Projects/Proj_FlD_01_7-11-26_ITRO/ITRO/server/src/middleware/auth.ts) and all route controllers.
- Access to sensitive entities (orders, sample reports, invoices, lab bookings) verifies both user authentication (`requireAuth`) and role permission (`requireRole`).
- Every query scoped to an institution or order explicitly asserts tenant ownership:
  ```typescript
  // Example: Orders can only be read by their creator, the assigned provider, or SUPER_ADMIN
  if (req.user.role !== "SUPER_ADMIN" && order.buyerId !== req.user.id && order.providerId !== req.user.institutionId) {
    throw new AppError(403, "Access denied to this order");
  }
  ```

### 7. Unrestricted File Upload & Malicious File Execution
- **Implementation:** [`server/src/lib/storage.ts`](file:///D:/CODEXE%20Technologies/Projects/Proj_FlD_01_7-11-26_ITRO/ITRO/server/src/lib/storage.ts) and [`server/src/routes/uploads.ts`](file:///D:/CODEXE%20Technologies/Projects/Proj_FlD_01_7-11-26_ITRO/ITRO/server/src/routes/uploads.ts)
- **Mitigations:**
  - Files are segregated into two distinct domains: `public/` (catalog and hero images) and `private/` (order NDAs, sample specifications, test result PDFs).
  - Public uploads are served with `Content-Security-Policy: default-src 'none'; sandbox` and `X-Content-Type-Options: nosniff` to prevent malicious SVGs or HTML files from executing scripts.
  - Private files are **never** served statically. They are accessed exclusively via short-lived (5-minute) signed URLs or authenticated Express streams after validating tenant permissions.
  - Safe key normalization (`safeKey`) blocks path traversal (`../`) attacks.

### 8. Payment Security & "Free Order" Bypass Defense
- **Implementation:** Hardened checkout handler in [`server/src/routes/orders.ts`](file:///D:/CODEXE%20Technologies/Projects/Proj_FlD_01_7-11-26_ITRO/ITRO/server/src/routes/orders.ts#L584-L640).
- **Vulnerability Mitigated:** In development or demo mode, disabled payment gateways previously permitted buyers to mark orders as `PAID`.
- **Production Guard:**
  - In `NODE_ENV=production`, non-admin users **cannot** mark orders as paid without a valid payment gateway callback.
  - Offline wire/bank transfers are marked as `PENDING` (Invoice status `ISSUED`), requiring manual administrative confirmation of the bank UTR before laboratory services commence.

### 9. Environment Secret Protection
- **Implementation:** [`server/src/env.ts`](file:///D:/CODEXE%20Technologies/Projects/Proj_FlD_01_7-11-26_ITRO/ITRO/server/src/env.ts)
- Production server startup immediately halts (`process.exit(1)`) if:
  - `DATABASE_URL` is missing or contains placeholder keywords (`change-me`, `demo`, `test`).
  - `JWT_SECRET` is shorter than 32 characters or uses default dev secrets.
  - S3 credentials are missing when `STORAGE_DRIVER=s3`.

---

## 5. Verification Checklist & Pre-Flight Smoke Tests

Before sharing access with stakeholders or clients, run this validation sequence:

### 1. Automated Test Suite
From the workspace root directory, run:
```bash
npm test
```
**Expected Result:**
```
✓ tests/env.spec.ts (3 tests)
✓ tests/storage.spec.ts (4 tests)
✓ tests/uploads.spec.ts (3 tests)
✓ tests/health.spec.ts (4 tests)
✓ tests/auth-middleware.spec.ts (4 tests)
✓ tests/tokens.spec.ts (3 tests)
✓ tests/seo-public-artifacts.spec.ts (2 tests)
✓ tests/formatters.spec.ts (6 tests)

Test Files  8 passed (8)
     Tests  29 passed (29)
```

### 2. Live Health & Database Connection Probe
Verify the live API on Render:
```bash
curl -i https://itro-api.onrender.com/api/health
```
**Expected HTTP Response:** `200 OK`
```json
{
  "status": "ok",
  "database": "connected"
}
```

### 3. Security Header Verification
Confirm security headers are active on the production API:
```bash
curl -I https://itro-api.onrender.com/api
```
**Expected Headers Present:**
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`

### 4. End-to-End User Journeys
Perform these smoke tests on your deployed Vercel URL:
1. **Public Discovery:** Browse `/exchange`, `/industries/aerospace-defense`, and `/facilities`. Verify cards and images load without errors.
2. **Buyer Registration & Login:** Create an account at `/auth/register`. Verify session cookie or bearer token is issued.
3. **Cart & Quote Submission:** Add a test service to cart and submit a quote or order request.
4. **Super Admin Dashboard:** Log in with administrative credentials and verify the `/platform/dashboard` and `/platform/integrations` screens render securely.

---

## 6. Summary of Deployment URLs & Credentials Reference

Fill in your actual deployment endpoints below for your operations team:

- **Frontend URL (Vercel):** `https://__________________________.vercel.app`
- **Backend API URL (Render):** `https://__________________________.onrender.com`
- **Database Host (Supabase):** `aws-0-________.pooler.supabase.com:6543`
- **Object Storage Bucket (R2):** `itro-storage`
- **Cloudflare DNS Domain:** `https://__________________________`
