# Tanuki Stories

An AI-powered story generation web app for students.

## Quick Install (Interactive)

The interactive installers handle Node.js dependencies, AI backend setup (vLLM, llama.cpp, or external API), and `.env.local` generation in one step.

**Linux / macOS:**
```bash
bash install.sh
```

**Windows:**
```bat
install.bat
```

The installer will ask you to choose from:

| Option | Description |
|---|---|
| **Local — vLLM** | NVIDIA GPU required; installs `vllm`, picks a model, generates `start-vllm.sh/.bat` |
| **Local — llama.cpp** | CPU or GPU; installs `llama-cpp-python[server]`, downloads a GGUF model, generates `start-llamacpp.sh/.bat` |
| **External API** | OpenAI, Ollama, LM Studio, Together AI, Groq, or any custom OpenAI-compatible endpoint |
| **Mock / no AI** | Demo mode – no API key needed |

After running a local backend installer, start the AI server first, then start the app:

```bash
# Terminal 1 — AI server
bash start-vllm.sh        # or: bash start-llamacpp.sh

# Terminal 2 — Tanuki Stories
npm run dev
```

Then open the **Admin UI → Settings** and set the *API Base URL* and *Model* to match your local server.

---

## Manual Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the example env file and add your OpenAI API key:
   ```bash
   cp .env.local.example .env.local
   ```
   Edit `.env.local` and set `OPENAI_API_KEY=your-actual-key`.
   The app works without an API key (mock mode).

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000).

## Demo Accounts

| Role    | Username  | Password     |
|---------|-----------|--------------|
| Admin   | `admin`   | `admin123`   |
| Student | `student` | `student123` |

## Features

- **Admin Dashboard**: Edit the system prompt, view all generated stories.
- **Student Dashboard**: Submit story requests, get AI-generated stories, pick a visual theme.
- **Themes**: Light, Dark, Sepia, Orbs on White, Orbs on Black.
- **Storage**: File-based JSON in `/data` (gitignored).
- **Auth**: Cookie-based session (no external auth library).
