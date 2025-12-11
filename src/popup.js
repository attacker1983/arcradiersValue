// Popup window: simplified UI without search boxes. Only capture, overlay, and DB import/export/reset.

(function () {
  const captureBtn = document.getElementById('captureBtn');
  const resultDiv = document.getElementById('lastChecked');
  const fileInput = document.getElementById('fileInput');
  const importBtn = document.getElementById('importBtn');
  const exportBtn = document.getElementById('exportBtn');
  const resetSampleBtn = document.getElementById('resetSampleBtn');
  const openOverlayBtn = document.getElementById('openOverlayBtn');
  const statusDiv = document.getElementById('status');

  function setStatus(s, timeout = 2500) {
    statusDiv.textContent = s;
    if (timeout > 0) {
      setTimeout(() => {
        if (statusDiv.textContent === s) statusDiv.textContent = '';
      }, timeout);
    }
  }

  function loadDB() {
    try {
      const raw = localStorage.getItem('arcr_value_items_db') || '{}';
      return JSON.parse(raw);
    } catch (e) {
      console.error('Failed to parse DB', e);
      return {};
    }
  }

  function saveDB(obj) {
    localStorage.setItem('arcr_value_items_db', JSON.stringify(obj));
  }

  function showLastChecked() {
    const last = localStorage.getItem('arcr_value_last_checked');
    if (!last) {
      resultDiv.innerHTML = `<div><strong>No item checked yet</strong></div>`;
      return;
    }
    try {
      const parsed = JSON.parse(last);
      const name = parsed.item || '(unknown)';
      const value = parsed.value != null ? parsed.value : 'not found';
      const src = parsed.source || 'unknown';
      const time = parsed.timestamp ? new Date(parsed.timestamp).toLocaleTimeString() : '';
      resultDiv.innerHTML = `<div><strong>${escapeHtml(name)}</strong> — <span style="color:#b8860b">${escapeHtml(String(value))}</span></div>
                             <div class="small-note">source: ${escapeHtml(src)} ${time ? '• ' + escapeHtml(time) : ''}</div>`;
    } catch (e) {
      resultDiv.innerHTML = `<div><strong>Invalid last checked data</strong></div>`;
    }
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"'`=\/]/g, function (c) {
      return {
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
        '/': '&#x2F;', '`': '&#x60;', '=': '&#x3D;'
      }[c];
    });
  }

  captureBtn.addEventListener('click', async () => {
    setStatus('Capturing... allow screen capture if prompted', 5000);
    try {
      if (window.captureLookupFlow) {
        await window.captureLookupFlow();
      } else {
        if (window.overwolf && overwolf.windows) {
          overwolf.windows.obtainDeclaredWindow('background', function (res) {
            if (res && res.status === 'success') {
              overwolf.windows.restore('background', () => {
                setStatus('Background restored; trigger capture via hotkey (Ctrl+F) if needed', 3000);
              });
            } else {
              setStatus('Capture unavailable in this context', 3000);
            }
          });
        } else {
          setStatus('Capture unavailable; open background window or use hotkey', 3000);
        }
      }
      showLastChecked();
      setStatus('Capture finished', 2000);
    } catch (e) {
      console.error('Capture failed', e);
      setStatus('Capture failed: ' + (e.message || e), 4000);
    }
  });

  exportBtn.addEventListener('click', () => {
    const db = loadDB();
    const text = JSON.stringify(db, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'arcr_values.json';
    a.click();
    URL.revokeObjectURL(url);
    setStatus('Export started');
  });

  importBtn.addEventListener('click', () => {
    fileInput.value = '';
    fileInput.click();
  });

  fileInput.addEventListener('change', (ev) => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (typeof parsed !== 'object' || parsed === null) throw new Error('Invalid DB object');
        saveDB(parsed);
        setStatus('Import successful');
      } catch (e) {
        console.error('Import error', e);
        setStatus('Invalid JSON file for DB', 4000);
      }
    };
    reader.onerror = () => setStatus('Failed to read file', 3000);
    reader.readAsText(f);
  });

  resetSampleBtn.addEventListener('click', () => {
    fetch('src/values.json').then(r => r.json()).then(json => {
      saveDB(json);
      setStatus('Reset to sample DB');
    }).catch(e => {
      console.error('Reset sample failed', e);
      setStatus('Failed to load sample', 3000);
    });
  });

  openOverlayBtn.addEventListener('click', () => {
    if (overwolf && overwolf.windows) {
      overwolf.windows.obtainDeclaredWindow('overlay', function (res) {
        if (res.status === 'success') {
          overwolf.windows.restore('overlay', function () {
            setStatus('Overlay opened');
          });
        } else {
          setStatus('Failed to open overlay');
        }
      });
    } else {
      setStatus('Overlay API not available');
    }
  });

  window.addEventListener('storage', (ev) => {
    if (ev.key === 'arcr_value_last_checked') showLastChecked();
  });

  showLastChecked();
  console.log('Popup ready (no search boxes)');
})();