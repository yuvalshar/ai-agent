# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**Flow** is an intelligent work-session transition agent. It watches a user-defined daily schedule, tracks active focus sessions, fires warnings before block boundaries, and uses an LLM to generate a context-preservation summary when switching tasks — so the user can pick up exactly where they left off.

Stack: Python 3.14 + FastAPI backend, vanilla HTML/CSS/JS frontend (no build step), PostgreSQL database, OpenAI `gpt-4.1-mini` model.

---

## Directory Structure

```
.
├── backend/
│   ├── main.py           # FastAPI app — all routes defined here
│   ├── llm_client.py     # OpenAI wrapper — task generation + transition summaries
│   ├── .env              # Local secrets (never commit)
│   └── DB/
│       ├── db.py         # SQLAlchemy engine + SessionLocal factory
│       ├── models.py     # ORM models: Interaction, SessionContext
│       └── init_db.py    # One-time DB table creation script
├── frontend/
│   ├── index.html        # All three screens (Setup, Dashboard, Transition)
│   ├── script.js         # All client-side logic — schedule, session, timer, API calls
│   └── style.css         # Meridian design system styles
├── .venv/                # Python virtual environment (not committed)
├── CLAUDE.md
└── README.md (if present)
```

Legacy files (not connected to the main project):
- `first-backend-product.py` — superseded backend
- `numbers.java` — standalone Java utility

---

## Running the Backend

```bash
# 1. Activate the virtual environment (from project root)
source .venv/bin/activate

# 2. Ensure backend/.env exists with both required variables (see below)

# 3. Start the server from inside backend/
cd backend
uvicorn main:app --reload
# Server runs at http://127.0.0.1:8000

# Alternative: run from project root
uvicorn backend.main:app --reload
```

The frontend is served as a static mount — open `http://127.0.0.1:8000/` in the browser after starting the server. No separate frontend server is needed.

---

## Environment Variables

Place these in `backend/.env` (loaded via `python-dotenv` in both `main.py` and `db.py`):

```env
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql+psycopg://miniagent:miniagent_password@localhost:5432/miniagent_db
```

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Yes | OpenAI API key used by `llm_client.py` |
| `DATABASE_URL` | Yes | PostgreSQL connection string (psycopg3 driver) |

If `DATABASE_URL` is missing, `db.py` raises `RuntimeError` at import time. If `OPENAI_API_KEY` is missing, `llm_client.py` returns a graceful error dict instead of calling the API.

---

## Database Setup

Run once after cloning to create all tables:

```bash
cd backend
python -m DB.init_db
```

This calls `Base.metadata.create_all()`, which creates both tables if they don't exist. Safe to re-run (idempotent).

### PostgreSQL (local)

```bash
# Start Postgres (macOS with Homebrew)
brew services start postgresql@16

# Create DB and user (first time only)
psql postgres -c "CREATE USER miniagent WITH PASSWORD 'miniagent_password';"
psql postgres -c "CREATE DATABASE miniagent_db OWNER miniagent;"
```

---

## Database Schema

### `interactions` table

Stores every user request + LLM task-list response for caching.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | auto-increment |
| `user_request` | TEXT | raw user input |
| `llm_response` | TEXT | newline-joined tasks |
| `created_at` | TIMESTAMPTZ | server default `now()` |

### `session_contexts` table

Stores one row per completed work session (task name, AI-generated summary, notes, duration).

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | auto-increment |
| `task_name` | TEXT | name of the task worked on |
| `summary` | TEXT | LLM-generated re-entry summary |
| `notes` | TEXT | user's in-session notes (may be empty) |
| `duration_minutes` | INTEGER | session length |
| `created_at` | TIMESTAMPTZ | server default `now()` |

---

## API Endpoints

All endpoints are defined in `backend/main.py`. CORS is open (`allow_origins=["*"]`).

### `GET /`
Serves `frontend/index.html` via `FileResponse`.

### `GET /health`
Returns `{"status": "ok"}`. Used for liveness checks.

### `POST /agent`
Accepts a free-text user request, calls the LLM, returns up to 3 actionable task bullets. Results are cached in the `interactions` table — identical requests skip the LLM call.

**Request:**
```json
{ "text": "I need to prepare for my math exam" }
```

**Response:**
```json
{ "tasks": ["Review chapter 3 notes", "Complete 10 practice problems", "..."] }
```

**Error (DB down):** HTTP 503
**Error (missing API key):** HTTP 200 with `{"error": "Missing OPENAI_API_KEY..."}`

### `POST /transition`
Called when the user switches tasks. Sends current task, duration, next task, and optional in-session notes to the LLM. Returns a 2-3 sentence re-entry summary and persists it to `session_contexts`.

**Request:**
```json
{
  "current_task": "Startup work",
  "duration_minutes": 47,
  "next_task": "Violin / Piano",
  "notes": "Finished auth flow, need to wire up the dashboard next"
}
```

**Response:**
```json
{ "summary": "You wrapped up 47 minutes deep in the auth flow..." }
```

### `GET /context?task=<task_name>`
Fetches the most recent `SessionContext` row for the given task name. Used on session start to show a re-entry card.

**Response (found):**
```json
{
  "context": {
    "summary": "You wrapped up...",
    "duration_minutes": 47,
    "created_at": "2026-03-08T10:30:00+00:00"
  }
}
```

**Response (not found):** `{"context": null}`

### `GET /history?limit=50`
Returns the most recent session records ordered by `created_at DESC`. Used to populate the session log panel on page load.

**Response:**
```json
{
  "sessions": [
    { "task_name": "Startup work", "duration_minutes": 47, "created_at": "2026-03-08T..." }
  ]
}
```

### `GET /weekly`
Aggregates `session_contexts` rows from the past 7 days, grouped by calendar day and task name. Used by the "This week" modal.

**Response:**
```json
{
  "days": [
    {
      "date": "2026-03-08",
      "total_minutes": 180,
      "tasks": [
        { "task": "Startup work", "minutes": 120 },
        { "task": "Study", "minutes": 60 }
      ]
    }
  ]
}
```

---

## Backend Modules

### `main.py`
- Loads `.env` at the top before any other imports
- Mounts `frontend/` as `/static` (StaticFiles)
- `check_db()` — called on every `/agent` request; raises HTTP 503 if Postgres is unreachable
- `get_cache_response()` — queries `interactions` for a prior identical request
- `save_interaction()` — persists user request + joined LLM response

### `llm_client.py`
- `generate_tasks_with_llm(user_text)` — calls `client.responses.create(model="gpt-4.1-mini")`, parses up to 3 bullet lines, returns `{"tasks": [...]}`
- `generate_transition_summary(current_task, duration_minutes, next_task, notes)` — crafts a detailed prompt and returns a 2-3 sentence paragraph written in second person; includes user notes in the prompt if provided
- Uses the OpenAI **Responses API** (`client.responses.create` / `resp.output_text`), not the Chat Completions API

### `DB/db.py`
- SQLAlchemy engine with `pool_pre_ping=True`, `pool_size=5`, `max_overflow=15`
- `SessionLocal` — `sessionmaker` with `autoflush=False`, `autocommit=False`, `expire_on_commit=False`
- `Base` — `declarative_base()` shared by all models

### `DB/models.py`
- `Interaction` — maps to `interactions` table
- `SessionContext` — maps to `session_contexts` table
- Both use SQLAlchemy 2.x `Mapped` / `mapped_column` syntax

### `DB/init_db.py`
- Imports `Base` and all models, calls `Base.metadata.create_all(bind=engine)`

---

## Frontend Architecture

The UI is a single HTML file with three full-screen states. No framework, no build step.

### Screens

| Screen ID | Purpose |
|---|---|
| `setup-screen` | User defines their weekly schedule (time slots + labels) |
| `dashboard-screen` | Main focus view — current task, timer ring, next-up panel, session log |
| `transition-screen` | Shown at block boundary — displays AI context summary before switching |

### Key JS State Variables (`script.js`)

| Variable | Type | Description |
|---|---|---|
| `schedule` | `Array<{time, label}>` | Sorted list of time blocks for the day |
| `sessionActive` | boolean | Whether a focus session is currently running |
| `sessionStart` | `Date \| null` | Timestamp when the current session began |
| `currentTask` | string | Name of the in-progress task |
| `warningFired` | boolean | True once the 15-min warning has triggered for this session |
| `transitionFired` | boolean | True once the auto-transition has triggered for this session |
| `sessionLog` | `Array<{task, duration}>` | In-memory log of this page-session's completed tasks |

### Schedule Persistence
Schedule entries are saved to `localStorage` under the key `flow_schedule` (JSON array of `{time, label}` objects). Loaded automatically on page open.

### Session Lifecycle

1. User types a task name into `#focus-input` and clicks "Start session" (or `Cmd/Ctrl+Enter`)
2. `startSession(task)` sets state, disables input, shows the notes textarea, calls `fetchReentryContext(task)` to load any prior AI summary
3. Every second: `tickClock()` → `updateSessionTimer()`, `updateNextUp()`, `checkTransitionWarning()`
4. At T-15 min before next block: warning chime + browser notification, timer turns amber
5. At T-0: `triggerTransition()` auto-fires → shows transition screen, calls `POST /transition`
6. User confirms → `endSession(true)` persists to log, resets all state, pre-fills next task in input

### Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + Enter` | Toggle session start/end (dashboard only) |
| `Escape` | Dismiss transition screen or close weekly modal |

### Audio (Web Audio API)
`playChime(type)` synthesizes tones using `OscillatorNode`:
- `'warn'` — two-note chord at 440 Hz + 554 Hz
- `'transition'` — three-note chord at 528 Hz + 660 Hz + 784 Hz

### Browser Notifications
`requestNotificationPermission()` is called on dashboard init. `sendNotification(title, body)` fires a native OS notification at the 15-min warning and at task switch time.

---

## Dependencies

No `requirements.txt` — all packages installed directly into `.venv`. Key packages:

| Package | Purpose |
|---|---|
| `fastapi` | Web framework |
| `uvicorn` | ASGI server |
| `pydantic` | Request body validation (`BaseModel`) |
| `openai` | OpenAI Responses API client |
| `python-dotenv` | `.env` file loading |
| `sqlalchemy` | ORM + connection pooling |
| `psycopg` (psycopg3) | PostgreSQL driver (`postgresql+psycopg://`) |

To install into a fresh venv:
```bash
python -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn pydantic openai python-dotenv sqlalchemy psycopg[binary]
```

---

## Common Gotchas

- **Wrong env var name**: The actual env var read by `llm_client.py` is `OPENAI_API_KEY` (not `OPEN_AI_API_KEY` as documented in older comments). Confirm with `os.getenv("OPENAI_API_KEY")` in `llm_client.py`.
- **DB driver**: The `DATABASE_URL` uses `postgresql+psycopg://` (psycopg3), not `postgresql+psycopg2://`. These are different drivers; don't mix them.
- **Responses API vs Chat Completions**: `llm_client.py` uses `client.responses.create(...)` and reads `resp.output_text` — this is the OpenAI Responses API, not `client.chat.completions.create(...)`. Do not refactor to Chat Completions without updating the response parsing.
- **CORS**: `allow_credentials=False` is intentional when `allow_origins=["*"]`; browsers block credentialed requests to wildcard origins.
- **Schedule is in-memory**: The JS `schedule` array is rebuilt from localStorage on each page load. If the user clears localStorage, the schedule resets to defaults.
- **`agent_core.py` was removed**: The original architecture had `agent_core.py` as an intermediary, but it no longer exists. `main.py` calls `llm_client.generate_tasks_with_llm()` directly.
