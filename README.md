# Flow

**Flow** is an intelligent work-session transition agent. It watches your daily schedule, tracks your active focus sessions, warns you before block boundaries, and uses an LLM to generate a context-preservation summary when you switch tasks — so you can pick up exactly where you left off.

---

## Features

- Define your weekly schedule once (persisted in `localStorage`)
- Live countdown to the next scheduled block
- 15-minute warning with audio chime and browser notification
- Auto-trigger transition screen at block boundary
- AI-generated re-entry summary (task + duration + your notes → 2-3 sentence handoff)
- Re-entry context card shown when you return to a previous task
- Session history log loaded from the database on startup
- Weekly time breakdown by task ("This week" modal)
- Keyboard shortcuts: `Cmd/Ctrl+Enter` to toggle session, `Esc` to dismiss

---

## Project Structure

```
.
├── backend/
│   ├── main.py           # FastAPI app — all routes
│   ├── llm_client.py     # OpenAI wrapper (task gen + transition summaries)
│   ├── .env              # Local secrets (not committed)
│   └── DB/
│       ├── db.py         # SQLAlchemy engine + SessionLocal
│       ├── models.py     # Interaction, SessionContext models
│       └── init_db.py    # One-time table creation script
├── frontend/
│   ├── index.html        # Setup, Dashboard, and Transition screens
│   ├── script.js         # All client logic — schedule, timer, API calls
│   └── style.css         # Meridian design system
└── .venv/                # Python virtual environment (not committed)
```

---

## Prerequisites

- Python 3.14
- PostgreSQL (local install or Homebrew)
- An OpenAI API key

---

## Setup

### 1. Create the virtual environment and install dependencies

```bash
python -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn pydantic openai python-dotenv sqlalchemy psycopg[binary]
```

### 2. Create `backend/.env`

```env
OPENAI_API_KEY=your-key-here
DATABASE_URL=postgresql+psycopg://miniagent:miniagent_password@localhost:5432/miniagent_db
```

### 3. Set up PostgreSQL

```bash
# macOS (Homebrew)
brew services start postgresql@16

psql postgres -c "CREATE USER miniagent WITH PASSWORD 'miniagent_password';"
psql postgres -c "CREATE DATABASE miniagent_db OWNER miniagent;"
```

### 4. Initialize the database tables

```bash
source .venv/bin/activate
cd backend
python -m DB.init_db
```

---

## Running

```bash
source .venv/bin/activate
cd backend
uvicorn main:app --reload
```

Open `http://127.0.0.1:8000` in your browser. The backend serves the frontend statically — no separate frontend server needed.

---

## API

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Serves `index.html` |
| `GET` | `/health` | Liveness check |
| `POST` | `/agent` | Natural language → 3 actionable tasks (cached) |
| `POST` | `/transition` | End-of-session summary generation + persistence |
| `GET` | `/context?task=<name>` | Fetch most recent re-entry summary for a task |
| `GET` | `/history?limit=50` | Recent session log from DB |
| `GET` | `/weekly` | Last 7 days aggregated by day and task |

### Example — `/agent`

```bash
curl -X POST http://127.0.0.1:8000/agent \
  -H "Content-Type: application/json" \
  -d '{"text": "Launch a new product"}'
```

```json
{
  "tasks": [
    "Define your target audience and value proposition",
    "Build and test an MVP with early users",
    "Create a go-to-market plan and set a launch date"
  ]
}
```

### Example — `/transition`

```bash
curl -X POST http://127.0.0.1:8000/transition \
  -H "Content-Type: application/json" \
  -d '{"current_task": "Startup work", "duration_minutes": 47, "next_task": "Violin", "notes": "Finished auth, need to wire dashboard"}'
```

```json
{
  "summary": "You wrapped up 47 focused minutes on the auth flow — your notes mention wiring up the dashboard next, so that's your clear entry point when you return. Great work pushing through the backend logic; pick up at the dashboard integration and you'll have momentum right away."
}
```

---

## Dependencies

| Package | Purpose |
|---|---|
| `fastapi` | Web framework |
| `uvicorn` | ASGI server |
| `pydantic` | Request body validation |
| `openai` | OpenAI Responses API client |
| `python-dotenv` | `.env` file loading |
| `sqlalchemy` | ORM + connection pooling |
| `psycopg` | PostgreSQL driver (psycopg3) |
