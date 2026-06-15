# DisasterShield — Environment Setup

This project has two processes: a **Remix/Node.js** frontend+SSR and a **Python FastAPI** backend.
Each needs its own `.env` file.

---

## 1. Remix App — `/.env` (project root)

Create `/home/adi/projects/finalYearProj/disasterShield/.env`:

```env
# ── Database ─────────────────────────────────────────────────────────────────
# Prisma connects to MySQL. Format: mysql://user:password@host:port/dbname
DATABASE_URL=mysql://root:password@localhost:3306/disastershield

# ── Session ──────────────────────────────────────────────────────────────────
# Any long random string. Generate with: openssl rand -hex 32
SESSION_SECRET=replace-with-a-long-random-secret

# ── Google OAuth ─────────────────────────────────────────────────────────────
# Create credentials at: https://console.cloud.google.com → APIs → Credentials
# Authorised redirect URI must include the callback URL below.
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/callback

# ── Python Backend ───────────────────────────────────────────────────────────
# Where Remix server-side code calls the FastAPI backend.
PYTHON_API_URL=http://localhost:8000

# ── GetStream.io Chat & Video ────────────────────────────────────────────────
# Sign up at https://getstream.io, create an app, then copy the key + secret.
STREAM_API_KEY=your-stream-api-key
STREAM_API_SECRET=your-stream-api-secret

# ── SMTP Email ───────────────────────────────────────────────────────────────
# Alert and BCP emails are sent via SMTP.
# For Gmail, use an App Password (not your account password):
#   Account → Security → 2FA enabled → App passwords
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
SMTP_FROM=alerts@disastershield.in

# ── App Base URL ─────────────────────────────────────────────────────────────
# Used in email links. Change to your domain in production.
APP_URL=http://localhost:3000
```

### Required vs Optional

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | **Yes** | MySQL must be running before app starts |
| `SESSION_SECRET` | **Yes** | Any 32+ character random string |
| `GOOGLE_CLIENT_ID` | **Yes** | App uses Google OAuth exclusively |
| `GOOGLE_CLIENT_SECRET` | **Yes** | |
| `GOOGLE_CALLBACK_URL` | **Yes** | Must match the URI registered in GCP Console |
| `PYTHON_API_URL` | **Yes** | Without this, AI features (alerts, BCP, risk) fail |
| `STREAM_API_KEY` | **Yes** | Chat and video call pages will not load |
| `STREAM_API_SECRET` | **Yes** | Used server-side to sign user tokens |
| `SMTP_*` | Optional | Email notifications are silently skipped if SMTP fails |
| `APP_URL` | Optional | Defaults to localhost; used only inside email links |

---

## 2. Python Backend — `/backend/.env`

Create `/home/adi/projects/finalYearProj/disasterShield/backend/.env`:

```env
# ── FastAPI Server ────────────────────────────────────────────────────────────
ENVIRONMENT=development
DEBUG=true
API_HOST=0.0.0.0
API_PORT=8000
LOG_LEVEL=INFO
LOG_FORMAT=json

# ── CORS ─────────────────────────────────────────────────────────────────────
# Comma-separated list of allowed origins. Remix dev runs on 5173 or 3000.
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# ── Database ─────────────────────────────────────────────────────────────────
# Same MySQL instance as Remix, but using the PyMySQL driver prefix.
# Format: mysql+pymysql://user:password@host:port/dbname
DATABASE_URL=mysql+pymysql://root:password@localhost:3306/disastershield

# ── LLM Provider ─────────────────────────────────────────────────────────────
# Choose "google" (Gemini) or "openai". Only the selected provider needs a key.
LLM_PROVIDER=google

# Google Gemini — https://aistudio.google.com/apikey
GOOGLE_API_KEY=your-gemini-api-key
GOOGLE_MODEL_NAME=gemini-1.5-pro

# OpenAI (alternative) — https://platform.openai.com/api-keys
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL_NAME=gpt-4-turbo

# ── Weather API ───────────────────────────────────────────────────────────────
# Required for weather-based alert generation.
# Sign up at https://www.meteosource.com (free tier available).
METEOSOURCE_API_KEY=your-meteosource-api-key
METEOSOURCE_BASE_URL=https://www.meteosource.com/api/v1

# ── Open-Source Geocoding APIs (no keys required) ────────────────────────────
# These are used during shop registration to enrich location profiles.
NOMINATIM_BASE_URL=https://nominatim.openstreetmap.org
NOMINATIM_USER_AGENT=DisasterShield/1.0
OPEN_ELEVATION_BASE_URL=https://api.open-elevation.com/api/v1
OPENTOPODATA_BASE_URL=https://api.opentopodata.org/v1
OVERPASS_BASE_URL=https://overpass-api.de/api/interpreter

# ── Alert Thresholds ──────────────────────────────────────────────────────────
ALERT_RAIN_THRESHOLD_MM=20.0
ALERT_WIND_THRESHOLD_KMPH=40.0
OVERPASS_SEARCH_RADIUS_METRES=10000

# ── Scheduler ─────────────────────────────────────────────────────────────────
SCHEDULER_TIMEZONE=Asia/Kolkata
ALERT_BATCH_INTERVAL_HOURS=1
LOCATION_REFRESH_INTERVAL_DAYS=30

# ── Security ──────────────────────────────────────────────────────────────────
# Internal API signing key. Any random string.
API_KEY_SECRET=replace-with-a-random-secret
```

### Required vs Optional

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | **Yes** | Must point to the same DB as Remix |
| `LLM_PROVIDER` | **Yes** | `google` or `openai` |
| `GOOGLE_API_KEY` | **Yes** (if `LLM_PROVIDER=google`) | Gemini key for alert/BCP/risk generation |
| `OPENAI_API_KEY` | **Yes** (if `LLM_PROVIDER=openai`) | |
| `METEOSOURCE_API_KEY` | **Yes** | Without this, weather-based alerts cannot run |
| `API_KEY_SECRET` | **Yes** | Change from default before deploying |
| Nominatim / Overpass / Elevation URLs | No | Defaults are correct; override only if self-hosting |
| Threshold / scheduler values | No | Sensible defaults are set |
| `SMTP_*` | No | (Only the backend `.env.example` mentions these; email is handled by the Remix side) |

---

## 3. MySQL Database

The app uses MySQL 8+. You need a running instance and a database created before first run.

```sql
CREATE DATABASE disastershield CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Prisma will create all tables automatically on first run (via `prisma migrate deploy` or `prisma db push`).

The `DATABASE_URL` format differs between the two sides:

| Side | Driver prefix | Example |
|---|---|---|
| Remix / Prisma | `mysql://` | `mysql://root:pass@localhost:3306/disastershield` |
| Python / SQLAlchemy | `mysql+pymysql://` | `mysql+pymysql://root:pass@localhost:3306/disastershield` |

---

## 4. External Service Accounts Summary

| Service | Where to sign up | Used for |
|---|---|---|
| **Google Cloud (OAuth)** | console.cloud.google.com | Login — create OAuth 2.0 credentials, enable Google+ API |
| **Google AI Studio (Gemini)** | aistudio.google.com | LLM for alert/BCP/risk text generation |
| **GetStream.io** | getstream.io | Real-time chat and video calls |
| **Meteosource** | meteosource.com | Live weather data for alert batch jobs |
| **SMTP provider** | Any (Gmail recommended) | Outbound email notifications |
| Nominatim / Overpass / Open-Elevation | None | Free OSM APIs — no account needed |
