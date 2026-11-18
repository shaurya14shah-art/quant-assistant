import yfinance as yf
raw_tickers = ["AAPL", "MSFT", "SPY"]
data = yf.download(raw_tickers, period="1mo", progress=False)["Close"]
returns = data.pct_change().dropna()
market_returns = returns["SPY"] if "SPY" in returns.columns else returns.mean(axis=1)
market_var = market_returns.var()
print(f"market_var: {market_var}")
