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


def generate_transition_summary(current_task: str, duration_minutes: int, next_task: str, notes: str = "") -> str:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return f"Worked on '{current_task}' for {duration_minutes} min. Pick up here when you return."

    client = OpenAI(api_key=api_key)

    notes_section = (
        f"\nThe user jotted these notes during the session:\n\"{notes}\"\n"
        if notes else ""
    )

    prompt = (
        f"The user just finished a {duration_minutes}-minute work session on: '{current_task}'.\n"
        f"They are switching to: '{next_task}'."
        f"{notes_section}\n"
        "Write a single short paragraph (2-3 sentences) that:\n"
        "1. References their specific notes if provided, otherwise infers what they were working on\n"
        "2. Gives a concrete re-entry point so they can pick up exactly where they left off\n"
        "3. Is encouraging but brief\n"
        "Write in second person. Do not use bullet points."
    )

    resp = client.responses.create(model="gpt-4.1-mini", input=prompt)
    return resp.output_text.strip()