Agent API (Python FastAPI)

Run a small Python server to host the agent endpoints that call LLM providers server-side.

1. Create a venv and install dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r ../requirements-agent.txt
```

2. Run the server:

```bash
uvicorn server.agent_api:app --reload --port 8788
```

3. In the React app, open Assistant → the Agent UI. Paste an API key into the UI and call actions. The React UI will POST to `/api/agent/generate` by default — for local dev you may want to proxy this to the Python server (or call the Python server directly at `http://localhost:8788/api/agent/generate`).

Notes:
- The Python server calls your chosen LLM provider on the server side, avoiding CORS issues.
- Keep keys secret and run locally or deploy securely when ready.
