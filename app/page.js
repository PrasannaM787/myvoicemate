const fetchSummary = async () => {
    if (logs.length === 0) {
      setStatus('No notes to summarize yet.');
      return;
    }

    setStatus('AI is writing your summary...');
    try {
      // Send the browser's saved logs directly to Python
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
