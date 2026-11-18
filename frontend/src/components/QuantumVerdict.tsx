"use client";

import { TrendingUp, TrendingDown, Minus, Shield, Atom, BarChart2, Activity } from 'lucide-react';

interface QuantumStateData {
  ticker: string;
  current_price: number;
  verdict: string;
  verdict_color: string;
  confidence: number;
  composite_score: number;
  predicted_price_30d: number;
  predicted_change_pct: number;
  models: {
    black_scholes: {
      expected_move: number;
      upper_bound: number;
      lower_bound: number;
      implied_volatility: number;
    };
    schrodinger: {
      collapse_price: number;
      uncertainty: number;
      tunnel_probability: number;
      resistance: number;
      support: number;
    };
    monte_carlo: {
      mean_outcome: number;
      median_outcome: number;
      bullish_probability: number;
      p10: number;
      p90: number;
      paths_simulated: number;
    };
    momentum: {
      rsi: number;
      macd_histogram: number;
      above_sma50: boolean;
    };
  };
}

export default function QuantumVerdict({ data, liveAccuracy }: { data: QuantumStateData | null, liveAccuracy?: number | null }) {
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 py-8">
        <Atom className="animate-spin text-accent-secondary" size={28} />
        <span className="text-text-muted text-sm">Analyzing stock…</span>
      </div>
    );
  }

  const isPositive = data.predicted_change_pct > 0;
  const VerdictIcon = isPositive ? TrendingUp : data.predicted_change_pct < -1 ? TrendingDown : Minus;

  const verdictLabels: Record<string, string> = {
    'STRONG BUY': '🟢 Strong Buy',
    'BUY': '🟢 Buy',
    'HOLD': '🟡 Hold',
    'SELL': '🔴 Sell',
    'STRONG SELL': '🔴 Strong Sell',
  };

  const verdictBg: Record<string, string> = {
    success: 'from-emerald-500/15 to-emerald-500/5 border-emerald-500/25',
    warning: 'from-amber-500/15 to-amber-500/5 border-amber-500/25',
    danger: 'from-red-500/15 to-red-500/5 border-red-500/25',
  };

  const verdictText: Record<string, string> = {
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    danger: 'text-red-400',
  };

  const scoreBarWidth = Math.abs(data.composite_score);
  const scoreBarColor = data.composite_score > 0 ? '#34d399' : '#f87171';

  // Layman-friendly momentum description
  const getMomentumLabel = (rsi: number) => {
    if (rsi > 70) return { text: 'Overheated', color: 'text-red-400' };
    if (rsi > 55) return { text: 'Strong', color: 'text-emerald-400' };
    if (rsi > 45) return { text: 'Neutral', color: 'text-amber-400' };
    if (rsi > 30) return { text: 'Weak', color: 'text-amber-400' };
    return { text: 'Oversold', color: 'text-emerald-400' };
  };

  const momentumLabel = getMomentumLabel(data.models.momentum.rsi);
  const trendDirection = data.models.momentum.macd_histogram > 0 ? 'Upward' : 'Downward';
  const trendColor = data.models.momentum.macd_histogram > 0 ? 'text-emerald-400' : 'text-red-400';

  return (
    <div className="flex flex-col gap-4">

      {/* ─── VERDICT HERO ─── */}
      <div className={`rounded-xl border bg-gradient-to-br p-5 ${verdictBg[data.verdict_color] || verdictBg.warning}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex flex-col">
            <span className={`text-2xl font-black tracking-tight ${verdictText[data.verdict_color]}`}>
              {verdictLabels[data.verdict] || data.verdict}
            </span>
            {liveAccuracy && (
              <span className="text-xs font-mono text-emerald-400 mt-1 flex items-center">
                <Activity size={12} className="mr-1" />
                Live Accuracy: {liveAccuracy.toFixed(2)}%
              </span>
            )}
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-text-muted uppercase tracking-widest">Confidence</span>
            <span className="text-xl font-black">{data.confidence}%</span>
          </div>
        </div>

        {/* Actionable Advice */}
        <div className="mb-4 bg-white/5 rounded-xl p-4 border border-white/10 shadow-lg backdrop-blur-sm">
          <span className="text-[13px] leading-relaxed text-white/90 font-medium block">
            {data.verdict === 'STRONG BUY' || data.verdict === 'BUY' ? (
              <>
                <strong className="text-emerald-400 text-[14px] uppercase tracking-wider block mb-1">Action Plan</strong>
                Buy now near <span className="text-white font-bold">${data.current_price}</span>. The AI predicts a rise to <span className="text-emerald-400 font-bold">${data.predicted_price_30d}</span> over the next 30 days. Consider selling if it drops below the floor of <span className="text-red-400 font-bold">${data.models.schrodinger.support}</span>.
              </>
            ) : data.verdict === 'SELL' || data.verdict === 'STRONG SELL' ? (
              <>
                <strong className="text-red-400 text-[14px] uppercase tracking-wider block mb-1">Action Plan</strong>
                Sell or avoid. The price is expected to drop towards <span className="text-red-400 font-bold">${data.predicted_price_30d}</span>. Wait for a drop near the floor of <span className="text-white font-bold">${data.models.schrodinger.support}</span> before considering buying.
              </>
            ) : (
              <>
                <strong className="text-amber-400 text-[14px] uppercase tracking-wider block mb-1">Action Plan</strong>
                Hold and wait. The trend is uncertain. Buy if it drops to the floor (<span className="text-white font-bold">${data.models.schrodinger.support}</span>) or sell if it hits the ceiling (<span className="text-white font-bold">${data.models.schrodinger.resistance}</span>).
              </>
            )}
          </span>
        </div>

        {/* Score meter */}
        <div className="mt-1">
          <div className="flex justify-between text-[10px] text-text-muted mb-1.5 font-medium">
            <span>Likely to Drop</span>
            <span>Likely to Rise</span>
          </div>
          <div className="relative h-2.5 bg-white/5 rounded-full overflow-hidden">
            <div className="absolute left-1/2 top-0 h-full w-px bg-white/10" />
            <div
              className="absolute top-0 h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${scoreBarWidth / 2}%`,
                left: data.composite_score > 0 ? '50%' : `${50 - scoreBarWidth / 2}%`,
                backgroundColor: scoreBarColor,
                boxShadow: `0 0 12px ${scoreBarColor}40`,
              }}
            />
          </div>
        </div>
      </div>

      {/* ─── PRICE PREDICTION ─── */}
      <div className="flex gap-3 items-stretch">
        <div className="flex-1 bg-white/[0.03] rounded-xl border border-white/[0.06] p-4 flex flex-col justify-center">
          <span className="text-[10px] text-text-muted uppercase tracking-widest mb-1">Current Price</span>
          <span className="text-2xl font-black">${data.current_price}</span>
        </div>
        <div className="flex items-center px-1">
          <span className="text-lg text-text-muted">→</span>
        </div>
        <div className="flex-1 bg-white/[0.03] rounded-xl border border-white/[0.06] p-4 flex flex-col justify-center">
          <span className="text-[10px] text-text-muted uppercase tracking-widest mb-1">30-Day Forecast</span>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-black ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              ${data.predicted_price_30d}
            </span>
          </div>
          <span className={`text-xs font-semibold mt-0.5 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {isPositive ? '▲' : '▼'} {isPositive ? '+' : ''}{data.predicted_change_pct}%
          </span>
        </div>
      </div>

      {/* ─── MODEL INSIGHTS (Layman terms) ─── */}
      <div className="grid grid-cols-2 gap-3">

        {/* Price Range */}
        <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-3.5">
          <div className="flex items-center gap-1.5 mb-2.5">
            <Shield size={13} className="text-indigo-400" />
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Price Range</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-text-muted">Could drop to</span>
              <span className="font-mono text-xs font-bold text-red-400">${data.models.black_scholes.lower_bound}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-text-muted">Could rise to</span>
              <span className="font-mono text-xs font-bold text-emerald-400">${data.models.black_scholes.upper_bound}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-text-muted">Volatility</span>
              <span className="font-mono text-xs font-bold">{data.models.black_scholes.implied_volatility}%</span>
            </div>
          </div>
        </div>

        {/* AI Probability */}
        <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-3.5">
          <div className="flex items-center gap-1.5 mb-2.5">
            <Atom size={13} className="text-violet-400" />
            <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider">AI Probability</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-text-muted">Most likely price</span>
              <span className="font-mono text-xs font-bold">${data.models.schrodinger.collapse_price}</span>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[11px] text-text-muted">Breakout chance</span>
                <span className="font-mono text-xs font-bold text-violet-400">{data.models.schrodinger.tunnel_probability}%</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-violet-400 rounded-full" style={{ width: `${data.models.schrodinger.tunnel_probability}%` }}></div>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-text-muted">Uncertainty</span>
              <span className="font-mono text-xs font-bold">±${data.models.schrodinger.uncertainty}</span>
            </div>
          </div>
        </div>

        {/* Odds */}
        <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-3.5">
          <div className="flex items-center gap-1.5 mb-2.5">
            <BarChart2 size={13} className="text-amber-400" />
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Odds</span>
          </div>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[11px] text-text-muted">Goes up</span>
                <span className={`font-mono text-xs font-bold ${data.models.monte_carlo.bullish_probability > 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {data.models.monte_carlo.bullish_probability}%
                </span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                <div className={`h-full rounded-full ${data.models.monte_carlo.bullish_probability > 50 ? 'bg-emerald-400' : 'bg-red-400'}`} style={{ width: `${data.models.monte_carlo.bullish_probability}%` }}></div>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-text-muted">Best case</span>
              <span className="font-mono text-xs font-bold text-emerald-400">${data.models.monte_carlo.p90}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-text-muted">Worst case</span>
              <span className="font-mono text-xs font-bold text-red-400">${data.models.monte_carlo.p10}</span>
            </div>
          </div>
        </div>

        {/* Momentum */}
        <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-3.5">
          <div className="flex items-center gap-1.5 mb-2.5">
            <Activity size={13} className="text-cyan-400" />
            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Momentum</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-text-muted">Energy</span>
              <span className={`font-mono text-xs font-bold ${momentumLabel.color}`}>{momentumLabel.text}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-text-muted">Trend</span>
              <span className={`font-mono text-xs font-bold ${trendColor}`}>{trendDirection}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-text-muted">Long-term</span>
              <span className={`font-mono text-xs font-bold ${data.models.momentum.above_sma50 ? 'text-emerald-400' : 'text-red-400'}`}>
                {data.models.momentum.above_sma50 ? 'Healthy' : 'Weak'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── KEY LEVELS STRIP ─── */}
      <div className="flex gap-2">
        <div className="flex-1 bg-red-500/8 border border-red-500/15 rounded-lg px-3 py-2 text-center">
          <span className="text-[9px] text-text-muted uppercase tracking-wider block">Floor</span>
          <span className="text-sm font-bold text-red-400">${data.models.schrodinger.support}</span>
        </div>
        <div className="flex-1 bg-emerald-500/8 border border-emerald-500/15 rounded-lg px-3 py-2 text-center">
          <span className="text-[9px] text-text-muted uppercase tracking-wider block">Ceiling</span>
          <span className="text-sm font-bold text-emerald-400">${data.models.schrodinger.resistance}</span>
        </div>
      </div>
    </div>
  );
}
