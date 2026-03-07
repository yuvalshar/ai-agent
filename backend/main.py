from dotenv import load_dotenv
load_dotenv()

from llm_client import generate_tasks_with_llm
from DB.models import Interaction
from DB.db import SessionLocal, engine

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel #data structures
from fastapi.middleware.cors import CORSMiddleware
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

    