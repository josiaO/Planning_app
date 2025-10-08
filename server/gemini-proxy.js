#!/usr/bin/env node
import express from 'express';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
app.use(express.json());

// Use a non-VITE env var so the key is not accidentally exposed to the client
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'models/text-bison-001';

if (!GEMINI_KEY) {
  console.error('GEMINI key (GEMINI_API_KEY) not found in environment');
}

app.post('/api/gemini/generate', async (req, res) => {
  try {
    if (!GEMINI_KEY) return res.status(500).json({ error: 'Gemini key missing' });
    const { prompt, temperature } = req.body;
    const url = `https://generativelanguage.googleapis.com/v1/${MODEL}:generateText?key=${GEMINI_KEY}`;
    const body = { prompt: { text: prompt }, temperature: temperature ?? 0.2, candidateCount: 1 };
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await r.json();
    if (!r.ok) {
      console.error('Upstream Gemini error', r.status, data);
      res.status(r.status).json({ error: data });
      return;
    }
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || String(e) });
  }
});

const port = process.env.PORT || 8787;
app.listen(port, () => console.log(`Gemini proxy listening on http://localhost:${port}`));
