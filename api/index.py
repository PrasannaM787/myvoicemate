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
            base_url="https://api.groq.com/openai/v1"
        )
        
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are a warm, empathetic personal journaling companion. Summarize the user's daily voice notes. Speak directly to them using 'You'."
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
