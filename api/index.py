from flask import Flask, request, jsonify
import speech_recognition as sr
from datetime import datetime
from groq import Groq
import os

app = Flask(__name__)

def top_tier_summary(text):
    """Uses Meta's Llama 3 via Groq for high-speed, empathetic summaries."""
    api_key = os.environ.get("GROQ_API_KEY")
    
    if not api_key:
        return "System Alert: I cannot find the GROQ_API_KEY in Vercel Environment Variables."

    try:
        client = Groq(api_key=api_key)
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are a warm, highly intelligent, and empathetic personal journaling companion. Summarize the user's daily voice notes. Speak directly to them using 'You'. Acknowledge their hard work, validate their feelings, and offer one gentle, encouraging thought at the end. Keep it human, concise, and professional."
                },
                {
                    "role": "user",
                    "content": f"Here are my voice notes for today: {text}"
                }
            ],
            model="llama3-8b-8192", 
            temperature=0.6,
            max_tokens=250
        )
        return chat_completion.choices[0].message.content
        
    except Exception as e:
        return f"Groq API Error: {str(e)}"

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
                
        return jsonify({'success': True, 'text': text})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/summary', methods=['POST'])
def get_summary():
    # We now receive the logs directly from the browser! No more /tmp files.
    data = request.get_json()
    
    if not data or 'logs' not in data or len(data['logs']) == 0:
        return jsonify({'summary': "Your mind is clear today! Hit Start to log a thought.", 'date': datetime.now().strftime("%A, %b %d")})
        
    # Join all the logs into one big text block
    full_text = " ".join(data['logs'])
    
    # Send to Groq
    summary_text = top_tier_summary(full_text)
    
    return jsonify({
        'summary': summary_text,
        'date': datetime.now().strftime("%A, %B %d, %Y at %I:%M %p"),
    })

if __name__ == '__main__':
    app.run(debug=True)
