"use client";

import { useState, useEffect, useRef } from 'react';
import { Loader2, TrendingUp, TrendingDown, Activity, DollarSign, Percent, AlertCircle, ZoomIn, ZoomOut } from 'lucide-react';
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, Brush } from 'recharts';

function useContainerSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const rect = el.getBoundingClientRect();
    setSize({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize({ width: Math.floor(width), height: Math.floor(height) });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

interface BacktestMetrics {
  total_return_pct: number;
  cagr_pct: number;
  annualized_vol_pct: number;
  sharpe_ratio: number;
  max_drawdown_pct: number;
  win_rate_pct: number;
  position_changes: number;
  days_tested: number;
}

interface TimeseriesData {
  date: string;
  normalized_price: number;
  cumulative_algo: number;
  combined_signal: number;
  position: number;
  price: number;
  isLive?: boolean;
}

interface BacktestData {
  metrics: BacktestMetrics;
  timeseries: TimeseriesData[];
}

export default function BacktestTab({ ticker, aiVerdict, livePrice, predictionData, onZoomChange }: { ticker: string, aiVerdict: string, livePrice?: number, predictionData?: any, onZoomChange?: (interval: number) => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displaySeries, setDisplaySeries] = useState<any[]>([]);
  
  const ZOOM_LEVELS = [
    { label: 'Wide', interval: 1.0, count: 200 },
    { label: 'Close', interval: 0.5, count: 120 },
    { label: 'Precise', interval: 0.2, count: 70 },
    { label: 'Ultra', interval: 0.1, count: 40 }
  ];
  const [zoomIndex, setZoomIndex] = useState(0);

  useEffect(() => {
    if (onZoomChange) onZoomChange(ZOOM_LEVELS[zoomIndex].interval);
  }, [zoomIndex]);

  useEffect(() => {
    if (!ticker) {
      setLoading(false);
      return;
    }
    fetch(`/api/backtest/${ticker}?t=${Date.now()}`, { cache: 'no-store' })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(d => {
        setData(d);
        setDisplaySeries(d.timeseries); // Initial population
        setLoading(false);
      })
      .catch(err => {
        console.error("Backtest fetch error:", err);
        setError(err.message);
        setLoading(false);
      });
  }, [ticker]);

  // Real-time update logic
  useEffect(() => {
    if (!data || !livePrice || data.timeseries.length === 0) return;
    
    const lastHistorical = data.timeseries[data.timeseries.length - 1];
    const initialLivePrice = lastHistorical.price || 100;
    
    // Dynamically shift the algorithm's signal based on real-time stock changes.
    // A 1% move dynamically adjusts the signal slightly
    const liveReturn = (livePrice / initialLivePrice) - 1;
    const dynamicSignal = (lastHistorical.combined_signal || 0) + (liveReturn * 15);
    
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    const liveTick = {
      date: timeStr,
      combined_signal: dynamicSignal, // Use dynamic signal for live ticks to ensure perfect continuity!
      position: lastHistorical.position || 0,
      price: livePrice || 0,
      isLive: true
    };
    
    setDisplaySeries(prevSeries => {
      const liveTicks = prevSeries.filter(t => t.isLive);
      const historical = data.timeseries;
      
      // Keep a trailing window of up to 300 live ticks (5 minutes at 1 tick/sec)
      if (liveTicks.length > 300) {
        liveTicks.shift();
      }
      
      return [...historical, ...liveTicks, liveTick];
    });
  }, [livePrice, data]);

  const pastAiMap = new Map();
  if (predictionData?.past_prediction_path) {
    predictionData.past_prediction_path.forEach((p: any) => {
      pastAiMap.set(p.date, { mean: p.past_mean, upper: p.past_upper, lower: p.past_lower });
    });
  }

  const processedSeries = displaySeries.map(tick => {
    let aiData = pastAiMap.get(tick.date);
    if (tick.isLive && predictionData?.past_prediction_path) {
      const pastList = predictionData.past_prediction_path;
      if (pastList.length > 0) {
        const last = pastList[pastList.length - 1];
        aiData = { mean: last.past_mean, upper: last.past_upper, lower: last.past_lower };
      }
    }

    return {
      ...tick,
      algo_prediction: tick.price * (1 + ((tick.combined_signal || 0) * 0.03)),
      ai_prediction: aiData ? aiData.mean : null,
      ai_bounds: aiData ? [aiData.lower, aiData.upper] : null
    };
  });

  // Generate Future Path
  const lastTick = displaySeries[displaySeries.length - 1];
  const currentPrice = lastTick?.price || 100;
  const currentSignal = lastTick?.combined_signal || 0;
  const baseAlgoPred = currentPrice * (1 + (currentSignal * 0.03));
  
  let finalSeries = [...processedSeries];
  if (predictionData?.future_path) {
    const firstFutureAIPrice = predictionData.future_path[0]?.mean_eigen || currentPrice;
    const aiLiveShift = currentPrice - firstFutureAIPrice;
    
    const futureSeries = predictionData.future_path.map((p: any, index: number) => {
      const daysOut = index + 1;
      
      const marketCurvature = p.mean_eigen / firstFutureAIPrice;
      
      // Use Square Root of time for a realistic geometric diffusion curve, avoiding straight-line BS
      const algoDrift = 1 + (currentSignal * 0.015 * Math.sqrt(daysOut));
      const algoFuture = baseAlgoPred * marketCurvature * algoDrift;
      
      const shiftedAiMean = p.mean_eigen + aiLiveShift;
      const shiftedAiUpper = p.swarm_upper + aiLiveShift;
      const shiftedAiLower = p.swarm_lower + aiLiveShift;
      
      return {
        date: p.date,
        price: null,
        algo_prediction: algoFuture,
        ai_prediction: shiftedAiMean,
        ai_bounds: [shiftedAiLower, shiftedAiUpper],
        isFuture: true
      };
    });
    
    finalSeries = [...finalSeries, ...futureSeries];
  }

  const currentZoom = ZOOM_LEVELS[zoomIndex];
  const displayData = finalSeries.slice(-currentZoom.count);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
        <Loader2 className="h-8 w-8 animate-spin text-accent-primary" />
        <span className="ml-3 text-white/70">Running multi-signal backtest...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-accent-danger/30 bg-accent-danger/10 backdrop-blur-sm p-6 text-center">
        <AlertCircle className="h-10 w-10 text-accent-danger mb-3 mx-auto" />
        <p className="text-white/90">Failed to run backtest: {error}</p>
      </div>
    );
  }

  const currentAlgoPos = data.timeseries[data.timeseries.length - 1]?.position || 0;
  const getAlgoSentiment = (pos: number) => {
    if (pos > 0.5) return 'LONG (Bullish)';
    if (pos < -0.5) return 'SHORT (Bearish)';
    return 'FLAT (Neutral / Risk-Off)';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Compare Forward Outlook */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-black/30 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] hover:border-white/20 transition-all">
          <h3 className="text-xs text-white/50 font-bold tracking-widest mb-2 uppercase flex items-center gap-2"><Activity size={14}/> AI Probability Engine</h3>
          <p className={`text-2xl font-black drop-shadow-md ${
            aiVerdict.includes('BUY') ? 'text-transparent bg-clip-text bg-gradient-to-r from-accent-success to-green-300' : 
            aiVerdict.includes('SELL') ? 'text-transparent bg-clip-text bg-gradient-to-r from-accent-danger to-red-300' : 'text-transparent bg-clip-text bg-gradient-to-r from-accent-warning to-yellow-300'
          }`}>
            {aiVerdict || 'AWAITING ANALYSIS'}
          </p>
        </div>
        <div className="bg-black/30 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] hover:border-white/20 transition-all">
          <h3 className="text-xs text-white/50 font-bold tracking-widest mb-2 uppercase flex items-center gap-2"><ZoomIn size={14}/> Algorithm Signal (Current)</h3>
          <p className={`text-2xl font-black drop-shadow-md ${
            currentAlgoPos > 0.5 ? 'text-transparent bg-clip-text bg-gradient-to-r from-accent-success to-green-300' : 
            currentAlgoPos < -0.5 ? 'text-transparent bg-clip-text bg-gradient-to-r from-accent-danger to-red-300' : 'text-transparent bg-clip-text bg-gradient-to-r from-accent-warning to-yellow-300'
          }`}>
            {getAlgoSentiment(currentAlgoPos)} <span className="text-sm font-semibold text-white/40 ml-3 bg-white/5 px-2 py-1 rounded">Size: {(currentAlgoPos).toFixed(2)}x</span>
          </p>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-black/30 backdrop-blur-xl p-5 rounded-2xl border border-white/10 flex flex-col items-center justify-center text-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
          <p className="text-xs text-white/50 font-bold tracking-widest mb-2 uppercase">CAGR</p>
          <p className={`text-2xl font-black drop-shadow-sm ${data.metrics.cagr_pct >= 0 ? 'text-accent-success' : 'text-accent-danger'}`}>
            {data.metrics.cagr_pct > 0 ? '+' : ''}{data.metrics.cagr_pct}%
          </p>
        </div>
        <div className="bg-black/30 backdrop-blur-xl p-5 rounded-2xl border border-white/10 flex flex-col items-center justify-center text-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
          <p className="text-xs text-white/50 font-bold tracking-widest mb-2 uppercase">Sharpe Ratio</p>
          <p className={`text-2xl font-black drop-shadow-sm ${data.metrics.sharpe_ratio >= 1 ? 'text-accent-success' : 'text-white'}`}>
            {data.metrics.sharpe_ratio}
          </p>
        </div>
        <div className="bg-black/30 backdrop-blur-xl p-5 rounded-2xl border border-white/10 flex flex-col items-center justify-center text-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
          <p className="text-xs text-white/50 font-bold tracking-widest mb-2 uppercase">Max Drawdown</p>
          <p className="text-2xl font-black text-accent-danger drop-shadow-sm">
            {data.metrics.max_drawdown_pct}%
          </p>
        </div>
        <div className="bg-black/30 backdrop-blur-xl p-5 rounded-2xl border border-white/10 flex flex-col items-center justify-center text-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
          <p className="text-xs text-white/50 font-bold tracking-widest mb-2 uppercase">Win Rate</p>
          <p className="text-2xl font-black text-white drop-shadow-sm">
            {data.metrics.win_rate_pct}%
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="glass-panel p-6 rounded-2xl border border-white/10 shadow-glow relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent-primary/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex justify-between items-center mb-6 relative z-10">
          <div className="text-lg font-bold text-white flex items-center">
            <Activity className="h-6 w-6 mr-3 text-accent-primary" />
            <h2 className="text-2xl">Simulation Visualization</h2>
          </div>
          <div className="flex gap-2">
            <span className="text-sm font-medium text-text-muted self-center mr-2">Zoom: {currentZoom.label}</span>
            <button 
              onClick={() => setZoomIndex(Math.max(0, zoomIndex - 1))}
              disabled={zoomIndex === 0}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 disabled:opacity-30 transition-all text-white"
            >
              <ZoomOut size={16} />
            </button>
            <button 
              onClick={() => setZoomIndex(Math.min(ZOOM_LEVELS.length - 1, zoomIndex + 1))}
              disabled={zoomIndex === ZOOM_LEVELS.length - 1}
              className="p-2 bg-accent-primary hover:bg-accent-secondary rounded-lg border border-accent-primary disabled:opacity-30 transition-all text-white shadow-sm"
            >
              <ZoomIn size={16} />
            </button>
          </div>
        </div>
        <div className="relative z-10">
          <BacktestChart displayData={displayData} />
        </div>
      </div>
    </div>
  );
}

function BacktestChart({ displayData }: { displayData: any[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width, height } = useContainerSize(containerRef);

  return (
    <div ref={containerRef} className="w-full" style={{ height: 450, position: 'relative' }}>
      {width > 0 && height > 0 && (
        <ComposedChart width={width} height={height} data={displayData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} opacity={0.3} />
          <XAxis 
            dataKey="date" 
            stroke="var(--text-muted)" 
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }} 
            tickMargin={10} 
            minTickGap={30}
          />
          <YAxis 
            stroke="var(--text-muted)" 
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            tickFormatter={(value) => `$${value.toFixed(0)}`}
            domain={['auto', 'auto']}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'rgba(28, 28, 33, 0.8)', 
              borderColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px rgba(168, 85, 247, 0.2)',
              backdropFilter: 'blur(12px)',
              padding: '12px'
            }}
            itemStyle={{ color: '#fff', fontWeight: 'bold' }}
            labelStyle={{ color: 'var(--text-muted)', marginBottom: '4px' }}
            formatter={(value: any, name: any, item: any) => [
              `$${Number(value).toFixed(2)}`, 
              name === 'algo_prediction' ? 'Algorithm Prediction' : 
              name === 'ai_prediction' ? 'AI Probability' : 'Real Stock Price'
            ]}
            labelFormatter={(label, payload) => {
              if (payload && payload.length > 0 && payload[0].payload.isLive) {
                return `LIVE UPDATE - Price: $${payload[0].payload.price.toFixed(2)}`;
              }
              return label;
            }}
          />
          <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '13px', fontWeight: 'bold' }} />
          
          <Line 
            type="monotone" 
            dataKey="algo_prediction" 
            name="Algorithm Prediction" 
            stroke="var(--accent-primary)" 
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 6, fill: 'var(--accent-primary)', stroke: '#000', strokeWidth: 2 }}
          />
          <Line 
            type="monotone" 
            dataKey="price" 
            name="Real Stock Price" 
            stroke="#94a3b8" 
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, fill: '#94a3b8', stroke: '#000', strokeWidth: 2 }}
          />
          <Line 
            type="monotone" 
            dataKey="ai_prediction" 
            name="AI Probability" 
            stroke="var(--accent-success)" 
            strokeWidth={3}
            strokeDasharray="6 6"
            dot={false}
            activeDot={false}
          />
        </ComposedChart>
      )}
    </div>
  );
}
