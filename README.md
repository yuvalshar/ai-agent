# AI Agent Product

An early-stage AI agent prototype that takes a natural language request and breaks it down into 3 actionable tasks using GPT-4.1-mini.

## Project Structure

```
.
├── backend/
│   ├── main.py          # FastAPI app entry point
│   ├── agent_core.py    # Orchestration layer
│   ├── llm_client.py    # OpenAI API wrapper
│   └── DB/
│       ├── db.py        # SQLAlchemy engine & session
│       ├── models.py    # Message model
│       └── init_db.py   # Table creation script
├── frontend/
│   ├── index.html       # UI
│   ├── style.css        # Styles
│   └── script.js        # Frontend logic
└── .venv/               # Python virtual environment
```

## Prerequisites

- Python 3.14
- An OpenAI API key
- Docker (for the PostgreSQL database)

## Setup

1. **Clone the repo and navigate to the project directory.**

2. **Create a `.env` file** in the project root:
   ```
   OPEN_AI_API_KEY=your-key-here
   DATABASE_URL=postgresql://miniagent:miniagent_password@localhost:5432/miniagent_db
   ```

3. **Start the database:**
   ```bash
   docker-compose up -d
   ```

4. **Initialize the database tables:**
   ```bash
   source .venv/bin/activate
   cd backend
   python -m DB.init_db
   ```

5. **Activate the virtual environment:**
   ```bash
   source .venv/bin/activate
   ```

## Running the Backend

```bash
source .venv/bin/activate
cd backend
uvicorn main:app --reload
```

The server runs at `http://127.0.0.1:8000`.

## Using the Frontend

Open `frontend/index.html` directly in your browser (no build step required). Type a request and click **Run** to get 3 actionable tasks back from the agent.

## API

| Method | Endpoint  | Description                                      |
|--------|-----------|--------------------------------------------------|
| GET    | `/`       | Server status check                              |
| GET    | `/health` | Health check                                     |
| POST   | `/agent`  | Accepts `{"text": "..."}`, returns task list     |

**Example request:**
```bash
curl -X POST http://127.0.0.1:8000/agent \
  -H "Content-Type: application/json" \
  -d '{"text": "Launch a new product"}'
```

**Example response:**
```json
{
  "tasks": [
    "Define your target audience and value proposition",
    "Build and test an MVP with early users",
    "Create a go-to-market plan and set a launch date"
  ]
}
```

## Dependencies

Managed directly in `.venv`. Key packages:

- `fastapi`
- `uvicorn`
- `pydantic`
- `openai`
- `python-dotenv`
- `sqlalchemy`
- `psycopg2-binary`
