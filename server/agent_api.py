from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os, json, requests, pathlib
from typing import Optional
import traceback
import datetime

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_FILE_BYTES = 80_000

class GenerateReq(BaseModel):
    action: str
    provider: str
    api_key: str
    model: Optional[str] = None
    temperature: Optional[float] = 0.2
    project_root: Optional[str] = '.'
    activity_data: Optional[dict] = None


def read_repo_files(root: str, patterns=("**/*.ts","**/*.tsx","**/*.js","**/*.jsx","**/*.py","**/*.json","**/*.md","**/*.html","package.json")):
    root = pathlib.Path(root)
    files = []
    for pat in patterns:
        for p in root.glob(pat):
            try:
                size = p.stat().st_size
                truncated = size > MAX_FILE_BYTES
                content = p.read_text(encoding='utf-8', errors='ignore')[:MAX_FILE_BYTES]
                files.append({"path": str(p.relative_to(root)), "content": content, "truncated": truncated})
            except Exception as e:
                files.append({"path": str(p), "content": f"/* error reading file: {e} */", "truncated": False})
    return files


def summarize_files_for_prompt(files, max_chars=20000):
    out = []
    chars = 0
    for f in files:
        snippet = (f['content'] or '')[:2000].strip()
        part = f"\n--- FILE: {f['path']} (truncated={f['truncated']})\n{snippet}\n"
        if chars + len(part) > max_chars:
            break
        out.append(part)
        chars += len(part)
    return "\n".join(out)


def call_llm(provider: str, api_key: str, model: str, prompt: str, temperature: float = 0.2, timeout=30):
    # Support a local 'mock' provider for development and integration tests
    if provider == 'mock':
        # Return a deterministic, short response so callers can validate integration without keys
        summary = prompt.replace('\n', ' ')[:240]
        return f"MOCK_LLM_RESPONSE: {summary}"

    if provider == 'openai':
        url = 'https://api.openai.com/v1/chat/completions'
        headers = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
        body = {'model': model or 'gpt-4o-mini', 'messages': [{'role':'user','content': prompt}], 'temperature': temperature, 'max_tokens': 800}
        try:
            r = requests.post(url, headers=headers, json=body, timeout=timeout)
            r.raise_for_status()
        except requests.exceptions.HTTPError as e:
            # forward provider HTTP errors to the client with sanitized details
            resp = e.response
            detail = None
            try:
                detail_json = resp.json() if resp is not None else None
                detail = detail_json if detail_json else resp.text if resp is not None else str(e)
            except Exception:
                detail = resp.text if resp is not None else str(e)
            raise HTTPException(status_code=resp.status_code if resp is not None else 502, detail=f'OpenAI error: {str(detail)[:1000]}')
        j = r.json()
        try:
            return j['choices'][0]['message']['content']
        except Exception:
            return json.dumps(j)
    elif provider == 'openrouter':
        url = 'https://openrouter.ai/api/v1/chat/completions'
        # Normalize model id: accept plain IDs (e.g. 'meta-llama/..') or prefixed forms
        # Strip any leading 'openrouter:' prefix and any trailing qualifiers like ':free'.
        normalized_model = (model or '').strip()
        if normalized_model.startswith('openrouter:'):
            normalized_model = normalized_model[len('openrouter:'):]
        # strip trailing colon-suffixed tags (like ':free')
        if ':' in normalized_model and normalized_model.count(':') > 0:
            # if there is more than one colon, we only want to strip known trailing qualifiers
            parts = normalized_model.split(':')
            # If last part looks like a tag (no slashes), drop it
            if len(parts) > 1 and '/' not in parts[-1]:
                normalized_model = ':'.join(parts[:-1])

        # fallback default if still empty
        if not normalized_model:
            normalized_model = 'openchat/openchat-3.5'

        headers = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
        body = {'model': normalized_model, 'messages': [{'role':'user','content': prompt}], 'temperature': temperature, 'max_tokens': 800}
        try:
            r = requests.post(url, headers=headers, json=body, timeout=timeout)
            r.raise_for_status()
        except requests.exceptions.HTTPError as e:
            resp = e.response
            detail = None
            try:
                detail_json = resp.json() if resp is not None else None
                detail = detail_json if detail_json else resp.text if resp is not None else str(e)
            except Exception:
                detail = resp.text if resp is not None else str(e)
            raise HTTPException(status_code=resp.status_code if resp is not None else 502, detail=f'OpenRouter error: {str(detail)[:1000]}')
        j = r.json()
        try:
            return j['choices'][0]['message']['content']
        except Exception:
            return json.dumps(j)
    elif provider == 'google':
            # Prefer the official google.generativeai client when available.
            try:
                import google.generativeai as genai
            except Exception:
                genai = None

            if genai is not None:
                # Use client and surface client errors as HTTP errors instead of silently falling back.
                try:
                    try:
                        genai.configure(api_key=api_key)
                    except Exception:
                        # configuration may fail, but the client might still work via env; proceed
                        pass

                    # Instantiate model. Normalize common short names by prefixing with 'models/'
                    # and prefer a safe default that is supported on the REST/v1 path.
                    client_model = (model or 'text-bison-001').strip()
                    # If the model looks like a Gemini short-name (e.g. 'gemini-1.5-flash'),
                    # try to prefix with 'models/' when calling the client API which often
                    # expects full model resource names.
                    tried_models = []
                    def _try_get_generative(model_name):
                        try:
                            return genai.GenerativeModel(model_name)
                        except Exception:
                            return None

                    gm = None
                    # First try the name as-provided
                    if client_model:
                        tried_models.append(client_model)
                        gm = _try_get_generative(client_model)

                    # Next, try prefixing with 'models/' if not already
                    if gm is None and client_model and not client_model.startswith('models/'):
                        alt = f'models/{client_model}'
                        tried_models.append(alt)
                        gm = _try_get_generative(alt)

                    # Finally, try falling back to a model described by genai.get_model()
                    if gm is None:
                        try:
                            mdesc = genai.get_model(client_model)
                            model_name = mdesc.model_name if hasattr(mdesc, 'model_name') else str(mdesc)
                            tried_models.append(model_name)
                            gm = _try_get_generative(model_name)
                        except Exception:
                            pass

                    if gm is None:
                        # We couldn't resolve the provided model into a client model.
                        # Surface a clear hint to the caller and suggest listing available models.
                        hint = (
                            'Model could not be resolved by the Google generative client. '
                            'Call /api/agent/models (provider=google) to see available models and their supported methods.'
                        )
                        raise HTTPException(status_code=502, detail=f'Google generative client error: model not found or unsupported ({client_model}). Tried: {tried_models}. {hint}')

                    # Call the client's generate path
                    resp = gm.generate_content(contents=[{'text': prompt}], generation_config=None)

                    # Extract text from common response shapes
                    if hasattr(resp, 'candidates') and getattr(resp, 'candidates'):
                        c = resp.candidates[0]
                        # candidate may have .content which can be a list or a single Content object
                        if hasattr(c, 'content'):
                            content = c.content
                            # If content is iterable (list-like), join parts
                            try:
                                parts = []
                                for item in content:
                                    if hasattr(item, 'text') and item.text:
                                        parts.append(item.text)
                                    else:
                                        parts.append(str(item))
                                return ' '.join(parts)
                            except TypeError:
                                # content is not iterable - handle single Content object
                                # try common attributes: text, parts, nested content
                                if hasattr(content, 'text') and content.text:
                                    return content.text
                                if hasattr(content, 'parts') and getattr(content, 'parts'):
                                    parts = []
                                    for p in content.parts:
                                        if hasattr(p, 'text') and p.text:
                                            parts.append(p.text)
                                        elif hasattr(p, 'content') and getattr(p, 'content'):
                                            for sub in p.content:
                                                if hasattr(sub, 'text') and sub.text:
                                                    parts.append(sub.text)
                                                else:
                                                    parts.append(str(sub))
                                        else:
                                            parts.append(str(p))
                                    return ' '.join(parts)
                                # last resort: string representation
                                return str(content)
                        return str(c)
                    if hasattr(resp, 'output') and getattr(resp, 'output'):
                        out0 = resp.output[0]
                        if hasattr(out0, 'content'):
                            parts = []
                            for item in out0.content:
                                if hasattr(item, 'text') and item.text:
                                    parts.append(item.text)
                                else:
                                    parts.append(str(item))
                            return ' '.join(parts)
                        return str(out0)
                    return str(resp)
                except Exception as e:
                    # Surface client errors with a 502 and sanitized message so the frontend can show a meaningful error
                    msg = str(e)
                    safe = (msg[:1000] + '...') if len(msg) > 1000 else msg
                    raise HTTPException(status_code=502, detail=f'Google generative client error: {safe}')
            else:
                # fallback to the REST endpoint if the client isn't available
                model_id = model or 'text-bison-001'
                if not model_id.startswith('models/'):
                    model_id = f'models/{model_id}'
                url = f'https://generativelanguage.googleapis.com/v1/{model_id}:generateText?key={api_key}'
                headers = {'Content-Type': 'application/json'}
                body = {'prompt': {'text': prompt}, 'temperature': temperature, 'candidateCount': 1}
                try:
                    r = requests.post(url, headers=headers, json=body, timeout=timeout)
                    r.raise_for_status()
                except requests.exceptions.HTTPError as e:
                    resp = e.response
                    resp = e.response
                    # Try to extract provider error body for richer client message
                    try:
                        detail_json = resp.json() if resp is not None else None
                        detail = detail_json if detail_json else (resp.text if resp is not None else str(e))
                    except Exception:
                        detail = resp.text if resp is not None else str(e)
                    # If 404, offer a helpful hint about model names
                    if resp is not None and getattr(resp, 'status_code', None) == 404:
                        hint = ' (Model not found - check the model name. For Google try "text-bison-001" or a valid Gemini model id.)'
                    else:
                        hint = ''
                    raise HTTPException(status_code=resp.status_code if resp is not None else 502, detail=f'Google REST error: {str(detail)[:1000]}{hint}')
                j = r.json()
                if isinstance(j, dict):
                    if 'candidates' in j and len(j['candidates'])>0:
                        c = j['candidates'][0]
                        if isinstance(c.get('content'), list):
                            return ' '.join([(x.get('text') if isinstance(x, dict) else str(x)) for x in c.get('content')])
                        return c.get('output') or json.dumps(c)
                    if 'output' in j and len(j['output'])>0:
                        return j['output'][0].get('content',[{}])[0].get('text') or json.dumps(j['output'][0])
                return json.dumps(j)

    
    else:
        raise HTTPException(status_code=400, detail='Unknown provider')


def log_exception(exc: Exception, context: dict = None):
    try:
        path = os.path.join(os.path.dirname(__file__), 'agent-error.log')
        with open(path, 'a') as fh:
            fh.write('\n---- %s ----\n' % datetime.datetime.utcnow().isoformat())
            if context:
                # redact api_key
                ctx = dict(context)
                if 'api_key' in ctx: ctx['api_key'] = '<REDACTED>'
                fh.write('Context: %s\n' % json.dumps(ctx))
            fh.write('Traceback:\n')
            traceback.print_exc(file=fh)
        return path
    except Exception:
        return None


@app.post('/api/agent/generate')
async def generate(req: GenerateReq):
    # Build prompt from personal planning data, not source files
    activity = req.activity_data or {}

    if req.action == 'analyze':
        prompt = (
            "You are a personal planning and budgeting assistant. Analyze the user's recent activity, plans, "
            "spending, and time-use. Provide: 1) a concise summary of current state, 2) strengths and risks, "
            "3) 5 actionable improvements the user can start today. Keep output friendly and concise.\n\n"
        )
        if activity:
            prompt += 'Activity data (summary + recent):\n' + json.dumps(activity)[:15000]
        else:
            prompt += 'No activity data provided. Offer general productivity and budgeting guidance.'
    elif req.action == 'behavior':
        prompt = (
            "You are a behavioral coach for a personal planning app. Using the user's spending and time-use "
            "patterns and their active plans, give: (1) 3 concrete habit changes (time & money), (2) 3 tactical "
            "actions aligned to their near-term plans, (3) a 12-week progression with milestone checkpoints. "
            "Be specific to the user's numbers when available.\n\n"
        )
        if activity:
            prompt += 'Activity data (summary + recent):\n' + json.dumps(activity)[:15000]
        else:
            prompt += 'No activity data provided; provide generally useful habits and a sample 12-week plan.'
    elif req.action == 'predict':
        prompt = (
            "You are a strategic planning assistant. Given the user's recent behavior and plan states, predict where "
            "they are likely to be in 12 months. Provide: (a) top 3 risks, (b) top 3 opportunities, (c) a prioritized "
            "checklist of 5 actions. Use numbers from the data when available. Do not return JSON.\n\n"
        )
        if activity:
            prompt += 'Activity data (summary + recent):\n' + json.dumps(activity)[:15000]
        else:
            prompt += 'No activity data provided; provide a reasonable generic prediction and action list.'
    else:
        raise HTTPException(status_code=400, detail='Unknown action')

    # call the selected LLM
    try:
        out = call_llm(req.provider, req.api_key, req.model or '', prompt, req.temperature or 0.2)
        return {'text': out}
    except HTTPException:
        # preserve HTTP exceptions raised by call_llm (e.g., bad provider)
        raise
    except Exception as e:
        log_path = log_exception(e, { 'action': req.action, 'provider': req.provider, 'model': req.model, 'project_root': req.project_root })
        raise HTTPException(status_code=500, detail=f'Internal server error. See server log: {log_path}')


class ChatReq(BaseModel):
    provider: str
    api_key: str
    model: Optional[str] = None
    temperature: Optional[float] = 0.2
    project_root: Optional[str] = '.'
    activity_data: Optional[dict] = None
    messages: list


@app.post('/api/agent/chat')
async def chat_endpoint(req: ChatReq):
    # Compose system prompt + history based on personal activity
    system = (
        "You are a helpful personal planning, budgeting, and time-management assistant. Use the provided "
        "activity data (plans, spending, time-use, recent entries) to tailor concise, actionable guidance."
    )
    prompt_parts = [system]
    if req.activity_data:
        prompt_parts.append('\n\nActivity data (summary + recent):\n' + json.dumps(req.activity_data)[:15000])

    # Attach recent chat history
    hist = req.messages or []
    prompt_parts.append('\n\nRecent conversation:')
    for m in hist[-12:]:
        role = m.get('role','user')
        content = m.get('content','')
        prompt_parts.append(f"\n{role.upper()}: {content}")

    prompt_parts.append('\n\nAssistant:')
    full_prompt = '\n'.join(prompt_parts)

    try:
        out = call_llm(req.provider, req.api_key, req.model or '', full_prompt, req.temperature or 0.2)
        return {'text': out}
    except HTTPException:
        raise
    except Exception as e:
        log_path = log_exception(e, { 'provider': req.provider, 'model': req.model, 'project_root': req.project_root })
        raise HTTPException(status_code=500, detail=f'Internal server error. See server log: {log_path}')


class ModelsReq(BaseModel):
    provider: str
    api_key: Optional[str] = None


@app.post('/api/agent/models')
async def list_models(req: ModelsReq):
    """Return a list of candidate model ids for the chosen provider.
    The client may pass the user's API key (temporary) so we can call provider list endpoints server-side and avoid CORS.
    """
    provider = (req.provider or '').lower()
    api_key = req.api_key
    try:
        if provider == 'google':
            if not api_key:
                raise HTTPException(status_code=400, detail='API key required to list Google models')
            url = f'https://generativelanguage.googleapis.com/v1/models?key={api_key}'
            r = requests.get(url, timeout=15)
            try:
                r.raise_for_status()
            except requests.exceptions.HTTPError as e:
                detail = None
                try:
                    detail = r.json()
                except Exception:
                    detail = r.text
                raise HTTPException(status_code=r.status_code, detail=f'Google list models error: {detail}')
            j = r.json()
            models = []
            if isinstance(j, dict) and 'models' in j:
                for m in j['models']:
                    name = m.get('name')
                    if name:
                        models.append(name.replace('models/', ''))
            return {'models': models}

        elif provider == 'openai':
            if not api_key:
                raise HTTPException(status_code=400, detail='API key required to list OpenAI models')
            r = requests.get('https://api.openai.com/v1/models', headers={'Authorization': f'Bearer {api_key}'}, timeout=15)
            try:
                r.raise_for_status()
            except requests.exceptions.HTTPError:
                try:
                    detail = r.json()
                except Exception:
                    detail = r.text
                raise HTTPException(status_code=r.status_code, detail=f'OpenAI list models error: {detail}')
            j = r.json()
            models = []
            if isinstance(j, dict) and 'data' in j:
                for m in j['data']:
                    mid = m.get('id')
                    if mid:
                        models.append(mid)
            return {'models': models}

        elif provider == 'openrouter':
            # OpenRouter does not have a standardized listing endpoint in this app;
            # provide a curated list of commonly used models (including full OpenRouter IDs)
            return {'models': [
                'meta-llama/llama-3.1-8b-instruct',
                'google/gemini-1.5-flash',
                'google/gemini-1.5-pro',
                'openchat/openchat-3.5',
                'gryphe/mythomax-l2-13b',
                'nousresearch/nous-hermes-2-vision',
                'nousresearch/nous-hermes-2-pro',
                'undi95/toppy-m-7b',
                'neversleep/noromaid-mixtral',
                'google/gemini-2.5-flash-image-preview'
            ]}

        elif provider == 'mock':
            return {'models': ['mock-model']}

        else:
            raise HTTPException(status_code=400, detail='Unknown provider')
    except HTTPException:
        raise
    except Exception as e:
        log_exception(e, { 'provider': req.provider })
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/api/agent/files')
async def list_files(root: Optional[str] = '.'):
    files = read_repo_files(root)
    return {'files': [f['path'] for f in files]}


@app.post('/api/agent/upload_activity')
async def upload_activity(file: UploadFile = File(...)):
    try:
        content = await file.read()
        name = file.filename
        if name.endswith('.json'):
            data = json.loads(content.decode('utf-8'))
            return {'ok': True, 'preview': data[:100] if isinstance(data, list) else data}
        else:
            # try CSV parse simple
            text = content.decode('utf-8', errors='ignore')
            rows = text.splitlines()[:20]
            return {'ok': True, 'preview': rows}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post('/api/sync/push')
async def push_sync(entries: dict):
    """Accept a payload { entries: [ { id, table_name, record_id, action, data, created_at } ] } and upsert into Supabase tables.
    This endpoint will try to use SUPABASE_SERVICE_ROLE_KEY from env if available to bypass RLS for server-side upsert.
    """
    try:
        payload = entries.get('entries') if isinstance(entries, dict) else None
        if not payload or not isinstance(payload, list):
            raise HTTPException(status_code=400, detail='invalid payload')
        # prefer service role key if present
        sb_url = os.environ.get('SUPABASE_URL')
        sb_key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or os.environ.get('SUPABASE_ANON_KEY')
        if not sb_url or not sb_key:
            raise HTTPException(status_code=500, detail='Supabase configuration missing on server')
        # call Supabase REST endpoints to upsert depending on table
        inserted = 0
        errors = []
        for e in payload:
            t = e.get('table_name')
            data = e.get('data') or {}
            if not t or not data:
                errors.append({'entry': e, 'error': 'missing table or data'});
                continue
            # POST to Supabase using REST endpoint
            url = f"{sb_url}/rest/v1/{t}"
            headers = {'Content-Type': 'application/json', 'apikey': sb_key, 'Authorization': f'Bearer {sb_key}'}
            # upsert by primary key using On Conflict header
            try:
                resp = requests.post(url, headers={**headers, 'Prefer': 'resolution=merge-duplicates'}, json=data, timeout=15)
                if resp.status_code in (200,201,204):
                    inserted += 1
                else:
                    errors.append({'entry': e, 'status': resp.status_code, 'body': resp.text})
            except Exception as ex:
                errors.append({'entry': e, 'error': str(ex)})
        return {'ok': True, 'inserted': inserted, 'errors': errors}
    except HTTPException:
        raise
    except Exception as ex:
        log_exception(ex, {'action': 'push_sync'})
        raise HTTPException(status_code=500, detail='internal')
