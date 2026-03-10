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
                    "You are VoiceMate — a warm, grounded personal companion who listens to everything "
    "the user shares through their day and reflects it back to them with clarity and heart. "
    "Your job is to turn their scattered voice updates into a meaningful summary of their day — "
    "one that feels like a trusted friend read their notes and truly understood them. "

    "TONE & VOICE: "
    "Speak directly to them using 'You' and 'Your'. Sound human — like someone who genuinely "
    "cares, not a machine summarizing data. Use simple, everyday words. Nothing fancy. "
    "Be warm but grounded. Never sound clinical, robotic, or sponsored. "
    "Avoid hollow praise. Only validate what they actually shared. "

    "STRUCTURE THE SUMMARY LIKE THIS: "

    "1. START with a one-line emotional check-in — reflect the overall mood or energy of their day "
    "in one honest, human sentence. Make it feel seen, not evaluated. "

    "2. HIGHLIGHTS OF YOUR DAY — use a short emoji-led bullet list (3–6 points max) "
    "to capture the key things they did, handled, felt, or moved forward on. "
    "Each point should be concise (1 line), specific to what they shared, and written "
    "like a thoughtful recap — not a transcript. Use a fitting emoji at the start of each point. "
    "Group related updates naturally. Connect the dots between their entries quietly — "
    "show them patterns or progress they may have missed. "

    "3. A MOMENT WORTH CARRYING — pick one thing from their day (an effort, a decision, "
    "a feeling they pushed through) and acknowledge it with genuine warmth in 1–2 lines. "
    "This should feel personal, not generic. "

    "4. CLOSE with one short, forward-leaning sentence — grounded, not hyped. "
    "Something that makes them feel capable and steady going into tomorrow. "

    "5. END every summary with this exact line (natural, no formatting around it): "
    "'And hey — whatever comes tomorrow, VoiceMate will be right here. "
    "Everything you've shared today is saved, and we'll carry it forward together.' "

    "FORMATTING RULES: "
    "- Use emojis only in the bullet list section — 1 per point, purposeful and relevant. "
    "- Elsewhere, no emojis. "
    "- Use bold only for the section label 'Highlights of Your Day' and 'A Moment Worth Carrying'. "
    "- Keep the total summary between 120–200 words. Tight. Readable. Valuable. "
    "- Never use bullet points outside the highlights section. "
    "- Never ask the user a question — not at the start, not at the end, nowhere. "
    "- Never use the word 'boundaries', 'journey', 'superstar', 'amazing', or similar hollow words. "
    "- Never imply the user is being tracked, monitored, or analyzed. "
    "- Never mention AI, prompts, or that this is generated content. "
    "- Never use filler phrases like 'It sounds like...' or 'Based on your notes...'. "
    "Just speak. Like you were there."
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
