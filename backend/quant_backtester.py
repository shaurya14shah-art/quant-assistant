#!/usr/bin/env python3
"""
quant_backtester.py — a configurable, multi-signal quant trading algorithm.

Combines three classic, publicly-documented signal families into one engine:

  1. Momentum        — buy strength, sell weakness over a lookback window
  2. Mean-reversion   — fade extreme short-term z-scores back toward a rolling mean
  3. Volatility regime gate — scale exposure down (or flatten) when realized vol spikes,
                              inspired by GARCH-style "size down when risk is high" logic

Position size is set by inverse-volatility targeting (a lighter-touch cousin of the Kelly
criterion): the strategy targets a constant level of *risk*, not a constant dollar exposure,
so a position in a calm asset is larger than a position in a volatile one.

This is research/educational code. It is NOT investment advice, and a profitable backtest is
not a promise of future returns. Transaction costs are modeled simply (a flat bps assumption)
and should be replaced with real costs before this is taken anywhere near live capital.

Usage:
    python quant_backtester.py --demo
    python quant_backtester.py --csv prices.csv --price-col close --date-col date

CSV format expected: a date column and a price column (one ticker per file).
"""

import argparse
import sys

import numpy as np
import pandas as pd


def generate_demo_prices(n_days: int = 1500, seed: int = 7) -> pd.Series:
    """Synthetic price series with drift + mean-reverting noise + occasional vol shocks,
    used only so the algorithm is runnable with zero setup. Replace with real data for
    anything beyond a smoke test."""
    rng = np.random.default_rng(seed)
    dates = pd.bdate_range("2018-01-01", periods=n_days)

    drift = 0.0003
    base_vol = 0.010
    vol_regime = base_vol * (1 + 0.6 * np.sin(np.arange(n_days) / 90))
    shocks = rng.normal(0, 1, n_days)
    # inject a few short high-vol clusters
    for _ in range(4):
        start = rng.integers(0, n_days - 40)
        vol_regime[start:start + 30] *= 2.5

    daily_returns = drift + vol_regime * shocks
    # small mean-reverting component so the mean-reversion signal has something to find
    mean_rev_component = -0.15 * pd.Series(daily_returns).rolling(5).mean().fillna(0).values
    daily_returns = daily_returns + mean_rev_component

    prices = 100 * np.exp(np.cumsum(daily_returns))
    return pd.Series(prices, index=dates, name="price")


def load_csv_prices(path: str, price_col: str, date_col: str) -> pd.Series:
    df = pd.read_csv(path)
    df[date_col] = pd.to_datetime(df[date_col])
    df = df.sort_values(date_col).set_index(date_col)
    return df[price_col].rename("price")


def momentum_signal(price: pd.Series, lookback: int = 20, threshold: float = 0.02) -> pd.Series:
    shifted = price.shift(lookback).replace(0, np.nan)
    ret = price / shifted - 1
    raw = np.sign(ret) * (ret.abs() > threshold)
    return raw.fillna(0)


def mean_reversion_signal(price: pd.Series, window: int = 10, z_threshold: float = 1.5) -> pd.Series:
    rolling_mean = price.rolling(window).mean()
    rolling_std = price.rolling(window).std()
    z = (price - rolling_mean) / rolling_std.replace(0, np.nan)
    raw = np.sign(-z) * (z.abs() > z_threshold)  # bet against extremes
    return raw.fillna(0)


def realized_vol(price: pd.Series, window: int = 20) -> pd.Series:
    shifted = price.shift(1).replace(0, np.nan)
    log_ret = np.log(price / shifted)
    return log_ret.rolling(window).std() * np.sqrt(252)


def vol_regime_gate(vol: pd.Series, calm_threshold: float, stressed_threshold: float) -> pd.Series:
    """Returns an exposure multiplier in [0, 1]: full size in calm regimes, scaled down as
    realized vol rises, flat once it crosses the stressed threshold."""
    gate = pd.Series(1.0, index=vol.index)
    scaled_zone = (vol > calm_threshold) & (vol <= stressed_threshold)
    gate[scaled_zone] = 1 - (vol[scaled_zone] - calm_threshold) / (stressed_threshold - calm_threshold)
    gate[vol > stressed_threshold] = 0.0
    return gate.clip(0, 1).fillna(1.0)


def build_strategy(
    price: pd.Series,
    mom_lookback: int = 20,
    mom_threshold: float = 0.02,
    mr_window: int = 10,
    mr_z_threshold: float = 1.5,
    vol_window: int = 20,
    target_vol: float = 0.15,
    calm_vol: float = 0.12,
    stressed_vol: float = 0.35,
    max_position: float = 2.0,
    cost_bps: float = 5.0,
) -> pd.DataFrame:
    """Builds the combined signal, position size, and simulated P&L. Returns a DataFrame
    with one row per day so every intermediate step is inspectable."""

    mom = momentum_signal(price, mom_lookback, mom_threshold)
    mrev = mean_reversion_signal(price, mr_window, mr_z_threshold)
    combined_signal = (mom + mrev).clip(-2, 2)  # -2..+2: both signals can agree or cancel

    vol = realized_vol(price, vol_window)
    gate = vol_regime_gate(vol, calm_vol, stressed_vol)

    # Inverse-volatility position sizing: target a constant level of risk, not constant
    # dollar exposure. Floors vol at 1% to avoid division blow-ups in dead-quiet periods.
    vol_floor = vol.clip(lower=0.01)
    inv_vol_size = (target_vol / vol_floor).clip(upper=max_position)

    raw_position = combined_signal * inv_vol_size * gate
    position = raw_position.shift(1).fillna(0)  # trade on next bar's open, not same-bar close

    daily_return = price.pct_change().fillna(0)
    gross_pnl = position * daily_return

    turnover = position.diff().abs().fillna(0)
    costs = turnover * (cost_bps / 10000)
    net_pnl = gross_pnl - costs

    out = pd.DataFrame({
        "price": price,
        "momentum_signal": mom,
        "mean_reversion_signal": mrev,
        "combined_signal": combined_signal,
        "realized_vol": vol,
        "vol_gate": gate,
        "position": position,
        "daily_return": daily_return,
        "gross_pnl": gross_pnl,
        "costs": costs,
        "net_pnl": net_pnl,
    })
    return out


def compute_metrics(df: pd.DataFrame) -> dict:
    pnl = df["net_pnl"].dropna()
    n_days = len(pnl)
    cumulative = (1 + pnl).cumprod()
    total_return = cumulative.iloc[-1] - 1
    years = n_days / 252
    cagr = (cumulative.iloc[-1]) ** (1 / years) - 1 if years > 0 else float("nan")

    ann_vol = pnl.std() * np.sqrt(252)
    sharpe = (pnl.mean() * 252) / ann_vol if ann_vol > 0 else float("nan")

    downside_returns = pnl[pnl < 0]
    downside_vol = downside_returns.std() * np.sqrt(252) if len(downside_returns) > 0 else 0
    sortino = (pnl.mean() * 252) / downside_vol if downside_vol > 0 else float("nan")

    running_max = cumulative.cummax()
    drawdown = (cumulative - running_max) / running_max
    max_drawdown = drawdown.min()

    trades = df["position"].diff().fillna(0)
    trade_days = (trades.abs() > 1e-9).sum()
    winning_days = (pnl > 0).sum()
    losing_days = (pnl < 0).sum()
    win_rate = winning_days / (winning_days + losing_days) if (winning_days + losing_days) > 0 else float("nan")

    return {
        "total_return_pct": round(total_return * 100, 2),
        "cagr_pct": round(cagr * 100, 2),
        "annualized_vol_pct": round(ann_vol * 100, 2),
        "sharpe_ratio": round(sharpe, 2),
        "sortino_ratio": round(sortino, 2),
        "max_drawdown_pct": round(max_drawdown * 100, 2),
        "win_rate_pct": round(win_rate * 100, 2),
        "position_changes": int(trade_days),
        "days_tested": n_days,
    }


def main():
    parser = argparse.ArgumentParser(description="Multi-signal quant strategy backtester.")
    parser.add_argument("--demo", action="store_true", help="Use synthetic demo price data.")
    parser.add_argument("--csv", type=str, help="Path to a CSV of historical prices.")
    parser.add_argument("--price-col", type=str, default="close")
    parser.add_argument("--date-col", type=str, default="date")
    parser.add_argument("--target-vol", type=float, default=0.15, help="Annualized target volatility.")
    parser.add_argument("--cost-bps", type=float, default=5.0, help="Round-trip cost assumption in bps.")
    parser.add_argument("--out", type=str, default=None, help="Optional path to save full daily output as CSV.")
    args = parser.parse_args()

    if args.csv:
        price = load_csv_prices(args.csv, args.price_col, args.date_col)
    else:
        if not args.demo:
            print("No --csv given; falling back to --demo synthetic data.\n", file=sys.stderr)
        price = generate_demo_prices()

    df = build_strategy(price, target_vol=args.target_vol, cost_bps=args.cost_bps)
    metrics = compute_metrics(df)

    print(f"Backtest over {metrics['days_tested']} trading days "
          f"({metrics['days_tested'] / 252:.1f} years)\n")
    print(f"{'Total return':<22}{metrics['total_return_pct']:>10.2f}%")
    print(f"{'CAGR':<22}{metrics['cagr_pct']:>10.2f}%")
    print(f"{'Annualized volatility':<22}{metrics['annualized_vol_pct']:>10.2f}%")
    print(f"{'Sharpe ratio':<22}{metrics['sharpe_ratio']:>10.2f}")
    print(f"{'Sortino ratio':<22}{metrics['sortino_ratio']:>10.2f}")
    print(f"{'Max drawdown':<22}{metrics['max_drawdown_pct']:>10.2f}%")
    print(f"{'Win rate (daily)':<22}{metrics['win_rate_pct']:>10.2f}%")
    print(f"{'Position changes':<22}{metrics['position_changes']:>10d}")

    if args.out:
        df.to_csv(args.out)
        print(f"\nFull daily output saved to {args.out}")


if __name__ == "__main__":
    main()
