from flask import Flask, request, jsonify
import speech_recognition as sr
import os
from datetime import datetime
from groq import Groq

app = Flask(__name__)
JOURNAL_FILE = '/tmp/daily_journal.txt'

def top_tier_summary(text):
    """Uses Meta's Llama 3 via Groq for production-grade, highly empathetic summaries."""
    api_key = os.environ.get("GROQ_API_KEY")
    
    # Failsafe if the API key isn't in Vercel
    if not api_key:
        return "System Alert: Please add your GROQ_API_KEY to your Vercel Environment Variables to unlock the AI."

    client = Groq(api_key=api_key)
    
    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are a warm, highly intelligent, and empathetic personal journaling companion. Summarize the user's daily voice notes. Speak directly to them using 'You'. Acknowledge their hard work, validate their stress, and offer one gentle, encouraging thought at the end. Keep it human, concise, and professional."
                },
                {
                    "role": "user",
                    "content": f"Here are my voice notes for today: {text}"
                }
            ],
            model="llama3-8b-8192", # Top open-source model
            temperature=0.6,
            max_tokens=250
        )
        return chat_completion.choices[0].message.content
        
    except Exception as e:
        return "I captured your notes perfectly, but I'm having a little trouble thinking right now. Your data is safe!"

@app.route('/api/upload', methods=['POST'])
def upload_audio():
    if 'file' not in request.files:
        return jsonify({'error': 'No file received'}), 400
        
    file = request.files['file']
    temp_path = '/tmp/audio.wav'
    file.save(temp_path)
    
    recognizer = sr.Recognizer()
    try:
        with sr.AudioFile(temp_path) as source:
            audio_data = recognizer.record(source)
            text = recognizer.recognize_google(audio_data)
            
            timestamp = datetime.now().strftime("%I:%M %p")
            with open(JOURNAL_FILE, 'a') as f:
                f.write(f"[{timestamp}] {text}. \n")
                
        return jsonify({'success': True, 'text': text})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/summary', methods=['GET'])
def get_summary():
    if not os.path.exists(JOURNAL_FILE):
        return jsonify({'summary': "Your mind is clear today! Hold the Start button to log a thought.", 'date': datetime.now().strftime("%A, %b %d")})
        
    with open(JOURNAL_FILE, 'r') as f:
        full_text = f.read()
        
    # Call Llama 3
    summary_text = top_tier_summary(full_text)
    
    return jsonify({
        'summary': summary_text,
        'date': datetime.now().strftime("%A, %B %d, %Y at %I:%M %p"),
    })

if __name__ == '__main__':
    app.run(debug=True)
