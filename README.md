# Mission Control High-level overview

- Offline-first personal planning app built with React + Vite + TypeScript.
- Local persistent store: Dexie (IndexedDB) with versioned schema.
- Cloud sync: Supabase (client-side) and optional server-side upserts via the `server` proxy.
- AI assistant: client unlocks an encrypted API key, then calls a server proxy (`/api/agent/*`) which calls provider APIs (OpenAI, Google Generative, OpenRouter) or a `mock` provider for tests.
- Smart PDF reader: upload/persist PDFs, highlight text, OCR, generate flashcards (AI).
- Multiple sync methods: Supabase history push/pull, Google Drive export/import, USB/file export/import, and a WiFi sync helper (toy implementation).

---

## quick reference

- Frontend entry & wiring: `src/main.tsx`, `src/App.tsx`
- Contexts and domain: `src/contexts/AuthContext.tsx`, `src/contexts/PlansContext.tsx`
- Local DB & types: `src/lib/db.ts`
- Sync & retry: `src/lib/sync.ts`, `src/lib/syncRetry.ts`
- AI helpers: `src/lib/aiAssistant.ts`, `src/components/AISettings.tsx`, `src/components/Assistant.tsx`
- PDF reader: `src/components/SmartPDFReader.tsx`
- Service worker wiring: `src/sw/sync-worker.ts` (registered from `main.tsx`)
- Server proxy for LLMs: `server/agent_api.py`
- Dev Gemini proxy: `server/gemini-proxy.js`
- Utility libs: `src/lib/secure.ts`, `src/lib/supabase.ts`, `src/lib/wifiSyncServer.ts`

Files under `src/components/` provide UI for Dashboard, Budget, Goals, Habits, History, Sync, Layout, Auth, Agent tooling, and tests. See the file list in the repo.

---

## Data model (Dexie / IndexedDB)

Main tables (see `src/lib/db.ts` for full TypeScript types):

- `plans`: id, user_id?, title, layer (Vision|Strategy|Tactic), category, start_date, end_date, budget_planned, budget_spent, progress, notes, status, created_at, updated_at
- `budget_logs`: per-plan budget rows with amount, date, description
- `spending`: general spending entries (amount, currency, datetime, description, goal_id)
- `time_use`: start/end/duration_minutes records for focused work tracking
- `highlights`: PDF highlights (page, text, note, pdf_filename)
- `flashcards`: generated cards (question, answer, SRS fields: due_at, interval_days, ease)
- `pdfs`: saved PDF blobs and metadata
- `assistant_messages`: offline chat history
- `recurring_expenses`: rules that auto-create `spending` entries and advance `next_run_date`
- `category_caps`: caps per category used to generate alerts
- `history`: local change log used by sync (table_name, record_id, action, data, created_at, synced)
- `sync_logs`: sync operation results
- `auth_cache`: local cached auth for offline sign-in (id='primary' entry)
- `settings`: generic keyed storage (encrypted ai key stored under `id='ai'`)

Schema is versioned (v1..v8). `history` and `sync_logs` were added later.

---

## Authentication & offline sign-in

- Uses Supabase for online authentication (see `src/lib/supabase.ts`).
- On successful sign-in the app stores an `auth_cache` entry in Dexie with fields: `{ id: 'primary', user, email, passHash, salt, cachedAt }`.
  - `passHash` = SHA256(salt + password) (browser crypto.subtle). This supports offline sign-in when the remote Supabase is unreachable.
- `AuthContext` exposes `signIn`, `signUp`, `signOut`, and `revalidateOnline` functions. `revalidateOnline(password)` tries an online sign-in with cached email and refreshes the local cache when successful.

Security note: SHA-256 is used for convenience (fast) — for local caches it's pragmatic but not a replacement for proper server-side password hashing. API keys are encrypted using PBKDF2 + AES-GCM in `src/lib/secure.ts`.

---

## Plans domain and main features

Implemented in `src/contexts/PlansContext.tsx`.

Capabilities:

- CRUD for `plans` with soft-delete (archiving) when `historyEnabled` is true.
- Budget management: `addBudgetLog`, `updateBudgetLog`, `deleteBudgetLog` automatically adjust `plan.budget_spent`.
- Spending & time tracking (daily entries), with helpers to get day/series data.
- Category caps and alerts (80% threshold triggers alert via `getOverCapAlerts`).
- Recurring expenses: daily scheduler (runs on mount and every 24h) that generates `spending` entries and advances `next_run_date`.
- Goals, habits, reflections, resilience logs, momentum rating.
- Export/import CSV/JSON and upload to OneDrive/Google Drive (tokens stored in `db.settings` via cloudTokens helpers).

Behaviour notes:

- Many operations create `db.history` entries (table_name, record_id, action, data) used by sync.
- Auto-backup runs every 6 hours (non-blocking best-effort) and updates `db.settings.id='last_backup_at'`.

---

## Sync architecture (client-side)

Core files: `src/lib/sync.ts`, `src/lib/syncRetry.ts`, `src/main.tsx`.

Flow:

- Local modifications write to domain tables (e.g., `highlights`, `flashcards`) and append a `db.history` record describing the change.
- `pushLocalHistoryToServer(userId)` collects unsynced `db.history` entries and upserts them into Supabase using the `supabase` client.
  - Upsert logic compares timestamps: if local `updated_at` is newer than server `updated_at`, it upserts; otherwise it skips.
- `pullServerItemsIntoLocal(userId)` pulls highlights/reflections/flashcards from Supabase and upserts into local Dexie, using `updated_at` to merge.
- `syncRetry` persists failed entries and schedules exponential-backoff retries (5s initial, up to 5 minutes). SW or UI can call `persistFailedEntries`.
- Service worker (registered in `main.tsx`) listens for messages from SW requesting history; main thread can respond with recent history and mark entries as synced on success.

Limitations:

- Conflict resolution is timestamp-based (last-write wins) — there is no CRDT.
- Push operations work in batches (limit used in code) and rely on Supabase table schema; server may require service role keys for server-side upserts.

---

## WiFi / LAN sync helper

- Implemented as a `WifiSyncServer` stub in `src/lib/wifiSyncServer.ts`.
- It attempts to return a shareable URL using `https://api.ipify.org` but does not create a real HTTP server in the browser runtime — this is a placeholder for a native or Node environment to implement an actual local server.
- `src/components/Sync.tsx` exposes UI to start the WiFi sync (calls the `start` method), or connect to a remote WiFi sync URL (`/sync-data` endpoint expected on remote device).

If you need a working LAN sync in-browser, implement a local Node server or use a native wrapper (Electron / Capacitor) that can host an HTTP endpoint.

---

## AI assistant — client + server proxy

Client libs/UI: `src/lib/aiAssistant.ts`, `src/components/AISettings.tsx`, `src/components/Assistant.tsx`.
Server: `server/agent_api.py` and a dev proxy `server/gemini-proxy.js`.

Client behaviour:

- User stores an API key in `AISettings` which encrypts it with a password (PBKDF2 + AES-GCM) and saves to `db.settings.id='ai'`.
- Unlocking: user provides password to decrypt the stored payload; the decrypted key is set in-memory for the session using `setSessionApiKey`.
- `aiAssistant.callGemini()` resolves a model (tries `/api/agent/models`) and sends a request to `/api/agent/generate` with `{ action, provider, api_key, model, temperature, activity_data }`.
- High-level assistant functions gather local aggregates (plans, spending, time_use) and build prompts: `analyzeBehaviorSummary()`, `personalizedPathSuggestion()`, `projectOneYearOutcomes()`, `agentChat()`.

Server behaviour (`server/agent_api.py`):

- `POST /api/agent/generate` — takes `action` (`analyze`/`behavior`/`predict`), builds a prompt from `activity_data` (truncated) and calls provider via `call_llm(provider, api_key, model, prompt)`.
- `POST /api/agent/chat` — composes system prompt + chat history + activity_data and calls `call_llm`.
- `POST /api/agent/models` — lists provider models (using provider-specific APIs) or returns a curated list.

Provider handling details (`call_llm`):

- `mock`: deterministic response for tests.
- `openai`: calls `https://api.openai.com/v1/chat/completions`.
- `openrouter`: calls `https://openrouter.ai/api/v1/chat/completions`, normalizes model ids.
- `google`: prefers `google.generativeai` Python client if available (tries to resolve model names and extract candidate content); falls back to REST `https://generativelanguage.googleapis.com/v1/{model}:generateText?key={api_key}`.

Security note: The server accepts a client-supplied API key and uses it for provider calls. For production prefer storing keys server-side and not accepting client keys.

---

## Smart PDF Reader (features)

Located in `src/components/SmartPDFReader.tsx`.

Highlights:

- Upload PDF and persist blob in `db.pdfs` for offline reading.
- Render pages with `react-pdf` (pdf.js worker loaded from CDN).
- Text selection -> floating actions: Explain / Translate / Define (AI calls via `callGemini`).
- Create highlights saved to `db.highlights`; each add creates a `db.history` entry for sync.
- OCR: render page to canvas and run `tesseract.js` to extract text; fills selectionText for saving as highlight.
- Flashcard generation from highlight using AI (expects JSON with question/answer; falls back to raw text if parse fails) and saved to `db.flashcards`.
- Simple SRS fields on flashcards (due_at, interval_days, ease) though advanced scheduling is minimal.
- Small gamification via localStorage badges (`smartpdf:badges`, `smartpdf:pagesRead`).

---

## Service worker and background sync

- `src/main.tsx` registers a service worker at `/src/sw/sync-worker.ts` and listens for SW messages like `request-history-sync`, `push-history-result`, `persist-failed-history`.
- On `request-history-sync` main thread collects recent `db.history` entries and posts `push-history` message to the SW. On `push-history-result` main thread marks the corresponding local entries as `synced`.

Note: In dev the service worker source is TypeScript and will be built by Vite.

---

## Small/hidden features discovered

- Offline sign-in support via Dexie `auth_cache`.
- Legacy localStorage migration utility to Dexie.
- Background auto-backup every 6 hours when online.
- Recurring expense generator that auto-creates spending entries.
- Layer tips used by PlanForm (touch hold triggers tooltip).
- `server/agent_api.py` has an endpoint to read repo files (useful for dev, but sensitive in production).
- `wifiSyncServer` is currently a convenience stub (returns an IP-based URL) rather than a full server.

---

## Edge cases & failure modes

- Offline auth relies on a local SHA-256 hash — if password is lost, cached entry won't help.
- Sync conflict resolution is timestamp-based (may overwrite concurrent changes without merge semantics).
- WiFi sync is a placeholder — it requires a real HTTP server for exchange between machines.
- OCR (tesseract) can be heavy and may fail on resource-constrained devices.
- AI keys are sent to the server proxy by the client; consider server-side-only key management for production.

---

## How to run (developer steps)

1) Install Node.js dependencies and start Vite dev server:

```bash
npm install
npm run dev
```

2) Start the backend AI proxy (Python/uvicorn):

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-agent.txt
uvicorn server.agent_api:app --reload --port 8788
```

3) (Optional) Start local Gemini proxy (Node):

```bash
# set GEMINI_API_KEY in env
node server/gemini-proxy.js
# or `npm run dev:proxy` if script exists
```

4) Open `http://localhost:5173` in your browser. Use the UI to sign up / sign in. To exercise AI features: open Assistant -> AI Settings and either unlock the saved encrypted key or paste a key for testing (mock provider supported).

Notes:
- `AISettings` and `Assistant` call `/api/agent/*` — ensure the Python server above is running to avoid CORS/proxy errors.
- To test sync with Supabase you need `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` configured in your environment; server-side upserts may require `SUPABASE_SERVICE_ROLE_KEY`.

---

## Where to look in the code (quick map)

- App wiring: `src/main.tsx`, `src/App.tsx`
- Auth: `src/contexts/AuthContext.tsx`, `src/lib/authCache.ts`
- Domain & orchestration: `src/contexts/PlansContext.tsx`
- Dexie schema & types: `src/lib/db.ts`
- Sync: `src/lib/sync.ts`, `src/lib/syncRetry.ts`, `src/sw/sync-worker.ts`
- AI client: `src/lib/aiAssistant.ts`
- AI settings UI: `src/components/AISettings.tsx`
- SmartPDFReader: `src/components/SmartPDFReader.tsx`
- Server (LLM proxy): `server/agent_api.py`
- Dev proxy for Gemini: `server/gemini-proxy.js`

---

## Recommended next steps (pick one)

1. Persist this doc file in the repository (done).
2. Run a smoke test: I can start the Python server and the Vite dev server and report the logs.
3. Improve WiFi sync: implement a simple Node HTTP server for LAN file exchange and wire it into the Sync UI.
4. Security hardening: don't send client API keys to server — instead store keys server-side or use OAuth + server token.
---

End of developer README.
