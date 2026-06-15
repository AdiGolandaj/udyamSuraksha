#!/usr/bin/env bash
# DisasterShield — Development Run Script
# Starts the MySQL-backed Remix frontend and the Python FastAPI backend together.
# Press Ctrl+C to stop both processes.

set -euo pipefail

# ── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
ENV_FILE="$SCRIPT_DIR/.env"
BACKEND_ENV_FILE="$BACKEND_DIR/.env"

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[info]${NC}  $*"; }
ok()    { echo -e "${GREEN}[ok]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $*"; }
die()   { echo -e "${RED}[error]${NC} $*" >&2; exit 1; }

# ── .env checks ───────────────────────────────────────────────────────────────
if [[ ! -f "$ENV_FILE" ]]; then
  die ".env not found at $ENV_FILE\n       Copy .env.example to .env and fill in your values.\n       See ENV_SETUP.md for guidance."
fi

if [[ ! -f "$BACKEND_ENV_FILE" ]]; then
  warn "backend/.env not found — Python backend will use defaults or fail on missing keys."
  warn "See ENV_SETUP.md section 2 for the full list of required backend variables."
fi

# Load root .env for this shell (Remix/Prisma vars)
set -o allexport
# shellcheck disable=SC1090
source "$ENV_FILE"
set +o allexport

# ── Dependency checks ─────────────────────────────────────────────────────────
command -v node  &>/dev/null || die "node is not installed or not on PATH."
command -v npm   &>/dev/null || die "npm is not installed or not on PATH."
command -v python3 &>/dev/null || die "python3 is not installed or not on PATH."

NODE_VER=$(node --version | sed 's/v//')
NODE_MAJOR="${NODE_VER%%.*}"
if (( NODE_MAJOR < 18 )); then
  die "Node.js 18+ is required (found v${NODE_VER})."
fi

# ── Node dependencies ─────────────────────────────────────────────────────────
if [[ ! -d "$SCRIPT_DIR/node_modules" ]]; then
  info "node_modules not found — running npm install..."
  npm install --prefix "$SCRIPT_DIR"
fi

# ── Prisma client & migrations ────────────────────────────────────────────────
info "Generating Prisma client..."
npx --prefix "$SCRIPT_DIR" prisma generate

info "Pushing database schema (prisma db push)..."
info "  → If this fails, ensure MySQL is running and DATABASE_URL is correct."
npx --prefix "$SCRIPT_DIR" prisma db push --skip-generate || {
  warn "prisma db push failed. The app may still start if the schema is already current."
}

# ── Python virtual environment ────────────────────────────────────────────────
VENV_DIR="$BACKEND_DIR/.venv"

if [[ ! -d "$VENV_DIR" ]]; then
  info "Creating Python virtual environment at backend/.venv ..."
  python3 -m venv "$VENV_DIR"
fi

PYTHON="$VENV_DIR/bin/python"
PIP="$VENV_DIR/bin/pip"

info "Installing / verifying Python dependencies..."
"$PIP" install --quiet -r "$BACKEND_DIR/requirements.txt"

# ── Process management ────────────────────────────────────────────────────────
BACKEND_PID=""
REMIX_PID=""

cleanup() {
  echo ""
  info "Shutting down..."
  [[ -n "$BACKEND_PID" ]] && kill "$BACKEND_PID" 2>/dev/null && info "Python backend stopped (PID $BACKEND_PID)"
  [[ -n "$REMIX_PID"   ]] && kill "$REMIX_PID"   2>/dev/null && info "Remix dev server stopped (PID $REMIX_PID)"
  wait 2>/dev/null
  ok "All processes stopped."
  exit 0
}
trap cleanup SIGINT SIGTERM

# ── Start Python backend ──────────────────────────────────────────────────────
BACKEND_PORT="${API_PORT:-8000}"
BACKEND_HOST="${API_HOST:-127.0.0.1}"

info "Starting Python FastAPI backend on ${BACKEND_HOST}:${BACKEND_PORT}..."
(
  cd "$BACKEND_DIR"
  "$VENV_DIR/bin/uvicorn" main:app \
    --host "$BACKEND_HOST" \
    --port "$BACKEND_PORT" \
    --reload \
    --log-level "${LOG_LEVEL:-info}" \
    2>&1 | sed 's/^/[python] /'
) &
BACKEND_PID=$!

# Brief pause to let FastAPI boot before Remix starts making internal calls
sleep 2

# Check the backend actually came up
if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
  die "Python backend failed to start. Check the output above."
fi
ok "Python backend started (PID $BACKEND_PID)"

# ── Start Remix dev server ────────────────────────────────────────────────────
REMIX_PORT="${PORT:-3000}"

info "Starting Remix dev server on port ${REMIX_PORT}..."
(
  cd "$SCRIPT_DIR"
  PORT="$REMIX_PORT" npm run dev 2>&1 | sed 's/^/[remix]  /'
) &
REMIX_PID=$!

ok "Remix dev server started (PID $REMIX_PID)"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  DisasterShield is running${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  Frontend : ${CYAN}http://localhost:${REMIX_PORT}${NC}"
echo -e "  API docs : ${CYAN}http://localhost:${BACKEND_PORT}/docs${NC}"
echo ""
echo -e "  Press ${YELLOW}Ctrl+C${NC} to stop all services."
echo ""

# Wait for either process to exit unexpectedly
wait -n 2>/dev/null || wait
echo ""
warn "A process exited unexpectedly. Shutting down the other."
cleanup
