Gemini Proxy for Development

This small Express server proxies requests to Google Gemini (Generative Language API) so that your API key is not exposed in the browser during development.

Prerequisites
- Node 18+ (or a runtime that supports fetch in node or you have node-fetch installed)
- Create a `.env` file in the project root with:

GEMINI_API_KEY=your_gemini_key

Run the proxy

```bash
npm run dev:proxy
```

This starts the proxy on http://localhost:8787 and your app can call `/api/gemini/generate` (from the same origin when running dev server with proxying, or configure a dev proxy in Vite).

Production
- For production, deploy the same proxy as a small serverless function (Cloud Run, Vercel Serverless Function, Netlify Functions) and update the client to call that endpoint.
- Keep the API key only on the server-side; do not embed it into the client.
