from playwright.sync_api import sync_playwright
import subprocess
import time
import os
import signal

def run():
    p_backend = subprocess.Popen(["../backend/venv/bin/python", "-m", "uvicorn", "main:app", "--port", "8000"], cwd="../backend")
    time.sleep(2)
    
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        errors = []
        page.on("pageerror", lambda err: errors.append(err.message))
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        
        page.goto("http://127.0.0.1:8000")
        page.wait_for_timeout(2000)
        
        # Type ticker and search
        page.fill("input#ticker", "AAPL")
        page.click("button:has-text('Analyze')")
        
        page.wait_for_timeout(4000) # wait for fetch
        
        try:
            page.click("text=Neural Engine")
            page.wait_for_timeout(2000)
        except Exception as e:
            print("Could not click Neural Engine:", e)
            
        print("ERRORS_FOUND:", errors)
        browser.close()
        
    os.kill(p_backend.pid, signal.SIGTERM)

if __name__ == '__main__':
    run()
