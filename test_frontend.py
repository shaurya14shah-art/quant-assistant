from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.goto('http://localhost:3000', wait_until='networkidle')
        time.sleep(2) # wait for 3d render
        page.screenshot(path='/Users/shauryashah/.gemini/antigravity-ide/brain/40298de1-2b41-4efb-b0a0-16c392e01494/3d_ui_test.png')
        browser.close()
        print("Screenshot saved!")
run()
