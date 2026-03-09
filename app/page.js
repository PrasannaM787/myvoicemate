'use client';
import { useState, useRef, useEffect } from 'react';

export default function Home() {
  const [username, setUsername] = useState('');
  const [isLogged, setIsLogged] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);

  useEffect(() => {
    const storedName = localStorage.getItem('voicemate_user');
    const storedLogs = localStorage.getItem('voicemate_logs');
    const storedSummary = localStorage.getItem('voicemate_summary');
    
    if (storedName) {
      setUsername(storedName);
      setIsLogged(true);
    }
    if (storedLogs) setLogs(JSON.parse(storedLogs));
    if (storedSummary) setSummary(JSON.parse(storedSummary));
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (username.trim()) {
      localStorage.setItem('voicemate_user', username);
      setIsLogged(true);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];
      
      mediaRecorder.current.ondataavailable = (e) => audioChunks.current.push(e.data);
      
      mediaRecorder.current.onstop = async () => {
        setStatus('Processing your voice...');
        const blob = new Blob(audioChunks.current);
        const arrayBuffer = await blob.arrayBuffer();
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const wavBlob = audioBufferToWav(audioBuffer);
        
        const formData = new FormData();
        formData.append('file', wavBlob, 'audio.wav');
        
        try {
          const res = await fetch('/api/upload', { method: 'POST', body: formData });
          const data = await res.json();
          
          if (data.text) {
             const timeNow = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
             const newLog = `[${timeNow}] ${data.text}`;
             
             setLogs(prev => {
               const updatedLogs = [...prev, newLog];
               localStorage.setItem('voicemate_logs', JSON.stringify(updatedLogs));
               return updatedLogs;
             });
             setStatus('Saved successfully.');
          } else {
             setStatus(`Transcription Error: ${data.error || 'Unknown'}`);
          }
        } catch (err) {
          setStatus('Failed to reach Vercel server.');
        }
      };
      
      mediaRecorder.current.start();
      setIsRecording(true);
      setStatus('Listening... Speak now.');
    } catch (err) {
      setStatus('Microphone access denied.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const fetchSummary = async () => {
    if (logs.length === 0) {
      setStatus('No notes to summarize yet.');
      return;
    }

    setStatus('AI is writing your summary...');
    try {
      const res = await fetch('/api/summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ logs: logs })
      });
      
      if (!res.ok) {
        throw new Error(`Server Crash (Error ${res.status})`);
      }
      
      const data = await res.json();
      
      const newSummary = { date: data.date, text: data.summary };
      setSummary(newSummary);
      localStorage.setItem('voicemate_summary', JSON.stringify(newSummary));
      setStatus('Ready');
    } catch (err) {
      setStatus(`Summary Failed: ${err.message}`);
    }
  };

  const clearHistory = () => {
    if(confirm("Erase all today's logs and summaries?")) {
      setLogs([]);
      setSummary(null);
      localStorage.removeItem('voicemate_logs');
      localStorage.removeItem('voicemate_summary');
    }
  };

  function audioBufferToWav(buffer) {
    const numOfChan = buffer.numberOfChannels, length = buffer.length * numOfChan * 2 + 44;
    const out = new ArrayBuffer(length), view = new DataView(out), channels = [];
    let i, sample, offset = 0, pos = 0;
    setUint32(0x46464952); setUint32(length - 8); setUint32(0x45564157); setUint32(0x20746d66); setUint32(16); setUint16(1); setUint16(numOfChan);
    setUint32(buffer.sampleRate); setUint32(buffer.sampleRate * 2 * numOfChan); setUint16(numOfChan * 2); setUint16(16); setUint32(0x61746164); setUint32(length - pos - 4);
    for (i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));
    while (pos < length) {
      for (i = 0; i < numOfChan; i++) {
        sample = Math.max(-1, Math.min(1, channels[i][offset]));
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
        view.setInt16(pos, sample, true); pos += 2;
      }
      offset++;
    }
    return new Blob([out], { type: 'audio/wav' });
    function setUint16(data) { view.setUint16(pos, data, true); pos += 2; }
    function setUint32(data) { view.setUint32(pos, data, true); pos += 4; }
  }

  if (!isLogged) {
    return (
      <div style={{ fontFamily: 'sans-serif', backgroundColor: '#111', color: '#fff', height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <h1 style={{ marginBottom: '10px' }}>Welcome to VoiceMate</h1>
        <p style={{ color: '#aaa', marginBottom: '30px' }}>Your personal AI audio journal.</p>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input 
            type="text" 
            placeholder="Enter your name..." 
            value={username} 
            onChange={(e) => setUsername(e.target.value)}
            style={{ padding: '15px', borderRadius: '10px', border: 'none', fontSize: '16px', width: '250px', textAlign: 'center' }}
            required
          />
          <button type="submit" style={{ padding: '15px', borderRadius: '10px', border: 'none', backgroundColor: '#3b82f6', color: '#fff', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
            Let's Talk
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '20px', backgroundColor: '#111', color: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column', maxWidth: '800px', margin: '0 auto' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '15px' }}>
        <h2 style={{ margin: 0, color: '#60a5fa' }}>Hello {username}! Let's talk.</h2>
        <button onClick={clearHistory} style={{ background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}>Clear Day</button>
      </div>

      <p style={{ color: '#aaa', textAlign: 'center', margin: '20px 0', height: '20px', fontWeight: 'bold' }}>{status}</p>
      
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px' }}>
        {!isRecording ? (
          <button onClick={startRecording} style={{ width: '90px', height: '90px', borderRadius: '50%', backgroundColor: '#10b981', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>Start</button>
        ) : (
          <button onClick={stopRecording} style={{ width: '90px', height: '90px', borderRadius: '50%', backgroundColor: '#ef4444', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer', animation: 'pulse 1.5s infinite' }}>Stop</button>
        )}
        <button onClick={fetchSummary} style={{ width: '90px', height: '90px', borderRadius: '15px', backgroundColor: '#3b82f6', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>Summarize</button>
      </div>

      {summary && (
        <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#1e3a8a', borderRadius: '12px', borderLeft: '5px solid #60a5fa' }}>
          <h3 style={{margin: '0 0 10px 0'}}>Your Daily Insights</h3>
          <p style={{fontSize: '13px', color: '#93c5fd', margin: '0 0 15px 0', borderBottom: '1px solid #3b82f6', paddingBottom: '10px'}}>{summary.date}</p>
          <p style={{margin: 0, lineHeight: '1.6', fontSize: '15px'}}>{summary.text}</p>
        </div>
      )}

      <div style={{ marginTop: '30px', flex: 1 }}>
        <h4 style={{ color: '#aaa', marginBottom: '15px' }}>Today's Transcripts ({logs.length})</h4>
        {logs.map((log, i) => <p key={i} style={{fontSize: '15px', backgroundColor: '#222', padding: '15px', borderRadius: '8px', marginBottom: '10px', lineHeight: '1.5'}}>{log}</p>)}
        {logs.length === 0 && <p style={{color: '#555', fontStyle: 'italic'}}>Your mind is clear. Record a thought above.</p>}
      </div>

      <div style={{ textAlign: 'center', marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #333' }}>
        <a href="https://www.buymeacoffee.com/YOUR_USERNAME" target="_blank" rel="noreferrer">
          <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style={{ height: '45px', borderRadius: '8px' }} />
        </a>
      </div>

      <style dangerouslySetInnerHTML={{__html: `@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); } 70% { box-shadow: 0 0 0 15px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }`}} />
    </div>
  );
}
