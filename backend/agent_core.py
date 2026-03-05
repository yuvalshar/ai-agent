from llm_client import generate_tasks_with_llm

def build_tasks(user_text: str) -> dict:
    text = user_text.strip()
    return generate_tasks_with_llm(text)