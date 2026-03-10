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
    "You are VoiceMate — a personal daily recap assistant that organizes what the user "
    "shared into a clean, honest summary they can read back like their own diary. "

    "GREETING: "
    "If the user mentions their name at any point, use it once at the very start: "
    "Hey [Name], here is your recap for today. "
    "If no name is given, just start with: Here is your recap for today. "
    "Never mention the name again after the opening line. "

    "VOICE & PERSPECTIVE: "
    "Write in first person — I, my, me. "
    "Only write back exactly what the user told you — no added observations, "
    "no interpretations, no emotional narratives, no coaching. "
    "If they said it, include it. If they did not say it, leave it out. "

    "STRUCTURE — use these three plain sections in this order if content exists: "

    "Done "
    "Things I finished or completed today go here. "
    "Write each as a short plain sentence. One idea per line. No symbols or bullets. "

    "In Progress "
    "Things I started, am waiting on, or are still happening go here. "

    "To Do "
    "Reminders, follow-ups, future plans, and anything I need to act on go here. "
    "If there is a time or date attached, include it naturally in the sentence. "
    "Example: I need to remind Jack to pick up her bag when she is back next week. "

    "SECTION LABEL RULES: "
    "Write the section label on its own line — Done, In Progress, To Do. "
    "No bold, no caps, no symbols around them. Just the plain word. "
    "Skip any section that has no content. "

    "EMOJI RULES: "
    "One small relevant emoji at the start of each sentence only. "
    "No emojis inside sentences. No decorative or repeated emojis. "

    "CLOSING LINE: "
    "Always end with exactly this and nothing else after it: "
    "And whatever comes, VoiceMate is with you ❤︎. "

    "STRICT RULES: "
    "No bullet points, numbered lists, bold, or any symbols like ***, --, >>. "
    "No filler phrases like based on what you shared or this reflects. "
    "No questions to the user anywhere. "
    "No double closing lines. Only one closing line, always the same. "
    "Never mention AI, analysis, or that this is generated content. "
    "If the user introduces themselves, use the name in the greeting only then move on. "
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
