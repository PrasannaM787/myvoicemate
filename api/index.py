from flask import Flask, request, jsonify
import speech_recognition as sr
from datetime import datetime
from groq import Groq
import os

app = Flask(__name__)

def top_tier_summary(text):
    """Uses a LIVE 2026 model via Groq to avoid 404/Decommissioned errors."""
    api_key = os.environ.get("GROQ_API_KEY")
    
    if not api_key:
        return "System Alert: GROQ_API_KEY is missing in Vercel."

    try:
        # DRILL DOWN: Direct Base URL to the Groq Gateway
        client = Groq(
            api_key=api_key, 
            base_url="https://api.groq.com"
        )
        
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                   "content": (
    "You are VoiceMate — a personal daily recap assistant. "
    "Your only job is to reflect back exactly what the user shared throughout their day — "
    "clearly, simply, and in first person as if they are reading their own diary. "

    "VOICE & PERSPECTIVE: "
    "Write in first person — I, my, me. "
    "The user should feel like they are reading their own words back, just organized. "
    "Never add interpretations, observations, or emotional narratives. "
    "Never say things like 'You showed courage' or 'This reflects your openness'. "
    "Only write what they actually told you. Nothing more. "

    "STRUCTURE: "

    "Start with: Today's Recap — then the date. "
    "No intro lines. Go straight into what happened. "

    "Write in short, clean paragraphs — one idea per paragraph. "
    "No bullet points. No numbered lists. No bold. No symbols like ***, --, or >>. "
    "Just plain flowing sentences the way a person would write in a diary. "

    "GROUP naturally in this order if the content exists: "
    "1. What I did today "
    "2. Things I want to remember or follow up "
    "3. Plans coming up "
    "4. End with one plain, calm motivating line — simple words, no hype. "
    "Then close with: VoiceMate has your back — see you tomorrow. "

    "EMOJI RULES: "
    "Use one small relevant emoji only at the start of each paragraph — nothing else. "
    "No emojis inside sentences. No decorative emojis. "

    "LANGUAGE RULES: "
    "Simple words only. No fancy vocabulary. "
    "Short sentences. Easy to read in one breath. "
    "Never cook the story — just serve it back as it was told. "
    "No filler phrases like it seems like, based on what you shared, or this shows that. "
    "No questions to the user at any point. "
    "Never mention AI, prompts, analysis, not just words or that this is generated. "
 "END every summary with this exact line (natural, no formatting around it): "
    "'And - whatever comes , VoiceMate is with you ❤︎. "
)
                },
                {
                    "role": "user",
                    "content": f"Voice notes: {text}"
                }
            ],
            # FIXED MODEL: Changed from llama3-8b-8192 to a supported 2026 model
            model="llama-3.3-70b-versatile", 
            temperature=0.6,
            max_tokens=300
        )
        return chat_completion.choices[0].message.content
        
    except Exception as e:
        return f"AI Engine Error: {str(e)}"

@app.route('/api/upload', methods=['POST'])
def upload_audio():
    if 'file' not in request.files: return jsonify({'error': 'No file'}), 400
    file = request.files['file']
    temp_path = '/tmp/audio.wav'
    file.save(temp_path)
    recognizer = sr.Recognizer()
    try:
        with sr.AudioFile(temp_path) as source:
            audio_data = recognizer.record(source)
            text = recognizer.recognize_google(audio_data)
        return jsonify({'success': True, 'text': text})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/summary', methods=['POST'])
def get_summary():
    data = request.get_json()
    if not data or 'logs' not in data or len(data['logs']) == 0:
        return jsonify({'summary': "No notes recorded yet.", 'date': datetime.now().strftime("%A, %b %d")})
    
    full_text = " ".join(data['logs'])
    summary_text = top_tier_summary(full_text)
    
    return jsonify({
        'summary': summary_text,
        'date': datetime.now().strftime("%A, %B %d, %Y at %I:%M %p"),
    })
