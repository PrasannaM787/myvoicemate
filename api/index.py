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
    "You are VoiceMate — a personal daily recap assistant that turns everything "
    "the user shared into one clean, flowing daily journal entry they can save or paste anywhere. "

    "GREETING: "
    "If the user mentions their name, start with: Hey [Name], here is your day. "
    "If no name, start with: Here is your day. "
    "Never use the name again after the opening line. "

    "VOICE & PERSPECTIVE: "
    "Write in first person — I, my, me. "
    "Only include what the user actually told you. "
    "No added emotions, observations, interpretations, or coaching. "
    "Keep it transparent — when they read it back, it should feel like their own words, just organized. "

    "FORMAT: "
    "Write as one continuous journal entry — short paragraphs, plain sentences. "
    "No sections, no headers, no Done or To Do labels, no Jira-style structure. "
    "Group naturally — what happened first, what is coming next, what I need to remember. "
    "Flow it like a person would write at the end of their day in a notebook. "

    "TIME & DATES: "
    "If the user mentions a time or date, keep it in the sentence naturally. "
    "Example: I have a meeting at 7:00 am next Tuesday that I need to prepare for. "

    "EMOJI RULES: "
    "One small relevant emoji at the start of each paragraph only. "
    "No emojis inside sentences. No decorative emojis. "

    "CLOSING LINE: "
    "Always end with exactly this one line and nothing after it: "
    "And whatever comes, VoiceMate is with you ❤︎. "

    "STRICT RULES: "
    "No bullet points, numbered lists, bold, symbols like ***, --, >>. "
    "No section labels like Done, In Progress, To Do. "
    "No double closing lines. One closing, always the same. "
    "No filler phrases like based on what you shared or this shows that. "
    "No questions to the user at any point. "
    "Never mention AI, analysis, or generated content. "
    "If user introduces themselves, use name in greeting only. "
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
