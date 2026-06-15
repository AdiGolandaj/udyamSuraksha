# DisasterShield

DisasterShield is a bilingual disaster resilience platform for MSME owners and LRDB officers. The repository contains a Remix app for the web experience and a Python FastAPI backend for AI, risk scoring, and support services.

## What You Need

- Node.js 20 or newer
- npm
- Python 3.11+ with `python3` and `pip`
- MySQL 8+
- Google Cloud OAuth credentials
- Stream API credentials
- Optional but recommended: a Gmail account or SMTP provider for notifications

## Project Structure

- `app/` - Remix frontend, routes, loaders, actions, and shared UI
- `backend/` - FastAPI backend and AI/ML services
- `prisma/` - Prisma schema, migrations, and seed scripts
- `public/` - Static assets
- `docs/` - Design, architecture, and module documentation
- `run.sh` - Convenience script that starts the full stack locally

## 1. Clone and Install

```bash
git clone <repo-url>
cd disasterShield
npm install
```

The backend dependencies are installed separately inside a virtual environment in the next steps.

## 2. Create Environment Files

Copy the example files and fill in your values:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

### Root `.env`

The root `.env` is used by Remix, Prisma, authentication, and Stream integration. At minimum, make sure these are set:

- `DATABASE_URL`
- `SESSION_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`
- `PYTHON_API_URL`
- `STREAM_API_KEY`
- `STREAM_API_SECRET`

### `backend/.env`

The backend `.env` configures the FastAPI service. At minimum, make sure these are set:

- `DATABASE_URL`
- `LLM_PROVIDER`
- `GOOGLE_API_KEY` or `OPENAI_API_KEY`, depending on the selected provider
- `METEOSOURCE_API_KEY`
- `API_KEY_SECRET`

If you want the app to send email alerts, also fill in the SMTP settings in the root `.env`.

## 3. Create the Database

Create the MySQL database if it does not already exist:

```sql
CREATE DATABASE disastershield CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Use these connection string formats:

- Remix / Prisma: `mysql://user:password@host:port/disastershield`
- Python backend: `mysql+pymysql://user:password@host:port/disastershield`

## 4. Prepare the Backend Environment

Create and populate the Python virtual environment:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..
```

## 5. Set Up Prisma

Generate the Prisma client and apply the schema to your database:

```bash
npx prisma generate
npx prisma db push
```

If you have seed data to load, run:

```bash
npx prisma db seed
```

## 6. Run the Application

### Option A: Start Everything Together

Use the provided script to start both services:

```bash
./run.sh
```

This script will:

- Verify that `.env` exists at the root
- Create `backend/.venv` if needed
- Install backend Python dependencies
- Run `prisma generate` and `prisma db push`
- Start the FastAPI backend on `http://localhost:8000`
- Start the Remix app on `http://localhost:3000`

### Option B: Run Manually in Two Terminals

Terminal 1 - backend:

```bash
cd backend
source .venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Terminal 2 - Remix app:

```bash
npm run dev
```

## 7. Useful Commands

- `npm run dev` - Start the Remix development server
- `npm run build` - Build the Remix app for production
- `npm start` - Run the built Remix server
- `npm run typecheck` - Run TypeScript checks
- `npm run lint` - Run ESLint using the root `.gitignore`

## 8. Access Points

- Frontend: `http://localhost:3000`
- Backend health check: `http://localhost:8000/health`
- Backend API docs: `http://localhost:8000/docs`

## Troubleshooting

- If the app fails to start, verify that MySQL is running and `DATABASE_URL` is correct in both `.env` files.
- If login fails, confirm that the Google OAuth redirect URI matches `GOOGLE_CALLBACK_URL`.
- If chat or video features fail, confirm that the Stream API key and secret are present in the root `.env`.
- If weather, alerts, or AI features fail, confirm that `backend/.env` has the required API keys and that `PYTHON_API_URL` points to the backend.
- If `run.sh` complains about missing tools, confirm that `node`, `npm`, `python3`, and `pip` are available on your PATH.

## Documentation

- `ENV_SETUP.md` - Full environment variable reference
- `docs/project_overview.md` - Product and architecture overview
- `docs/architecture.md` - System architecture details
- `docs/msme_module_md.md` - MSME module details
- `docs/lrdb_module_md.md` - LRDB module details

## Notes

- Root `.env` and `backend/.env` are intentionally excluded from version control.
- The repository includes `.env.example` files at the root and in `backend/` for onboarding.
- The backend uses `backend/.venv` as its local virtual environment.