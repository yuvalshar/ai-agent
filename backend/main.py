from dotenv import load_dotenv
load_dotenv()

from llm_client import generate_tasks_with_llm
from DB.models import Interaction
from DB.db import SessionLocal, engine

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel #data structures
from fastapi.middleware.cors import CORSMiddleware

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

@app.get("/")
def root():
    return {"message": "server is running"}

@app.get("/health")
def health():
    return {"status": "ok"}

def check_db():
    try:
        with engine.connect():
            pass
    except Exception as e:
        print(f"[DB Error] Database is unreachable: {e}")
        raise HTTPException(status_code=503, detail="Database is unavailable. Please start the DB and try again.")

@app.post("/agent")
def agent(req: AgentRequest):
    check_db()
    text = req.text.strip()
    result = generate_tasks_with_llm(text)
    save_interaction(text, "\n".join(result.get("tasks", [])))
    return result

    