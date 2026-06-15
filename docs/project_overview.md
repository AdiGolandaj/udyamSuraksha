# PROJECT_OVERVIEW.md
# DisasterShield — MSME Disaster Resilience Platform

---

## 1. Problem Statement

Rural and hilly MSMEs (Micro, Small & Medium Enterprises) in and around Pune, Maharashtra face frequent and severe weather disruptions — floods, thunderstorms, landslides, and prolonged power outages. Despite existing government alert systems like IMD (India Meteorological Department) and SACHET, these businesses receive no actionable, business-specific guidance.

### The Gap in Current Solutions

Existing government alerts look like this:

> *"NOWCAST: Thunderstorm accompanied with lightning and light to moderate spells of rain with gusty winds 30–40 kmph likely to occur at isolated places in districts of Pune, Satara in next 3 hours. Take precautions while moving out. — IMD Pune."*

This alert tells a medicine shop owner, a grocery store, and a hardware supplier the exact same thing. None of them know:
- Which of their specific stock items are at risk
- What they should do in the next 30 minutes
- How much they stand to lose if they do nothing
- Who nearby can help them

### The Result

- Avoidable inventory losses due to lack of timely, specific guidance
- No structured plan for business continuity during or after disasters
- No peer-to-peer support coordination among nearby businesses
- Slow recovery due to lack of financial impact awareness
- Government bodies unable to identify which businesses need priority intervention

---

## 2. Solution

**DisasterShield** is a web-based, bilingual (Marathi / Hindi / English) disaster resilience platform built specifically for MSME owners in disaster-prone rural and hilly regions near Pune.

It transforms generic weather warnings into **personalized, stock-specific, actionable alerts** and connects shop owners with both a **community peer network** and **local government disaster management bodies (LRDB)**.

### Core Value Proposition

| For MSME Owners | For LRDB Authorities |
|---|---|
| Know exactly which of your stock is at risk | See every registered business and its live risk status |
| Get alerts in your language, specific to your shop | Create targeted, AI-assisted advisories by area or sector |
| Follow a ready-made continuity checklist | Manage incoming emergency queries with priority tracking |
| Connect with nearby shop owners for mutual aid | Coordinate volunteers, transport, and relief via group chat |
| Estimate your potential financial loss before it happens | Generate post-disaster economic impact reports |

---

## 3. Target Users

### Role 1 — MSME Shop Owner
- Small business owners in rural/hilly areas near Pune
- Primarily in categories: grocery, pharmacy, hardware, textiles, food, electronics, agri-supplies
- Low-to-moderate tech literacy; require simple, fast UI
- Primary language: Marathi or Hindi
- Access device: Mobile browser (primary), Desktop (secondary)

### Role 2 — LRDB Officer (Local Disaster Resilient Government Body)
- District or taluka-level disaster management officers
- Moderate-to-high tech literacy
- Responsible for monitoring, coordinating, and supporting MSMEs during emergencies
- Access device: Desktop browser (primary)

---

## 4. Key Features Summary

### MSME Module (10 pages)
1. **Register & Login** — Google OAuth onboarding with business profile setup
2. **Dashboard** — Real-time risk overview, AI alerts, inventory summary, quick actions
3. **Stock Management** — Inventory catalog with disaster-sensitivity tagging and AI storage advice
4. **Business Continuity Plan (BCP)** — Auto-generated before/during/after disaster checklists
5. **Alerts** — AI-enhanced, stock-specific, multilingual disaster alerts with action prompts
6. **Local Support Chat Groups** — Proximity-based peer SOS network with real-time messaging
7. **Risk Profiling** — Business risk scoring with AI-recommended improvements
8. **Recent Trends** — Local disaster pattern analysis and seasonal risk calendar
9. **Estimates & Forecasts** — AI-predicted financial loss for upcoming disaster scenarios
10. **Settings** — Language, notifications, emergency contacts, privacy

### LRDB Module (7 pages)
1. **List of Shops** — Live MSME directory with risk status, map view, and direct messaging
2. **Queries** — Priority-based emergency assistance request management
3. **Chat Groups** — Multi-group coordination hub with labels, broadcasts, and file sharing
4. **Disaster Reports** — Sector and area-wise post-event impact analysis
5. **Estimation** — Region-level financial loss forecasting and resource planning
6. **Alerts** — AI-assisted alert creation, targeting, and delivery tracking
7. **Settings** — Administrative controls, zone configuration, access role management

### Cross-Cutting Features
- **Real-time chat, voice call, video call** — powered by Stream SDK (getstream.io)
- **AI-enhanced alerts** — LLM-generated recommendations personalized to each business profile
- **Multilingual UI** — Marathi, Hindi, English switchable at runtime
- **Role-based routing** — Completely separate navigation shells per role
- **Proximity-based grouping** — Auto-assigns MSME owners to local chat groups by geolocation

---

## 5. Technology Stack

### Frontend Framework
- **Remix** (`remix-run/remix`) — Full-stack React framework with server-side rendering, nested routing, and loader/action pattern for data fetching and mutations.

### UI & Styling
- **Tailwind CSS** — Utility-first CSS framework; all styling done via Tailwind classes. No custom CSS files unless absolutely necessary.
- **shadcn/ui** — Pre-built, accessible component library built on Radix UI primitives. Used for all core UI elements (buttons, dialogs, dropdowns, forms, tables, tabs, etc.)
- **Lucide React** — Icon library (already bundled with shadcn/ui)

### Data Visualization
- **MUI X Charts** (`@mui/x-charts`) — Used for all charts across both modules: bar charts, line charts, area charts, pie charts. No other charting library is to be used.

### Real-Time Communication
- **Stream SDK** (getstream.io) — Used for all chat, voice call, and video call features. Implementation reference: `https://github.com/burakorkmez/streamify-video-calls`. The Stream client is initialized once and shared via Remix context.

### AI & Machine Learning Backend
- **Language** — Python 3.11+
- **Location** — All AI/ML logic lives in `backend/packages/` within the monorepo. This folder is treated as a Python package ecosystem.
- **Package structure** — Every subdirectory inside `packages/` is a proper Python package with an `__init__.py` file, enabling clean imports and modular separation of concerns.
- **Planned packages (initial)**:
  - `packages/alerts/` — LLM-driven alert generation; takes a business profile + weather event as input and returns a structured, stock-specific, multilingual alert payload.
  - `packages/bcp/` — Business Continuity Plan generator; produces before/during/after checklists personalized to a shop's category and inventory.
  - `packages/risk/` — Risk scoring engine; computes business vulnerability scores from location, inventory composition, power dependency, and historical exposure data.
  - `packages/forecasts/` — Financial loss estimation models; predicts stock damage and downtime cost for a given disaster scenario against the shop's current inventory.
  - `packages/trends/` — Local disaster pattern analysis; processes historical event data to surface seasonal risk insights.
  - `packages/core/` — Shared utilities used across packages: API clients, data models (Pydantic schemas), logging config, and environment variable management.
- **Framework** — FastAPI; each package exposes its functionality via a FastAPI router, all mounted under a single `backend/main.py` application entry point.
- **LLM Integration** — Each package that requires generative AI calls an LLM (e.g. Google Gemini or OpenAI GPT) via the package's own service layer inside `packages/core/llm_client.py`, keeping API key management and retry logic centralized.
- **Data validation** — Pydantic v2 used for all request/response schemas within each package.
- **Communication with Remix frontend** — The Python FastAPI server exposes a REST API consumed by Remix `loader` and `action` functions via server-side `fetch` calls. The frontend never calls the Python backend directly from the browser.

```
backend/
├── main.py                  # FastAPI app entry point; mounts all routers
├── requirements.txt
├── .env
└── packages/
    ├── __init__.py
    ├── core/
    │   ├── __init__.py
    │   ├── llm_client.py    # Centralized LLM API client
    │   ├── schemas.py       # Shared Pydantic base models
    │   ├── config.py        # Environment variable management
    │   └── logger.py        # Logging configuration
    ├── alerts/
    │   ├── __init__.py
    │   ├── router.py        # FastAPI router: POST /alerts/generate
    │   ├── service.py       # Business logic
    │   └── schemas.py       # Alert-specific Pydantic models
    ├── bcp/
    │   ├── __init__.py
    │   ├── router.py        # FastAPI router: POST /bcp/generate
    │   ├── service.py
    │   └── schemas.py
    ├── risk/
    │   ├── __init__.py
    │   ├── router.py        # FastAPI router: POST /risk/score
    │   ├── service.py
    │   └── schemas.py
    ├── forecasts/
    │   ├── __init__.py
    │   ├── router.py        # FastAPI router: POST /forecasts/estimate
    │   ├── service.py
    │   └── schemas.py
    └── trends/
        ├── __init__.py
        ├── router.py        # FastAPI router: GET /trends/{region}
        ├── service.py
        └── schemas.py
```

### Identity & Unique Identification
- **UUIDv4** — Every entity in the system (users, shops, alerts, queries, chat groups, stock items, BCP plans) is assigned a UUIDv4 as its primary identifier at the time of creation.
- **Remix dynamic routes** — UUIDs power all `# PROJECT_OVERVIEW.md
# DisasterShield — MSME Disaster Resilience Platform

---

## 1. Problem Statement

Rural and hilly MSMEs (Micro, Small & Medium Enterprises) in and around Pune, Maharashtra face frequent and severe weather disruptions — floods, thunderstorms, landslides, and prolonged power outages. Despite existing government alert systems like IMD (India Meteorological Department) and SACHET, these businesses receive no actionable, business-specific guidance.

### The Gap in Current Solutions

Existing government alerts look like this:

> *"NOWCAST: Thunderstorm accompanied with lightning and light to moderate spells of rain with gusty winds 30–40 kmph likely to occur at isolated places in districts of Pune, Satara in next 3 hours. Take precautions while moving out. — IMD Pune."*

This alert tells a medicine shop owner, a grocery store, and a hardware supplier the exact same thing. None of them know:
- Which of their specific stock items are at risk
- What they should do in the next 30 minutes
- How much they stand to lose if they do nothing
- Who nearby can help them

### The Result

- Avoidable inventory losses due to lack of timely, specific guidance
- No structured plan for business continuity during or after disasters
- No peer-to-peer support coordination among nearby businesses
- Slow recovery due to lack of financial impact awareness
- Government bodies unable to identify which businesses need priority intervention

---

## 2. Solution

**DisasterShield** is a web-based, bilingual (Marathi / Hindi / English) disaster resilience platform built specifically for MSME owners in disaster-prone rural and hilly regions near Pune.

It transforms generic weather warnings into **personalized, stock-specific, actionable alerts** and connects shop owners with both a **community peer network** and **local government disaster management bodies (LRDB)**.

### Core Value Proposition

| For MSME Owners | For LRDB Authorities |
|---|---|
| Know exactly which of your stock is at risk | See every registered business and its live risk status |
| Get alerts in your language, specific to your shop | Create targeted, AI-assisted advisories by area or sector |
| Follow a ready-made continuity checklist | Manage incoming emergency queries with priority tracking |
| Connect with nearby shop owners for mutual aid | Coordinate volunteers, transport, and relief via group chat |
| Estimate your potential financial loss before it happens | Generate post-disaster economic impact reports |

---

## 3. Target Users

### Role 1 — MSME Shop Owner
- Small business owners in rural/hilly areas near Pune
- Primarily in categories: grocery, pharmacy, hardware, textiles, food, electronics, agri-supplies
- Low-to-moderate tech literacy; require simple, fast UI
- Primary language: Marathi or Hindi
- Access device: Mobile browser (primary), Desktop (secondary)

### Role 2 — LRDB Officer (Local Disaster Resilient Government Body)
- District or taluka-level disaster management officers
- Moderate-to-high tech literacy
- Responsible for monitoring, coordinating, and supporting MSMEs during emergencies
- Access device: Desktop browser (primary)

---

## 4. Key Features Summary

### MSME Module (10 pages)
1. **Register & Login** — Google OAuth onboarding with business profile setup
2. **Dashboard** — Real-time risk overview, AI alerts, inventory summary, quick actions
3. **Stock Management** — Inventory catalog with disaster-sensitivity tagging and AI storage advice
4. **Business Continuity Plan (BCP)** — Auto-generated before/during/after disaster checklists
5. **Alerts** — AI-enhanced, stock-specific, multilingual disaster alerts with action prompts
6. **Local Support Chat Groups** — Proximity-based peer SOS network with real-time messaging
7. **Risk Profiling** — Business risk scoring with AI-recommended improvements
8. **Recent Trends** — Local disaster pattern analysis and seasonal risk calendar
9. **Estimates & Forecasts** — AI-predicted financial loss for upcoming disaster scenarios
10. **Settings** — Language, notifications, emergency contacts, privacy

### LRDB Module (7 pages)
1. **List of Shops** — Live MSME directory with risk status, map view, and direct messaging
2. **Queries** — Priority-based emergency assistance request management
3. **Chat Groups** — Multi-group coordination hub with labels, broadcasts, and file sharing
4. **Disaster Reports** — Sector and area-wise post-event impact analysis
5. **Estimation** — Region-level financial loss forecasting and resource planning
6. **Alerts** — AI-assisted alert creation, targeting, and delivery tracking
7. **Settings** — Administrative controls, zone configuration, access role management

### Cross-Cutting Features
- **Real-time chat, voice call, video call** — powered by Stream SDK (getstream.io)
- **AI-enhanced alerts** — LLM-generated recommendations personalized to each business profile
- **Multilingual UI** — Marathi, Hindi, English switchable at runtime
- **Role-based routing** — Completely separate navigation shells per role
- **Proximity-based grouping** — Auto-assigns MSME owners to local chat groups by geolocation

---

## 5. Technology Stack

### Frontend Framework
- **Remix** (`remix-run/remix`) — Full-stack React framework with server-side rendering, nested routing, and loader/action pattern for data fetching and mutations.

### UI & Styling
- **Tailwind CSS** — Utility-first CSS framework; all styling done via Tailwind classes. No custom CSS files unless absolutely necessary.
- **shadcn/ui** — Pre-built, accessible component library built on Radix UI primitives. Used for all core UI elements (buttons, dialogs, dropdowns, forms, tables, tabs, etc.)
- **Lucide React** — Icon library (already bundled with shadcn/ui)

### Data Visualization
- **MUI X Charts** (`@mui/x-charts`) — Used for all charts across both modules: bar charts, line charts, area charts, pie charts. No other charting library is to be used.

### Real-Time Communication
- **Stream SDK** (getstream.io) — Used for all chat, voice call, and video call features. Implementation reference: `https://github.com/burakorkmez/streamify-video-calls`. The Stream client is initialized once and shared via Remix context.

### AI & Machine Learning Backend
- **Language** — Python 3.11+
- **Location** — All AI/ML logic lives in `backend/packages/` within the monorepo. This folder is treated as a Python package ecosystem.
- **Package structure** — Every subdirectory inside `packages/` is a proper Python package with an `__init__.py` file, enabling clean imports and modular separation of concerns.
- **Planned packages (initial)**:
  - `packages/alerts/` — LLM-driven alert generation; takes a business profile + weather event as input and returns a structured, stock-specific, multilingual alert payload.
  - `packages/bcp/` — Business Continuity Plan generator; produces before/during/after checklists personalized to a shop's category and inventory.
  - `packages/risk/` — Risk scoring engine; computes business vulnerability scores from location, inventory composition, power dependency, and historical exposure data.
  - `packages/forecasts/` — Financial loss estimation models; predicts stock damage and downtime cost for a given disaster scenario against the shop's current inventory.
  - `packages/trends/` — Local disaster pattern analysis; processes historical event data to surface seasonal risk insights.
  - `packages/core/` — Shared utilities used across packages: API clients, data models (Pydantic schemas), logging config, and environment variable management.
- **Framework** — FastAPI; each package exposes its functionality via a FastAPI router, all mounted under a single `backend/main.py` application entry point.
- **LLM Integration** — Each package that requires generative AI calls an LLM (e.g. Google Gemini or OpenAI GPT) via the package's own service layer inside `packages/core/llm_client.py`, keeping API key management and retry logic centralized.
- **Data validation** — Pydantic v2 used for all request/response schemas within each package.
- **Communication with Remix frontend** — The Python FastAPI server exposes a REST API consumed by Remix `loader` and `action` functions via server-side `fetch` calls. The frontend never calls the Python backend directly from the browser.

```
backend/
├── main.py                  # FastAPI app entry point; mounts all routers
├── requirements.txt
├── .env
└── packages/
    ├── __init__.py
    ├── core/
    │   ├── __init__.py
    │   ├── llm_client.py    # Centralized LLM API client
    │   ├── schemas.py       # Shared Pydantic base models
    │   ├── config.py        # Environment variable management
    │   └── logger.py        # Logging configuration
    ├── alerts/
    │   ├── __init__.py
    │   ├── router.py        # FastAPI router: POST /alerts/generate
    │   ├── service.py       # Business logic
    │   └── schemas.py       # Alert-specific Pydantic models
    ├── bcp/
    │   ├── __init__.py
    │   ├── router.py        # FastAPI router: POST /bcp/generate
    │   ├── service.py
    │   └── schemas.py
    ├── risk/
    │   ├── __init__.py
    │   ├── router.py        # FastAPI router: POST /risk/score
    │   ├── service.py
    │   └── schemas.py
    ├── forecasts/
    │   ├── __init__.py
    │   ├── router.py        # FastAPI router: POST /forecasts/estimate
    │   ├── service.py
    │   └── schemas.py
    └── trends/
        ├── __init__.py
        ├── router.py        # FastAPI router: GET /trends/{region}
        ├── service.py
        └── schemas.py
```

-prefixed dynamic route segments in the Remix `routes/` folder. For example:
  - `routes/msme.$userId.dashboard.tsx` — MSME owner's dashboard, scoped to their UUID
  - `routes/msme.$userId.stock.$itemId.tsx` — Individual stock item detail
  - `routes/lrdb.$officerId.shops.$shopId.tsx` — LRDB officer viewing a specific shop
  - `routes/lrdb.$officerId.queries.$queryId.tsx` — Individual query detail view
- **UUID generation** — UUIDs are generated server-side (in Remix `action` functions or the Python backend) at the point of record creation. The `uuid` npm package (`import { v4 as uuidv4 } from 'uuid'`) is used on the Remix side; Python's built-in `import uuid; uuid.uuid4()` is used on the backend side.
- **URL readability** — UUIDs in URLs are kept as-is (not shortened or encoded). Remix's `useParams()` hook extracts them in route components and passes them to loaders for data fetching.
- **Cross-system consistency** — The same UUID assigned to a user by the Remix auth layer is used as the identifier when that user's data is stored and retrieved from the Python backend, ensuring no ID translation layer is needed between the two systems.

### Authentication
- **`remix-auth`** (open source, MIT licensed) — Core authentication framework built specifically for Remix's loader/action pattern. Handles session management, CSRF protection, session rotation, and redirect safety out of the box.
- **`remix-auth-google`** — Google OAuth 2.0 strategy for `remix-auth`. Primary login method for both MSME owners and LRDB officers.
- **Role assignment** — Determined at first registration and stored in the user's database record alongside their UUIDv4. The session cookie carries `{ userId, role, name, email }` — signed and HTTP-only.
- **Extensibility** — `remix-auth` supports multiple strategies. A phone/OTP strategy (`remix-auth-otp`) can be added in v2 for rural users who may not have Google accounts.
- **Session storage** — Cookie-based sessions via Remix's `createCookieSessionStorage`. No server-side session store required for v1.

### Mail Notifications (SMTP)
- **`nodemailer`** — Node.js SMTP mail sending library. Runs exclusively on the Remix server inside `app/lib/mail.server.ts`. Never called from the client.
- **SMTP configuration** — Provider-agnostic. Uses standard SMTP credentials from `.env`. Supports Gmail SMTP for development and any production-grade provider (Mailgun, SendGrid, Postmark) by swapping credentials.
- **Mail triggers** — Nodemailer is called from Remix `action` functions when notification conditions are met:
  - Disaster alert generated for a shop (if user has email alerts enabled)
  - BCP checklist summary after plan generation
  - Risk score change notification
  - LRDB broadcast announcement to all MSMEs in a region
  - Query status update (assigned, resolved, escalated)
- **User preference respected** — Mail is only sent if the user has enabled email notifications in Settings. This preference is checked server-side before calling `mail.server.ts`.

### State Management
- **Remix loaders and actions** — Primary data flow pattern; server-side data fetching via `loader`, mutations via `action`.
- **React Context** — For global client-side state: current user, language preference, Stream client instance.

### Database
- **MySQL** — Primary relational database. Stores all structured application data including users, shop profiles, stock inventory, alerts, BCP plans, risk scores, queries, reports, and chat group metadata.
- **Prisma ORM** — Type-safe database client for Node.js. Defined via a single `schema.prisma` file. Used exclusively inside Remix `loader` and `action` functions — never called from the browser. Provides auto-generated migrations via `prisma migrate dev`.
- **Connection** — Both the Remix server and the Python FastAPI backend connect to the same MySQL instance. Remix uses Prisma; Python uses **SQLAlchemy** with **PyMySQL** driver.
- **Schema file location** — `prisma/schema.prisma` at the monorepo root.
- **Migration files** — `prisma/migrations/` — version-controlled and committed to the repo.

### Location Intelligence APIs
All location APIs are open-source and free. No API keys required except where noted.

| API | Base URL | Purpose |
|---|---|---|
| **Nominatim** (OpenStreetMap) | `https://nominatim.openstreetmap.org` | Reverse geocoding — converts lat/lng to structured address (village, taluka, district, pincode). No key required. Rate limit: 1 req/sec |
| **Overpass API** (OpenStreetMap) | `https://overpass-api.de/api/interpreter` | Single-query amenity discovery within a radius — hospitals, reservoirs, dams, LRDB centres, police stations, fire stations, relief centres, roads, substations. No key required |
| **Open-Elevation** | `https://api.open-elevation.com` | Elevation in metres from lat/lng. No key required. Self-hostable |
| **OpenTopoData** | `https://api.opentopodata.org` | Terrain slope, aspect, and DEM data. Complements Open-Elevation with richer topographic detail. No key required |
| **Meteosource** | `https://www.meteosource.com/api/v1` | Weather forecasting for Pune region. Current conditions, 48hr hourly forecast, 21-day daily forecast, historical weather. API key required |

### Weather & Alert Scheduling
- **APScheduler** — Python background job scheduler running inside the FastAPI backend. Runs one Meteosource call per `regionCode` per hour (not per shop) for efficiency. If weather thresholds are exceeded, triggers per-shop LLM alert generation and writes `Alert` + `AlertRecipient` records to MySQL.
- **Alert generation is fully internal** — The Python `packages/alerts/` package handles Meteosource fetch + LLM prompt construction + alert writing. No third-party alert service (no SACHET, no IMD push API).

### Location Enrichment Package
- **`packages/location/`** — New Python package responsible for all location intelligence. Orchestrates Nominatim, Overpass, Open-Elevation, and OpenTopoData calls. Triggered once on shop registration and re-run every 30 days via APScheduler batch job. Writes enriched data to the `LocationProfile` table in MySQL.

### Internationalisation
- **i18next with remix-i18next** — For Marathi / Hindi / English runtime language switching.

---

## 6. Design Principles

1. **Mobile-first for MSME, Desktop-first for LRDB** — MSME pages must be fully functional and readable on a 375px mobile screen. LRDB pages are optimised for 1280px+ desktop.
2. **Speed over decoration** — No heavy animations, no complex loaders. Content should be readable within one second of page load.
3. **Reusable components everywhere** — Every repeated UI pattern (stat card, alert banner, risk badge, shop card, chat bubble, query row) must be extracted into a named component and reused. No inline duplication.
4. **Accessible and inclusive** — Minimum contrast ratio AA compliance. All interactive elements must be keyboard navigable.
5. **Actionable over informational** — Every page should end with a clear action the user can take. Data is shown to drive decisions, not just to display numbers.
6. **Offline-awareness** — The app should gracefully communicate when data is unavailable rather than breaking.

# 6. Installation — Authentication & Mail Packages

```bash
# Prisma ORM
npm install prisma @prisma/client
npx prisma init --datasource-provider mysql

# SQLAlchemy + PyMySQL (Python FastAPI side)
pip install sqlalchemy pymysql
```

---

## 7. Application URL Structure

```
/                                                      → Landing page / role selector
/login                                                 → Google OAuth login
/register                                              → Business profile setup (post-login, first time)

/msme/$userId/                                         → MSME module root (protected)
/msme/$userId/dashboard                                → Dashboard
/msme/$userId/stock                                    → Stock Management (inventory list)
/msme/$userId/stock/$itemId                            → Individual stock item detail
/msme/$userId/bcp                                      → Business Continuity Plan
/msme/$userId/alerts                                   → Alerts list
/msme/$userId/alerts/$alertId                          → Individual alert detail
/msme/$userId/chat                                     → Local Support Chat Groups
/msme/$userId/chat/$groupId                            → Individual chat group
/msme/$userId/risk                                     → Risk Profiling
/msme/$userId/trends                                   → Recent Trends
/msme/$userId/forecasts                                → Estimates & Forecasts
/msme/$userId/settings                                 → Settings

/lrdb/$officerId/                                      → LRDB module root (protected)
/lrdb/$officerId/shops                                 → List of Shops
/lrdb/$officerId/shops/$shopId                         → Individual shop detail
/lrdb/$officerId/queries                               → Queries list
/lrdb/$officerId/queries/$queryId                      → Individual query detail
/lrdb/$officerId/chat                                  → Chat Groups hub
/lrdb/$officerId/chat/$groupId                         → Individual chat group
/lrdb/$officerId/reports                               → Disaster Reports
/lrdb/$officerId/reports/$reportId                     → Individual report
/lrdb/$officerId/estimation                            → Estimation overview
/lrdb/$officerId/alerts                                → Alerts management
/lrdb/$officerId/alerts/$alertId                       → Individual alert detail
/lrdb/$officerId/settings                              → Settings
```

---

## 8. Project Constraints & Assumptions

- The application is web-based only (no native mobile app at this stage).
- All AI/LLM-generated content (alerts, BCP, risk suggestions, forecasts) is produced by the Python FastAPI backend in `backend/packages/`. The Remix frontend calls these endpoints via server-side loaders and actions — the browser never directly calls the Python service.
- Real-time data (weather feeds, live risk scores) is assumed to be delivered via a backend API; the frontend consumes it.
- The Stream SDK handles all WebRTC complexity for voice and video calls.
- Maps are used for visualisation only — no turn-by-turn navigation.
- The application must support Marathi Unicode rendering correctly across all text nodes.
- Initial build targets Pune district and surrounding talukas as the geographic scope.

---

## 9. Success Metrics (for product evaluation)

| Metric | Target |
|---|---|
| Time to complete onboarding | < 3 minutes |
| Alert delivery to action completion | < 5 taps / clicks |
| Dashboard load time | < 2 seconds on 4G |
| MSME owner comprehension of BCP checklist | No training required |
| LRDB query resolution visibility | 100% of open queries visible on one screen |
| Chat group message delivery latency | < 500ms (Stream SLA) |

---

*This document serves as the foundational reference for all subsequent specification, design, and implementation documents in this project.*
