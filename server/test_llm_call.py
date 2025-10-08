from server.agent_api import call_llm
import json, sys

def main():
    try:
        out = call_llm('google', sys.argv[1], sys.argv[2], 'Please provide a 1-line test greeting.', 0.2, timeout=30)
        print('LLM OK:\n', out)
    except Exception as e:
        print('LLM ERROR:', type(e), e)

if __name__ == '__main__':
    # usage: python test_llm_call.py <API_KEY> <MODEL>
    main()
