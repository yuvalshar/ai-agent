import os
from openai import OpenAI

def generate_tasks_with_llm(user_text: str) -> dict:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return {"error": "Missing OPENAI_API_KEY. Put it in backend/.env and restart uvicorn."}

    client = OpenAI(api_key=api_key)
    
    prompt = (
            "Return exactly 3 actionable tasks (short bullets) for the user's request.\n"
            f"User request: {user_text}"
    )

    resp = client.responses.create(
        model="gpt-4.1-mini",
        input=prompt
    )

    output = resp.output_text.strip()
    
    #tasks = [t.strip("-• \t") for t in output.splitlines() if t.strip()][:3]    
    tasks = []
    count = 0
    for t in output.splitlines():
        if t.strip():
            tasks.append(t.strip("-• \t"))
            if len(tasks) == 3:
                break
    
    print("model:", getattr(resp, "model", None))
    print("usage:", getattr(resp, "usage", None))
    return {"tasks": tasks}