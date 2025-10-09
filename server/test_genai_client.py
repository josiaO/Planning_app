import os
import sys
import traceback

API_KEY = os.environ.get('GENAI_KEY') 
MODEL = os.environ.get('GENAI_MODEL') or 'gemini-2.5-flash'

print('Using API key:', '***REDACTED***' if API_KEY else '<none>')
print('Model:', MODEL)

try:
    import google.generativeai as genai
except Exception as e:
    print('Failed to import google.generativeai:', e)
    traceback.print_exc()
    sys.exit(2)

print('module attrs sample:', [a for a in dir(genai) if not a.startswith('_')][:40])

candidates = [a for a in dir(genai) if 'generate' in a.lower() or 'chat' in a.lower() or 'text' in a.lower()]
print('Candidate callables:', candidates)

# configure
try:
    genai.configure(api_key=API_KEY)
    print('Configured google.generativeai with API key')
except Exception as e:
    print('Failed to configure:', e)

# Try calling obvious methods
tried = False
for name in candidates:
    attr = getattr(genai, name)
    if not callable(attr):
        continue
    print('\nTrying', name)
    tried = True
    try:
        # Best-effort call shapes
        try:
            resp = attr(model=MODEL, prompt="Hello from test: give a 1-line response.")
            print('-> Success, type:', type(resp))
            # Print a short repr
            print('REPR:', repr(resp)[:2000])
        except TypeError:
            try:
                resp = attr(model=MODEL, input="Hello from test: give a 1-line response.")
                print('-> Success (input=), type:', type(resp))
                print('REPR:', repr(resp)[:2000])
            except Exception as e2:
                print('Call failed:', e2)
                traceback.print_exc()
    except Exception as e:
        print('Error calling', name, e)
        traceback.print_exc()

if not tried:
    print('No candidate methods found to call automatically. Please inspect the installed package.')

print('\nDone')
