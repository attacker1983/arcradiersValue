```markdown
# Arc Raiders Value Checker (Overwolf) — OCR + arctracker.io lookup

This Overwolf app captures an item tooltip via hotkey (Ctrl+F), runs OCR to read the item name, normalizes it to an arctracker slug, and scrapes arctracker.io for the item value. If direct fetch is blocked by CORS, a small local proxy scrapes the site server-side.

Quick start (developer mode)
1. Optional: run proxy (recommended for reliable scraping)
   - From project root:
     npm install express node-fetch cheerio
     node src/proxy-server.js

2. Load the app in Overwolf developer mode:
   - Enable Developer Mode in Overwolf and install unpacked app (point to this folder)
   - Or package into a .overwolfpkg

3. Run the app, open the popup, and press Ctrl+F while hovering an item tooltip in-game. Allow screen capture if prompted.

Notes
- If the capture fails, try using the popup "Capture" button and allow screen capture permission when requested.
- OCR accuracy depends on tooltip contrast; provide a screenshot if you want me to tune preprocessing.
- The proxy server runs on http://localhost:4000/lookup?name=ITEM_NAME by default. Change PROXY_URL in src/background.js if you run it on a different host/port.

Security and TOS
- Be careful with any method that reads game memory or interacts with game internals; avoid methods that could violate the game's TOS.

If you want, I can:
- Harden the proxy to target exact selectors on arctracker.io (more accurate)
- Improve OCR for your game's tooltip (upload a screenshot)
- Provide a small script that automates packaging & local install
```