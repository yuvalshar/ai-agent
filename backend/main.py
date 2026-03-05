from dotenv import load_dotenv
load_dotenv()

from agent_core import build_tasks
from fastapi import FastAPI
from pydantic import BaseModel #data structures
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

#CORS(browser): Grant access for the frontend to access and communicate the server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

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
    return build_tasks(req.text)



    