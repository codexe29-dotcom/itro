# ITRO — Deployment Guide

**Application:** ITRO — Indian Testing & Research Organisation (multi-tenant testing/research marketplace)
**Audience:** Deployment / DevOps team
**Repo:** `https://github.com/BOSTONHANA/ITRO.git` (code on branch `development`)

---

## 1. Architecture at a glance

```
                    ┌─────────────────────────┐
  Browser  ─────►   │  Frontend (static SPA)  │   React + Vite build → static files
                    │  Netlify / Nginx / CDN  │
                    └───────────┬─────────────┘
                                │  HTTPS  /api/*
                                ▼
                    ┌─────────────────────────┐
                    │  Backend API (Node)     │   Express + Prisma, port 4000
                    │  Render / PM2 / systemd │   serves /api; local mode serves /uploads
                    └───────────┬─────────────┘
                                │  PostgreSQL wire
                                ▼
                    ┌─────────────────────────┐
                    │  PostgreSQL (managed)   │   schema: itro  (already hosted)
                    └─────────────────────────┘

             Public images → S3-compatible public/ prefix → CDN
             Private order files → S3-compatible private/ prefix → short-lived signed download
```

The app has **three parts**: a static frontend, a Node/Express API, and a PostgreSQL database (already hosted remotely — not deployed by this guide).

### Local development standard ports

- Frontend (Vite): http://localhost:5000
- API (Express): http://localhost:4000
- CORS allowed origin: http://localhost:5000

---

## 2. Technology stack

| Component | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Vite 5 (build → static `dist/`), Tailwind CSS 3, TanStack Query, React Router 6, Axios |
| **Backend** | Node.js (ESM), TypeScript 5, Express 4, Prisma 5 ORM, Zod validation, JWT auth (`jsonwebtoken` + `bcryptjs`), Multer (uploads), Nodemailer (SMTP), Twilio (WhatsApp), Razorpay (payments) |
| **Database** | PostgreSQL (managed/remote), application tables isolated in the **`itro`** schema |

**Repository layout:**
```
rix-platform/
├── server/     → backend API (deploy this as a Node service)
├── web/        → frontend SPA (build → static hosting)
└── DEPLOYMENT.md
```

---

## 3. Prerequisites

- **Node.js 20 LTS** and npm (both frontend and backend)
- Network access from the API host to the PostgreSQL server (host/port opened in the DB firewall)
- Two DNS records, e.g. `itro.example.com` (frontend) and `api.itro.example.com` (backend) — or a single domain with `/api` proxied (see §7)
- TLS certificates (Let's Encrypt / platform-managed)
- The **secrets bundle** (DB URL, JWT secret, integration keys) — shared **separately and securely**, not in this document or the repo

---

## 4. Environment variables

> ⚠️ **Secrets** (`DATABASE_URL`, `JWT_SECRET`, payment/SMTP/Twilio keys) are provided **out-of-band** by the ITRO team. Never commit them to the repo or paste them into tickets. Store them in the host's secret manager / environment settings.

### 4.1 Backend — `server/.env`

| Variable | Required | Example / Notes |
|---|---|---|
| `NODE_ENV` | yes | `production` |
| `PORT` | yes | `4000` (default 4000; on PaaS read the injected `PORT`) |
| `DATABASE_URL` | yes | Supabase pooled PostgreSQL URL for API runtime traffic. Use the pooler host/port and Prisma parameters such as `pgbouncer=true&connection_limit=1`; retain `schema=itro` and URL-encode special characters in the password. |
| `DIRECT_URL` | yes | Direct PostgreSQL URL for Prisma migrations/schema operations, using the Supabase direct host/port (or session pooler if direct IPv6 is unavailable); retain `schema=itro` and URL-encode special characters in the password. Never commit either URL. |
| `JWT_SECRET` | yes | Strong random string (≥ 32 chars). **Generate a new one for prod** |
| `JWT_EXPIRES_IN` | yes | e.g. `7d` |
| `CORS_ORIGIN` | yes | Frontend origin, e.g. `https://itro.example.com`. **Comma-separate** multiple origins. Do **not** use `*` in production |
| `PUBLIC_API_URL` | yes | Public URL of the API, e.g. `https://api.itro.example.com` |
| `PLATFORM_NAME` | yes | `ITRO` |
| `PLATFORM_TAGLINE` | no | Marketing tagline |
| `PLATFORM_PRIMARY_COLOR` | no | `#0d9488` (teal) |
| `PLATFORM_DEFAULT_CURRENCY` | no | `INR` |
| `PLATFORM_DEFAULT_TAX_RATE` | no | e.g. `18` |
| `PLATFORM_TAKE_RATE` | no | Platform commission % |

> Payment (Razorpay), email (SMTP) and WhatsApp (Twilio) keys are **not** set via `.env` — they are configured at runtime in the app under **Platform → Integrations** (stored encrypted in the DB). They can be left blank until go-live.

### 4.2 Frontend — build-time env (`web/.env.production`)

> Vite **bakes these into the build** — they must be set **before** running `npm run build`. Changing them requires a rebuild.

| Variable | Required | Example |
|---|---|---|
| `VITE_API_URL` | yes | `https://api.itro.example.com/api` (include the trailing `/api`) |
| `VITE_PLATFORM_NAME` | no | `ITRO` |

---

## 5. Backend deployment (API)

### 5.1 Build & run (VPS / bare server with PM2)

```bash
# 1. Get the code
git clone https://github.com/BOSTONHANA/ITRO.git
cd ITRO/server

# 2. Install dependencies (root is an npm workspace: run `npm ci` from repo root instead
#    if you also need the web/ workspace installed)
npm ci

# 3. Create server/.env with the production values from §4.1

# 4. Build: generates the Prisma client, type-checks, and bundles src/ into dist/index.js
npm run build

# 5. Apply the database schema (see §8 for the drift caveat)
npx prisma migrate deploy

# 6. Start under a process manager. `npm start` runs `node dist/index.js`.
pm2 start npm --name itro-api -- start
pm2 save
pm2 startup     # enable on boot
```

> **Why a bundle, not raw `tsc` output?** The app is ESM (`"type": "module"`) and the
> TypeScript source uses extensionless relative imports (e.g. `from "./env"`), which is
> valid under `moduleResolution: "Bundler"` but which plain `tsc` output leaves unresolved
> at runtime — Node's ESM loader doesn't guess extensions, so `node dist/index.js` used to
> fail with `ERR_MODULE_NOT_FOUND`. `npm run build` now runs `esbuild` (see
> `server/package.json`'s `bundle` script) to inline the whole relative-import graph into a
> single `dist/index.js`, leaving only real npm packages (`express`, `@prisma/client`, …) as
> imports. `npm run typecheck` (also run as part of `build`) still catches type errors.
> Local development still uses `npm run dev` / `npm run start:dev` (both run `tsx` directly,
> no build step needed).

The API now listens on `http://127.0.0.1:$PORT` and exposes:
- `GET /api/health` — database-aware health check; returns 200 with
  `{ "status": "ok", "database": "connected" }` only when Prisma can query PostgreSQL,
  otherwise returns 503 with `{ "status": "error", "database": "disconnected", "reason": "..." }`.
- `GET /api/...` — application API
- `GET /uploads/...` — public image assets only (see §9)
- `GET /api/orders/:id/files/:filename` — authenticated, order-party-scoped order files

The API validates the format and presence of `DATABASE_URL` during boot and
logs a sanitized diagnostic. If it is missing, malformed, or PostgreSQL is
temporarily unavailable, the API still listens in degraded mode so the
database-aware health endpoint can return 503; configure/recover the database
before routing user traffic to it.

### 5.2 Managed PaaS (Render / Railway / Azure App Service)

1. `npm run build` runs `prisma generate`, `tsc --noEmit` (typecheck), then the `esbuild`
   bundle, producing `dist/index.js`.
2. Create a **Web Service** with root directory `server`:
   - **Build command:** `npm install && npm run build`
   - **Start command:** `npm start`  (runs `node dist/index.js`)
3. Add all §4.1 environment variables in the service settings.
4. Run `npx prisma migrate deploy` once (release command / one-off job).
5. Point the health check to `/api/health`. This endpoint runs a bounded Prisma
   database query (1-second connection acquisition, 2-second query transaction);
   a database outage returns HTTP 503.

### 5.3 CI/CD (Jenkins)

A `Jenkinsfile` at the repo root drives build + deploy for both `server/` and `web/`.
The pipeline uses a staging-first flow: build and test, deploy to staging, apply
staging migrations, require a database-aware staging health check, pause for
approval, then rebuild the frontend with production URLs, deploy to production,
apply production migrations, and require a production health check.

Configure these required Jenkins parameters before each run:

| Parameter | Purpose |
|---|---|
| `STAGING_DEPLOY_HOST` | Staging SSH host |
| `STAGING_SSH_USER` | SSH account on staging (defaults to `ubuntu`) |
| `STAGING_DEPLOY_PATH` | Absolute project directory on staging |
| `STAGING_PM2_APP_NAME` | Staging PM2 process name |
| `STAGING_API_URL` | Staging API base URL ending in `/api` |
| `STAGING_SITE_URL` | Staging canonical website URL |
| `BRANCH` / `COMMIT_ID` | Source revision; a commit ID takes precedence |
| `RUN_SONARQUBE` | Optional SonarQube scan and quality gate |

The pipeline fails before checkout/build if the required staging parameters are
missing or malformed. Keep staging and production databases, credentials,
storage buckets, and external-service credentials separate. The deploy hosts
must have the configured Node.js version, npm, PM2, and an existing `server/.env`;
the Jenkins agent needs Git/SSH, `rsync`, `curl`, and permission to install
Playwright Chromium. SSH keys must be authorized for GitHub and both hosts.
The host-side preflight checks required environment settings before running
Prisma migrations; both staging and production require S3-compatible storage
and a non-placeholder production-strength `JWT_SECRET`, plus explicit
`CORS_ORIGIN` and `PUBLIC_WEB_URL` values.
The pipeline does not create database snapshots. Before approving a production
promotion, the deployment owner must take and verify a restorable production
PostgreSQL snapshot and confirm the recovery point.

The build stage runs the server build and existing frontend test suite, then
builds the web app with the staging API/site URLs. There is currently no
backend test script in the workspace. On each host the pipeline rsyncs sources
and built static files, installs dependencies, builds the server, runs
`npx prisma migrate deploy`, and restarts or starts the configured PM2 process.
The health gates request `/api/health` and require HTTP 200; this endpoint also
checks database connectivity. The exact production approval prompt is
**“Promote staging build to production?”**. After approval, the frontend is
rebuilt from the same checked-out source with the production API/site URLs.

The production host/API values remain configured in the Jenkinsfile. Staging
host details are intentionally not hard-coded. Jenkins credentials, branch
protection, deployment access, environment configuration, and actual staging
and production runs must be provisioned and tested by the deployment owner;
pipeline source alone is not evidence that a release has succeeded.

---

## 6. Frontend deployment (SPA)

### 6.1 Build

```bash
cd ITRO/rix-platform/web
npm ci
# set the public API and canonical site URLs before building
printf 'VITE_API_URL=https://api.itro.example.com/api\nVITE_SITE_URL=https://itro.co.in\nVITE_PLATFORM_NAME=ITRO\n' > .env.production
npx playwright install chromium
npm run build      # outputs static files to web/dist/
```

When `VITE_API_URL` is configured, the build's `prebuild` step queries the
public API and regenerates `web/public/sitemap.xml` from active industries,
technologies, tests, packages, events, published institutions, facilities,
services, instruments, and bundles. It excludes search results, account pages,
and individual expert profiles. Sitemap generation fails the build if a
configured API cannot be reached or returns invalid data; without an API URL,
the checked-in sitemap of public landing routes is retained. Set
`VITE_SITE_URL` when building for a staging or non-production hostname; it
controls canonical URLs, social image URLs, and the sitemap/robots host. The
`postbuild` step uses the installed Playwright Chromium browser to render every
URL in that sitemap into a route-specific `index.html` file under `web/dist/`.
This makes the initial HTML contain the page title, description, canonical,
structured data, and rendered page content. Builds with the API URL set must
be able to reach it, and deployment CI must install Chromium before building.

Deploy the contents of **`web/dist/`** to any static host. The crawler files
(`robots.txt`, `sitemap.xml`, and `llms.txt`) are copied there by Vite from
`web/public/`.

### 6.3 Search crawler rollout

The static SEO files in `web/public/` include a sitemap of public routes,
crawler directives, and `llms.txt`. With `VITE_API_URL` set, the sitemap is
generated from published public API data at build time. The application sets
route-specific metadata and structured data in the browser. Keep `/search` and
`/cart` out of the sitemap and `noindex`; exclude authentication, buyer
account/order, admin, operator, and platform routes from indexing. Expert
profiles are `noindex` and excluded from the sitemap until an owner privacy
review authorizes indexing.

**Rendering limitation:** this is a client-rendered SPA. Static hosting and the
Nginx configuration return the same `index.html` shell for application routes;
route-specific titles, descriptions, canonicals, and JSON-LD are added after
JavaScript runs. Crawlers that execute JavaScript can render these updates, but
social preview bots and other non-JavaScript crawlers may not. Route-specific
pre-rendering or SSR remains necessary for reliable HTML previews and indexing
across dynamic detail pages. Verify crawler rendering in Google Search Console
and Bing Webmaster Tools before claiming full route-level crawlability.
personal/account data into generated HTML. Exclude changing prices from static
HTML unless a price-change publish hook can trigger an immediate rebuild;
otherwise prices risk going stale. Rebuild at least nightly and trigger a
rebuild after every publish/unpublish, catalog, institution, event, or price
change. Compare each route's pre-rendered HTML with its hydrated staging page
before enabling the output.

### 6.2 Hosting options

- **Netlify / Vercel / Cloudflare Pages:** root `rix-platform/web`, build `npm run build`, publish dir `dist`, set `VITE_API_URL` in the build env.
- **Nginx / S3+CloudFront:** upload `web/dist/`; for Nginx, include
  `deployment/nginx/itro-static-routes.conf` inside the site `server` block.
  Configure an SPA fallback only for declared app routes, and return 404 for
  unknown paths.

> **Known-route fallback is required** — the app uses path-based client-side routing. Configure the fallback only for routes declared by the React Router; unknown paths should return 404. See `deployment/nginx/itro-static-routes.conf`.
> A blanket `/* /index.html 200` Netlify redirect also returns the app shell for
> unknown paths; configure host-specific known-route rewrites if real HTTP 404s
> are required.

---

## 7. Single-domain option (Nginx reverse proxy)

Serve the SPA and proxy `/api` to the Node service from one domain. In local
storage mode, proxy `/uploads` to the API as well; in S3 mode, uploaded image
URLs point directly at the configured public media URL.

```nginx
server {
    listen 443 ssl;
    server_name itro.example.com;

    ssl_certificate     /etc/letsencrypt/live/itro.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/itro.example.com/privkey.pem;

    # Frontend (static SPA)
    root /var/www/itro/web/dist;
    index index.html;
    include /etc/nginx/snippets/itro-static-routes.conf;

    client_max_body_size 20m;   # allow report/file uploads (multer limit is 15 MB — must exceed it)
}
```

With this layout: `CORS_ORIGIN=https://itro.example.com` and `VITE_API_URL=https://itro.example.com/api`.
Issue TLS with: `sudo certbot --nginx -d itro.example.com`.

### 7.1 Safe Nginx deployment, verification, and rollback

1. Back up the current static release directory and active Nginx site
   configuration before copying files or changing the include.
2. Copy the new `web/dist/` files and Nginx include into a versioned release.
   Keep the previous release and config backup available until checks pass.
3. Validate the candidate configuration with **`sudo nginx -t` before reload**.
   If validation fails, do not reload.
4. Reload only after validation succeeds: `sudo systemctl reload nginx`.
5. Run these checks against the deployed origin (replace `https://itro.co.in`
   if verifying another approved host):

   ```sh
   curl -i https://itro.co.in/robots.txt
   curl -i https://itro.co.in/sitemap.xml
   curl -i https://itro.co.in/llms.txt
   curl -i https://itro.co.in/this-route-must-not-exist-92841
   ```

   The first three should return `200` with `text/plain`, `application/xml`,
   and `text/plain` respectively. The made-up URL should return HTTP `404`.
   Also smoke-test `/`, `/login`, `/register`, `/cart`, `/app`, `/admin`,
   `/operator`, `/platform`, `/assets/<known-built-asset>`, `/favicon.svg`,
   `/api/health`, and a known `/uploads/<file>` to confirm that the SPA, static,
   and backend routes still reach their intended handlers.
6. If any check fails, restore the previous static release and Nginx config
   from backup, run **`sudo nginx -t` before reload**, then reload with
   `sudo systemctl reload nginx`. Repeat the curl checks after rollback.

### 7.2 Route-pattern coverage

The Nginx include is based on the React Router paths in `web/src/App.tsx`.
When adding or changing a frontend route, update
`deployment/nginx/itro-static-routes.conf` and its route-pattern coverage table
in this guide. A follow-up improvement is to generate the Nginx route allowlist
from the React Router route configuration during the web build, then validate
the generated regex against every declared route and representative unknown
paths. Until that generator is implemented and tested, the checked-in Nginx
include remains manually maintained.
Query strings are not part of Nginx's `$uri` path match. The following sample
paths were checked against the configured patterns; route-shaped dynamic
examples verify dispatch shape, not that the referenced database record exists.

| Route pattern | Example path checked |
|---|---|
| `/` | `/` |
| `/exchange` | `/exchange?tab=bundles` |
| `/search` | `/search?q=tensile` |
| `/industries/:slug` | `/industries/aerospace-defense` |
| `/technologies/:slug` | `/technologies/precision-machining` |
| `/packages` | `/packages` |
| `/packages/:slug` | `/packages/sample-package` |
| `/tests/:slug` | `/tests/tensile-test` |
| `/bundles/:slug` | `/bundles/sample-bundle` |
| `/providers` | `/providers` |
| `/experts` | `/experts` |
| `/experts/:id` | `/experts/expert-123` |
| `/services/:id` | `/services/service-123` |
| `/equipment` | `/equipment` |
| `/instruments/:id` | `/instruments/instrument-123` |
| `/institutions/:slug` | `/institutions/sample-lab` |
| `/facilities/:id` | `/facilities/facility-123` |
| `/events` | `/events` |
| `/events/:slug` | `/events/sample-event` |
| `/cart` (cart and checkout UI) | `/cart` |
| `/login` | `/login` |
| `/register` | `/register` |
| `/register-provider` | `/register-provider` |
| `/forgot-password` | `/forgot-password` |
| `/reset-password` | `/reset-password` |
| `/app` | `/app` |
| `/app/exchange` | `/app/exchange` |
| `/app/cart` | `/app/cart` |
| `/app/orders` | `/app/orders` |
| `/app/orders/:id` | `/app/orders/order-123` |
| `/app/request/:serviceId` | `/app/request/service-123` |
| `/app/invoices` | `/app/invoices` |
| `/admin` | `/admin` |
| `/admin/analytics` | `/admin/analytics` |
| `/admin/orders` | `/admin/orders` |
| `/admin/orders/:id` | `/admin/orders/order-123` |
| `/admin/bookings` | `/admin/bookings` |
| `/admin/queue` | `/admin/queue` |
| `/admin/facilities` | `/admin/facilities` |
| `/admin/instruments` | `/admin/instruments` |
| `/admin/instruments/:id` | `/admin/instruments/instrument-123` |
| `/admin/services` | `/admin/services` |
| `/admin/services/:id` | `/admin/services/service-123` |
| `/admin/experts` | `/admin/experts` |
| `/admin/catalog` | `/admin/catalog` |
| `/admin/bundles` | `/admin/bundles` |
| `/admin/events` | `/admin/events` |
| `/admin/discounts` | `/admin/discounts` |
| `/admin/invoices` | `/admin/invoices` |
| `/admin/users` | `/admin/users` |
| `/admin/settings` | `/admin/settings` |
| `/operator` (provider/operator portal) | `/operator` |
| `/platform` | `/platform` |
| `/platform/providers` | `/platform/providers` |
| `/platform/providers/:id` | `/platform/providers/provider-123` |
| `/platform/buyers` | `/platform/buyers` |
| `/platform/buyers/:id` | `/platform/buyers/buyer-123` |
| `/platform/orders` | `/platform/orders` |
| `/platform/orders/:id` | `/platform/orders/order-123` |
| `/platform/institutions` (redirect) | `/platform/institutions` |
| `/platform/settlements` | `/platform/settlements` |
| `/platform/catalog` | `/platform/catalog` |
| `/platform/catalog/tests/:id` | `/platform/catalog/tests/test-123` |
| `/platform/catalog/packages/:id` | `/platform/catalog/packages/package-123` |
| `/platform/fee-config` | `/platform/fee-config` |
| `/platform/discounts` | `/platform/discounts` |
| `/platform/integrations` | `/platform/integrations` |
| `/assets/*` | `/assets/index-CYfecGEE.js` and `/assets/index-bF4vSuWd.css` |
| Root-level images | `/hero-1-tejas.jpg` |
| Favicon | `/favicon.svg` |
| Manifest file pattern (only if a manifest is deployed) | `/manifest.webmanifest` |
| API proxy exact path and prefix | `/api` and `/api/health` |
| Uploaded image/file proxy | `/uploads/sample.png` |
| Unknown path (must not reach SPA) | `/this-route-must-not-exist-92841` |

The cart implements checkout as an action on `/cart`; there is no separate
`/checkout` React route. The current repository also has no manifest file or
manifest link in `web/index.html`; the static-file rule serves a deployed
manifest if one exists and returns 404 if it does not. Do not treat either
nonexistent path as an active app route.

For route naming: signup is `/register` (provider registration is
`/register-provider`), the buyer account area starts at `/app`, and the
provider/operator portal is `/operator`. Institution administration is under
`/admin`, while platform administration is under `/platform`.

---

## 8. Database

- **Engine:** PostgreSQL. **Schema:** `itro` (all app tables live here — the database may be shared, but ITRO is isolated to this schema). The `?schema=itro` suffix on `DATABASE_URL` is required.
- Set `DATABASE_URL` to the Supabase pooled connection for API runtime requests and `DIRECT_URL` to the direct/session connection for Prisma Migrate. The datasource uses `DIRECT_URL` for migration operations. Configure both in the deployment secret manager using the exact values from Supabase Connect; do not copy credentials into tracked files or chat. A safe placeholder template is in `server/.env.supabase.example`.
- **Apply schema:** `npx prisma migrate deploy` (applies committed migrations; safe to re-run).
- The `docker-compose.yml` in the repo is a **local-dev Postgres only** — it is **not** used in production.

### 8.1 Migration reconciliation status

The committed history had 19 migrations, newest
`20261103200000_auth_hardening`. A source-level comparison against Prisma's
generated PostgreSQL DDL found seven missing models, 47 missing columns, 13
indexes, and 14 foreign keys. These are now covered by the forward-only
`20261106133000_schema_reconciliation` migration. The comparison checked all
45 model tables, column definitions/defaults, index definitions, foreign-key
definitions, and enum values against the concatenated committed migration SQL;
no source-level gaps remain.

Do not edit or squash previously deployed migrations. The static comparison
validates the committed chain, not a live database. Production may already
contain some or all of these objects from manual SQL, so follow §8.4 before
applying the new migration to any existing database.

### 8.2 Validate the reconciliation migration

```sh
cd server
npx prisma validate
npx prisma generate
```

Do not use `prisma db push` or rewrite deployed migration files to resolve this
drift.

### 8.3 Test on a fresh local PostgreSQL database

Use Docker Desktop with a disposable PostgreSQL instance and a separate empty
application schema. These PowerShell commands create a dedicated local test
container on port 5434; they do not touch the shared dev database or production.
Run them from the repository root:

```powershell
docker run --name itro-migration-test `
  -e POSTGRES_USER=itro `
  -e POSTGRES_PASSWORD=local-only `
  -e POSTGRES_DB=itro_migration_test `
  -p 5434:5432 `
  -d postgres:16-alpine

docker exec itro-migration-test pg_isready -U itro -d itro_migration_test
docker exec itro-migration-test psql -U itro -d itro_migration_test -c "CREATE SCHEMA itro;"

$env:DATABASE_URL = "postgresql://itro:local-only@localhost:5434/itro_migration_test?schema=itro"
$env:DIRECT_URL = $env:DATABASE_URL
Set-Location server
npx prisma migrate deploy
npx prisma migrate status
npx prisma migrate diff --from-url $env:DIRECT_URL --to-schema-datamodel .\prisma\schema.prisma --exit-code
```

All migrations must report applied, and the final diff must be empty (exit code
0). The migration status should include
`20261106133000_schema_reconciliation`. To independently compare the complete
committed migration chain with the Prisma datamodel, create a second empty
database for Prisma's shadow replay and run:

```powershell
docker exec itro-migration-test psql -U itro -d postgres -c "CREATE DATABASE itro_migration_shadow;"
$env:SHADOW_DATABASE_URL = "postgresql://itro:local-only@localhost:5434/itro_migration_shadow?schema=itro"
npx prisma migrate diff `
  --from-migrations .\prisma\migrations `
  --to-schema-datamodel .\prisma\schema.prisma `
  --shadow-database-url $env:SHADOW_DATABASE_URL `
  --exit-code
```

Exit code 0 means no migration-history-to-schema diff. The direct URL
`--from-url` diff separately confirms the applied fresh database matches the
schema. Keep the two checks: the former verifies migration replay; the latter
verifies deployment output. Run `npm --workspace server run build` and the
application smoke tests after the schema checks. Do not use these disposable
credentials outside local testing.

To clean up only the named test container after all checks:

```powershell
docker rm -f itro-migration-test
```

### 8.4 Clean staging provisioning and validation

Repeat the fresh-database checks on an empty staging database running the same
PostgreSQL major version and with the same required extensions/permissions as
production. Store credentials in the staging secret manager, not in tracked
files or chat. Also verify the backend build and critical read/write workflows.

### 8.5 Existing production database

First take and verify a restorable database backup, then inspect migration
status and compare the existing database to the Prisma schema on a protected
production clone or approved read-only connection:

```sh
npx prisma migrate status
npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel ./prisma/schema.prisma \
  --script
```

If the database already contains every change in the new migration, **do not
run `migrate deploy` yet**: it would try to create objects that may already
exist. After confirming the candidate migration exactly matches those already
present changes, and after practicing on a clone, mark only that migration as
applied with `npx prisma migrate resolve --applied <migration_directory_name>`.
If any expected schema change is absent, apply the migration normally to a
production clone first and verify it there. Resolve partial or conflicting
drift with a reviewed repair migration and DBA approval; do not stamp a
partially applied migration as complete. Never run `migrate reset` against
production.

---

## 9. File uploads — persistence (important)

Uploads are handled by the shared `server/src/lib/storage.ts` abstraction. Use
`STORAGE_DRIVER=local` for offline development; local public files are stored in
`server/public-uploads/`, and private order files in `server/uploads/`. Set
`STORAGE_LOCAL_ROOT` to move both directories under a persistent development
volume. Local storage is rejected in production.

Production uses one S3-compatible bucket with isolated object-key prefixes:

- `public/` — provider logos, facility banners, event images, and other public
  raster media. The API returns a public CDN/bucket URL. Only this prefix should
  be readable without authentication.
- `private/` — order supporting documents, NDAs, reports, RFQ attachments, and
  buyer intake uploads. Do not enable public access for this prefix.

`GET /api/orders/:id/files/:filename` authenticates the requester, verifies
buyer/provider-institution/platform access, and checks the file is referenced by
that order. With S3 storage it redirects to a five-minute presigned download
URL; with local storage it streams the file through the same authorization
check. Pre-checkout intake files are stored under a buyer-specific private key
and checkout accepts only the current buyer's staged object. Private files are
never mounted as static files.

The public image upload accepts JPEG, PNG, GIF, WebP, and AVIF. Private document
uploads accept images, PDF, Word, Excel, text, and common CAD formats (`DWG`,
`DXF`, `STEP/STP`, `IGES/IGS`, `STL`, `3MF`, `OBJ`, `GLTF`, and `GLB`); each
multipart upload is limited to 15 MB. Keep the reverse proxy limit above that
(for example `client_max_body_size 20m` in Nginx).

### 9.0.1 Configure AWS S3

1. Create a bucket in the target region with **Block Public Access enabled**.
   The application key writes objects under `public/` and `private/`; do not
   configure a bucket-wide public ACL.
2. Create an application IAM principal with least-privilege
   `s3:PutObject` for `private/*` and `public/*`, and `s3:GetObject` for
   `private/*` (including `HeadObject`). Keep bucket-level Block Public Access
   enabled and give a CDN origin identity read access to `public/*`. If direct
   anonymous S3 URLs are chosen instead, review the public-access-block settings
   and scope the bucket policy strictly to `public/*`. Never grant anonymous
   access to `private/*`.
3. Configure the API's production environment:

   ```dotenv
   NODE_ENV=production
   STORAGE_DRIVER=s3
   S3_BUCKET_NAME=your-bucket-name
   S3_REGION=ap-south-1
   S3_ACCESS_KEY_ID=<application-access-key-id>
   S3_SECRET_ACCESS_KEY=<application-secret-access-key>
   # Optional when using a CDN/custom public domain; otherwise AWS S3 URL is used.
   STORAGE_PUBLIC_BASE_URL=https://media.example.com
   ```

4. Store credentials in the deployment platform's secret manager, not in source
   control, images, logs, or the frontend environment. Use a distinct IAM
   principal per environment, enable encryption at rest, and configure
   lifecycle/versioning/backup policies to match document-retention needs.
5. Upload a test image and a test order attachment in staging. Confirm the image
   URL is publicly readable, the private object is not anonymously readable,
   an authorized order party receives a short-lived redirect, and an unrelated
   user is denied before any signed URL is issued.

### 9.0.2 Configure Cloudflare R2

1. Create an R2 bucket and an R2 API token restricted to that bucket, with
   object read/write access. Create a public custom domain for public media (or
   use an approved R2 public bucket URL); do not expose the private prefix.
2. Configure the S3-compatible R2 endpoint and credentials in the API's secret
   environment:

   ```dotenv
   NODE_ENV=production
   STORAGE_DRIVER=s3
   S3_BUCKET_NAME=your-r2-bucket
   S3_REGION=auto
   S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   S3_ACCESS_KEY_ID=<r2-access-key-id>
   S3_SECRET_ACCESS_KEY=<r2-secret-access-key>
   STORAGE_PUBLIC_BASE_URL=https://media.example.com
   ```

   `STORAGE_PUBLIC_BASE_URL` is required with a custom S3 endpoint. It must map
   the bucket root; the application appends `/public/<object-key>`.
3. Keep private-object access restricted. Presigned URLs are issued by the API
   only after order membership authorization and expire after five minutes.
   Configure CDN caching only for the public custom domain/prefix.
4. Apply the same staging verification and credentials-separation practices as
   for AWS.

### 9.0.3 Moving existing local files

Before switching an existing deployment to S3, copy existing public files to
the S3 bucket's `public/` prefix and private files to `private/`, preserving
their relative keys. Copy both `server/public-uploads/` and `server/uploads/`
(including buyer-specific `pending/` subdirectories), then verify representative
stored database URLs resolve to the copied public URLs or private object keys.
Keep a protected backup until all references and order downloads have been
verified. Do not copy private documents into a public prefix.

For AWS, from the repository root, the initial copy can use:

```sh
aws s3 sync server/public-uploads/ s3://your-bucket-name/public/
aws s3 sync server/uploads/ s3://your-bucket-name/private/ --sse AES256
```

For R2, add `--endpoint-url https://<account-id>.r2.cloudflarestorage.com` to
each `aws s3 sync` command. Run the copy from a trusted host and keep the
private source and destination inaccessible to public users.

### 9.1 Upload privacy and access control

Private files use generated random filenames and are stored under a private
object prefix. The original display name is retained separately for order
documents. Order document, report, and file-answer URLs are rewritten to the
authenticated order-download endpoint when order details are returned.
Pre-checkout intake files are staged under a buyer-specific private key and
cannot be associated with an order by another buyer. In S3 mode, the API issues
a five-minute signed URL only after checking order membership and file
references; in local mode, it streams the same object only after those checks.
`public-uploads/` and `public/` must contain only intentionally public media.
`robots.txt` is not an access-control mechanism.

### 9.2 Local Nginx checks on Windows with Docker

The following is a local-only smoke test. It uses
`deployment/nginx/local-test.conf` as a minimal Nginx server wrapper and mounts
the same `itro-static-routes.conf` include used by deployment. Run from the
repository root in PowerShell, with Docker Desktop's Linux container engine
running:

```powershell
npm --workspace web run build
$testDir = Join-Path $env:TEMP "itro-nginx-test"
New-Item -ItemType Directory -Force (Join-Path $testDir "conf.d") | Out-Null
Copy-Item web\dist (Join-Path $testDir "dist") -Recurse -Force

# The deployed include targets a backend beside Nginx at 127.0.0.1:4000.
# In a Docker container, host.docker.internal reaches a backend running on Windows.
$snippet = Get-Content deployment\nginx\itro-static-routes.conf -Raw
$snippet = $snippet.Replace("http://127.0.0.1:4000", "http://host.docker.internal:4000")
Set-Content (Join-Path $testDir "conf.d\itro-static-routes.conf") $snippet -Encoding ascii
Copy-Item deployment\nginx\local-test.conf (Join-Path $testDir "nginx.conf")

$dockerPath = $testDir.Replace("\", "/")
docker run --detach --rm --name itro-nginx-test --publish 8088:8080 `
  --mount "type=bind,source=$dockerPath/nginx.conf,target=/etc/nginx/nginx.conf,readonly" `
  --mount "type=bind,source=$dockerPath/conf.d/itro-static-routes.conf,target=/etc/nginx/conf.d/itro-static-routes.conf,readonly" `
  --mount "type=bind,source=$dockerPath/dist,target=/usr/share/nginx/html,readonly" `
  nginx:alpine

docker exec itro-nginx-test nginx -t
curl.exe -sS -o NUL -w "%{http_code} %{content_type}`n" http://localhost:8088/robots.txt
curl.exe -sS -o NUL -w "%{http_code} %{content_type}`n" http://localhost:8088/sitemap.xml
curl.exe -sS -o NUL -w "%{http_code} %{content_type}`n" http://localhost:8088/llms.txt
curl.exe -sS -o NUL -w "%{http_code} %{content_type}`n" http://localhost:8088/this-route-must-not-exist-92841
curl.exe -sS -o NUL -w "%{http_code} %{content_type}`n" http://localhost:8088/search
docker stop itro-nginx-test
```

Expect `200 text/plain` for robots and llms, `200 application/xml` for the
sitemap, `404` for the made-up URL, and an `X-Robots-Tag: noindex, nofollow`
header for `/search` (inspect headers with `curl.exe -sSI
http://localhost:8088/search`). If the backend is also running on Windows at
port 4000, the proxy paths can be smoke-tested with
`curl.exe -i http://localhost:8088/api/health` and a known
`/uploads/<file>`. The test copy changes only the upstream hostname so the
container can reach Windows; it does not modify the checked-in deployment
include. Stop the container if a command fails:
`docker stop itro-nginx-test`.

---

## 10. Post-deployment checklist

- [ ] `GET https://api.../api/health` returns **200**
- [ ] Frontend loads and a deep link (e.g. `/exchange`) works on **hard refresh** (SPA fallback OK)
- [ ] Login works (JWT issued; no CORS errors in the browser console)
- [ ] `CORS_ORIGIN` matches the exact frontend origin (scheme + host, no trailing slash)
- [ ] Create/edit a record (e.g. an instrument) and confirm it persists (DB connectivity OK)
- [ ] Upload a file (order report or service photo) and re-open it after a redeploy (persistence OK — §9)
- [ ] HTTPS valid on both domains; HTTP redirects to HTTPS
- [ ] `NODE_ENV=production`, a **fresh** `JWT_SECRET`, and no dev secrets in prod

---

## 11. Security notes

- Set a **new, strong `JWT_SECRET`** for production — do not reuse the dev value.
- Lock `CORS_ORIGIN` to the real frontend domain(s); never `*`.
- Keep `.env` out of the repo (it is git-ignored). Store secrets in the host secret manager.
- Payment/SMTP/WhatsApp keys are entered in **Platform → Integrations** (encrypted at rest) — share them only with authorised admins.
- Restrict PostgreSQL network access to the API host's IP; rotate the DB password if it has been exposed.

---

## 12. Rollback

### 12.1 Failed deployment or health check

1. Stop promotion and retain the Jenkins console log, checked-out commit ID,
   migration output, and health-check response. Do not rerun repeatedly against
   an unknown database state.
2. If the failure is before migration, correct the configuration/build issue
   and redeploy the same commit after confirming the deployed files and `.env`.
3. If migration or startup failed, follow §12.2 before restarting the app.
4. If the API health gate fails after restart, inspect `pm2 status`, `pm2 logs
   <app-name> --lines 200`, the host service logs, and database connectivity.
   Roll back the application to a known-good commit only if its code is
   compatible with the current schema. Keep production traffic in maintenance
   mode if the API is unhealthy.
5. Re-run the health check and critical user flows after recovery. Record the
   incident, schema state, and final deployed commit.

### 12.2 Failed Prisma migration

Prisma migrations are forward-only; do not edit an already-deployed migration
or use `migrate reset` on staging/production.

1. Pause the deployment and take a fresh database snapshot before making any
   repair attempt. Record the target database and migration name.
2. Inspect `npx prisma migrate status`, the failed entry in
   `server/prisma/migrations/`, the `_prisma_migrations` record, and PostgreSQL
   logs. Determine which DDL statements completed; do not assume the migration
   was wholly applied or wholly rolled back.
3. If the migration is partially applied, restore a clone from the snapshot and
   rehearse recovery there. Have the DBA prepare and review a precise repair
   plan. Only use `npx prisma migrate resolve --rolled-back <migration_name>`
   after the failed migration's partial effects have been safely undone and
   verified; then deploy a corrected forward migration. If all intended changes
   are already present, verify every object against the migration before
   considering `--applied`. Never mark a partial migration applied.
4. Run `npx prisma migrate deploy`, `npx prisma migrate status`, and the
   schema-diff procedure in §8 against the recovered clone. Resume staging
   verification before attempting production again.

### 12.3 PostgreSQL snapshot/PITR restore

Restoring a database can discard writes made after the backup and can make the
current application incompatible with the restored schema. Treat it as a
coordinated outage, not an automatic migration rollback.

1. Obtain incident-owner/DBA approval, pause writes or place the app in
   maintenance mode, and record the recovery point and expected data loss.
2. Restore the selected PostgreSQL snapshot/PITR point to a **new database**
   where the provider supports it. Verify the restored database, schema, and
   data before changing application connections. Preserve the failed database
   until recovery is confirmed.
3. Point the API's `DATABASE_URL` and `DIRECT_URL` at the restored database
   using the approved secret manager. Verify that migration status and the
   application schema are compatible with the application version to be
   deployed.
4. Restart the API, check `/api/health`, and run critical read/write workflows.
   Reconcile or recover post-snapshot business data under DBA guidance before
   reopening traffic.
5. Keep the original database and recovery logs until the incident is closed.
   Do not restore production data into staging or expose database credentials
   in Jenkins logs.

### 12.4 Application and static frontend rollback

The current deployment is rsync-to-host plus a PM2 restart; it is not an
immutable release-directory or container deployment. Record the last known-good
commit ID for each promotion. To roll back application code, start a new
controlled Jenkins run for that commit, verify it in staging, and use the same
production approval gate. If immediate recovery is necessary, an operator may
redeploy the known-good server build and matching `web/dist/` artifact archived
by the successful Jenkins run, then restart the configured PM2 process and
verify `/api/health`. The archive contains the built server bundle, migrations,
frontend output, and package manifests. Keep the frontend artifact paired with
its matching production API/site URLs.

For an approved emergency artifact restore, download and extract that
successful Jenkins build to a temporary directory, then copy its `server/dist/`
and `web/dist/` into the corresponding deployment directories without
overwriting `.env`, uploads, or other persistent data. Restore the matching root
and workspace package manifests/lockfile and run `npm ci` from the deployment
root so the bundled server's external dependencies match. Restart the API with
`pm2 restart itro-api --update-env`, confirm the static web server serves the
restored files, and check `https://itro.co.in/api/health`.
Do not run migrations as part of an application-only rollback.

Do not roll application code backward across a schema change unless that
version is compatible with the current database. Prefer a forward fix for
additive migrations. Restore the database only when required and only with the
coordinated procedure in §12.3. Backend PaaS deployments may use the platform's
previous-deploy action if applicable.

### 12.5 Container image rollback (future deployment model only)

The current Jenkins pipeline does not deploy containers. If a future deployment
uses immutable container images, record the digest deployed to each environment.
For rollback, redeploy the prior approved digest (never a mutable `latest` tag),
verify its environment configuration and schema compatibility, and repeat the
health and critical-flow checks. A container rollback does not roll back Prisma
migrations or database data; use §12.2–12.3 for database recovery.

---

*Prepared for the ITRO deployment team. For the secrets bundle and the migration reconciliation (§8), contact the ITRO engineering owner.*
