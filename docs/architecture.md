# ARCHITECTURE.md
# DisasterShield — System Architecture & Project Structure

---

## 1. System Overview

DisasterShield is a monorepo containing two distinct runtime systems that communicate over HTTP:

1. **Remix Frontend** (`/app`) — Full-stack React application handling UI, routing, authentication, and server-side data orchestration via loaders and actions.
2. **Python FastAPI Backend** (`/backend`) — AI and ML service layer organized as a Python package ecosystem. Handles all LLM inference, risk scoring, alert generation, BCP generation, and financial forecasting.

These two systems are deliberately decoupled. The Remix server talks to the FastAPI server via internal HTTP calls inside loaders and actions. The browser never directly calls the FastAPI backend.

```
Browser
  │
  ▼
Remix Server (Node.js)
  │  loaders / actions make HTTP calls
  ▼
FastAPI Server (Python)
  │  packages/alerts, packages/risk, packages/bcp, etc.
  ▼
LLM API (Google Gemini / OpenAI)
External APIs (IMD weather feed, Stream SDK, Google OAuth)
```

---

## 2. Monorepo Root Structure

```
disastershield/
├── app/                        # Remix application (frontend + SSR)
├── backend/                    # Python FastAPI AI/ML service
├── public/                     # Static assets (favicon, og images)
├── package.json                # Remix/Node dependencies
├── tsconfig.json               # TypeScript config
├── tailwind.config.ts          # Tailwind + custom tokens
├── components.json             # shadcn/ui config
├── vite.config.ts              # Vite bundler config (Remix uses Vite)
├── .env                        # Environment variables (Node side)
└── README.md
```

---

## 3. Remix Application Structure (`/app`)

```
app/
├── root.tsx
├── entry.client.tsx
├── entry.server.tsx
│
├── routes/
│
├── components/
│   ├── ui/
│   └── shared/
│
├── lib/
│   ├── utils.ts
│   ├── constants.ts
│   ├── api.server.ts
│   ├── auth.server.ts
│   ├── session.server.ts
│   ├── mail.server.ts
│   ├── db.server.ts                # Prisma client singleton (see DATABASE.md)
│   ├── stream.server.ts
│   └── schemas/
│       ├── registerSchema.ts
│       ├── stockItemSchema.ts
│       ├── bcpSchema.ts
│       ├── alertSchema.ts
│       ├── querySchema.ts
│       └── settingsSchema.ts
│
├── context/
│   ├── UserContext.tsx
│   ├── LanguageContext.tsx
│   └── StreamContext.tsx
│
├── hooks/
│   ├── useUser.ts
│   ├── useLanguage.ts
│   ├── useStreamClient.ts
│   └── useRiskColor.ts
│
├── locales/
│   ├── en/common.json
│   ├── mr/common.json
│   └── hi/common.json
│
└── styles/
    └── globals.css
```

> **Database schema and migrations live at the monorepo root under `prisma/`.
> See `DATABASE.md` for the full Prisma schema, migration workflow, and
> the `db.server.ts` singleton pattern.**

---

## 4. Python Backend Structure (`/backend`)

```
backend/
├── main.py                     # FastAPI app entry: mounts all routers, CORS, middleware
├── scheduler.py                # APScheduler setup — weather batch + location refresh jobs
├── requirements.txt
├── .env
├── Dockerfile
│
└── packages/
    ├── __init__.py
    ├── core/
    │   ├── __init__.py
    │   ├── config.py
    │   ├── logger.py
    │   ├── schemas.py
    │   ├── llm_client.py
    │   └── database.py
    │
    ├── location/               # Location intelligence package (NEW)
    │   ├── __init__.py
    │   ├── router.py           # POST /location/enrich
    │   ├── service.py          # Orchestrates all geo API calls
    │   ├── nominatim.py        # Reverse geocoding client
    │   ├── overpass.py         # Amenity discovery client (single-query)
    │   ├── elevation.py        # Open-Elevation + OpenTopoData client
    │   └── schemas.py          # LocationEnrichRequest, LocationEnrichResponse
    │
    ├── alerts/
    │   ├── __init__.py
    │   ├── router.py           # POST /alerts/generate
    │   ├── service.py          # Meteosource fetch + LLM prompt + alert construction
    │   ├── meteosource.py      # Meteosource API client
    │   └── schemas.py
    │
    ├── bcp/
    │   ├── __init__.py
    │   ├── router.py
    │   ├── service.py
    │   └── schemas.py
    │
    ├── risk/
    │   ├── __init__.py
    │   ├── router.py
    │   ├── service.py
    │   └── schemas.py
    │
    ├── forecasts/
    │   ├── __init__.py
    │   ├── router.py
    │   ├── service.py
    │   └── schemas.py
    │
    └── trends/
        ├── __init__.py
        ├── router.py
        ├── service.py
        └── schemas.py
```

> **The Python backend connects to the same MySQL database as Remix via
> SQLAlchemy. See `DATABASE.md` for the connection setup and
> `packages/core/database.py` session factory pattern.**

### `backend/scheduler.py` — APScheduler Batch Jobs

```python
# backend/scheduler.py
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from packages.alerts.service import run_regional_alert_batch
from packages.location.service import run_location_refresh_batch

scheduler = AsyncIOScheduler()

# Weather alert batch — runs every hour
# One Meteosource call per regionCode, not per shop
scheduler.add_job(
    run_regional_alert_batch,
    trigger=IntervalTrigger(hours=1),
    id='alert_batch',
    name='Regional Weather Alert Generation',
    replace_existing=True,
)

# Location enrichment refresh — runs every 30 days per shop
# Re-fetches Overpass amenity data in case infrastructure has changed
scheduler.add_job(
    run_location_refresh_batch,
    trigger=IntervalTrigger(days=30),
    id='location_refresh',
    name='Location Profile Refresh',
    replace_existing=True,
)
```

Started in `main.py`:
```python
# backend/main.py (addition)
from scheduler import scheduler

@app.on_event("startup")
async def startup():
    scheduler.start()

@app.on_event("shutdown")
async def shutdown():
    scheduler.shutdown()
```

### Alert Batch Flow (per hourly run)

```
scheduler → run_regional_alert_batch()
  │
  ├── Query MySQL: SELECT DISTINCT regionCode FROM shop_profiles
  │
  └── For each regionCode:
      ├── Fetch regionCode centroid lat/lng
      ├── Call Meteosource GET /point/hourly (one call per region)
      ├── Evaluate weather thresholds:
      │   - Rain > 20mm/hr → Flood risk
      │   - Wind > 40kmph → Wind damage risk
      │   - Power grid stress indicators → Outage risk
      │
      └── If threshold exceeded:
          └── For each ShopProfile in regionCode:
              ├── Fetch LocationProfile + StockItem list + StockSensitivity
              ├── Construct LLM prompt with:
              │   weather data + location context + stock sensitivity profile
              ├── Call LLM → structured AlertResponse
              ├── Write Alert record to MySQL
              ├── Write AlertRecipient record for each shop owner
              └── Queue email notification (if user.notifyViaEmail)
```

### Location Enrichment Flow (on registration + every 30 days)

```
POST /location/enrich called by Remix action after registration
  │
  └── packages/location/service.py
      ├── nominatim.py  → GET https://nominatim.openstreetmap.org/reverse
      │                    ?lat={lat}&lon={lng}&format=json
      │                    Returns: village, suburb, county(taluka), state_district, postcode
      │
      ├── overpass.py   → Single Overpass QL query (10km radius):
      │                    [out:json];
      │                    (
      │                      node["amenity"="hospital"](around:10000,{lat},{lng});
      │                      node["amenity"="police"](around:10000,{lat},{lng});
      │                      node["amenity"="fire_station"](around:10000,{lat},{lng});
      │                      node["amenity"="social_facility"](around:10000,{lat},{lng});
      │                      node["emergency"="disaster_response"](around:10000,{lat},{lng});
      │                      node["natural"="water"](around:10000,{lat},{lng});
      │                      node["waterway"="reservoir"](around:10000,{lat},{lng});
      │                      node["waterway"="dam"](around:10000,{lat},{lng});
      │                      node["waterway"~"river|stream"](around:10000,{lat},{lng});
      │                      node["power"="substation"](around:10000,{lat},{lng});
      │                      way["highway"~"primary|secondary|tertiary"](around:5000,{lat},{lng});
      │                    );
      │                    out body;
      │                    Returns: name + distance + type for all amenities
      │
      ├── elevation.py  → GET https://api.open-elevation.com/api/v1/lookup
      │                    ?locations={lat},{lng}
      │                    Returns: elevation in metres
      │
      └── elevation.py  → GET https://api.opentopodata.org/v1/srtm90m
                           ?locations={lat},{lng}
                           Returns: slope + aspect (terrain analysis)

      All results written to LocationProfile in MySQL
      batchStatus updated to COMPLETE
      lastBatchRunAt set to now()
```

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from packages.alerts.router import router as alerts_router
from packages.bcp.router import router as bcp_router
from packages.risk.router import router as risk_router
from packages.forecasts.router import router as forecasts_router
from packages.trends.router import router as trends_router

app = FastAPI(title="DisasterShield AI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Remix dev server
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(alerts_router,    prefix="/alerts",    tags=["Alerts"])
app.include_router(bcp_router,       prefix="/bcp",       tags=["BCP"])
app.include_router(risk_router,      prefix="/risk",      tags=["Risk"])
app.include_router(forecasts_router, prefix="/forecasts", tags=["Forecasts"])
app.include_router(trends_router,    prefix="/trends",    tags=["Trends"])
```

### Starting the Python Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

---

## 5. Remix Route File Conventions

Remix uses file-based routing inside `app/routes/`. The filename directly maps to the URL. Dynamic segments use the `$` prefix. Nested layouts use dot-notation.

### Full Route File Map

```
app/routes/
│
├── _index.tsx                              # GET /  → Landing page
├── login.tsx                               # GET /login → Google OAuth redirect
├── auth.callback.tsx                       # GET /auth/callback → OAuth callback handler
├── register.tsx                            # GET/POST /register → Profile setup
│
│── msme.$userId.tsx                        # MSME layout shell (sidebar, nav)
│   └── (children rendered via <Outlet />)
├── msme.$userId.dashboard.tsx              # GET /msme/:userId/dashboard
├── msme.$userId.stock.tsx                  # GET /msme/:userId/stock
├── msme.$userId.stock.$itemId.tsx          # GET /msme/:userId/stock/:itemId
├── msme.$userId.bcp.tsx                    # GET /msme/:userId/bcp
├── msme.$userId.alerts.tsx                 # GET /msme/:userId/alerts
├── msme.$userId.alerts.$alertId.tsx        # GET /msme/:userId/alerts/:alertId
├── msme.$userId.chat.tsx                   # GET /msme/:userId/chat (layout)
├── msme.$userId.chat.$groupId.tsx          # GET /msme/:userId/chat/:groupId
├── msme.$userId.risk.tsx                   # GET /msme/:userId/risk
├── msme.$userId.trends.tsx                 # GET /msme/:userId/trends
├── msme.$userId.forecasts.tsx              # GET /msme/:userId/forecasts
├── msme.$userId.settings.tsx               # GET/POST /msme/:userId/settings
│
├── lrdb.$officerId.tsx                     # LRDB layout shell (sidebar, nav)
│   └── (children rendered via <Outlet />)
├── lrdb.$officerId.shops.tsx               # GET /lrdb/:officerId/shops
├── lrdb.$officerId.shops.$shopId.tsx       # GET /lrdb/:officerId/shops/:shopId
├── lrdb.$officerId.queries.tsx             # GET /lrdb/:officerId/queries
├── lrdb.$officerId.queries.$queryId.tsx    # GET /lrdb/:officerId/queries/:queryId
├── lrdb.$officerId.chat.tsx                # GET /lrdb/:officerId/chat (layout)
├── lrdb.$officerId.chat.$groupId.tsx       # GET /lrdb/:officerId/chat/:groupId
├── lrdb.$officerId.reports.tsx             # GET /lrdb/:officerId/reports
├── lrdb.$officerId.reports.$reportId.tsx   # GET /lrdb/:officerId/reports/:reportId
├── lrdb.$officerId.estimation.tsx          # GET /lrdb/:officerId/estimation
├── lrdb.$officerId.alerts.tsx              # GET /lrdb/:officerId/alerts
├── lrdb.$officerId.alerts.$alertId.tsx     # GET /lrdb/:officerId/alerts/:alertId
└── lrdb.$officerId.settings.tsx            # GET/POST /lrdb/:officerId/settings
```

---

## 6. Nested Layout Pattern (Remix Outlet)

Remix uses nested layouts via `<Outlet />`. The layout shell file (e.g. `msme.$userId.tsx`) renders the `<AppShell />` component and an `<Outlet />` where child routes render their content.

### Pattern

```tsx
// app/routes/msme.$userId.tsx  — Layout shell for all MSME pages
import { Outlet } from '@remix-run/react'
import { AppShell } from '~/components/shared/AppShell'
import { json, LoaderFunctionArgs } from '@remix-run/node'
import { requireUser } from '~/lib/auth.server'

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireUser(request)
  // Redirect if user is not MSME role or UUID mismatch
  if (user.role !== 'msme' || user.id !== params.userId) {
    throw redirect('/login')
  }
  return json({ user })
}

export default function MSMEShell() {
  const { user } = useLoaderData<typeof loader>()
  return (
    <AppShell role="msme" userId={user.id}>
      <Outlet />
    </AppShell>
  )
}
```

The child route (e.g. `msme.$userId.dashboard.tsx`) only renders the page content — it inherits the shell automatically.

---

## 7. Loader & Action Pattern

Every route file follows this structure. Data fetching happens in `loader` (GET). Mutations happen in `action` (POST/PUT/DELETE).

### Loader Pattern (data fetching)

```tsx
// app/routes/msme.$userId.stock.tsx
import { json, LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { requireUser } from '~/lib/auth.server'
import { apiClient } from '~/lib/api.server'

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireUser(request)
  // Server-side call to FastAPI or database
  const stock = await apiClient.get(`/stock/${params.userId}`)
  return json({ stock })
}

export default function StockPage() {
  const { stock } = useLoaderData<typeof loader>()
  return <StockManagementView items={stock} />
}
```

### Action Pattern (mutations)

```tsx
// app/routes/msme.$userId.stock.tsx (continued)
import { ActionFunctionArgs, redirect } from '@remix-run/node'
import { stockItemSchema } from '~/lib/schemas/stockItemSchema'

export async function action({ request, params }: ActionFunctionArgs) {
  const formData = await request.formData()
  const raw = Object.fromEntries(formData)

  const parsed = stockItemSchema.safeParse(raw)
  if (!parsed.success) {
    return json({ errors: parsed.error.flatten() }, { status: 400 })
  }

  await apiClient.post(`/stock/${params.userId}`, parsed.data)
  return redirect(`/msme/${params.userId}/stock`)
}
```

### Server-Side FastAPI Client (`app/lib/api.server.ts`)

```ts
// app/lib/api.server.ts
const PYTHON_API_BASE = process.env.PYTHON_API_URL ?? 'http://localhost:8000'

export const apiClient = {
  async get(path: string) {
    const res = await fetch(`${PYTHON_API_BASE}${path}`)
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    return res.json()
  },
  async post(path: string, body: unknown) {
    const res = await fetch(`${PYTHON_API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    return res.json()
  },
}
```

---

## 8. Authentication Architecture

### 8.1 Package Setup

```bash
npm install remix-auth remix-auth-google
```

### 8.2 Session Storage (`app/lib/session.server.ts`)

The session storage instance is created once and shared across all auth utilities.

```ts
// app/lib/session.server.ts
import { createCookieSessionStorage } from '@remix-run/node'

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: '__ds_session',          // ds = DisasterShield
    httpOnly: true,                // Never accessible via JS
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,     // 7-day session
    secrets: [process.env.SESSION_SECRET!],
  },
})

export const { getSession, commitSession, destroySession } = sessionStorage
```

### 8.3 Authenticator Setup (`app/lib/auth.server.ts`)

```ts
// app/lib/auth.server.ts
import { Authenticator } from 'remix-auth'
import { GoogleStrategy } from 'remix-auth-google'
import { sessionStorage } from '~/lib/session.server'
import { v4 as uuidv4 } from 'uuid'

export type SessionUser = {
  id: string              // UUIDv4 — permanent identifier
  role: 'msme' | 'lrdb'
  name: string
  email: string
  avatar?: string
  language: 'en' | 'mr' | 'hi'
}

export const authenticator = new Authenticator<SessionUser>(sessionStorage)

authenticator.use(
  new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL:  process.env.GOOGLE_CALLBACK_URL!,
    },
    async ({ profile }) => {
      // Look up user in DB by Google email
      const existingUser = await db.user.findByEmail(profile.emails[0].value)

      if (existingUser) {
        // Returning user — return their stored profile
        return existingUser as SessionUser
      }

      // New user — generate UUID, store with pending role assignment
      // Role is set during /register profile completion
      const newUser: SessionUser = {
        id:       uuidv4(),
        role:     'msme',           // Default; overridden during /register
        name:     profile.displayName,
        email:    profile.emails[0].value,
        avatar:   profile.photos?.[0]?.value,
        language: 'en',
      }

      await db.user.create(newUser)
      return newUser
    }
  ),
  'google'
)

// Helper: require authenticated user or redirect to /login
export async function requireUser(request: Request): Promise<SessionUser> {
  return authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  })
}

// Helper: require specific role or redirect
export async function requireRole(
  request: Request,
  role: 'msme' | 'lrdb'
): Promise<SessionUser> {
  const user = await requireUser(request)
  if (user.role !== role) throw redirect('/login')
  return user
}
```

### 8.4 Auth Route Files

```ts
// app/routes/login.tsx
import { authenticator } from '~/lib/auth.server'

export async function loader({ request }: LoaderFunctionArgs) {
  // If already logged in, redirect to their dashboard
  return authenticator.isAuthenticated(request, {
    successRedirect: '/',   // root redirects based on role
  })
}

export async function action({ request }: ActionFunctionArgs) {
  return authenticator.authenticate('google', request)
}
```

```ts
// app/routes/auth.callback.tsx
import { authenticator } from '~/lib/auth.server'

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await authenticator.authenticate('google', request, {
    successRedirect: '/register',   // Always go to register to check profile completeness
    failureRedirect: '/login',
  })
  return user
}
```

```ts
// app/routes/logout.tsx
import { authenticator } from '~/lib/auth.server'

export async function action({ request }: ActionFunctionArgs) {
  await authenticator.logout(request, { redirectTo: '/login' })
}
```

### 8.5 Auth Flow — Step by Step

```
1.  User visits /login
      └─ loader checks if already authenticated → redirect to dashboard if yes

2.  User clicks "Sign in with Google"
      └─ action calls authenticator.authenticate('google', request)
      └─ remix-auth-google redirects to Google OAuth consent screen

3.  Google redirects to /auth/callback?code=...
      └─ GoogleStrategy exchanges code for access token
      └─ Fetches Google profile (name, email, avatar)
      └─ Looks up user in DB by email

4a. Returning user found in DB
      └─ Returns existing SessionUser (role + UUID already set)
      └─ Redirects to /register (register checks completeness → redirects to dashboard)

4b. New user — not found in DB
      └─ Generates UUIDv4 server-side
      └─ Creates DB record with default role 'msme'
      └─ Redirects to /register for role selection + business profile setup

5.  /register completion
      └─ action updates user record with: role, shopName, category, language, location
      └─ Redirects to /msme/:userId/dashboard OR /lrdb/:officerId/shops

6.  All subsequent requests
      └─ requireUser(request) validates session cookie on every loader/action
      └─ Layout shell loaders additionally validate role + UUID match in URL params
```

### 8.6 Role + UUID URL Guard (Layout Shell Loaders)

```ts
// app/routes/msme.$userId.tsx — loader
export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireRole(request, 'msme')

  // Prevent accessing another user's data via URL manipulation
  if (user.id !== params.userId) {
    throw redirect(`/msme/${user.id}/dashboard`)
  }

  return json({ user })
}

// app/routes/lrdb.$officerId.tsx — loader
export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireRole(request, 'lrdb')

  if (user.id !== params.officerId) {
    throw redirect(`/lrdb/${user.id}/shops`)
  }

  return json({ user })
}
```

---

## 9. Mail Notification Architecture (SMTP + Nodemailer)

### 9.1 Package Setup

```bash
npm install nodemailer
npm install --save-dev @types/nodemailer
```

### 9.2 SMTP Client (`app/lib/mail.server.ts`)

```ts
// app/lib/mail.server.ts
import nodemailer from 'nodemailer'

// Transporter — configured from .env
// Swap SMTP credentials to switch between Gmail (dev) and production provider
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === 'true',   // true for port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

// Base mail sender
async function sendMail(options: {
  to: string
  subject: string
  html: string
  text: string
}) {
  return transporter.sendMail({
    from: `"DisasterShield Alerts" <${process.env.SMTP_FROM}>`,
    ...options,
  })
}

// ─── Mail Trigger Functions ───────────────────────────────────────────────────

// 1. Disaster alert notification to MSME owner
export async function sendAlertMail(params: {
  to: string
  ownerName: string
  alertTitle: string
  severity: string
  affectedItems: string[]
  actionSummary: string
  alertId: string
  userId: string
}) {
  await sendMail({
    to: params.to,
    subject: `⚠️ DisasterShield Alert: ${params.alertTitle}`,
    text: `Hello ${params.ownerName}, a ${params.severity} alert has been issued for your shop.`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px;">
        <h2 style="color: #1A6B4A;">DisasterShield — Disaster Alert</h2>
        <p>Hello <strong>${params.ownerName}</strong>,</p>
        <p>A <strong>${params.severity.toUpperCase()}</strong> alert has been issued relevant to your shop:</p>
        <h3>${params.alertTitle}</h3>
        <p><strong>Affected stock items:</strong> ${params.affectedItems.join(', ')}</p>
        <p><strong>Recommended action:</strong> ${params.actionSummary}</p>
        <a href="${process.env.APP_URL}/msme/${params.userId}/alerts/${params.alertId}"
           style="background:#1A6B4A;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">
          View Full Alert
        </a>
        <p style="color:#94A3B8;font-size:12px;margin-top:24px;">
          You are receiving this because email alerts are enabled in your DisasterShield settings.
        </p>
      </div>
    `,
  })
}

// 2. BCP plan generated notification
export async function sendBCPMail(params: {
  to: string
  ownerName: string
  userId: string
}) {
  await sendMail({
    to: params.to,
    subject: '📋 Your Business Continuity Plan is Ready — DisasterShield',
    text: `Hello ${params.ownerName}, your personalized Business Continuity Plan has been generated.`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px;">
        <h2 style="color: #1A6B4A;">Your Business Continuity Plan is Ready</h2>
        <p>Hello <strong>${params.ownerName}</strong>,</p>
        <p>Your personalized disaster continuity plan has been generated based on your shop profile and inventory.</p>
        <a href="${process.env.APP_URL}/msme/${params.userId}/bcp"
           style="background:#1A6B4A;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">
          View My Plan
        </a>
      </div>
    `,
  })
}

// 3. Risk score change notification
export async function sendRiskScoreMail(params: {
  to: string
  ownerName: string
  previousScore: number
  newScore: number
  topThreat: string
  userId: string
}) {
  const increased = params.newScore > params.previousScore
  await sendMail({
    to: params.to,
    subject: `${increased ? '🔺' : '🔻'} Your Risk Score has Changed — DisasterShield`,
    text: `Hello ${params.ownerName}, your business risk score changed from ${params.previousScore} to ${params.newScore}.`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px;">
        <h2 style="color: #1A6B4A;">Risk Score Update</h2>
        <p>Hello <strong>${params.ownerName}</strong>,</p>
        <p>Your business risk score has ${increased ? 'increased' : 'decreased'} 
           from <strong>${params.previousScore}</strong> to <strong>${params.newScore}</strong>.</p>
        <p><strong>Top threat identified:</strong> ${params.topThreat}</p>
        <a href="${process.env.APP_URL}/msme/${params.userId}/risk"
           style="background:#1A6B4A;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">
          View Risk Profile
        </a>
      </div>
    `,
  })
}

// 4. LRDB broadcast to all MSMEs in a region
export async function sendBroadcastMail(params: {
  recipients: Array<{ email: string; name: string; userId: string }>
  subject: string
  messageBody: string
  officerName: string
  region: string
}) {
  const promises = params.recipients.map(recipient =>
    sendMail({
      to: recipient.email,
      subject: `📢 ${params.subject} — DisasterShield`,
      text: params.messageBody,
      html: `
        <div style="font-family: sans-serif; max-width: 600px;">
          <h2 style="color: #1A6B4A;">Official Notice — ${params.region}</h2>
          <p>Hello <strong>${recipient.name}</strong>,</p>
          <p>The following notice has been issued by <strong>${params.officerName}</strong>
             from the Local Disaster Resilience Body:</p>
          <blockquote style="border-left:4px solid #1A6B4A;padding-left:16px;color:#475569;">
            ${params.messageBody}
          </blockquote>
          <a href="${process.env.APP_URL}/msme/${recipient.userId}/alerts"
             style="background:#1A6B4A;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">
            View All Alerts
          </a>
        </div>
      `,
    })
  )
  await Promise.allSettled(promises)   // allSettled — don't fail if one recipient fails
}

// 5. Query status update to MSME owner
export async function sendQueryStatusMail(params: {
  to: string
  ownerName: string
  queryType: string
  newStatus: string
  queryId: string
  officerId: string
}) {
  await sendMail({
    to: params.to,
    subject: `🔄 Query Update: ${params.queryType} — DisasterShield`,
    text: `Hello ${params.ownerName}, your query status has been updated to: ${params.newStatus}.`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px;">
        <h2 style="color: #1A6B4A;">Query Status Update</h2>
        <p>Hello <strong>${params.ownerName}</strong>,</p>
        <p>Your support request regarding <strong>${params.queryType}</strong> 
           has been updated to: <strong>${params.newStatus.toUpperCase()}</strong>.</p>
        <a href="${process.env.APP_URL}/msme/${params.ownerName}/queries/${params.queryId}"
           style="background:#1A6B4A;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">
          View Query
        </a>
      </div>
    `,
  })
}
```

### 9.3 How Mail is Triggered from Actions

Mail functions are called inside Remix `action` functions after a successful mutation. The mail call is non-blocking — it uses `await` but failures are caught and logged without breaking the user-facing response.

```ts
// Example: inside app/routes/msme.$userId.alerts.$alertId.tsx action
export async function action({ request, params }: ActionFunctionArgs) {
  const user = await requireUser(request)
  const alert = await apiClient.get(`/alerts/${params.alertId}`)

  // ... process action (mark as read, confirm, etc.)

  // Send email if user has email notifications enabled
  if (user.emailNotificationsEnabled) {
    try {
      await sendAlertMail({
        to:            user.email,
        ownerName:     user.name,
        alertTitle:    alert.title,
        severity:      alert.severity,
        affectedItems: alert.affectedItems,
        actionSummary: alert.actionSummary,
        alertId:       params.alertId,
        userId:        params.userId,
      })
    } catch (err) {
      // Log error but don't fail the action
      console.error('Mail send failed:', err)
    }
  }

  return redirect(`/msme/${params.userId}/alerts`)
}
```

### 9.4 SMTP Environment Variables

Add to `.env` (Node/Remix side):

```env
# SMTP Configuration
SMTP_HOST=smtp.gmail.com             # Gmail for dev; swap for production
SMTP_PORT=587
SMTP_SECURE=false                    # true for port 465 (SSL), false for 587 (TLS)
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password    # Use Gmail App Password, not account password
SMTP_FROM=alerts@disastershield.in

# App base URL (used in mail links)
APP_URL=http://localhost:3000        # Change to production domain when deployed
```

### 9.5 SMTP Provider Reference

| Provider | SMTP Host | Port | Notes |
|---|---|---|---|
| Gmail (dev) | `smtp.gmail.com` | 587 | Requires App Password (2FA must be on) |
| Mailgun | `smtp.mailgun.org` | 587 | Recommended for production |
| SendGrid | `smtp.sendgrid.net` | 587 | Reliable, good deliverability |
| Postmark | `smtp.postmarkapp.com` | 587 | Best for transactional mail |
| Mailtrap (testing) | `sandbox.smtp.mailtrap.io` | 2525 | Use during development to preview emails safely |

> **Recommendation:** Use **Mailtrap** during development (all outgoing mail is caught in a safe inbox — no real emails sent) and **Mailgun** in production.

---

## 9. Environment Variables

### Node / Remix side (`.env` in project root)

```env
SESSION_SECRET=your-session-secret-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/callback

PYTHON_API_URL=http://localhost:8000

STREAM_API_KEY=your-stream-api-key
STREAM_API_SECRET=your-stream-api-secret
```

### Python side (`backend/.env`)

```env
LLM_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-key
OPENAI_API_KEY=your-openai-key

# Same MySQL instance as Remix
DATABASE_URL=mysql+pymysql://root:password@localhost:3306/disastershield

# Meteosource weather API
METEOSOURCE_API_KEY=your-meteosource-key
METEOSOURCE_BASE_URL=https://www.meteosource.com/api/v1

# Location APIs (no keys needed — OSS)
NOMINATIM_BASE_URL=https://nominatim.openstreetmap.org
OVERPASS_BASE_URL=https://overpass-api.de/api/interpreter
OPEN_ELEVATION_BASE_URL=https://api.open-elevation.com/api/v1
OPENTOPODATA_BASE_URL=https://api.opentopodata.org/v1

# Alert generation thresholds
ALERT_RAIN_THRESHOLD_MM=20         # mm/hr triggers flood alert
ALERT_WIND_THRESHOLD_KMPH=40       # kmph triggers wind alert
OVERPASS_SEARCH_RADIUS_METRES=10000
```

---

## 10. Data Flow — End-to-End Example

**Scenario:** MSME owner opens the Alerts page. The app fetches active alerts personalized to their shop.

```
1. Browser navigates to /msme/uuid-123/alerts

2. Remix server runs msme.$userId.alerts.tsx → loader()
   - Calls requireUser() → validates session
   - Calls apiClient.get('/alerts/uuid-123/active')
     → This hits the Remix server's own internal API proxy

3. Remix server makes HTTP POST to FastAPI:
   POST http://localhost:8000/alerts/generate
   Body: { userId: 'uuid-123', shopProfile: {...}, weatherEvent: {...} }

4. FastAPI packages/alerts/service.py:
   - Constructs LLM prompt with shop profile + weather data
   - Calls LLM API (Gemini) → receives structured alert JSON
   - Parses and validates response with Pydantic AlertResponse schema
   - Returns structured alert list to Remix

5. Remix loader returns json({ alerts }) to the route component

6. Browser receives server-rendered HTML with alerts already populated
   (no client-side loading state on first render — SSR advantage)

7. AlertCard components render each alert with SensitivityTag,
   RiskBadge, and action buttons
```

---

## 11. Stream SDK Architecture (Chat, Voice, Video)

Stream requires both a server-side token generator and a client-side provider. The two are kept strictly separate.

### Server Side — Token Generation

```ts
// app/lib/stream.server.ts
import { StreamChat } from 'stream-chat'

const serverClient = StreamChat.getInstance(
  process.env.STREAM_API_KEY!,
  process.env.STREAM_API_SECRET!
)

export async function generateStreamToken(userId: string): Promise<string> {
  return serverClient.createToken(userId)
}
```

The Stream token is generated inside the chat route's `loader` and passed to the client as part of `useLoaderData`. The secret never leaves the server.

### Client Side — Provider Initialization

```tsx
// app/components/shared/StreamClientProvider.tsx
'use client'
import { useEffect, useState } from 'react'
import { StreamChat } from 'stream-chat'
import { Chat } from 'stream-chat-react'
import { ClientOnly } from 'remix-utils/client-only'

export function StreamClientProvider({ apiKey, userId, token, userData, children }) {
  const [client, setClient] = useState<StreamChat | null>(null)

  useEffect(() => {
    const c = StreamChat.getInstance(apiKey)
    c.connectUser(userData, token).then(() => setClient(c))
    return () => { c.disconnectUser() }
  }, [userId])

  if (!client) return <LoadingSkeleton variant="chat" />

  return (
    <ClientOnly fallback={<LoadingSkeleton variant="chat" />}>
      {() => <Chat client={client}>{children}</Chat>}
    </ClientOnly>
  )
}
```

### Channel Naming Conventions (Stream)

Stream channels are identified by type and ID. DisasterShield uses the following naming conventions:

| Channel Purpose | Type | ID Pattern |
|---|---|---|
| MSME local community group | `messaging` | `local-{regionCode}-{groupUUID}` |
| LRDB coordination group | `team` | `lrdb-{districtCode}-{groupUUID}` |
| LRDB ↔ MSME direct message | `messaging` | `dm-{lrdbUUID}-{msmeUUID}` |
| SOS emergency broadcast | `livestream` | `sos-{regionCode}-{timestamp}` |

---

## 12. i18n Architecture

```ts
// app/lib/i18n.ts
export const supportedLanguages = ['en', 'mr', 'hi'] as const
export type Language = typeof supportedLanguages[number]

export const languageNames: Record<Language, string> = {
  en: 'English',
  mr: 'मराठी',
  hi: 'हिंदी',
}
```

Language preference is stored in the user's session and applied to the root `<html>` element's `lang` attribute and `font-family`. The `LanguageSelector` component writes the new preference via a Remix action on `settings.tsx`, which updates the session and triggers a page reload.

Translation files live in `app/locales/{lang}/common.json`. All user-facing strings must use the `t('key')` function from `react-i18next`. No hardcoded English strings in component JSX.

---

## 13. Error Handling

### Route-Level Error Boundaries

Every route file exports an `ErrorBoundary` component. This prevents a single failing route from crashing the entire app.

```tsx
// Pattern used in every route file
export function ErrorBoundary() {
  const error = useRouteError()
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <AlertOctagon className="size-12 text-status-critical" />
      <h2 className="text-h2">Something went wrong</h2>
      <p className="text-text-secondary">
        {isRouteErrorResponse(error) ? error.data : 'An unexpected error occurred.'}
      </p>
      <Button asChild variant="outline">
        <Link to=".">Try again</Link>
      </Button>
    </div>
  )
}
```

### API Error Handling

The `apiClient` in `api.server.ts` throws typed errors. Loaders catch these and either return partial data with an error flag or throw a `Response` with appropriate status codes (404, 500) which Remix routes to the `ErrorBoundary`.

---

## 14. Development Scripts

### Starting the Full Stack Locally

```bash
# Terminal 1 — Remix frontend
npm run dev
# Runs at http://localhost:3000

# Terminal 2 — Python FastAPI backend
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000
# Runs at http://localhost:8000
# FastAPI auto-docs at http://localhost:8000/docs
```

### package.json Scripts

```json
{
  "scripts": {
    "dev":        "remix vite:dev",
    "build":      "remix vite:build",
    "start":      "remix-serve ./build/server/index.js",
    "typecheck":  "tsc",
    "lint":       "eslint --ignore-path .gitignore --cache --cache-location ./node_modules/.cache/eslint ."
  }
}
```

---

## 15. Key Architectural Rules (Non-Negotiable)

1. **No direct browser → FastAPI calls.** All AI/ML API calls go through Remix loaders/actions server-side.
2. **No client-side data fetching with useEffect + fetch.** Use Remix loaders exclusively for initial data. Use `useFetcher` for incremental client-triggered fetches within the same route.
3. **UUIDs are generated server-side only.** Never `uuidv4()` on the client.
4. **Stream SDK is client-only.** Never import Stream SDK modules in loader or action functions.
5. **One layout shell per role.** `msme.$userId.tsx` and `lrdb.$officerId.tsx` are the only files that render `<AppShell />`. Child routes never render their own shell.
6. **No inline styles.** All styling is via Tailwind utility classes or shadcn component variants.
7. **All forms use Remix `<Form />` component,** not HTML `<form>`. This enables progressive enhancement and optimistic UI.
8. **Every route exports an `ErrorBoundary`.** No exceptions.
9. **All reusable components live in `app/components/shared/`.** Page-specific one-off components may live co-located in the route file only if they are never reused.
14. **Prisma client is always imported from `~/lib/db.server.ts`**, never instantiated directly in a route file. See `DATABASE.md` for the singleton pattern required in Remix's dev server hot-reload environment.
15. **All database writes that trigger notifications must also call the relevant `mail.server.ts` function** in the same action, wrapped in try/catch so mail failure never blocks the DB write.
