from flask import Flask, request, jsonify
import speech_recognition as sr
import os
from datetime import datetime
import requests
import urllib.parse

app = Flask(__name__)
JOURNAL_FILE = '/tmp/daily_journal.txt'

def free_llm_summary(text):
    """Uses a completely free, keyless open LLM endpoint for empathetic summarization"""
    prompt = f"""
    You are an empathetic, highly intelligent journaling companion. 
    The user recorded these voice notes today:
    
    {text}
    
    Please write a warm, conversational summary of their day. 
    Speak directly to them in the second person ("You...").
    Acknowledge their tasks, validate their feelings, and offer one gentle, encouraging sentence at the end for their mental well-being.
    Keep it concise and friendly. Do not use robotic phrases.
    """
    
    try:
        # Encode the prompt for the URL
        encoded_prompt = urllib.parse.quote(prompt)
        # Using Pollinations open API - strictly free, no keys required, allows server IPs
        url = f"https://text.pollinations.ai/{encoded_prompt}?model=mistral"
        
        # We give it 15 seconds to respond before timing out
        response = requests.get(url, timeout=15)
        
        if response.status_code == 200:
            return response.text
        else:
            return f"Error {response.status_code}: The open AI engine is overloaded right now. Please try summarizing again in a minute!"
            
    except Exception as e:
        return f"Summary Engine Error: {str(e)}"

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
        return jsonify({'summary': "No notes to summarize yet! Hold the Start button to begin.", 'date': datetime.now().strftime("%A, %b %d")})
        
    with open(JOURNAL_FILE, 'r') as f:
        full_text = f.read()
        
    summary_text = free_llm_summary(full_text)
    
    return jsonify({
        'summary': summary_text,
        'date': datetime.now().strftime("%A, %B %d, %Y at %I:%M %p"),
    })

if __name__ == '__main__':
    app.run(debug=True)
