#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Tanuki Stories – Interactive Installer
# Supports: vLLM, llama.cpp (local), external OpenAI-compatible API, mock mode
# Usage:  bash install.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'
CYAN='\033[0;36m'; MAGENTA='\033[0;35m'; BOLD='\033[1m'; RESET='\033[0m'

log()  { echo -e "${CYAN}[Tanuki]${RESET} $*"; }
ok()   { echo -e "${GREEN}  ✓${RESET} $*"; }
warn() { echo -e "${YELLOW}  ⚠${RESET}  $*"; }
err()  { echo -e "${RED}  ✗${RESET}  $*" >&2; }
die()  { err "$*"; exit 1; }
hr()   { echo -e "${CYAN}──────────────────────────────────────────────────────${RESET}"; }

ask() {
  # ask <var_name> <prompt> [default]
  # Always reads from /dev/tty so that piped stdin (e.g. npm install) doesn't
  # consume the user's keystrokes.
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

ask_secret() {
  # ask_secret <var_name> <prompt>
  local var="$1" prompt="$2" value
  read -rsp "$(echo -e "${BOLD}${prompt}${RESET}: ")" value </dev/tty
  echo
  printf -v "$var" '%s' "$value"
}

pick_menu() {
  # pick_menu <var_name> <title> item1 item2 ...
  local var="$1" title="$2"; shift 2
  local items=("$@")
  echo -e "\n${BOLD}${title}${RESET}"
  for i in "${!items[@]}"; do
    echo -e "  ${CYAN}$((i+1))${RESET}) ${items[$i]}"
  done
  local choice
  while true; do
    ask choice "Enter number" "1"
    if [[ "$choice" =~ ^[0-9]+$ ]] && (( choice >= 1 && choice <= ${#items[@]} )); then
      printf -v "$var" '%s' "$((choice-1))"
      return
    fi
    warn "Please enter a number between 1 and ${#items[@]}"
  done
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
  echo -e "${BOLD}  Tanuki Stories — Interactive Installer${RESET}"
  hr
  echo
}

# ── Prereq checks ─────────────────────────────────────────────────────────────
check_command() {
  if command -v "$1" &>/dev/null; then
    ok "$1 found ($(command -v "$1"))"
    return 0
  else
    return 1
  fi
}

check_prereqs() {
  log "Checking prerequisites..."
  echo

  check_command node   || die "Node.js is required. Install it from https://nodejs.org"
  check_command npm    || die "npm is required. It is bundled with Node.js."
  check_command curl   || warn "curl not found — model downloads will be skipped."

  local node_ver
  node_ver=$(node -e "process.stdout.write(process.versions.node)")
  local node_major="${node_ver%%.*}"
  if (( node_major < 18 )); then
    die "Node.js 18+ is required (found v${node_ver}). Please upgrade."
  fi
  ok "Node.js v${node_ver}"
  echo
}

check_python() {
  if command -v python3 &>/dev/null; then
    ok "python3 found"
    PY_CMD="python3"
  elif command -v python &>/dev/null; then
    PY_CMD="python"
    local pyver
    pyver=$($PY_CMD --version 2>&1 | awk '{print $2}')
    if [[ "${pyver%%.*}" -lt 3 ]]; then
      die "Python 3 is required for local AI backends."
    fi
    ok "python found ($pyver)"
  else
    die "Python 3 is required for local AI backends. Install it from https://python.org"
  fi

  if $PY_CMD -m pip --version &>/dev/null; then
    ok "pip found"
    PIP_CMD="$PY_CMD -m pip"
  else
    die "pip not found. Run: ${PY_CMD} -m ensurepip"
  fi
}

# ── npm install ───────────────────────────────────────────────────────────────
run_npm_install() {
  log "Installing Node.js dependencies..."
  npm install
  ok "npm install complete"
  echo
}

# ── vLLM ─────────────────────────────────────────────────────────────────────
VLLM_MODELS=(
  "meta-llama/Llama-3.2-3B-Instruct   (small, fast — ~6 GB VRAM)"
  "meta-llama/Meta-Llama-3.1-8B-Instruct  (balanced — ~16 GB VRAM)"
  "mistralai/Mistral-7B-Instruct-v0.3  (versatile — ~14 GB VRAM)"
  "Qwen/Qwen2.5-7B-Instruct            (multilingual — ~14 GB VRAM)"
  "microsoft/Phi-3-mini-4k-instruct    (very small — ~8 GB VRAM)"
  "Custom model (enter HuggingFace ID)"
)
VLLM_MODEL_IDS=(
  "meta-llama/Llama-3.2-3B-Instruct"
  "meta-llama/Meta-Llama-3.1-8B-Instruct"
  "mistralai/Mistral-7B-Instruct-v0.3"
  "Qwen/Qwen2.5-7B-Instruct"
  "microsoft/Phi-3-mini-4k-instruct"
  ""
)

install_vllm() {
  log "Installing vLLM..."
  warn "vLLM requires an NVIDIA GPU with CUDA. CPU inference is not supported."
  echo

  $PIP_CMD install --upgrade vllm
  ok "vLLM installed"
  echo

  pick_menu idx "Choose a model for vLLM:" "${VLLM_MODELS[@]}"
  local model_id="${VLLM_MODEL_IDS[$idx]}"
  if [[ -z "$model_id" ]]; then
    ask model_id "Enter HuggingFace model ID (e.g. org/model-name)"
  fi

  local port
  ask port "vLLM server port" "8000"

  local hf_token=""
  warn "Some models (e.g. Llama) require a HuggingFace token."
  ask hf_token "HuggingFace token (leave blank to skip)"

  BACKEND_URL="http://localhost:${port}/v1"
  BACKEND_MODEL="$model_id"
  BACKEND_API_KEY="EMPTY"

  # Generate start-vllm.sh
  cat > start-vllm.sh << EOF
#!/usr/bin/env bash
# Auto-generated by Tanuki installer — start the vLLM server
set -euo pipefail

MODEL="${model_id}"
PORT="${port}"
${hf_token:+HUGGING_FACE_HUB_TOKEN="${hf_token}"}

echo "Starting vLLM server for \${MODEL} on port \${PORT}..."
python3 -m vllm.entrypoints.openai.api_server \\
  --model "\${MODEL}" \\
  --port "\${PORT}" \\
  --trust-remote-code
EOF
  chmod +x start-vllm.sh
  ok "Generated start-vllm.sh"
  echo
}

# ── llama.cpp ─────────────────────────────────────────────────────────────────
LLAMA_MODELS=(
  "Llama-3.2-3B-Instruct Q4_K_M  (~2 GB)"
  "Mistral-7B-Instruct-v0.2 Q4_K_M (~4 GB)"
  "Phi-3-mini-4k-instruct Q4_K_M  (~2.2 GB)"
  "Custom GGUF (enter HuggingFace repo, URL, or local path)"
)
LLAMA_GGUF_URLS=(
  "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf"
  "https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF/resolve/main/mistral-7b-instruct-v0.2.Q4_K_M.gguf"
  "https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf"
  ""
)
LLAMA_GGUF_FILES=(
  "Llama-3.2-3B-Instruct-Q4_K_M.gguf"
  "mistral-7b-instruct-v0.2.Q4_K_M.gguf"
  "Phi-3-mini-4k-instruct-q4.gguf"
  ""
)
LLAMA_MODEL_NAMES=(
  "llama-3.2-3b"
  "mistral-7b"
  "phi-3-mini"
  "custom"
)

install_llamacpp() {
  log "Installing llama.cpp Python server..."
  echo

  echo -e "${BOLD}Installation method:${RESET}"
  echo -e "  ${CYAN}1${RESET}) pip install llama-cpp-python[server]  (recommended, includes HTTP server)"
  echo -e "  ${CYAN}2${RESET}) I already have llama-cpp-python installed"
  local inst_choice
  ask inst_choice "Enter number" "1"

  if [[ "$inst_choice" == "1" ]]; then
    echo
    echo -e "${BOLD}Hardware target:${RESET}"
    echo -e "  ${CYAN}1${RESET}) CPU only    (pre-built wheel, no compiler needed)"
    echo -e "  ${CYAN}2${RESET}) NVIDIA GPU  (requires gcc/clang + CUDA Toolkit)"
    echo -e "  ${CYAN}3${RESET}) Apple Metal (requires Xcode command-line tools)"
    local hw_choice
    ask hw_choice "Enter number" "1"

    if [[ "$hw_choice" == "1" ]]; then
      log "Installing CPU-only pre-built wheel..."
      $PIP_CMD install --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu 'llama-cpp-python[server]'
    elif [[ "$hw_choice" == "2" ]]; then
      warn "CUDA Toolkit must be installed. Setting CMAKE_ARGS for NVIDIA GPU..."
      CMAKE_ARGS="-DGGML_CUDA=on" $PIP_CMD install 'llama-cpp-python[server]'
    elif [[ "$hw_choice" == "3" ]]; then
      warn "Xcode command-line tools must be installed. Setting CMAKE_ARGS for Metal..."
      CMAKE_ARGS="-DGGML_METAL=on" $PIP_CMD install 'llama-cpp-python[server]'
    else
      warn "Unknown choice; falling back to default install..."
      $PIP_CMD install 'llama-cpp-python[server]'
    fi
    ok "llama-cpp-python installed"
  else
    ok "Skipping install — using existing llama-cpp-python"
  fi
  echo

  pick_menu idx "Choose a model:" "${LLAMA_MODELS[@]}"
  local gguf_url="${LLAMA_GGUF_URLS[$idx]}"
  local gguf_file="${LLAMA_GGUF_FILES[$idx]}"
  local model_name="${LLAMA_MODEL_NAMES[$idx]}"

  if [[ -z "$gguf_url" ]]; then
    ask gguf_url "Enter GGUF download URL, HuggingFace repo (owner/model), or local path"
    # Detect a HuggingFace repo ID: matches owner/model, not a URL, not an
    # absolute/relative path, and does not end with .gguf (which would be a
    # local GGUF filename). Dots are excluded from the pattern to prevent any
    # path-traversal sequences and because HF repo IDs use alphanumerics,
    # underscores, and hyphens only.
    if [[ ! "$gguf_url" == http* ]] && \
       [[ ! "$gguf_url" == /* ]]   && \
       [[ ! "$gguf_url" == ./* ]]  && \
       [[ ! "$gguf_url" == *.gguf ]] && \
       [[ "$gguf_url" =~ ^[A-Za-z0-9_-]+/[A-Za-z0-9_-]+$ ]]; then
      local hf_repo="$gguf_url"
      local hf_file
      ask hf_file "Enter the GGUF filename within ${hf_repo} (e.g. model-Q4_K_M.gguf)"
      gguf_url="https://huggingface.co/${hf_repo}/resolve/main/${hf_file}"
      gguf_file="$hf_file"
    elif [[ "$gguf_url" == http* ]]; then
      gguf_file="${gguf_url##*/}"
    else
      gguf_file="$gguf_url"
    fi
    model_name="custom"
  fi

  local models_dir="models"
  mkdir -p "$models_dir"

  # Download if URL
  if [[ "$gguf_url" == http* ]]; then
    local dest="${models_dir}/${gguf_file}"
    if [[ -f "$dest" ]]; then
      ok "Model already downloaded: ${dest}"
    elif command -v curl &>/dev/null; then
      log "Downloading ${gguf_file} (this may take a while)..."
      curl -L --progress-bar -o "$dest" "$gguf_url"
      ok "Downloaded to ${dest}"
    else
      warn "curl not available — please manually download:"
      warn "  ${gguf_url}"
      warn "  → ${dest}"
    fi
    gguf_file="$dest"
  fi

  local port
  ask port "llama.cpp server port" "8080"

  local ctx_size
  ask ctx_size "Context window size (tokens)" "4096"

  BACKEND_URL="http://localhost:${port}/v1"
  BACKEND_MODEL="$model_name"
  BACKEND_API_KEY="EMPTY"

  # Generate start-llamacpp.sh
  cat > start-llamacpp.sh << EOF
#!/usr/bin/env bash
# Auto-generated by Tanuki installer — start the llama.cpp server
set -euo pipefail

MODEL_PATH="${gguf_file}"
PORT="${port}"
CTX="${ctx_size}"

echo "Starting llama.cpp server on port \${PORT}..."
python3 -m llama_cpp.server \\
  --model "\${MODEL_PATH}" \\
  --port "\${PORT}" \\
  --n_ctx "\${CTX}"
EOF
  chmod +x start-llamacpp.sh
  ok "Generated start-llamacpp.sh"
  echo
}

# ── External API ──────────────────────────────────────────────────────────────
configure_external_api() {
  echo
  EXTERNAL_API_PRESETS=(
    "OpenAI  (https://api.openai.com/v1)"
    "Ollama  (http://localhost:11434/v1)"
    "LM Studio  (http://localhost:1234/v1)"
    "Together AI  (https://api.together.xyz/v1)"
    "Groq  (https://api.groq.com/openai/v1)"
    "Custom URL"
  )
  EXTERNAL_API_URLS=(
    ""
    "http://localhost:11434/v1"
    "http://localhost:1234/v1"
    "https://api.together.xyz/v1"
    "https://api.groq.com/openai/v1"
    ""
  )

  pick_menu idx "Choose API provider:" "${EXTERNAL_API_PRESETS[@]}"
  local base_url="${EXTERNAL_API_URLS[$idx]}"
  if [[ "$idx" == "5" ]]; then
    # Custom URL
    ask base_url "Enter base URL (e.g. http://localhost:11434/v1)"
  fi

  ask_secret BACKEND_API_KEY "API Key (leave blank if not needed)"
  BACKEND_URL="$base_url"

  EXTERNAL_API_MODELS=(
    "gpt-4o-mini"
    "gpt-4o"
    "gpt-4-turbo"
    "llama3"
    "mistral"
    "Custom model name"
  )
  pick_menu midx "Choose a model:" "${EXTERNAL_API_MODELS[@]}"
  local model="${EXTERNAL_API_MODELS[$midx]}"
  if [[ "$model" == "Custom model name" ]]; then
    ask model "Enter model name"
  fi
  BACKEND_MODEL="$model"
  echo
}

# ── Credentials setup ─────────────────────────────────────────────────────────
configure_credentials() {
  log "Configuring application credentials..."
  echo

  ask ADMIN_USER  "Admin username"   "admin"
  ask_secret ADMIN_PASS  "Admin password"
  echo
}

# ── Reading level ─────────────────────────────────────────────────────────────
configure_reading_level() {
  log "Configuring default reading level..."
  echo

  READING_LEVEL_CHOICES=(
    "Simple       (early elementary)"
    "Intermediate (upper elementary / middle school)"
    "Advanced     (high school / adult)"
  )
  READING_LEVEL_VALUES=("simple" "intermediate" "advanced")
  pick_menu rl_idx "Default reading complexity for stories:" "${READING_LEVEL_CHOICES[@]}"
  DEFAULT_READING_LEVEL="${READING_LEVEL_VALUES[$rl_idx]}"
  ok "Default reading level: ${DEFAULT_READING_LEVEL}"
  echo
}

# ── CSV student import ────────────────────────────────────────────────────────
import_students_csv() {
  log "Student account setup..."
  echo

  echo -e "${BOLD}How would you like to set up student accounts?${RESET}"
  echo -e "  ${CYAN}1${RESET}) Import from a CSV file  (username,password per line)"
  echo -e "  ${CYAN}2${RESET}) Skip — I will manage students in the Admin UI"
  local choice
  ask choice "Enter number" "2"

  if [[ "$choice" != "1" ]]; then
    ok "Skipping CSV import — use the Admin UI to add students later."
    echo
    return
  fi

  local csv_path
  ask csv_path "Path to CSV file (e.g. students.csv)"

  if [[ ! -f "$csv_path" ]]; then
    warn "File not found: ${csv_path}  — skipping CSV import."
    echo
    return
  fi

  mkdir -p data

  # Parse CSV and write data/users.json.
  # Supports an optional header row (containing the word "username").
  # Note: commas in usernames or passwords are not supported.
  local count_file
  count_file=$(mktemp)

  node - "$csv_path" "$count_file" <<'NODEEOF'
const fs = require('fs');
const filePath = process.argv[2];
const countFile = process.argv[3];
const lines = fs.readFileSync(filePath, 'utf8')
  .split(/\r?\n/)
  .map(l => l.trim())
  .filter(Boolean);

// Skip header row if present
const dataLines = lines[0].toLowerCase().includes('username') ? lines.slice(1) : lines;

const newUsers = [];
for (const line of dataLines) {
  const parts = line.split(',');
  if (parts.length < 2) continue;
  const username = parts[0].trim();
  const password = parts[1].trim();
  if (!username || !password) continue;
  newUsers.push({ username, password, role: 'student' });
}

// Merge with existing users.json if present
let existing = [];
try {
  existing = JSON.parse(fs.readFileSync('data/users.json', 'utf8'));
} catch {}
for (const u of newUsers) {
  const idx = existing.findIndex(e => e.username === u.username);
  if (idx !== -1) { existing[idx] = u; } else { existing.push(u); }
}

fs.writeFileSync('data/users.json', JSON.stringify(existing, null, 2));
fs.writeFileSync(countFile, String(newUsers.length));
NODEEOF

  local count
  count=$(cat "$count_file")
  rm -f "$count_file"

  ok "Imported ${count} student(s) → data/users.json"
  echo
}

# ── Generate SESSION_SECRET ───────────────────────────────────────────────────
generate_secret() {
  if command -v openssl &>/dev/null; then
    openssl rand -hex 32
  else
    # Fallback: use /dev/urandom
    LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 64 || true
  fi
}

# ── Write .env.local ──────────────────────────────────────────────────────────
write_env() {
  log "Writing .env.local..."

  local secret
  secret="$(generate_secret)"

  {
    echo "# Generated by Tanuki installer on $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
    echo "SESSION_SECRET=${secret}"
    echo ""
    echo "# Admin credentials"
    echo "ADMIN_USERNAME=${ADMIN_USER}"
    echo "ADMIN_PASSWORD=${ADMIN_PASS}"
    echo ""
    echo "# Default reading level (simple | intermediate | advanced)"
    echo "DEFAULT_READING_LEVEL=${DEFAULT_READING_LEVEL:-intermediate}"
    echo ""
    if [[ -n "${BACKEND_API_KEY:-}" && "${BACKEND_API_KEY}" != "EMPTY" ]]; then
      echo "# AI API"
      echo "OPENAI_API_KEY=${BACKEND_API_KEY}"
    fi
    if [[ -n "${BACKEND_URL:-}" ]]; then
      echo "OPENAI_BASE_URL=${BACKEND_URL}"
    fi
  } > .env.local

  ok ".env.local written"
  echo
}

# ── Summary ───────────────────────────────────────────────────────────────────
print_summary() {
  hr
  echo -e "\n${BOLD}${GREEN}  Installation complete!${RESET}\n"

  echo -e "${BOLD}  Next steps:${RESET}"
  echo

  if [[ -f start-vllm.sh ]]; then
    echo -e "  ${CYAN}1.${RESET} Start the vLLM server:"
    echo -e "       ${YELLOW}bash start-vllm.sh${RESET}"
    echo -e "     (keep it running, then open a new terminal)"
    echo
    echo -e "  ${CYAN}2.${RESET} In the Admin UI set:"
    echo -e "       API Base URL → ${BACKEND_URL}"
    echo -e "       Model → ${BACKEND_MODEL}"
    echo
    echo -e "  ${CYAN}3.${RESET} Start Tanuki Stories:"
    echo -e "       ${YELLOW}npm run dev${RESET}   (development)"
    echo -e "       ${YELLOW}npm run build && npm start${RESET}   (production)"
  elif [[ -f start-llamacpp.sh ]]; then
    echo -e "  ${CYAN}1.${RESET} Start the llama.cpp server:"
    echo -e "       ${YELLOW}bash start-llamacpp.sh${RESET}"
    echo -e "     (keep it running, then open a new terminal)"
    echo
    echo -e "  ${CYAN}2.${RESET} In the Admin UI set:"
    echo -e "       API Base URL → ${BACKEND_URL}"
    echo -e "       Model → ${BACKEND_MODEL}"
    echo
    echo -e "  ${CYAN}3.${RESET} Start Tanuki Stories:"
    echo -e "       ${YELLOW}npm run dev${RESET}"
  else
    echo -e "  ${CYAN}1.${RESET} Start Tanuki Stories:"
    echo -e "       ${YELLOW}npm run dev${RESET}   (development)"
    echo -e "       ${YELLOW}npm run build && npm start${RESET}   (production)"
    if [[ -n "${BACKEND_MODEL:-}" ]]; then
      echo
      echo -e "  ${CYAN}2.${RESET} In the Admin UI confirm:"
      echo -e "       Model → ${BACKEND_MODEL:-gpt-4o-mini}"
      [[ -n "${BACKEND_URL:-}" ]] && echo -e "       API Base URL → ${BACKEND_URL}"
    fi
  fi

  echo
  echo -e "  ${CYAN}Open:${RESET} http://localhost:3000"
  echo -e "  ${CYAN}Admin:${RESET} ${ADMIN_USER:-admin} / (your password)"
  echo -e "  ${CYAN}Students:${RESET} manage via Admin UI → Student Management"
  echo
  hr
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
  print_banner

  # Prereqs
  check_prereqs

  # npm install
  run_npm_install

  # AI backend
  hr
  BACKEND_URL=""
  BACKEND_MODEL=""
  BACKEND_API_KEY=""

  BACKEND_CHOICES=(
    "Local — vLLM         (NVIDIA GPU required)"
    "Local — llama.cpp    (CPU or GPU, GGUF models)"
    "External API         (OpenAI, Ollama, LM Studio, etc.)"
    "Mock / no AI         (demo mode, no API needed)"
  )
  pick_menu be_idx "How should Tanuki Stories connect to an AI model?" "${BACKEND_CHOICES[@]}"

  case "$be_idx" in
    0)
      check_python
      install_vllm
      ;;
    1)
      check_python
      install_llamacpp
      ;;
    2)
      configure_external_api
      ;;
    3)
      log "Mock mode selected — no AI backend will be configured."
      echo
      ;;
  esac

  # Credentials
  hr
  configure_credentials

  # Reading level
  hr
  configure_reading_level

  # Student CSV import
  hr
  import_students_csv

  # .env.local
  write_env

  # Done
  print_summary
}

main "$@"
