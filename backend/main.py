from dotenv import load_dotenv
load_dotenv()

from llm_client import generate_tasks_with_llm
from DB.models import Message
from DB.db import SessionLocal

from fastapi import FastAPI
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
def save_message(role: str, content: str):
    db = SessionLocal()
    try:
        db.add(Message(role=role, content=content))
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

@app.post("/agent")
def agent(req: AgentRequest):
    text = req.text.strip()
    save_message("user", text)

    result = generate_tasks_with_llm(text)
    save_message("AI", "\n".join(result.get("tasks", [])))
    return result

    