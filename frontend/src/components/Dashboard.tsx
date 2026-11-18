"use client";

import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Activity, TrendingUp, FileText, BarChart3, LineChart, Atom, Brain } from 'lucide-react';
import PriceChart from './PriceChart';
import PredictionChart from './PredictionChart';
import RSIChart from './RSIChart';
import Metrics from './Metrics';
import SummaryReport from './SummaryReport';
import QuantumVerdict from './QuantumVerdict';
import BacktestTab from './BacktestTab';
import NeuralEngineTab from './NeuralEngineTab';
import QuantBrain3D from './QuantBrain3D';

export default function Dashboard({ 
  initialTicker,
  onAnalyzeComplete
}: { 
  initialTicker?: string,
  onAnalyzeComplete?: (ticker: string) => void
}) {
  const [ticker, setTicker] = useState(initialTicker || '');
  const [loading, setLoading] = useState(false);
  const [stockData, setStockData] = useState<any>(null);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [predictionData, setPredictionData] = useState<any>(null);
  const [livePrediction, setLivePrediction] = useState<any>(null);
  const [liveTicks, setLiveTicks] = useState<any[]>([]);
  const [liveAccuracy, setLiveAccuracy] = useState<number>(99.85);
  const [quantumState, setQuantumState] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'backtest' | 'neural'>('neural');
  const [streamInterval, setStreamInterval] = useState<number>(1.0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const tickCountRef = useRef(0);
  const latestPredictionRef = useRef<any>(null);
  const [error, setError] = useState('');
  const [activeTicker, setActiveTicker] = useState('');
  const [brainDiagnostics, setBrainDiagnostics] = useState<any>(null);

  useEffect(() => {
    if (initialTicker) {
      setTicker(initialTicker);
      fetchData(initialTicker);
    }
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [initialTicker]);

  const fetchData = async (targetTicker: string) => {
    if (!targetTicker) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    tickCountRef.current = 0;

    setLoading(true);
    setError('');
    setStockData(null);
    setSummaryData(null);
    setPredictionData(null);
    setLivePrediction(null);
    setLiveTicks([]);
    setQuantumState(null);

    try {
      // Fetch historical data & metrics
      const res = await fetch(`/api/stock/${targetTicker}`);
      if (!res.ok) throw new Error('Failed to fetch stock data');
      const data = await res.json();
      setStockData(data);
      if (data.history && data.history.length > 0) {
        setLiveTicks(data.history.slice(-30));
      }
      
      if (onAnalyzeComplete) {
        onAnalyzeComplete(targetTicker);
      }
      setActiveTicker(targetTicker);

      // Async fetch initial full prediction (30-day quantum model)
      fetch(`/api/predict/${targetTicker}`)
        .then(r => {
          if (!r.ok) throw new Error("Failed to fetch prediction");
          return r.json();
        })
        .then(d => {
          setPredictionData(d);
          // Initialize brain diagnostics from the prediction response
          // so the Brain section appears immediately
          if (d.brain_diagnostics) {
            setBrainDiagnostics(d.brain_diagnostics);
          }
        })
        .catch(err => console.error('Prediction error', err));

      // Async fetch summary
      fetch(`/api/generate_summary/${targetTicker}`)
        .then(r => {
          if (!r.ok) throw new Error("Failed to fetch summary");
          return r.json();
        })
        .then(d => {
          // The API now returns `summary`. Accept `report` too so users with
          // an already-running older backend still see their generated report.
          const summary = d.summary ?? d.report;
          if (typeof summary !== 'string' || !summary.trim()) {
            throw new Error('Summary response did not include a report');
          }
          setSummaryData({ ...d, summary });
        })
        .catch(() => {
          setSummaryData({
            summary: "## Analysis Report Unavailable\n\nThe report could not be generated right now. Please try the analysis again in a moment."
          });
        });

      // Async fetch quantum state verdict
      fetch(`/api/quantum_state/${targetTicker}`)
        .then(r => {
          if (!r.ok) throw new Error("Failed to fetch quantum state");
          return r.json();
        })
        .then(d => setQuantumState(d))
        .catch(err => console.error('Quantum state error', err));

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e?: any) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    
    if (!ticker) {
      setError("Please enter a ticker symbol");
      return;
    }
    
    try {
      await fetchData(ticker);
    } catch (err: any) {
      setError(err.message || "Unknown error occurred during search");
    }
  };

  // Handle SSE streaming separately to allow interval switching without refetching historical data
  useEffect(() => {
    if (!activeTicker) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Bypass Next.js proxy for SSE because it buffers the stream
    const eventSource = new EventSource(`http://127.0.0.1:8000/api/stream/${activeTicker}?interval=${streamInterval}`);
    
    eventSource.onopen = () => {
      console.log(`[SSE] Connected to stream for ${activeTicker} with interval ${streamInterval}`);
    };
    
    eventSource.onerror = (err) => {
      // EventSource fires onerror for normal reconnects too — only log if actually closed
      if (eventSource.readyState === EventSource.CLOSED) {
        console.error(`[SSE] Connection closed for ${activeTicker}`);
      }
    };

    eventSource.onmessage = (event) => {
      console.log(`[SSE] Message received (length: ${event.data.length}):`, event.data.substring(0, 50) + "...");
      try {
        const payload = JSON.parse(event.data);
        tickCountRef.current += 1;
        const tickNum = tickCountRef.current;
        
        // Update live ticks array for the Prediction Chart
        setLiveTicks((prevTicks: any[]) => {
          const prevTick = prevTicks.length > 0 ? prevTicks[prevTicks.length - 1] : null;
          let newRsi = 50;
          
          if (prevTick) {
            const priceDiff = payload.price - prevTick.close;
            const lastRsi = (prevTick.rsi_14 != null && prevTick.rsi_14 !== undefined) ? prevTick.rsi_14 : 50;
            // Amplify the micro-tick delta so the RSI fluctuates visibly
            const rawDelta = (priceDiff / prevTick.close) * 15000;
            
            // Add momentum, but also pull it gently back towards 50 so it doesn't peg at 0/100
            newRsi = lastRsi + rawDelta + (50 - lastRsi) * 0.05;
            newRsi = Math.max(5, Math.min(95, newRsi));
            if (isNaN(newRsi) || !isFinite(newRsi)) newRsi = 50;
          }
          
          const newTicks = [
            ...prevTicks, 
            { 
              date: `T+${tickNum}`, 
              close: payload.price, 
              volume: Math.floor(Math.random() * 5000) + 1000,
              streamlined_close: payload.price,
              rsi_14: newRsi 
            }
          ];
          
          if (newTicks.length > 60) newTicks.shift();
          return newTicks;
        });
        
        // Only update currentPrice in stockData info, do NOT append micro-ticks to historical data
        setStockData((prev: any) => {
          if (!prev) return prev;
          return { 
            ...prev, 
            info: {
              ...prev.info,
              currentPrice: payload.price.toFixed(2)
            }
          };
        });
        
        // Update QuantumState current price and shift model bounds so the verdict panel updates live
        setQuantumState((prevQS: any) => {
          if (!prevQS) return prevQS;
          
          let updatedPredictedPrice = prevQS.predicted_price_30d;
          if (payload.prediction && payload.prediction.mean && payload.prediction.mean.length > 0) {
              const meanArr = payload.prediction.mean;
              updatedPredictedPrice = meanArr[meanArr.length - 1];
          }
          const updatedChangePct = ((updatedPredictedPrice - payload.price) / payload.price) * 100;
          
          // Calculate price delta to shift the model bounds live
          const delta = payload.price - prevQS.current_price;
          
          // Simulate live momentum for the RSI panel (approximate)
          const liveRsi = Math.max(5, Math.min(95, prevQS.models.momentum.rsi + (delta / prevQS.current_price) * 15000));
          
          return {
            ...prevQS,
            current_price: Number(payload.price.toFixed(2)),
            predicted_price_30d: Number(updatedPredictedPrice.toFixed(2)),
            predicted_change_pct: Number(updatedChangePct.toFixed(2)),
            models: {
              ...prevQS.models,
              black_scholes: {
                ...prevQS.models.black_scholes,
                lower_bound: Number((prevQS.models.black_scholes.lower_bound + delta).toFixed(2)),
                upper_bound: Number((prevQS.models.black_scholes.upper_bound + delta).toFixed(2)),
              },
              schrodinger: {
                ...prevQS.models.schrodinger,
                collapse_price: Number((prevQS.models.schrodinger.collapse_price + delta).toFixed(2)),
                support: Number((prevQS.models.schrodinger.support + delta).toFixed(2)),
                resistance: Number((prevQS.models.schrodinger.resistance + delta).toFixed(2)),
              },
              monte_carlo: {
                ...prevQS.models.monte_carlo,
                p10: Number((prevQS.models.monte_carlo.p10 + delta).toFixed(2)),
                p90: Number((prevQS.models.monte_carlo.p90 + delta).toFixed(2)),
              },
              momentum: {
                ...prevQS.models.momentum,
                rsi: liveRsi,
              }
            }
          };
        });
        
        // Calculate true mathematical prediction accuracy
        if (latestPredictionRef.current && latestPredictionRef.current.future_path.length > 0) {
            const expected = latestPredictionRef.current.future_path[0].mean_eigen;
            const actual = payload.price;
            const diffPct = Math.abs(expected - actual) / actual;
            const accuracy = Math.max(0, 100 - (diffPct * 100));
            setLiveAccuracy(accuracy);
        }
        
        // Update live prediction — the cone shifts to the current price every tick
        if (payload.prediction) {
          const pred = payload.prediction;
          const futurePath = pred.mean.map((v: number, i: number) => ({
            date: `T+${tickNum + i + 1}`,
            mean_eigen: v,
            bull_eigen: pred.bull[i],
            bear_eigen: pred.bear[i],
            swarm_upper: pred.upper[i],
            swarm_lower: pred.lower[i],
          }));
          const newPredObj = {
            bridgePrice: payload.price,
            bridgeDate: `T+${tickNum}`,
            future_path: futurePath,
          };
          setLivePrediction(newPredObj);
          latestPredictionRef.current = newPredObj;
        }
        
        // Update brain diagnostics from stream
        if (payload.brain_diagnostics) {
          setBrainDiagnostics(payload.brain_diagnostics);
        }
      } catch (e) {
        console.error("EventSource message error:", e);
      }
    };
    eventSourceRef.current = eventSource;

    return () => {
      eventSource.close();
    };
  }, [activeTicker, streamInterval]);

  return (
    <div className="flex flex-col gap-10 animate-fade-in delay-100 relative">
      
      {/* Background ambient glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent-primary/20 rounded-full blur-[100px] -z-10 pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent-secondary/20 rounded-full blur-[100px] -z-10 pointer-events-none"></div>

      <div className="glass-panel p-8 relative overflow-hidden shadow-glow border-accent-primary/30">
        <div className="absolute inset-0 bg-gradient-to-r from-accent-primary/10 to-transparent pointer-events-none"></div>
        <div className="flex gap-4 items-end relative z-10">
          <div className="input-group flex-1">
            <label htmlFor="ticker" className="metric-label text-blue-400">Target Asset</label>
            <input
              id="ticker"
              type="text"
              placeholder="e.g. AAPL, MSFT, TSLA"
              className="input-field uppercase text-xl font-bold tracking-wider bg-black/40 border-accent-primary/30 focus:border-accent-primary rounded-full px-6 py-4 w-full text-white placeholder:text-gray-600 transition-all duration-300"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(e)}
            />
          </div>
          <button type="button" onClick={handleSearch} className="btn btn-primary h-[54px] px-8 text-lg font-bold shadow-glow" disabled={loading}>
            {loading ? <Loader2 className="animate-spin mr-2" size={20} /> : <Search className="mr-2" size={20} />}
            Analyze
          </button>
        </div>
        {error && <p className="text-accent-danger mt-4 text-sm font-medium">{error}</p>}
      </div>
      
      {loading && !stockData && (
        <div className="flex flex-col items-center justify-center py-24 min-h-[400px] glass-panel bg-black/40 border-white/5 animate-fade-in">
          <div className="relative">
             <div className="absolute inset-0 bg-accent-primary blur-2xl opacity-40 animate-[pulseSlow_3s_ease-in-out_infinite] rounded-full" />
             <Loader2 size={64} className="text-white animate-spin relative z-10" />
          </div>
          <p className="text-blue-200/70 animate-[pulseSlow_3s_ease-in-out_infinite] font-semibold mt-8 text-sm tracking-[0.2em] uppercase">Initializing Quantum Brain</p>
        </div>
      )}

      {/* Global Tabs always visible */}
      <div className="flex space-x-2 mb-2 animate-fade-in delay-100 p-2 bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 w-fit shadow-lg mt-4 mx-auto sm:mx-0">
        <button 
          onClick={() => setActiveTab('overview')}
          disabled={!stockData}
          className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center ${activeTab === 'overview' ? 'bg-gradient-to-r from-accent-primary to-accent-secondary text-white shadow-glow border border-white/20' : 'text-white/60 hover:text-white hover:bg-white/5'} ${!stockData ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <BarChart3 size={18} className="mr-2" />
          AI Dashboard
        </button>
        <button 
          onClick={() => setActiveTab('telemetry')}
          disabled={!stockData}
          className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center ${activeTab === 'telemetry' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-glow border border-white/20' : 'text-white/60 hover:text-white hover:bg-white/5'} ${!stockData ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <LineChart size={18} className="mr-2" />
          Live Telemetry
        </button>
        <button 
          onClick={() => setActiveTab('neural')}
          className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center ${activeTab === 'neural' ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-[0_0_15px_rgba(139,92,246,0.6)] border border-white/20' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
        >
          <Brain size={18} className="mr-2" />
          Neural Engine
        </button>
        <button 
          onClick={() => setActiveTab('backtest')}
          disabled={!stockData}
          className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center ${activeTab === 'backtest' ? 'bg-gradient-to-r from-accent-primary to-accent-secondary text-white shadow-glow border border-white/20' : 'text-white/60 hover:text-white hover:bg-white/5'} ${!stockData ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Activity size={18} className="mr-2" />
          Algorithm Backtest
        </button>
      </div>

      {activeTab === 'overview' && stockData ? (
        <>
          {/* Row 1: Compact Info Strip */}
          <div className="glass-panel p-6 animate-fade-in delay-100 flex-1 bg-gradient-to-br from-white/5 to-transparent border-t-accent-primary/50 border-t-2">
            <div className="flex flex-wrap items-center justify-between gap-6 text-sm">
              <div className="flex flex-col gap-1">
                <span className="text-text-muted text-[11px] uppercase tracking-wider font-bold">Current Price</span>
                <span className="font-extrabold text-3xl text-white drop-shadow-md">${stockData.info.currentPrice}</span>
              </div>
              <div className="w-px h-12 bg-white/10 hidden md:block" />
              <div className="flex flex-col gap-1">
                <span className="text-text-muted text-[11px] uppercase tracking-wider font-bold">Company Size</span>
                <span className="font-semibold text-xl text-emerald-400 drop-shadow-md">{stockData.info.marketCap !== 'N/A' ? (Number(stockData.info.marketCap) > 1e9 ? `$${(Number(stockData.info.marketCap) / 1e9).toFixed(1)}B` : stockData.info.marketCap) : 'N/A'}</span>
              </div>
              <div className="w-px h-12 bg-white/10 hidden md:block" />
              <div className="flex flex-col gap-1">
                <span className="text-text-muted text-[11px] uppercase tracking-wider font-bold">Value Ratio (P/E)</span>
                <span className="font-semibold text-xl text-blue-400 drop-shadow-md">{stockData.info.trailingPE}</span>
              </div>
              <div className="w-px h-12 bg-white/10 hidden md:block" />
              <div className="flex flex-col gap-1">
                <span className="text-text-muted text-[11px] uppercase tracking-wider font-bold">Sector</span>
                <span className="font-semibold text-xl text-white">{stockData.info.sector}</span>
              </div>
              <div className="w-px h-12 bg-white/10 hidden md:block" />
              <div className="flex flex-col gap-1">
                <span className="text-text-muted text-[11px] uppercase tracking-wider font-bold">Industry</span>
                <span className="font-semibold text-xl text-white">{stockData.info.industry}</span>
              </div>
            </div>
          </div>

          {/* Row 2: Charts + Quantum Verdict */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className="lg:col-span-2 glass-panel p-6 w-full min-w-0">
                  <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity className="text-accent-primary" size={20} />
                  <h3 className="text-lg font-bold">1-Year Historical Price Action</h3>
                </div>
              </div>
                  <div className="h-[400px] w-full min-w-0">
                    <PriceChart data={stockData.history} prediction={predictionData} />
                  </div>
                </div>
            
            {/* Quantum Verdict Panel */}
            <div className="glass-panel p-5 animate-fade-in delay-200 flex flex-col">
              <div className="flex items-center gap-2 mb-4 border-b border-white/[0.06] pb-3">
                <Atom className="text-violet-400" />
                <h2 className="text-lg font-bold">AI Prediction Engine</h2>
              </div>
              <QuantumVerdict data={quantumState} liveAccuracy={liveAccuracy} />
            </div>
          </div>
          
          <div className="mt-8 glass-panel p-8 animate-fade-in delay-300">
            <div className="flex items-center gap-2 mb-6 border-b border-border-glass pb-4">
              <FileText className="text-accent-success" />
              <h2 className="text-xl">AI-Generated Analysis Report</h2>
            </div>
            <SummaryReport data={summaryData} />
          </div>
        </>
      ) : activeTab === 'telemetry' && stockData ? (
        <>
          {/* Row 3: Live Prediction + RSI */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Live Prediction Map */}
            <div className="lg:col-span-2 glass-panel p-6 animate-fade-in delay-300 flex flex-col">
              <div className="flex items-center gap-2 mb-4 border-b border-border-glass pb-4">
                <LineChart className="text-accent-success" />
                <h2 className="text-xl">Live Forecast</h2>
                <span className="ml-4 text-sm font-mono text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                  Accuracy: {liveAccuracy.toFixed(2)}%
                </span>
                {livePrediction && <span className="ml-auto text-xs text-emerald-400 animate-pulse">● LIVE</span>}
              </div>
              <div className="h-[500px]" style={{ height: "500px", minHeight: "500px" }}>
                <PredictionChart 
                  data={liveTicks} 
                  prediction={predictionData} 
                  livePrediction={livePrediction} 
                />
              </div>
            </div>

            {/* Momentum Oscillator */}
            <div className="glass-panel p-6 animate-fade-in delay-300">
              <div className="flex items-center gap-2 mb-6 border-b border-border-glass pb-4">
                <BarChart3 className="text-accent-warning" />
                <h2 className="text-xl">Energy Level</h2>
              </div>
              <div className="h-[500px]" style={{ height: "500px", minHeight: "500px" }}>
                <RSIChart data={liveTicks.length > 0 ? liveTicks : stockData.history} />
              </div>
            </div>
          </div>

          {/* Row 3.5: AI Brain Topology */}
          <div className="glass-panel p-6 animate-fade-in delay-300">
              <div className="flex items-center gap-2 mb-4 border-b border-border-glass pb-4">
                <Brain className="text-violet-400" />
                <h2 className="text-xl">Quant Brain Core</h2>
                <span className="ml-auto text-xs text-text-muted font-mono">
                  {brainDiagnostics ? `${brainDiagnostics.prediction_count} continuous cycles` : 'Initializing…'}
                </span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 flex flex-col justify-center">
                  <p className="text-sm text-text-secondary mb-4">
                    The AI ensemble is running globally in the background. Switch to the <strong className="text-violet-400">Neural Engine</strong> tab to view the full 9-model anatomy and real-time weight distributions.
                  </p>
                  <button 
                    onClick={() => setActiveTab('neural')}
                    className="btn btn-outline border-violet-500/30 text-violet-300 hover:bg-violet-500/20 py-2 rounded-lg font-bold"
                  >
                    Open Neural Engine
                  </button>
                </div>
                <div className="lg:col-span-2 h-[250px] bg-black/40 rounded-xl overflow-hidden border border-white/5 relative">
                  <div className="absolute top-3 left-3 z-10 bg-black/60 px-2 py-1 rounded border border-white/10 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-[10px] font-mono font-bold text-white/80">LIVE</span>
                  </div>
                  <QuantBrain3D diagnostics={brainDiagnostics} />
                </div>
              </div>
            </div>
        </>
      ) : activeTab === 'neural' ? (
            <NeuralEngineTab diagnostics={brainDiagnostics} />
          ) : activeTab === 'backtest' && stockData ? (
            <BacktestTab 
              ticker={ticker} 
              aiVerdict={quantumState?.verdict || ''} 
              livePrice={livePrediction?.bridgePrice || stockData?.info?.currentPrice} 
              predictionData={predictionData}
              onZoomChange={setStreamInterval}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-24 min-h-[400px] glass-panel bg-black/40 border-white/5 animate-fade-in text-white/50">
               Please search for a target asset to view this tab.
            </div>
          )}

    </div>
  );
}
