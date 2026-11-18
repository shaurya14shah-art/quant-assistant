import sys
sys.path.append("/Users/shauryashah/AG/QuantAssistant/backend")
from fastapi.testclient import TestClient
from main import app
import traceback

client = TestClient(app)
try:
    response = client.get("/api/predict/AAPL")
    print("STATUS:", response.status_code)
    if response.status_code == 500:
        print("CONTENT:", response.content)
    else:
        print("SUCCESS")
except Exception as e:
    traceback.print_exc()
