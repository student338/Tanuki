# Debugging & Troubleshooting Guide

This guide helps maintainers diagnose and fix common issues with a Tanuki Stories installation.

---

## 1. Quick Health Checks

| Check | How |
|---|---|
| App is running | Open `http://<host>:3000` — you should see the login page |
| Auth works | Log in with a known account (see §3) |
| AI backend reachable | Admin UI → Settings → verify *API Base URL* and *Model*; click Save and watch for errors |
| Data directory writable | Ensure the process can write to `data/` (users, stories, config live there) |
| Build is current | `git log -1` against the deployed commit; `npm run build` should succeed |

---

## 2. Logs

- **Next.js server logs**: wherever you launched `npm run dev` / `npm start`. Look for stack traces on failed API routes (`/api/...`).
- **Browser console**: open DevTools → Console on the affected client. iPad/Safari issues often surface here.
- **AI backend**: check your vLLM / llama.cpp / Ollama / external provider logs separately — the app only reports what the backend returns.

---

## 3. Accessing an Admin Account for Debugging

There is **no hidden or hardcoded backdoor account** in this codebase, and none should be added. Admin access is configured openly through environment variables so that the person running the installation controls it.

To add a temporary maintainer/debug admin account on a specific installation:

1. Edit the installation's `.env.local`.
2. Append an extra admin using the comma-separated form:
   ```
   ADMIN_USERNAME=admin,maintainer-debug
   ADMIN_PASSWORD=<existing-admin-password>,<a-strong-temporary-password>
   ```
   Each username gets the password at the same index. If fewer passwords than usernames are supplied, the first password is reused and a warning is logged.
3. Restart the app.
4. **Remove the debug account when finished** and restart again.

Student and teacher accounts are managed in the Admin UI (Students / Teachers tabs) or via CSV import; they are stored in `data/users.json`, not in env vars.

### Resetting a lost admin password
1. Set a new `ADMIN_PASSWORD` in `.env.local` (env-based admins always override file-based config at startup).
2. Restart the app and log in with the env credentials.
3. Optionally update any stored admin accounts via the Admin UI, then remove the env override.

---

## 4. Common Issues

### Login succeeds but immediately bounces back to `/login`
- **Cause (most common on iPad/iOS Safari):** the session cookie set by the login response is not yet visible to in-page `fetch()` calls. The app already retries (see `src/lib/client-auth.ts`), but a very slow or heavily cached session can still flap.
- **Fix:** ensure the app is served over a single consistent origin (no mixed `http`/`https` or port changes), hard-refresh, and confirm cookies are not blocked (Settings → Safari → Block All Cookies must be off).

### "SESSION_SECRET environment variable must be set in production"
- Set `SESSION_SECRET` to a long random string in `.env.local` before running `npm run build`/`npm start`.

### Stories are not generating / mock-mode output
- The app falls back to mock mode when no API key or local model is configured.
- Check Admin UI → Settings: *API Base URL*, *Model*, and (if using a local model) the HuggingFace model ID or local path. Confirm `OPENAI_API_KEY` in `.env.local` if using an external API.

### Local model fails to load
- The `@huggingface/transformers` local model path must be an absolute path to a `.safetensors` directory, or a valid HF model ID. Check server logs for download/parse errors.

### Changes to `.env.local` have no effect
- `.env.local` is read at startup. Restart the dev/production server after editing.

### Data looks corrupt or you want a clean slate
- All runtime data is in `data/` (gitignored). Stop the app, back up `data/`, then delete the affected JSON file(s) (e.g. `data/users.json`, `data/stories.json`, `data/config.json`). Restart — the app recreates missing files with defaults.

---

## 5. iPad / Tablet Notes

- Pinch-zoom is intentionally allowed (accessibility). Layouts use safe-area insets and 16px minimum font size on text inputs to prevent iOS focus-zoom.
- If the UI looks stale after an update, clear the site's service worker: DevTools → Application → Service Workers → Unregister, then reload.
- The Tauri iOS build (`npm run tauri:build:ios`) uses the same web assets; web debugging in Safari (Develop menu) applies there too.

---

## 6. Still Stuck?

Collect the following before asking for help:
- Output of `git log -1` and `npm run build`
- Server log excerpt covering the failure
- Browser console errors (with device/OS, e.g. "iPad Air, iPadOS 18, Safari")
- Whether the issue reproduces in an incognito/private window with cookies enabled
