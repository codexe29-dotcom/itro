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
                    │  Render / PM2 / systemd │   serves /api and /uploads
                    └───────────┬─────────────┘
                                │  PostgreSQL wire
                                ▼
                    ┌─────────────────────────┐
                    │  PostgreSQL (managed)   │   schema: itro  (already hosted)
                    └─────────────────────────┘
```

The app has **three parts**: a static frontend, a Node/Express API, and a PostgreSQL database (already hosted remotely — not deployed by this guide).

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
| `DATABASE_URL` | yes | `postgresql://<user>:<pass>@<host>:5432/<db>?schema=itro` — **must keep `?schema=itro`**; URL-encode special chars in the password |
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
- `GET /api/health` — health check
- `GET /api/...` — application API
- `GET /uploads/...` — uploaded files (see §9)

### 5.2 Managed PaaS (Render / Railway / Azure App Service)

1. `npm run build` runs `prisma generate`, `tsc --noEmit` (typecheck), then the `esbuild`
   bundle, producing `dist/index.js`.
2. Create a **Web Service** with root directory `server`:
   - **Build command:** `npm install && npm run build`
   - **Start command:** `npm start`  (runs `node dist/index.js`)
3. Add all §4.1 environment variables in the service settings.
4. Run `npx prisma migrate deploy` once (release command / one-off job).
5. Point the health check to `/api/health`.

### 5.3 CI/CD (Jenkins)

A `Jenkinsfile` at the repo root drives build + deploy for both `server/` and `web/`.
Key points (see the file for full detail — search "ADJUST ME" for anything host-specific
you still need to confirm):

- **Parameters:** `BRANCH` or `COMMIT_ID` to pick what to build, `ENVIRONMENT` (currently
  only `production` is wired up), `BUILD_OPTION` (`frontend` / `backend` / `both` /
  `sonarqube`), and an optional SonarQube scan.
- **Backend deploy stage:** `rsync`s `server/` (excluding `node_modules`, `.env`, `uploads`)
  to the target host, then over SSH runs `npm ci`, `prisma generate`,
  `prisma migrate deploy`, `npm run build` (the esbuild bundle from §5.1), and
  `pm2 restart itro-api` (falling back to `pm2 start dist/index.js` if the process doesn't
  exist yet), followed by `pm2 save`.
- **Frontend deploy stage:** builds `web/` with the environment's `VITE_API_URL` baked in,
  then `rsync`s `web/dist/` to the target host.
- **Health check stage:** curls `${VITE_API_URL}/health` after deploy.
- Auth to both GitHub and the deploy host relies on the Jenkins agent's own SSH key being
  pre-authorized — no Jenkins credential store lookups for those. SonarQube uses a Jenkins
  secret-text credential (`sonarqube_tokan_ITRO`).

---

## 6. Frontend deployment (SPA)

### 6.1 Build

```bash
cd ITRO/rix-platform/web
npm ci
# set the API URL the app will call (baked into the bundle)
printf 'VITE_API_URL=https://api.itro.example.com/api\nVITE_PLATFORM_NAME=ITRO\n' > .env.production
npm run build      # outputs static files to web/dist/
```

Deploy the contents of **`web/dist/`** to any static host.

### 6.2 Hosting options

- **Netlify / Vercel / Cloudflare Pages:** root `rix-platform/web`, build `npm run build`, publish dir `dist`, set `VITE_API_URL` in the build env.
- **Nginx / S3+CloudFront:** upload `web/dist/` and configure an **SPA fallback** so client-side routes resolve to `index.html`.

> **SPA fallback is mandatory** — the app uses client-side routing. Without it, deep links like `/services/abc` return 404 on refresh.
> - Netlify: add `web/public/_redirects` with `/*  /index.html  200`
> - Nginx: `try_files $uri /index.html;` (see §7)

---

## 7. Single-domain option (Nginx reverse proxy)

Serve the SPA and proxy `/api` + `/uploads` to the Node service from one domain:

```nginx
server {
    listen 443 ssl;
    server_name itro.example.com;

    ssl_certificate     /etc/letsencrypt/live/itro.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/itro.example.com/privkey.pem;

    # Frontend (static SPA)
    root /var/www/itro/web/dist;
    index index.html;
    location / {
        try_files $uri /index.html;      # SPA fallback
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Uploaded files
    location /uploads/ {
        proxy_pass http://127.0.0.1:4000;
    }

    client_max_body_size 20m;   # allow report/file uploads (multer limit is 15 MB — must exceed it)
}
```

With this layout: `CORS_ORIGIN=https://itro.example.com` and `VITE_API_URL=https://itro.example.com/api`.
Issue TLS with: `sudo certbot --nginx -d itro.example.com`.

---

## 8. Database

- **Engine:** PostgreSQL. **Schema:** `itro` (all app tables live here — the database may be shared, but ITRO is isolated to this schema). The `?schema=itro` suffix on `DATABASE_URL` is required.
- **Apply schema:** `npx prisma migrate deploy` (applies committed migrations; safe to re-run).
- The `docker-compose.yml` in the repo is a **local-dev Postgres only** — it is **not** used in production.

> ⚠️ **Migration-history note (must reconcile before a fresh/prod DB rebuild):**
> Some columns were applied directly to the running database via `prisma db execute` and do **not** have matching migration files yet. The **current database already contains these columns**, so the app runs correctly against it. However, `prisma migrate deploy` against a **brand-new empty database** would not create them. Before standing up a *fresh* production database, the ITRO team will squash these into a proper migration. If you are deploying against the **existing** database, no action is needed.

---

## 9. File uploads — persistence (important)

Uploaded files (test reports, documents, service/instrument photos) are written to **`server/uploads/`** on the API host's local disk and served at `/uploads`.

- **VPS / persistent disk:** works as-is — the folder persists across restarts.
- **Ephemeral hosts (Render/Railway/containers):** the local disk is **wiped on every redeploy**, so uploaded files would be lost. **Mount a persistent volume** at `server/uploads`, or migrate uploads to object storage (S3/GCS). Confirm the chosen approach before go-live.

Also ensure the reverse proxy / platform allows request bodies up to **~10 MB** (`client_max_body_size 10m` in Nginx; JSON limit is 2 MB, file uploads are multipart).

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

- **Backend (PM2):** deploy is a git checkout + rebuild; to roll back, `git checkout <previous-tag>` → `npm ci && npm run build` → `pm2 restart itro-api`.
- **Backend (PaaS):** use the platform's "Rollback to previous deploy".
- **Frontend:** redeploy the previous `dist/` build (static hosts keep deploy history — one-click rollback).
- **Database:** migrations are additive; do not auto-rollback schema. Take a DB snapshot **before** each release for point-in-time restore.

---

*Prepared for the ITRO deployment team. For the secrets bundle and the migration reconciliation (§8), contact the ITRO engineering owner.*
