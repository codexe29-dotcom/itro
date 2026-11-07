# RIX API Contract (v1)

Base URL: `http://localhost:4000/api`. All JSON. Auth via `Authorization: Bearer <jwt>`.
Errors: `{ "message": string, "details"?: any }` with proper HTTP status. No mock/fallback data anywhere — every endpoint reads/writes PostgreSQL via Prisma.

## Conventions
- List endpoints support `?page=1&pageSize=20&q=search&status=...&category=...` and return `{ data: T[], total, page, pageSize }`.
- Multi-tenant: non-platform users are scoped to their `institutionId` automatically (server-derived from JWT — never trust a client-sent institutionId for scoping).
- RBAC per endpoint noted as `[roles]`. `SUPER_ADMIN` may access everything.

## Auth
| Method | Path | Roles | Body / Notes |
|---|---|---|---|
| POST | `/auth/register` | public | `{name,email,password,orgName?,phone?}` → creates INDUSTRY_BUYER. Returns `{token,user}` |
| POST | `/auth/login` | public | `{email,password}` → `{token,user}` |
| GET | `/auth/me` | any | current user (with institution) |

## Platform config (white-label)
| GET | `/config` | public | `{platformName, tagline, primaryColor, defaultCurrency}` from env |

## Institutions (tenants)
| GET | `/institutions` | public | published institutions (for exchange) |
| GET | `/institutions/:slug` | public | one institution + facilities + active services |
| POST | `/institutions` | SUPER_ADMIN | create tenant |
| PATCH | `/institutions/:id` | SUPER_ADMIN, INSTITUTION_ADMIN(own) | update branding/config (name,logoUrl,themeColor,currency,taxRate,accreditations,onExchange) |

## Facilities
| GET | `/facilities` | INSTITUTION_ADMIN, LAB_MANAGER | own institution facilities (+instrument counts) |
| POST | `/facilities` | INSTITUTION_ADMIN, LAB_MANAGER | `{name,department?,description?,location?}` |
| PATCH | `/facilities/:id` | INSTITUTION_ADMIN, LAB_MANAGER | update |
| DELETE | `/facilities/:id` | INSTITUTION_ADMIN | delete |

## Instruments / assets
| GET | `/instruments` | admin roles | own institution instruments (filter category,status,facilityId) |
| GET | `/instruments/:id` | admin roles | one (+facility, bookings) |
| POST | `/instruments` | INSTITUTION_ADMIN, LAB_MANAGER | `{facilityId,name,category,make?,model?,specs?,hourlyRate,trainingRequired,imageUrl?,description?}` |
| PATCH | `/instruments/:id` | INSTITUTION_ADMIN, LAB_MANAGER | update (incl. status) |
| DELETE | `/instruments/:id` | INSTITUTION_ADMIN | delete |

## Services (catalog)
| GET | `/services` | admin roles | own institution services |
| GET | `/services/:id` | public | one service (+institution +instrument) — used by exchange |
| POST | `/services` | INSTITUTION_ADMIN, LAB_MANAGER | `{name,category,description?,deliverable?,turnaroundDays,priceInternal,priceAcademic,priceIndustry,accreditation?,instrumentId?}` |
| PATCH | `/services/:id` | INSTITUTION_ADMIN, LAB_MANAGER | update (incl. isActive) |
| DELETE | `/services/:id` | INSTITUTION_ADMIN | delete |

## Exchange (cross-institution discovery) — public
| GET | `/exchange/services` | public | ALL active services across published institutions. Filters: `q,category,accreditation,institutionId,maxPrice,maxTurnaround`. Returns `{data,total,...}` with `service.institution` populated |
| GET | `/exchange/categories` | public | distinct categories with counts |

## Service orders (managed workflow)
| GET | `/orders` | buyer(own) / admin(institution) | list; buyers see their orders, admins see institution orders |
| GET | `/orders/:id` | owner buyer / institution admin | full order (+service,+institution,+buyer,+events,+invoice,+settlement) |
| POST | `/orders` | INDUSTRY_BUYER | create RFQ `{serviceId, sampleDetails, quantity, requirements}` → status QUOTE_REQUESTED, tier INDUSTRY, generates code ORD-YYYY-NNNN, adds OrderEvent |
| POST | `/orders/:id/quote` | INSTITUTION_ADMIN, LAB_MANAGER | `{quotedPrice, slaDays}` → status QUOTED |
| POST | `/orders/:id/accept` | INDUSTRY_BUYER(own) | → status ACCEPTED then NDA_PENDING |
| POST | `/orders/:id/nda` | INDUSTRY_BUYER(own) | e-sign NDA → ndaSigned true, status SAMPLE_AWAITED |
| POST | `/orders/:id/sample-received` | LAB_MANAGER, OPERATOR | → status IN_PROGRESS, sets dueAt = now + slaDays |
| POST | `/orders/:id/report` | LAB_MANAGER, OPERATOR | `{reportUrl}` → status REPORT_READY |
| POST | `/orders/:id/complete` | INSTITUTION_ADMIN, LAB_MANAGER | → COMPLETED, releases settlement |
| POST | `/orders/:id/cancel` | owner buyer / admin | → CANCELLED |
| POST | `/orders/:id/review` | INDUSTRY_BUYER(own) | `{rating,comment}` |

On QUOTE→ACCEPT the server creates an **Invoice** (subtotal=quotedPrice, taxRate=institution.taxRate, tax, total) and a **Settlement** (takeRate from env PLATFORM_TAKE_RATE, platformFee, netToProvider).

## Invoices & payments
| GET | `/invoices` | buyer(own)/admin | list |
| GET | `/invoices/:id` | owner | one (+order, +payment) |
| POST | `/invoices/:id/pay` | INDUSTRY_BUYER(own) | `{method, reference?}` → Payment SUCCESS, Invoice PAID (simulated gateway settlement, but real DB records) |

## Bookings
| GET | `/bookings` | admin roles / faculty(own) | list (filter instrumentId,status) |
| POST | `/bookings` | FACULTY, RESEARCHER, LAB_MANAGER | `{instrumentId,startAt,endAt,purpose}` — server checks training + conflict |
| POST | `/bookings/:id/approve` | LAB_MANAGER, OPERATOR | approve |
| POST | `/bookings/:id/reject` | LAB_MANAGER, OPERATOR | reject |
| POST | `/bookings/:id/cancel` | owner | cancel |

## Users (tenant + platform)
| GET | `/users` | INSTITUTION_ADMIN | own-institution users |
| POST | `/users` | INSTITUTION_ADMIN | invite/create `{name,email,role,password}` within institution |
| PATCH | `/users/:id` | INSTITUTION_ADMIN | update role/active |

## Analytics
| GET | `/analytics/summary` | admin roles | `AnalyticsSummary` (see web types) scoped to institution |
| GET | `/analytics/platform` | SUPER_ADMIN | network-wide totals + settlements + institution leaderboard |

## Operator
| GET | `/operator/queue` | OPERATOR, LAB_MANAGER | orders in SAMPLE_AWAITED/IN_PROGRESS + today's approved bookings |

## Settlements (platform)
| GET | `/settlements` | SUPER_ADMIN | all settlements (+order,+institution) |
| POST | `/settlements/:id/release` | SUPER_ADMIN | → RELEASED |
