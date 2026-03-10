'use client';
import { useState, useRef, useEffect } from 'react';

export default function Home() {
  const [username, setUsername] = useState('');
  const [isLogged, setIsLogged] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);

  // Theme Colors Configuration
  const theme = {
    bg: isDarkMode ? '#111111' : '#F3F4F6',
    text: isDarkMode ? '#FFFFFF' : '#1F2937',
    subText: isDarkMode ? '#9CA3AF' : '#6B7280',
    card: isDarkMode ? '#1F2937' : '#FFFFFF',
    border: isDarkMode ? '#374151' : '#E5E7EB',
    accent: '#3B82F6',
    insightBg: isDarkMode ? '#1E3A8A' : '#DBEAFE',
    insightText: isDarkMode ? '#E0E7FF' : '#1E40AF'
  };

  useEffect(() => {
    const storedName = localStorage.getItem('voicemate_user');
    const storedLogs = localStorage.getItem('voicemate_logs');
    const storedSummary = localStorage.getItem('voicemate_summary');
    const storedTheme = localStorage.getItem('voicemate_theme');
    
    if (storedName) { setUsername(storedName); setIsLogged(true); }
    if (storedLogs) setLogs(JSON.parse(storedLogs));
    if (storedSummary) setSummary(JSON.parse(storedSummary));
    if (storedTheme !== null) setIsDarkMode(storedTheme === 'true');
  }, []);

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('voicemate_theme', newMode.toString());
  };

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
        setStatus('Processing...');
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
             setStatus('Saved.');
          } else { setStatus('Error in transcription.'); }
        } catch (err) { setStatus('Server error.'); }
      };
      mediaRecorder.current.start();
      setIsRecording(true);
      setStatus('Listening...');
    } catch (err) { setStatus('Mic denied.'); }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const fetchSummary = async () => {
    if (logs.length === 0) { setStatus('No notes.'); return; }
    setStatus('AI is thinking...');
    try {
      const res = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs: logs })
      });
      const data = await res.json();
      const newSummary = { date: data.date, text: data.summary };
      setSummary(newSummary);
      localStorage.setItem('voicemate_summary', JSON.stringify(newSummary));
      setStatus('Ready');
    } catch (err) { setStatus('Summary failed.'); }
  };

  const clearHistory = () => {
    if(confirm("Clear today's log?")) {
      setLogs([]); setSummary(null);
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
      <div style={{ backgroundColor: theme.bg, color: theme.text, height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', transition: '0.3s' }}>
        <h1 style={{fontSize: '3rem', margin: '0 0 10px 0'}}>VoiceMate</h1>
        <p style={{ color: theme.subText, marginBottom: '30px' }}>Your AI journal companion.</p>
        <form onSubmit={handleLogin} style={{ width: '100%', maxWidth: '300px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input type="text" placeholder="Your Name" value={username} onChange={(e) => setUsername(e.target.value)}
            style={{ padding: '15px', borderRadius: '15px', border: `1px solid ${theme.border}`, fontSize: '18px', textAlign: 'center', backgroundColor: theme.card, color: theme.text }} required />
          <button type="submit" style={{ padding: '15px', borderRadius: '15px', border: 'none', backgroundColor: theme.accent, color: '#fff', fontSize: '18px', fontWeight: 'bold' }}>Let's Talk</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: theme.bg, color: theme.text, minHeight: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', transition: '0.3s', overflowX: 'hidden' }}>
      
      {/* Dynamic Header */}
      <div style={{ padding: '20px', borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.card }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem', color: theme.accent }}>Hi, {username}</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={toggleTheme} style={{ background: 'transparent', border: `1px solid ${theme.border}`, padding: '8px', borderRadius: '50%', cursor: 'pointer', fontSize: '18px' }}>
                {isDarkMode ? '☀️' : '🌙'}
            </button>
            <button onClick={clearHistory} style={{ background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '8px 15px', borderRadius: '10px', fontSize: '12px' }}>Clear</button>
        </div>
      </div>

      <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <p style={{ color: theme.subText, textAlign: 'center', margin: 0, fontSize: '14px', fontWeight: '600' }}>{status}</p>
        
        {/* Main Controls */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '30px' }}>
          {!isRecording ? (
            <button onClick={startRecording} style={{ width: '90px', height: '90px', borderRadius: '50%', backgroundColor: '#10b981', color: '#fff', border: 'none', fontWeight: 'bold', fontSize: '16px', boxShadow: '0 4px 14px 0 rgba(16, 185, 129, 0.39)' }}>Start</button>
          ) : (
            <button onClick={stopRecording} style={{ width: '90px', height: '90px', borderRadius: '50%', backgroundColor: '#ef4444', color: '#fff', border: 'none', fontWeight: 'bold', animation: 'pulse 1.5s infinite' }}>Stop</button>
          )}
          <button onClick={fetchSummary} style={{ width: '90px', height: '90px', borderRadius: '25px', backgroundColor: theme.accent, color: '#fff', border: 'none', fontWeight: 'bold', boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.39)' }}>Summarize</button>
        </div>

        {/* AI Insight Section */}
        {summary && (
          <div style={{ padding: '25px', backgroundColor: theme.insightBg, borderRadius: '25px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', border: `1px solid ${theme.border}` }}>
            <h3 style={{margin: '0 0 10px 0', fontSize: '1.2rem', color: theme.insightText}}>AI Daily Analysis</h3>
            <p style={{fontSize: '11px', color: theme.subText, marginBottom: '15px', textTransform: 'uppercase'}}>{summary.date}</p>
            <p style={{margin: 0, lineHeight: '1.8', fontSize: '16px', color: theme.insightText}}>{summary.text}</p>
          </div>
        )}

        {/* History List */}
        <div>
          <h4 style={{ color: theme.subText, fontSize: '0.8rem', marginBottom: '15px', letterSpacing: '1px' }}>VOICE LOGS</h4>
          {logs.map((log, i) => (
            <div key={i} style={{ backgroundColor: theme.card, padding: '18px', borderRadius: '18px', marginBottom: '12px', fontSize: '15px', border: `1px solid ${theme.border}`, boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>{log}</div>
          ))}
          {logs.length === 0 && <p style={{color: theme.subText, textAlign: 'center', fontStyle: 'italic', marginTop: '40px'}}>Ready to hear your thoughts.</p>}
        </div>
      </div>

      {/* Team Appreciation Footer */}
      <div style={{ padding: '40px 20px', textAlign: 'center', borderTop: `1px solid ${theme.border}`, backgroundColor: isDarkMode ? '#000' : '#FFF' }}>
        <p style={{ fontSize: '14px', color: theme.subText, marginBottom: '20px' }}>Your support helps our team keep the AI brain alive and free.</p>
        <a href="https://rzp.io/rzp/myvoicemate_subscriptions" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
           <div style={{ backgroundColor: '#FFDD00', color: '#000', padding: '14px 30px', borderRadius: '15px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
             ❤️ Support MyVoiceMate Team
           </div>
        </a>
        <p style={{ fontSize: '11px', color: theme.subText, marginTop: '20px' }}>Designed with care for your mental clarity.</p>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        body { margin: 0; padding: 0; overflow-x: hidden; }
        @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); } 70% { box-shadow: 0 0 0 20px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
      `}} />
    </div>
  );
}
