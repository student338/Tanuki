#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Tanuki Stories – Update Script
# Updates an existing install: pulls latest code, refreshes dependencies,
# and optionally rebuilds for production.
# Usage:  bash update.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

log()  { echo -e "${CYAN}[Tanuki]${RESET} $*"; }
ok()   { echo -e "${GREEN}  ✓${RESET} $*"; }
warn() { echo -e "${YELLOW}  ⚠${RESET}  $*"; }
err()  { echo -e "${RED}  ✗${RESET}  $*" >&2; }
die()  { err "$*"; exit 1; }
hr()   { echo -e "${CYAN}──────────────────────────────────────────────────────${RESET}"; }

ask() {
  local var="$1" prompt="$2" default="${3:-}"
  local full_prompt value
  if [[ -n "$default" ]]; then
    full_prompt="${BOLD}${prompt}${RESET} ${YELLOW}[${default}]${RESET}: "
  else
    full_prompt="${BOLD}${prompt}${RESET}: "
  fi
  read -rp "$(echo -e "$full_prompt")" value </dev/tty
  if [[ -z "$value" && -n "$default" ]]; then
    value="$default"
  fi
  printf -v "$var" '%s' "$value"
}

# ── Banner ────────────────────────────────────────────────────────────────────
print_banner() {
  echo -e "${BOLD}${CYAN}"
  cat << 'BANNER'
  ████████╗ █████╗ ███╗   ██╗██╗   ██╗██╗  ██╗██╗
     ██╔══╝██╔══██╗████╗  ██║██║   ██║██║ ██╔╝██║
     ██║   ███████║██╔██╗ ██║██║   ██║█████╔╝ ██║
     ██║   ██╔══██║██║╚██╗██║██║   ██║██╔═██╗ ██║
     ██║   ██║  ██║██║ ╚████║╚██████╔╝██║  ██╗██║
     ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝  ╚═╝╚═╝
BANNER
  echo -e "${RESET}"
  echo -e "${BOLD}  Tanuki Stories — Update Script${RESET}"
  hr
  echo
}

# ── Prereq checks ─────────────────────────────────────────────────────────────
check_prereqs() {
  log "Checking prerequisites..."
  echo

  command -v node &>/dev/null || die "Node.js is required. Install it from https://nodejs.org"
  ok "node found ($(command -v node))"

  command -v npm &>/dev/null  || die "npm is required. It is bundled with Node.js."
  ok "npm found ($(command -v npm))"

  local node_ver
  node_ver=$(node -e "process.stdout.write(process.versions.node)")
  local node_major="${node_ver%%.*}"
  if (( node_major < 18 )); then
    die "Node.js 18+ is required (found v${node_ver}). Please upgrade."
  fi
  ok "Node.js v${node_ver}"
  echo
}

# ── git pull ──────────────────────────────────────────────────────────────────
pull_latest() {
  if ! command -v git &>/dev/null; then
    warn "git not found — skipping source update."
    echo
    return
  fi

  if [[ ! -d .git ]]; then
    warn "Not a git repository — skipping source update."
    echo
    return
  fi

  log "Pulling latest changes from remote..."
  local before after
  before=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
  git pull
  after=$(git rev-parse HEAD 2>/dev/null || echo "unknown")

  if [[ "$before" == "$after" ]]; then
    ok "Already up to date (${after:0:8})"
  else
    ok "Updated ${before:0:8} → ${after:0:8}"
  fi
  echo
}

# ── npm install ───────────────────────────────────────────────────────────────
run_npm_install() {
  log "Updating Node.js dependencies..."
  npm install
  ok "npm install complete"
  echo
}

# ── Optional production build ─────────────────────────────────────────────────
maybe_build() {
  local choice
  ask choice "Run production build now? (npm run build)" "n"
  if [[ "$choice" =~ ^[Yy] ]]; then
    log "Building for production..."
    npm run build
    ok "Build complete"
  else
    ok "Skipping build — run 'npm run build' manually when ready."
  fi
  echo
}

# ── Summary ───────────────────────────────────────────────────────────────────
print_summary() {
  hr
  echo -e "\n${BOLD}${GREEN}  Update complete!${RESET}\n"
  echo -e "${BOLD}  Start Tanuki Stories:${RESET}"
  echo -e "    ${YELLOW}npm run dev${RESET}                  (development)"
  echo -e "    ${YELLOW}npm run build && npm start${RESET}   (production)"
  echo
  echo -e "  ${CYAN}Open:${RESET} http://localhost:3000"
  echo
  hr
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
  print_banner

  # Verify existing install
  if [[ ! -f .env.local ]]; then
    warn ".env.local not found — have you run install.sh yet?"
    warn "Your configuration will not be changed by this script."
    echo
  fi

  check_prereqs
  pull_latest
  run_npm_install
  hr
  maybe_build
  print_summary
}

main "$@"
