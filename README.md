# RIX — Research Infrastructure Exchange (Platform)

A generic, **multi-tenant, white-label** enterprise SaaS that lets any research institution run its labs **and** sell certified testing / R&D services to industry through a managed, cross-institution exchange. Every institution is just a **tenant** — nothing about any single customer is hardcoded.

> No mock data, no fallbacks. Real REST API + PostgreSQL persistence + real JWT auth. The frontend renders only data returned by the API. Platform name, logos, colors and every tenant are configurable at runtime.

## Monorepo layout

```
rix-platform/
  server/   # Node + TypeScript + Express + Prisma + PostgreSQL  (REST API, JWT auth, RBAC, multi-tenant)
  web/      # React + TypeScript + Vite + Tailwind + TanStack Query  (public site, buyer portal, admin console, operator app)
```

## Surfaces

| Surface | Audience | Route prefix |
|---|---|---|
| **Public site + Exchange discovery** | Anyone / industry buyers | `/` , `/exchange` |
| **Buyer portal** | Industry / external buyers | `/app` |
| **Admin console** | Institution admins, lab managers | `/admin` |
| **Operator queue** | Instrument operators | `/operator` |
| **Platform console** | Platform (network) operator | `/platform` |

## Roles (RBAC) — generic, no customer names

`SUPER_ADMIN` · `INSTITUTION_ADMIN` · `LAB_MANAGER` · `OPERATOR` · `FACULTY` · `RESEARCHER` · `INDUSTRY_BUYER`

## Configurability (enterprise white-label)

- **Platform branding** via env (`PLATFORM_NAME`, `PLATFORM_PRIMARY_COLOR`, logo URL) — no name baked into code.
- **Per-tenant branding** (name, logo, theme color, subdomain, accreditations, currency, locale, GST/tax profile) stored on the `Institution` record.
- **Configurable pricing tiers, currencies, tax rules, SLA policies** per tenant.

## Quick start

Local standard ports are:
- API: http://localhost:4000
- Web: http://localhost:5000

```bash
docker compose up -d                       # PostgreSQL
cd server && cp ../.env.example .env
npm install && npx prisma migrate dev --name init
npm run seed                               # neutral demo tenants + reference catalog (no customer names)
npm run dev                                # http://localhost:4000
cd ../web && npm install && npm run dev    # http://localhost:5000
```

## Seeded demo logins (neutral)

| Role | Email | Password |
|---|---|---|
| Platform super admin | super@rix.local | Rix@12345 |
| Institution admin | admin@northgate.rix.local | Rix@12345 |
| Lab manager | labmgr@northgate.rix.local | Rix@12345 |
| Operator | operator@northgate.rix.local | Rix@12345 |
| Industry buyer | buyer@meridian.rix.local | Rix@12345 |

## Core modules

Facilities & Assets · Booking & Access (training-gated) · Service Orders (RFQ→Quote→Order→Sample→Report) · Quoting & Tiered Pricing · Billing & Tax Invoicing · Payments · NDA / Accreditation / Trust · Cross-institution Exchange & Settlement · Analytics.
