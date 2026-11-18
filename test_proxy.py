from playwright.async_api import async_playwright
import asyncio

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        
        await page.goto("http://localhost:3000")
        
        # Test if the Edge Route streams correctly without buffering
        result = await page.evaluate("""
            new Promise((resolve, reject) => {
                const es = new EventSource('/sse-stream/AAPL?interval=1');
                let count = 0;
                let start = Date.now();
                let times = [];
                es.onmessage = (e) => {
                    count++;
                    times.push(Date.now() - start);
                    if (count >= 3) {
                        resolve(times);
                        es.close();
                    }
                };
                es.onerror = (e) => reject('ERROR');
            });
        """)
        print(f"Tick times (ms): {result}")
        await browser.close()

asyncio.run(main())
