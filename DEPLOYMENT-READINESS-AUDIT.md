# ITRO Site and Production-Readiness Audit

**Assessment date:** 2026-11-06  
**Scope:** Repository source, local configuration, production build, frontend tests, dependency audit, database schema/migrations, deployment configuration, and SEO/AIO/AEO/GEO implementation.  
**Overall verdict:** **NO-GO for production release based on evidence available in this workspace.** The application compiles and the public SEO build pipeline is verified, but a production database-backed runtime, migration safety, deployment, and external service configuration were not verified. This is a source-and-local-build audit; it is not a live production penetration test or a claim that the hosted site is down.

## Executive status

| Area | Status | Evidence / limitation |
|---|---|---|
| Product and user journeys | **Implemented in source; live behavior unverified** | Public exchange, buyer, provider/admin, operator, and platform surfaces and corresponding API modules exist. |
| Frontend production build | **Pass, with warnings** | TypeScript/Vite build completed. Route splitting reduced the main JavaScript entry to 52.02 kB (15.04 kB gzip); no chunk exceeds the configured 600 kB warning threshold. Zod dependency annotation warnings remain. |
| Backend production build | **Pass** | Prisma client generation, TypeScript typecheck, and esbuild bundle completed. |
| Frontend automated tests | **Pass, very limited** | One Vitest file; 2 SEO artifact tests passed. No backend test files were found in the source tree. |
| Dependency audit | **Pass** | Both `npm audit` and `npm audit --omit=dev` report zero vulnerabilities at audit time. |
| Prisma schema | **Pass syntax/validation only** | `prisma validate` succeeds using placeholder connection strings; this does not connect to or inspect a database. |
| Local app startup | **Degraded mode verified** | Without a database URL, the API logs a diagnostic, starts, and returns HTTP 503 from `/api/health`. With an unreachable PostgreSQL URL it also starts and reports a sanitized connectivity reason. |
| Database availability/data | **Unknown / not connected** | No local database listener or runtime database credentials were available. Production database state and records were not inspected. |
| Database migration readiness | **Source reconciliation complete; live migration unverified** | A new forward-only migration adds the previously missing seven models, 47 columns, 13 indexes, and 14 foreign keys. Static comparison found no remaining schema/migration object or definition gaps. Fresh PostgreSQL migration and production drift checks could not run because Docker/PostgreSQL was unavailable. |
| Public SEO rendering | **Build-time generation verified** | Release build fetched 399 public URLs, regenerated the sitemap, and prerendered 399 route HTML files. Sampled homepage and industry HTML contain route-specific title, description, canonical, Open Graph, and managed WebPage JSON-LD. |
| Payment, email, WhatsApp | **Code exists; configuration/transactions unverified** | Razorpay, SMTP, and Twilio implementations are present. Their runtime settings are stored in the database, which was unavailable. |
| Deployment pipeline | **Staging-first flow implemented; execution not verified** | Jenkins now validates required staging parameters, builds/tests, deploys to staging, runs migrations and `/api/health`, pauses for production approval, rebuilds with production URLs, deploys, and checks production health. No Jenkins execution, credential/host validation, database backup/restore, or live deployment was available. |
| Production deployment | **Not verified** | No staging or production deployment, TLS/DNS check, live database health check, backup restore, or end-to-end business transaction was tested. |

## Product and core business idea

ITRO is a multi-tenant marketplace and operating platform for research and testing institutions. Institutions publish laboratory capabilities; industry buyers discover providers, request quotes or place orders, submit samples, receive reports, and pay. The platform also supports internal instrument bookings and institution operations.

### Core audiences and surfaces

- **Public visitors / buyers:** discover tests, services, packages, providers, facilities, equipment, experts, events, and industry/technology capabilities.
- **Industry buyers:** browse, maintain a cart, submit quotes/orders, exchange documents/messages with providers, view invoices, and make payments.
- **Institution administrators and lab managers:** manage institution catalog, facilities, instruments, services, staff, bookings, orders, invoices, and events.
- **Operators:** work from the operational queue for instrument bookings and testing orders.
- **Platform administrators:** manage providers/buyers, catalog, orders, discounts, integrations, fees, and settlements.

### Main business services represented in source

1. **Research/testing discovery and provider marketplace** — tests, service catalog, institution profiles, industry/technology pages, equipment, and experts.
2. **Quote-to-order workflow** — RFQ, provider quote, buyer acceptance, NDA/sample stages, work in progress, report delivery, completion, and review.
3. **Cart and multi-provider checkout** — service lines, sample requirements/intake files, pricing, discounts/credits, and order allocation.
4. **Laboratory and asset operations** — facilities, instruments, availability/capacity scheduling, bookings, and operator queues.
5. **Commercial operations** — invoices, tax/pricing, Razorpay payment handling, platform fees, and provider settlements.
6. **Supporting capabilities** — user/role administration, accreditation records, events/registrations, analytics, uploads, and email/WhatsApp notifications.

These are capabilities observed in source and API route modules, not confirmation that each workflow has passed production acceptance tests.

## Frontend status

### Working / verified

- React/TypeScript frontend compiles successfully through `tsc -b` and Vite.
- Public, buyer, admin, operator, and platform routes are defined in `web/src/App.tsx`.
- API client uses the configured `VITE_API_URL` and credentialed requests.
- Public pages include route-specific metadata hooks, canonical URLs, social tags, breadcrumbs, and selected structured data.
- Crawler resources exist: `web/public/robots.txt`, `web/public/sitemap.xml`, and `web/public/llms.txt`.
- Two automated tests validate sitemap uniqueness/public URL scope and crawler exclusions.
- Route-level lazy loading and vendor splitting reduced the main JavaScript chunk from **1,703.22 kB** to **52.02 kB** in the latest Vite build. The largest vendor chunk is charts at **332.21 kB**, under the 600 kB warning threshold.

### Not working or not proven

- The frontend can build, but it could not be verified against a running API/database in this workspace.
- The frontend test suite is only two tests; it does not exercise authentication, cart/checkout, orders, accessibility, browser compatibility, or provider/admin flows.
- The main bundle reduction moves code into route/vendor chunks; verify field performance and route-navigation loading on production-like networks.
- The remaining Vite build notices are dependency annotation warnings from Zod. The `web/src/lib/api.ts` mixed static/dynamic import warning is resolved by using static imports only.
- `README.md` documents Vite on port 5173, while `web/vite.config.ts` binds to port 5000. The root `.env.example` also sets a 5173 CORS origin. Reconcile local setup instructions and examples.

## Backend and core-service status

### Working / verified

- Express API source has modules for authentication, configuration, institutions, facilities, instruments, services, experts, exchange/search, carts, orders, bookings, events, invoices, payments, analytics, platform administration, settlements, discounts, bundles, and uploads.
- Backend build and TypeScript typecheck pass.
- The health endpoint performs a bounded database query and returns HTTP 503 with a sanitized diagnostic when the database is disconnected.
- Source includes JWT/password authentication, role checks, request validation, order lifecycle handling, upload handling, and payment signature verification.
- Uploads use an S3-compatible/local storage abstraction with separate public and private prefixes. Local private streaming and five-minute S3-compatible presigned URL generation passed focused checks; production order access is authorized before signing.

### Not working or not proven

- API health behavior was verified in degraded mode, but login, data reads/writes, and business workflows still require a configured PostgreSQL database.
- No backend automated test suite was found. Typechecking and bundling do not test authorization boundaries, tenant isolation, transaction consistency, or payment behavior.
- Razorpay, SMTP, and Twilio require valid runtime configuration. The code indicates integration settings are database-backed, so enabled/disabled state cannot be determined without database access.
- The external payment provider, notification delivery, webhook/settlement behavior, and failure/retry handling were not exercised against staging credentials.
- Production S3/R2 bucket policy, credentials, existing-file migration, and database-backed authorization/upload/download flows remain unverified; complete staging tests before release.

## Database status and blockers

### What is known

- PostgreSQL is the configured database engine; Prisma schema validation passes.
- The repository now contains 20 migration directories, including `20261106133000_schema_reconciliation`.
- `DATABASE_URL` and `DIRECT_URL` are absent from this environment; no local PostgreSQL listener or running Docker daemon was available. No live database query, row count, backup check, migration deployment, or database-to-schema diff was possible.
- A Prisma-generated DDL comparison found and reconciled seven missing models, 47 missing columns, 13 indexes, and 14 foreign keys. Static comparison of the migration history against the current Prisma schema reports zero missing or mismatched tables, column definitions/defaults, indexes, constraints, or enum values. Actual fresh-database migration remains **unverified** until PostgreSQL replay and `migrate diff` pass.

### Required before production

1. Provision/confirm the intended PostgreSQL instance and securely supply runtime `DATABASE_URL` and migration `DIRECT_URL`. Never commit credentials.
2. Apply the migration chain, including `20261106133000_schema_reconciliation`, to an empty local/staging database using the procedure in `DEPLOYMENT.md` §8.3–8.4; require an empty final schema diff.
3. Compare the result with a protected clone of production. The production database may contain manual DDL, so verify its migration history and schema before applying or resolving the reconciliation migration.
4. Verify backup/restore, connection pooling, network allowlists, TLS, retention, capacity, alerting, and recovery procedures.
5. Run representative read/write flows and the API's database-aware health check against staging before authorizing a release.

## SEO, AIO, AEO, and GEO implementation

Here, **AIO/AEO/GEO** mean AI optimization, answer engine optimization, and generative engine optimization—not geospatial search. Presence of files or markup does not prove indexing, citations, rich results, traffic, or ranking.

| Area | Current implementation | Assessment / remaining work |
|---|---|---|
| **Technical SEO** | `robots.txt`, sitemap, canonical URLs, title/description, Open Graph/Twitter tags, and `Organization`/`WebSite` JSON-LD exist. Route pages call `useSeo`; the crawler rules exclude account/admin areas. | **Build pipeline verified; deployment still unverified.** With `VITE_API_URL` and `VITE_SITE_URL` set, the release build regenerated a 399-URL sitemap and generated 399 route HTML files. Sample output includes route-specific metadata and managed WebPage JSON-LD. Search-console indexing, live canonical responses, and complete media delivery still require deployment verification. |
| **AEO** | All 399 URLs from the generated sitemap receive managed `WebPage` JSON-LD in prerendered HTML; selected pages also emit `FAQPage`, `Service`, `Event`, `Organization`, and breadcrumb data. Public pages use semantic headings/content. | **Partial.** Validate richer structured data against page content and current search engine policies; do not promise FAQ rich-result display. |
| **AIO / GEO** | `llms.txt` describes ITRO, its public catalog, information accuracy caveats, and crawler resources. `robots.txt` explicitly lists several AI crawlers and allows public paths. | **Basic foundation only.** Crawler permission does not guarantee indexing or model inclusion. Strengthen source-backed, original provider/test content, clear authorship and update dates, accreditation verification links, entity consistency, and crawlable pre-rendered pages. |
| **Local / geographic discovery** | Public content is India-oriented (`en-IN`, `IN`, and `areaServed: India` on selected services), and provider data can include address/location. | **Partial.** Verify address and service-area completeness for every provider, structured address accuracy, location-specific landing page quality, and actual search/index coverage. No Search Console, analytics, or ranking evidence was available. |
| **Social previews** | Global Open Graph and Twitter card metadata are present. | **Partial.** Most routes use a shared logo image; add suitable page/provider imagery and validate preview rendering on deployed URLs. |

### SEO release blockers / actions

1. Provide the public API URL and canonical site URL to `npm run build` / `npm run build:release`; both now run compilation, sitemap generation, then prerendering, and fail if API configuration or required API fetches are unavailable. Only `NODE_ENV=development` builds use the missing-URL/network fallback.
2. Verify dynamic catalog content, canonical responses, and complete uploaded-media delivery from the deployed site. The earlier preview emitted connection-refused warnings for `/uploads/*` because its local API target was not running. Vite's development proxy now derives its target origin from `VITE_API_URL`; deployed media delivery and S3/R2 access still need staging verification.
3. Verify sitemap URLs return the correct page and canonical, contain no unpublished/duplicate/broken content, and match the deployed public catalog.
4. Confirm route-specific title, description, canonical, H1, and JSON-LD in the actual returned HTML for representative routes, not only after client-side navigation.
5. Submit sitemap and inspect crawl/index coverage and structured-data reports in webmaster tools after deployment.

## Production blockers ranked by priority

### P0 — Must resolve before release

1. **Database connectivity and migration safety:** configure the intended database; replay the reconciliation migration on a fresh PostgreSQL database; prove clean staging provisioning and production migration state.
2. **End-to-end operational proof:** stage the app with real production-like configuration and pass critical buyer/provider/admin flows, including authorization, order state transitions, invoices, payment, document access, and database health.
3. **Safe deployment operation:** provision required Jenkins staging parameters and SSH access; protect the exact production approval gate; run the new staging-first pipeline; verify migration recovery, backup restore, and rollback procedures before production use.

### P1 — Required production-readiness work

4. **SEO deployment verification:** deploy the verified sitemap and prerendered files with the matching public API and upload origin; confirm route metadata and media delivery from the deployed site.
5. **Automated coverage:** add backend/database integration tests and browser end-to-end coverage for authentication, tenant isolation, quote/order, payment, uploads/downloads, and admin workflows.
6. **Storage deployment verification:** configure the production S3/R2 bucket, secret credentials, public CDN prefix, and lifecycle/backup policies; migrate existing files and validate public/private separation plus order-download authorization in staging.
7. **External service readiness:** configure and test Razorpay, SMTP, and Twilio as applicable; document ownership, secret rotation, sandbox/live modes, alerting, and failure handling.
8. **Operational readiness:** verify TLS/DNS, production CORS/API/frontend origins, database backups and restore, monitoring/logging/alerts, rate limits, incident response, and rollback on the deployed environment.

### P2 — Important improvements

9. Measure the split frontend on real devices and networks; monitor route-navigation performance and accessibility.
10. Align `README.md`, `DEPLOYMENT.md`, root/server environment examples, and current package versions/ports. The local frontend port differs from the README and root CORS example.
11. Improve AI/search entity signals and social previews; measure crawler/index coverage rather than treating `llms.txt` or `robots.txt` as proof of visibility.

## Environment inconsistency blockers resolved

On 2026-11-06, the local development and configuration drift blockers were corrected to align the application with a consistent runtime contract:

- Standardized local ports to API `http://localhost:4000` and web `http://localhost:5000`.
- Updated CORS and public origin defaults to allow `http://localhost:5000` only for local development.
- Reworked `server/src/env.ts` to validate environment values with Zod and surface clear warnings in development while failing fast in production.
- Added explicit checks for missing or placeholder `DATABASE_URL`, weak/placeholder `JWT_SECRET`, and incomplete S3 credentials.
- Aligned the root and workspace env examples, deployment guidance, and Vite config to the same local port contract.

## Verification performed

| Check | Result |
|---|---|
| `npm run build` in `web/` with `VITE_API_URL=https://itro.co.in/api` and `VITE_SITE_URL=https://itro.co.in` | **PASS** — TypeScript/Vite compilation, live API-driven sitemap generation (399 URLs), and headless route prerender completed sequentially. |
| Prerendered output | **PASS** — 399 sitemap URLs and 399 `dist/**/index.html` files. Homepage and `/industries/aerospace-defense` HTML contain title, description, canonical, Open Graph title/description/URL/image, and valid managed WebPage JSON-LD. |
| Build-mode validation | **PASS** — missing API configuration warns/skips only for `NODE_ENV=development`; production rejects missing configuration and a failed API connection exits 1 with the failing route and API origin. |
| Frontend main JS chunk | **PASS** — decreased from 1,703.22 kB to 52.02 kB; no chunk exceeds the configured 600 kB warning limit. |
| `npm test` in `web/` | **PASS** — 1 file, 2 tests. |
| `npm audit` | **PASS** — 0 vulnerabilities reported. |
| `npm audit --omit=dev` | **PASS** — 0 production dependency vulnerabilities reported. |
| Prisma schema validation | **PASS** — schema valid with placeholder URL; no database connection was made. |
| Schema-to-migration static comparison | **PASS** — 45 tables, 33 indexes, 108 constraints, 11 enums and all column definitions match after reconciliation. |
| API runtime without database configuration | **PASS (degraded mode)** — API starts; `/api/health` returns 503 and explains that `DATABASE_URL` is missing. |
| API runtime with unreachable PostgreSQL | **PASS (degraded mode)** — API starts; `/api/health` returns 503 with a sanitized connection diagnostic. |
| Fresh PostgreSQL migration deployment | **NOT RUN** — Docker daemon/PostgreSQL and database credentials were unavailable. |
| Production database state | **NOT VERIFIED** — no credentials or approved live/clone connection available. |
| Production/staging deployment, payments, email, WhatsApp, S3/R2 credentials/bucket policy, upload/download flows, TLS, DNS | **NOT RUN** — environment access/configuration unavailable. |
| Jenkins Declarative Pipeline | **Source-reviewed; Jenkins linter/execution unavailable** — no Jenkins controller/CLI or deployment credentials were available in this workspace. The pipeline and documented stage order still require validation in the target Jenkins instance. |

### Build warnings

- Before route splitting, frontend main JavaScript was **1,703.22 kB minified / 448.20 kB gzip**.
- After route splitting, main `index` JavaScript is **52.02 kB / 15.04 kB gzip**. Largest chunks: charts **332.21 kB**, shared vendor **176.37 kB**, maps **155.84 kB**, and React **143.06 kB** (all below the 600 kB limit).
- `web/src/lib/api.ts` is now imported statically only; the mixed-import chunk warning no longer appears.
- Rollup reports dependency annotation-position warnings from Zod; build still succeeds.
- The recorded headless prerender run logged connection-refused errors for uploaded images because its local API target was unavailable. The development proxy now derives the upload target from `VITE_API_URL`; verify deployed media delivery before release.

## Key evidence files

- [README.md](./README.md) — product description, surfaces, roles, and local setup (some ports/setup details are stale).
- [web/src/App.tsx](./web/src/App.tsx) — frontend route surfaces.
- [server/src/routes/index.ts](./server/src/routes/index.ts) — API modules and database-aware health endpoint.
- [server/src/env.ts](./server/src/env.ts) — required database URL and production JWT-secret validation.
- [server/prisma/schema.prisma](./server/prisma/schema.prisma) — PostgreSQL data model.
- [server/prisma/migrations/](./server/prisma/migrations/) — committed database migrations.
- [web/src/lib/useSeo.ts](./web/src/lib/useSeo.ts) — client-side metadata and structured-data manager.
- [web/scripts/build.mjs](./web/scripts/build.mjs) and [web/scripts/build-env.mjs](./web/scripts/build-env.mjs) — release build sequencing and environment assertions.
- [web/scripts/generate-sitemap.mjs](./web/scripts/generate-sitemap.mjs) — API-driven sitemap generation.
- [web/scripts/prerender-public-routes.mjs](./web/scripts/prerender-public-routes.mjs) — browser-based public-route prerendering.
- [web/tests/seo-public-artifacts.spec.ts](./web/tests/seo-public-artifacts.spec.ts) — the two passing public crawler-resource tests.
- [web/public/robots.txt](./web/public/robots.txt), [web/public/sitemap.xml](./web/public/sitemap.xml), and [web/public/llms.txt](./web/public/llms.txt) — current crawler-facing resources.
- [Jenkinsfile](./Jenkinsfile) — staging-first deployment, required staging parameters, staging/production health gates, approval, and archived production build artifacts; live execution remains unverified.
- [DEPLOYMENT.md](./DEPLOYMENT.md) — deployment and database operating guidance.
