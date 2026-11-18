from playwright.sync_api import sync_playwright
import subprocess
import time
import os
import signal

def run():
    # start backend
    p_backend = subprocess.Popen(["../backend/venv/bin/python", "-m", "uvicorn", "main:app", "--port", "8000"], cwd="../backend")
    time.sleep(2)
    
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        errors = []
        page.on("pageerror", lambda err: errors.append(err.message))
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        
        page.goto("http://127.0.0.1:8000")
        page.wait_for_timeout(3000)
        print("ERRORS_FOUND:", errors)
        browser.close()
        
    os.kill(p_backend.pid, signal.SIGTERM)

if __name__ == '__main__':
    run()
