import asyncio
import httpx
import json

async def test():
    async with httpx.AsyncClient() as client:
        try:
            async with client.stream('GET', 'http://127.0.0.1:8000/api/stream/AAPL?interval=1.0', timeout=5) as r:
                async for line in r.aiter_lines():
                    if line.startswith('data:'):
                        print(line)
        except Exception as e:
            print("Error:", e)

asyncio.run(test())
