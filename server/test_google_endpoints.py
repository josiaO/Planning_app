import requests, sys, json

def try_endpoint(api_key, model_id, method):
    if not model_id.startswith('models/'):
        model_id = f'models/{model_id}'
    url = f'https://generativelanguage.googleapis.com/v1/{model_id}:{method}?key={api_key}'
    body = {'prompt': {'text': 'Say hello in one sentence: who are you?'}, 'temperature': 0.2, 'candidateCount': 1}
    try:
        r = requests.post(url, json=body, timeout=30)
        print(f'[{method}] STATUS', r.status_code)
        try:
            print(json.dumps(r.json(), indent=2)[:4000])
        except Exception:
            print(r.text[:4000])
    except Exception as e:
        print(f'[{method}] ERROR', e)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('usage: python test_google_endpoints.py <API_KEY> <MODEL>')
        sys.exit(1)
    key = sys.argv[1]
    model = sys.argv[2]
    for method in ('generateText','generateContent'):
        try_endpoint(key, model, method)
