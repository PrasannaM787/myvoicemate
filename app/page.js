'use client';
import { useState, useRef } from 'react';

export default function Home() {
  const [status, setStatus] = useState('Ready');
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];
      
      mediaRecorder.current.ondataavailable = (e) => audioChunks.current.push(e.data);
      mediaRecorder.current.onstop = async () => {
        setStatus('Processing in Python...');
        
        const blob = new Blob(audioChunks.current, { type: 'audio/webm' });
        
        // Convert to WAV format for Python
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const wavBlob = bufferToWave(audioBuffer, audioBuffer.length);
        
        const formData = new FormData();
        formData.append('file', wavBlob, 'audio.wav');
        
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        
        if (data.text) {
           const timeNow = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
           setLogs(prev => [...prev, `[${timeNow}] ${data.text}`]);
           setStatus('Saved locally.');
        } else {
           setStatus('Transcription failed. Speak clearly.');
        }
      };
      
      mediaRecorder.current.start();
      setStatus('Listening...');
    } catch (err) {
      setStatus('Microphone access denied.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current) mediaRecorder.current.stop();
  };

  const fetchSummary = async () => {
    setStatus('Running Math Algorithm...');
    const res = await fetch('/api/summary');
    const data = await res.json();
    setSummary({ date: data.date, text: data.summary });
    setStatus('Ready');
  };

  // Helper function to encode WAV strictly for Python SpeechRecognition
  function bufferToWave(abuffer, len) {
    let numOfChan = abuffer.numberOfChannels, length = len * numOfChan * 2 + 44,
        buffer = new ArrayBuffer(length), view = new DataView(buffer),
        channels = [], i, sample, offset = 0, pos = 0;
    setUint32(0x46464952); setUint32(length - 8); setUint32(0x45564157);
    setUint32(0x20746d66); setUint32(16); setUint16(1); setUint16(numOfChan);
    setUint32(abuffer.sampleRate); setUint32(abuffer.sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2); setUint16(16); setUint32(0x61746164); setUint32(length - pos - 4);
    for(i = 0; i < abuffer.numberOfChannels; i++) channels.push(abuffer.getChannelData(i));
    while(pos < length) {
      for(i = 0; i < numOfChan; i++) {
        sample = Math.max(-1, Math.min(1, channels[i][offset]));
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0;
        view.setInt16(pos, sample, true); pos += 2;
      }
      offset++
    }
    return new Blob([buffer], {type: "audio/wav"});
    function setUint16(data) { view.setUint16(pos, data, true); pos += 2; }
    function setUint32(data) { view.setUint32(pos, data, true); pos += 4; }
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '20px', backgroundColor: '#111', color: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <h2 style={{textAlign: 'center'}}>EchoLog (No-AI Engine)</h2>
      <p style={{ color: '#aaa', textAlign: 'center' }}>{status}</p>
      
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '20px' }}>
        <button 
          onPointerDown={startRecording} onPointerUp={stopRecording}
          onTouchStart={startRecording} onTouchEnd={stopRecording}
          style={{ width: '90px', height: '90px', borderRadius: '50%', backgroundColor: 'red', color: 'white', border: 'none', fontWeight: 'bold' }}
        >
          Hold
        </button>
        <button 
          onClick={fetchSummary}
          style={{ width: '90px', height: '90px', borderRadius: '15px', backgroundColor: '#3b82f6', color: 'white', border: 'none', fontWeight: 'bold' }}
        >
          Summarize
        </button>
      </div>

      {summary && (
        <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#1e3a8a', borderRadius: '10px' }}>
          <h3 style={{margin: '0 0 10px 0'}}>Day Analysis</h3>
          <p style={{fontSize: '12px', color: '#93c5fd', margin: '0 0 10px 0'}}>{summary.date}</p>
          <p style={{margin: 0, fontStyle: 'italic'}}>"{summary.text}"</p>
        </div>
      )}

      <div style={{ marginTop: '20px', flex: 1, borderTop: '1px solid #333', paddingTop: '20px' }}>
        {logs.map((log, i) => <p key={i} style={{fontSize: '14px', borderBottom: '1px solid #222', paddingBottom: '10px'}}>{log}</p>)}
      </div>
    </div>
  );
}
