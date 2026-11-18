from playwright.async_api import async_playwright
import asyncio

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        
        page.on("requestfailed", lambda request: print(f"Request failed: {request.url} - {request.failure}"))
        page.on("response", lambda response: print(f"Response: {response.url} - {response.status}"))
        
        await page.goto("http://localhost:3000")
        
        result = await page.evaluate("""
            new Promise((resolve, reject) => {
                const es = new EventSource('/sse-stream/AAPL?interval=1');
                es.onmessage = (e) => resolve('SUCCESS');
                es.onerror = (e) => resolve('ERROR');
            });
        """)
        print(f"Result: {result}")
        await browser.close()

asyncio.run(main())
