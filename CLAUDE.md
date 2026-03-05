# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Backend

```bash
# Activate the virtual environment
source .venv/bin/activate

# Set the OpenAI API key (required)
export OPEN_AI_API_KEY=your-key-here

# Start the FastAPI server from inside the backend/ directory
cd backend
uvicorn main:app --reload
# Server runs at http://127.0.0.1:8000
```

> Note: The server can also be run from the project root with `uvicorn backend.main:app --reload`.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPEN_AI_API_KEY` | Yes | OpenAI API key used by `llm_client.py` to call the model |

The key is loaded via `python-dotenv` (`load_dotenv()` in `main.py`), so you can also place it in a `.env` file in the project root.

## Architecture

This is an early-stage AI agent prototype with two components:

### Backend (`backend/`)

- **`main.py`** — FastAPI app entry point. Loads env vars, sets up CORS, defines three endpoints:
  - `GET /` — server status
  - `GET /health` — health check
  - `POST /agent` — accepts `{"text": "..."}`, delegates to `agent_core`, returns a task list
- **`agent_core.py`** — thin orchestration layer; calls `llm_client.generate_tasks_with_llm()`
- **`llm_client.py`** — OpenAI client wrapper; sends a prompt to `gpt-4.1-mini` and parses up to 3 task bullets from the response

### Frontend (`frontend/`)

- **`index.html`** — Vanilla HTML/JS UI that POSTs to `http://127.0.0.1:8000/agent` and renders the JSON response

The frontend is a static file opened directly in the browser (no build step). The backend uses Python 3.14 with FastAPI + Uvicorn installed in `.venv/`.

## Other Files

- `first-backend-product.py` — legacy/superseded backend, not in use
- `numbers.java` — standalone Java utility, not connected to the main project

## Dependencies

No `requirements.txt` — dependencies are managed directly in `.venv`. Key packages: `fastapi`, `uvicorn`, `pydantic`, `openai`, `python-dotenv`.
