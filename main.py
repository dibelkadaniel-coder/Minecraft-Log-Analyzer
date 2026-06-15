import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from google.genai import types

app = FastAPI(title="Interactive AI Minecraft Log Analyzer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = "GEMINI KLÍČ"
client = genai.Client(api_key=GEMINI_API_KEY)

# Globální proměnná, která bude držet aktivní chat na pozadí
# V reálné produkci pro více uživatelů by se to řešilo jinak, ale pro tvůj vlastní web je to ideální
ai_chat_session = None

SYSTEM_PROMPT = """
Jsi expertní správce Minecraft serverů a programátor Javy. Tvým úkolem je pomáhat uživatelům s chybami v logách.
Při první analýze najdi hlavní chybu a stručně navrhni řešení.
V následné konverzaci odpovídej uživateli na jeho doplňující dotazy. Buď trpělivý, vysvětluj kroky podrobně, případně mu napiš přesné Linux příkazy nebo postupy, pokud se zeptá, jak to má udělat.
Odpovídej vždy v ČEŠTINĚ.
""".strip()

class LogInput(BaseModel):
    log_text: str

class FollowUpInput(BaseModel):
    user_question: str

@app.post("/analyze")
async def analyze_log(input_data: LogInput):
    global ai_chat_session
    log = input_data.log_text
    
    if not log.strip():
        raise HTTPException(status_code=400, detail="Log nesmí být prázdný")

    try:
        # Inicializujeme novou chatovací relaci s čistou historií
        ai_chat_session = client.chats.create(
            model="gemini-2.5-flash",
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.2,
            )
        )
        
        # Odešleme log jako první zprávu
        response = ai_chat_session.send_message(f"Zanalyzuj tento Minecraft log a najdi chybu:\n\n{log}")
        return {"status": "analyzed", "reply": response.text}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ask")
async def ask_follow_up(input_data: FollowUpInput):
    global ai_chat_session
    question = input_data.user_question
    
    if ai_chat_session is None:
        raise HTTPException(status_code=400, detail="Nejdříve musíte spustit prvotní analýzu logu.")
        
    if not question.strip():
        raise HTTPException(status_code=400, detail="Otázka nesmí být prázdná")

    try:
        # Pokračujeme v existujícím chatu, AI zná log i svou předchozí odpověď
        response = ai_chat_session.send_message(question)
        return {"status": "replied", "reply": response.text}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))