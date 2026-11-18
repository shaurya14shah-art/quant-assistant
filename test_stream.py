import requests
import time

url = "http://127.0.0.1:8000/api/stream/AAPL?interval=1.0"
headers = {"Accept": "text/event-stream"}

try:
    with requests.get(url, headers=headers, stream=True) as r:
        r.raise_for_status()
        start = time.time()
        for line in r.iter_lines():
            if line:
                decoded_line = line.decode('utf-8')
                print(decoded_line[:100] + "..." if len(decoded_line) > 100 else decoded_line)
            if time.time() - start > 5:
                break
except Exception as e:
    print(f"Error: {e}")
