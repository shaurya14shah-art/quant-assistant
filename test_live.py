import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1400, "height": 900})
        
        errors = []
        console_msgs = []
        
        page.on("console", lambda msg: print(f"Browser console: {msg.text}") if "Download the React DevTools" not in msg.text else None)
        page.on("requestfailed", lambda request: print(f"Request failed: {request.url} - {request.failure}"))
        page.on("pageerror", lambda err: errors.append(str(err)))
        
        print("Navigating to http://127.0.0.1:3000...")
        await page.goto("http://127.0.0.1:3000")
        
        print("Typing AAPL...")
        await page.fill("input#ticker", "AAPL")
        
        print("Clicking Analyze button...")
        await page.click("button.btn-primary")
        
        print("Waiting 5 seconds for data to load and stream to start...")
        await page.wait_for_timeout(5000)
        
        # Scroll to see the charts
        await page.evaluate("window.scrollBy(0, 600)")
        await page.wait_for_timeout(1000)
        
        print("Taking screenshot 1 (after 6s)...")
        await page.screenshot(path="test_live_1.png", full_page=True)
        
        # Wait 3 more seconds for live ticks 
        await page.wait_for_timeout(3000)
        
        print("Taking screenshot 2 (after 9s, should show different price if live)...")
        await page.screenshot(path="test_live_2.png", full_page=True)
        
        # Scroll down further to see brain section
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await page.wait_for_timeout(1000)
        
        print("Taking screenshot 3 (bottom of page — brain section)...")
        await page.screenshot(path="test_live_3.png", full_page=True)
        
        # Report
        print(f"\n--- RESULTS ---")
        print(f"JS Errors: {len(errors)}")
        for e in errors[:5]:
            print(f"  ERROR: {e[:200]}")
        
        width_warnings = [m for m in console_msgs if "width(-1)" in m]
        print(f"Chart width(-1) warnings: {len(width_warnings)}")
        
        sse_related = [m for m in console_msgs if "stream" in m.lower() or "event" in m.lower()]
        print(f"SSE-related console msgs: {len(sse_related)}")
        for m in sse_related[:3]:
            print(f"  {m[:150]}")
        
        await browser.close()

asyncio.run(main())
