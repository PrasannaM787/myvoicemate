'use client';
import { useState, useRef } from 'react';

export default function Home() {
  const [status, setStatus] = useState('Ready');
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];
      
      mediaRecorder.current.ondataavailable = (e) => audioChunks.current.push(e.data);
      
      mediaRecorder.current.onstop = async () => {
        setStatus('Encoding audio to WAV...');
        
        // 1. Get the raw browser audio
        const blob = new Blob(audioChunks.current);
        const arrayBuffer = await blob.arrayBuffer();
        
        // 2. Decode it using the browser's audio engine
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // 3. Force encode to strict 16-bit PCM WAV (which Python demands)
        const wavBlob = audioBufferToWav(audioBuffer);
        
        const formData = new FormData();
        formData.append('file', wavBlob, 'audio.wav');
        
        setStatus('Sending to Python...');
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        
        if (data.text) {
           const timeNow = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
           setLogs(prev => [...prev, `[${timeNow}] ${data.text}`]);
           setStatus('Saved locally.');
        } else {
           setStatus(`Error: ${data.error || 'Failed to transcribe'}`);
        }
      };
      
      mediaRecorder.current.start();
      setIsRecording(true);
      setStatus('Recording... Speak now.');
    } catch (err) {
      setStatus('Microphone access denied.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
      // Stop all microphone tracks to turn off the red recording light on your browser tab
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const fetchSummary = async () => {
    setStatus('Running Extractive Math Algorithm...');
    const res = await fetch('/api/summary');
    const data = await res.json();
    setSummary({ date: data.date, text: data.summary });
    setStatus('Ready');
  };

  // --- BULLETPROOF WAV ENCODER ---
  function audioBufferToWav(buffer) {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const out = new ArrayBuffer(length);
    const view = new DataView(out);
    const channels = [];
    let i, sample, offset = 0, pos = 0;

    // Write WAV Header
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"
    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit
    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    // Write interleaved data
    for (i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));
    while (pos < length) {
      for (i = 0; i < numOfChan; i++) {
        sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
        view.setInt16(pos, sample, true); // write 16-bit sample
        pos += 2;
      }
      offset++;
    }
    return new Blob([out], { type: 'audio/wav' });

    function setUint16(data) { view.setUint16(pos, data, true); pos += 2; }
    function setUint32(data) { view.setUint32(pos, data, true); pos += 4; }
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '20px', backgroundColor: '#111', color: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <h2 style={{textAlign: 'center'}}>EchoLog (No-AI Engine)</h2>
      <p style={{ color: '#aaa', textAlign: 'center', height: '20px' }}>{status}</p>
      
      {/* Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '20px' }}>
        
        {/* Dynamic Start/Stop Button */}
        {!isRecording ? (
          <button 
            onClick={startRecording}
            style={{ width: '100px', height: '100px', borderRadius: '50%', backgroundColor: '#10b981', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Start
          </button>
        ) : (
          <button 
            onClick={stopRecording}
            style={{ width: '100px', height: '100px', borderRadius: '50%', backgroundColor: '#ef4444', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer', animation: 'pulse 1.5s infinite' }}
          >
            Stop
          </button>
        )}

        <button 
          onClick={fetchSummary}
          style={{ width: '100px', height: '100px', borderRadius: '15px', backgroundColor: '#3b82f6', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
        >
          Summarize
        </button>
      </div>

      {/* Summary Dashboard */}
      {summary && (
        <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#1e3a8a', borderRadius: '10px' }}>
          <h3 style={{margin: '0 0 10px 0'}}>Day Analysis</h3>
          <p style={{fontSize: '12px', color: '#93c5fd', margin: '0 0 10px 0'}}>{summary.date}</p>
          <p style={{margin: 0, fontStyle: 'italic'}}>"{summary.text}"</p>
        </div>
      )}

      {/* Raw Logs */}
      <div style={{ marginTop: '20px', flex: 1, borderTop: '1px solid #333', paddingTop: '20px' }}>
        {logs.map((log, i) => <p key={i} style={{fontSize: '14px', borderBottom: '1px solid #222', paddingBottom: '10px'}}>{log}</p>)}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { box-shadow: 0 0 0 15px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}} />
    </div>
  );
}
