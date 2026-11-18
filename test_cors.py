from playwright.async_api import async_playwright
import asyncio

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        
        # Navigate to a generic localhost site (we can just load Next.js frontend on localhost)
        await page.goto("http://localhost:3000")
        
        # Inject JS to connect to 127.0.0.1:8000
        result = await page.evaluate("""
            new Promise((resolve, reject) => {
                const es = new EventSource('http://127.0.0.1:8000/api/stream/AAPL?interval=1');
                es.onmessage = (e) => resolve('SUCCESS: ' + e.data.substring(0, 50));
                es.onerror = (e) => resolve('ERROR: ' + e);
                setTimeout(() => resolve('TIMEOUT'), 5000);
            });
        """)
        print(f"Connection result from localhost to 127.0.0.1: {result}")
        await browser.close()

asyncio.run(main())
