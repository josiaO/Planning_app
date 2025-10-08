SmartPDFReader component

This component implements an in-app PDF reader with AI-assisted features.

Features:
- Upload and render PDFs using react-pdf.
- Select text to request Explain/Translate/Define via the app's AI proxy.
- Save highlights and notes locally in Dexie (db.highlights).
- Save reflections to db.reflections.
- Generate flashcards from highlights (stored in db.flashcards) via AI.
- OCR fallback using Tesseract.js if PDF is scanned.

Run locally:
1. npm install
2. npm run dev
3. (optional) npm run dev:agent to start the AI proxy server (server.agent_api)

Tests:
- Unit tests (Vitest/Jest style) are added under src/components/__tests__.
- Playwright smoke test is in tests/smoke.spec.ts — run with `npm run test:playwright` after starting dev server.
