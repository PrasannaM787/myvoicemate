from flask import Flask, request, jsonify
import speech_recognition as sr
import os
import re
from datetime import datetime
from collections import Counter

app = Flask(__name__)
JOURNAL_FILE = '/tmp/daily_journal.txt'

def pure_code_summary(text):
    """Summarizes text using mathematical word frequency"""
    words = re.findall(r'\w+', text.lower())
    if not words: return "No entries yet."
    
    # Calculate word weights
    freq = Counter(words)
    max_freq = max(freq.values())
    for word in freq:
        freq[word] = freq[word] / max_freq

    # Score sentences
    sentences = re.split(r'(?<=[.!?]) +', text)
    sentence_scores = {}
    for sent in sentences:
        for word in re.findall(r'\w+', sent.lower()):
            if word in freq:
                sentence_scores[sent] = sentence_scores.get(sent, 0) + freq[word]
                
    # Extract the top 2 sentences
    sorted_sentences = sorted(sentence_scores, key=sentence_scores.get, reverse=True)
    return ' '.join(sorted_sentences[:2])

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
            # Uses public, keyless Google Speech endpoint
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
        return jsonify({'summary': "No data to summarize yet.", 'date': datetime.now().strftime("%A, %b %d")})
        
    with open(JOURNAL_FILE, 'r') as f:
        full_text = f.read()
        
    summary_text = pure_code_summary(full_text)
    
    return jsonify({
        'summary': summary_text,
        'date': datetime.now().strftime("%A, %b %d at %I:%M %p"),
        'raw_log': full_text
    })

# Required for Vercel serverless functions
if __name__ == '__main__':
    app.run(debug=True)
