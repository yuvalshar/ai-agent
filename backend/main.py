from dotenv import load_dotenv
load_dotenv()

from llm_client import generate_tasks_with_llm
from DB.models import Interaction, SessionContext
from DB.db import SessionLocal, engine

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel #data structures
import os

app = FastAPI()

#CORS(browser): Grant access for the frontend to access and communicate the server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"]
)

#DataBase (Postgres)
def save_interaction(user_request: str, llm_response: str):
    db = SessionLocal()
    try:
        db.add(Interaction(user_request=user_request, llm_response=llm_response))
        db.commit()
    finally:
        db.close()

class AgentRequest(BaseModel):
    text: str

class TransitionRequest(BaseModel):
    current_task: str
    duration_minutes: int
    next_task: str
    notes: str = ""

frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")
app.mount("/static", StaticFiles(directory=frontend_path), name="static")

@app.get("/")
def root():
    return FileResponse(os.path.join(frontend_path, "index.html"))

@app.get("/health")
def health():
    return {"status": "ok"}

#functions
def check_db():
    try:
        with engine.connect():
            pass
    except Exception as e:
        print(f"[DB Error] Database is unreachable: {e}")
        raise HTTPException(status_code=503, detail="Database is unavailable. Please start the DB and try again.")
    
def get_cache_response(user_request: str):
    db = SessionLocal()
    try:
        interaction = db.query(Interaction).filter(Interaction.user_request == user_request).first()
        return interaction.llm_response if interaction else None
    finally:
        db.close()

@app.post("/agent")
def agent(user_request: AgentRequest):
    check_db()
    text = user_request.text.strip()
    cached = get_cache_response(text)
    if cached:
        print("[Cache] Returning cached response.")
        return {"tasks": cached.split("\n")}

    result = generate_tasks_with_llm(text)
    save_interaction(text, "\n".join(result.get("tasks", [])))
    return result

@app.post("/transition")
def transition(req: TransitionRequest):
    from llm_client import generate_transition_summary
    summary = generate_transition_summary(req.current_task, req.duration_minutes, req.next_task, req.notes)

    db = SessionLocal()
    try:
        db.add(SessionContext(
            task_name=req.current_task,
            summary=summary,
            notes=req.notes,
            duration_minutes=req.duration_minutes,
        ))
        db.commit()
    finally:
        db.close()

    return {"summary": summary}


@app.get("/weekly")
def get_weekly():
    from datetime import datetime, timedelta, timezone
    from collections import defaultdict
    db = SessionLocal()
    try:
        since = datetime.now(timezone.utc) - timedelta(days=7)
        rows = (
            db.query(SessionContext)
            .filter(SessionContext.created_at >= since)
            .order_by(SessionContext.created_at.desc())
            .all()
        )
        days = defaultdict(lambda: defaultdict(int))
        for r in rows:
            day = r.created_at.strftime('%Y-%m-%d')
            days[day][r.task_name] += r.duration_minutes

        result = []
        for day in sorted(days.keys(), reverse=True):
            tasks = [
                {"task": t, "minutes": m}
                for t, m in sorted(days[day].items(), key=lambda x: -x[1])
            ]
            result.append({
                "date": day,
                "total_minutes": sum(t["minutes"] for t in tasks),
                "tasks": tasks,
            })
        return {"days": result}
    finally:
        db.close()


@app.get("/history")
def get_history(limit: int = 50):
    db = SessionLocal()
    try:
        rows = (
            db.query(SessionContext)
            .order_by(SessionContext.created_at.desc())
            .limit(limit)
            .all()
        )
        return {"sessions": [
            {
                "task_name": r.task_name,
                "duration_minutes": r.duration_minutes,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]}
    finally:
        db.close()


@app.get("/context")
def get_context(task: str):
    db = SessionLocal()
    try:
        row = (
            db.query(SessionContext)
            .filter(SessionContext.task_name == task)
            .order_by(SessionContext.created_at.desc())
            .first()
        )
        if not row:
            return {"context": None}
        return {
            "context": {
                "summary": row.summary,
                "duration_minutes": row.duration_minutes,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
        }
    finally:
        db.close()

    