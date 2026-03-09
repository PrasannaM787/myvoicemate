from flask import Flask, request, jsonify
import speech_recognition as sr
import os
from datetime import datetime
from duckduckgo_search import DDGS

app = Flask(__name__)
JOURNAL_FILE = '/tmp/daily_journal.txt'

def free_llm_summary(text):
    """Uses DuckDuckGo's free AI chat library for empathetic summarization"""
    prompt = f"""
    You are an empathetic, highly intelligent journaling assistant. 
    The user recorded these voice notes today:
    
    {text}
    
    Please write a warm, conversational summary of their day. 
    Acknowledge their tasks, validate their feelings, and offer one gentle, encouraging sentence at the end for their mental well-being.
    Keep it concise, friendly, and speak directly to them (e.g., "It sounds like you had a busy morning...").
    """
    try:
        # Taps into free LLMs (GPT-4o-mini/Claude) with zero API keys
        result = DDGS().chat(prompt, model="gpt-4o-mini")
        return result
    except Exception as e:
        return "I heard everything you said today, but my AI engine is currently taking a quick rest. Your notes are safely saved below!"

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
            # Save to temporary server file for the Python summary engine
            with open(JOURNAL_FILE, 'a') as f:
                f.write(f"[{timestamp}] {text}. \n")
                
        return jsonify({'success': True, 'text': text})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/summary', methods=['GET'])
def get_summary():
    if not os.path.exists(JOURNAL_FILE):
        return jsonify({'summary': "No notes to summarize yet! Hold the Start button to begin.", 'date': datetime.now().strftime("%A, %b %d")})
        
    with open(JOURNAL_FILE, 'r') as f:
        full_text = f.read()
        
    # Call the new Free LLM
    summary_text = free_llm_summary(full_text)
    
    return jsonify({
        'summary': summary_text,
        'date': datetime.now().strftime("%A, %B %d, %Y at %I:%M %p"),
    })

if __name__ == '__main__':
    app.run(debug=True)
