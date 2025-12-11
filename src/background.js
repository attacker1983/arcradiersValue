// Background window: detects Arc Raiders, manages overlay, registers hotkey/capture flow,
// performs OCR capture around cursor and fetches value from arctracker.io (with proxy fallback).

(async function () {
  console.log('Background started (OCR + lookup enabled)');

  const TARGET_SITE = 'https://arctracker.io/items/';
  const PROXY_URL = 'http://localhost:4000/lookup?name='; // fallback if CORS blocks direct fetch

  function nameToSlug(name) {
    if (!name) return '';
    return name.trim()
      .toLowerCase()
      .replace(/[\u2019']/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_');
  }

  function setLastChecked(item, value, source = 'direct') {
    const obj = { item, value, source, timestamp: Date.now() };
    localStorage.setItem('arcr_value_last_checked', JSON.stringify(obj));
    window.dispatchEvent(new Event('arcr_checked'));
    console.log('Saved last checked', obj);
  }

  async function fetchValueDirect(slug) {
    const url = TARGET_SITE + encodeURIComponent(slug);
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const html = await res.text();
      const candidate = extractValueFromHtml(html);
      return candidate ? { value: candidate, source: 'arctracker_direct', url } : null;
    } catch (e) {
      console.warn('Direct fetch failed', e);
      return null;
    }
  }

  async function fetchValueViaProxy(name) {
    try {
      const res = await fetch(PROXY_URL + encodeURIComponent(name));
      if (!res.ok) throw new Error('Proxy HTTP ' + res.status);
      const j = await res.json();
      return j && j.value ? { value: j.value, source: 'proxy', url: j.url || '' } : null;
    } catch (e) {
      console.warn('Proxy fetch failed', e);
      return null;
    }
  }

  function extractValueFromHtml(html) {
    const text = html.replace(/<script[\s\S]*?<\/script>/gi, '')
                     .replace(/<style[\s\S]*?<\/style>/gi, '')
                     .replace(/<\/?[^>]+(>|$)/g, ' ')
                     .replace(/\s+/g, ' ')
                     .toLowerCase();
    const valueRegex = /(value|price|worth)[^\d\-]{0,30}([0-9][0-9,\.]{0,10})/i;
    const m = text.match(valueRegex);
    if (m && m[2]) return normalizeNumberString(m[2]);
    const nums = Array.from(text.matchAll(/([0-9][0-9,\.]{0,10})/g), x => normalizeNumberString(x[1])).filter(Boolean);
    if (nums.length === 0) return null;
    const largest = nums.reduce((a,b) => (a>b? a:b), nums[0]);
    return largest;
  }

  function normalizeNumberString(s) {
    if (!s) return null;
    const cleaned = s.replace(/,/g, '').replace(/[^\d\.]/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }

  async function captureAndOCR() {
    try {
      if (window.overwolf && window.overwolf.media && window.overwolf.media.getScreenshot) {
        const res = await new Promise(resolve => overwolf.media.getScreenshot(resolve));
        console.log('overwolf screenshot result', res);
        if (res && res.url) {
          const img = new Image();
          img.src = res.url;
          await new Promise(r => { img.onload = r; img.onerror = r; });
          const pos = await getMousePosition();
          return await cropImageAndOCR(img, pos.x, pos.y);
        }
      }
    } catch (e) {
      console.warn('Overwolf screenshot attempt failed', e);
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: 'always' } });
      const track = stream.getVideoTracks()[0];
      const image = await captureFrameFromTrack(track);
      track.stop();
      const pos = await getMousePosition();
      return await cropImageAndOCR(image, pos.x, pos.y);
    } catch (e) {
      console.warn('getDisplayMedia failed or denied', e);
      throw new Error('Screen capture not available. Allow screen capture or use the manual capture button.');
    }
  }

  function captureFrameFromTrack(track) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const video = document.createElement('video');
      video.autoplay = true;
      video.muted = true;
      video.srcObject = new MediaStream([track]);
      video.onloadedmetadata = () => {
        video.play().then(() => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            img.src = canvas.toDataURL('image/png');
            img.onload = () => resolve(img);
            img.onerror = e => reject(e);
          } catch (e) { reject(e); }
        }).catch(reject);
      };
      video.onerror = reject;
    });
  }

  async function cropImageAndOCR(img, cx, cy, w = 420, h = 140) {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    if (!cx || !cy) {
      cx = canvas.width / 2;
      cy = canvas.height / 3;
    }

    const left = Math.max(0, Math.round(cx - w/2));
    const top = Math.max(0, Math.round(cy - h/2));
    const cw = Math.min(w, canvas.width - left);
    const ch = Math.min(h, canvas.height - top);

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = cw;
    cropCanvas.height = ch;
    const cc = cropCanvas.getContext('2d');
    cc.drawImage(canvas, left, top, cw, ch, 0, 0, cw, ch);

    const imgData = cc.getImageData(0,0,cw,ch);
    for (let i=0;i<imgData.data.length;i+=4) {
      const r = imgData.data[i], g = imgData.data[i+1], b = imgData.data[i+2];
      let gray = 0.299*r + 0.587*g + 0.114*b;
      gray = Math.min(255, Math.max(0, (gray - 80) * 1.8 + 80));
      imgData.data[i] = imgData.data[i+1] = imgData.data[i+2] = gray;
    }
    cc.putImageData(imgData, 0, 0);

    const whitelist = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 _-()";
    const txt = await window.doOCR(cropCanvas, { lang: 'eng', whitelist });
    const lines = txt.split('\n').map(l=>l.trim()).filter(Boolean);
    const best = lines.length ? lines[0] : (txt || '').trim();
    return best;
  }

  function getMousePosition() {
    return new Promise((resolve) => {
      if (window.__lastMousePos) return resolve(window.__lastMousePos);
      resolve({ x: 0, y: 0 });
    });
  }

  window.addEventListener('mousemove', (ev) => {
    window.__lastMousePos = { x: ev.screenX || ev.clientX || 0, y: ev.screenY || ev.clientY || 0 };
  });

  async function captureLookupFlow() {
    try {
      const rawText = await captureAndOCR();
      if (!rawText) throw new Error('No text captured');
      const cleaned = rawText.replace(/[|]+/g, 'i').replace(/[^a-zA-Z0-9 \-_()']/g, ' ').trim();
      console.log('OCR text:', JSON.stringify(rawText), 'cleaned:', cleaned);
      const slug = nameToSlug(cleaned);
      if (!slug) throw new Error('Could not normalize item name');
      const direct = await fetchValueDirect(slug);
      if (direct) {
        setLastChecked(cleaned, direct.value, direct.source);
        return direct;
      }
      const prox = await fetchValueViaProxy(cleaned);
      if (prox) {
        setLastChecked(cleaned, prox.value, prox.source);
        return prox;
      }
      setLastChecked(cleaned, null, 'not_found');
      return null;
    } catch (e) {
      console.error('captureLookupFlow failed', e);
      setLastChecked('', null, 'error');
      throw e;
    }
  }

  function registerHotkey() {
    try {
      if (window.overwolf && overwolf.settings && overwolf.settings.registerHotKey) {
        overwolf.settings.registerHotKey('capture_item', function (res) {
          console.log('Hotkey callback', res);
          if (res && res.isPressed) {
            captureLookupFlow().catch(err => { console.warn('Hotkey capture error', err); });
          }
        });
        console.log('Registered overwolf hotkey (capture_item)');
      } else {
        window.addEventListener('keydown', (ev) => {
          if (ev.ctrlKey && ev.key.toLowerCase() === 'f') {
            ev.preventDefault();
            captureLookupFlow().catch(e => console.warn(e));
          }
        });
        console.log('Registered local ctrl+f fallback in background page');
      }
    } catch (e) {
      console.warn('Hotkey registration error', e);
    }
  }

  window.captureLookupFlow = captureLookupFlow;

  registerHotkey();

  setInterval(() => {}, 60000);

  console.log('Background ready');
})();