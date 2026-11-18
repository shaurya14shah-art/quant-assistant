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
        page.goto("http://127.0.0.1:8000")
        page.wait_for_timeout(3000)
        
        # Click on Neural Engine tab to see if it's there
        # We need to find the tab and click it.
        try:
            page.click("text=Neural Engine")
            page.wait_for_timeout(1000)
        except Exception as e:
            print("Could not click Neural Engine:", e)
            
        print(page.content())
        browser.close()
        
    os.kill(p_backend.pid, signal.SIGTERM)

if __name__ == '__main__':
    run()
