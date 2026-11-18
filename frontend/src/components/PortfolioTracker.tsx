"use client";

import { useState, useEffect } from 'react';
import { Loader2, Target, Search, X, Activity, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';

export default function PortfolioTracker({ onAnalyzeClick }: { onAnalyzeClick: (ticker: string) => void }) {
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addTicker, setAddTicker] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  useEffect(() => {
    fetchPortfolio();
  }, []);

  const fetchPortfolio = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/portfolio');
      const data = await res.json();
      setPortfolio(data.portfolio || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addTicker.trim()) return;
    setAddLoading(true);
    try {
      await fetch('/api/portfolio/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: addTicker.trim() })
      });
      setAddTicker('');
      await fetchPortfolio();
    } catch (e) {
      console.error(e);
    } finally {
      setAddLoading(false);
    }
  };

  const handleRemove = async (ticker: string) => {
    try {
      await fetch(`/api/portfolio/remove/${ticker}`, {
        method: 'DELETE'
      });
      await fetchPortfolio();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col gap-8 animate-fade-in delay-100 relative mt-4">
      
      {/* Background glow for portfolio */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-3/4 h-64 bg-accent-primary/10 rounded-full blur-[120px] -z-10 pointer-events-none"></div>

      {/* Modern Premium Header */}
      <div className="glass-panel p-8 flex flex-col lg:flex-row justify-between items-center gap-6 shadow-glow border-t-2 border-t-accent-primary/30 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-accent-primary/5 to-transparent pointer-events-none"></div>
        <div className="relative z-10 w-full lg:w-auto text-center lg:text-left">
          <h2 className="text-3xl font-extrabold flex items-center justify-center lg:justify-start gap-3 mb-2 tracking-tight">
            <Target className="text-accent-primary" size={32} />
            Command Center
          </h2>
          <p className="text-text-secondary text-sm font-medium tracking-wide">
            Real-time, multi-asset quantum AI monitoring.
          </p>
        </div>
        <form onSubmit={handleAdd} className="flex gap-3 w-full lg:w-auto relative z-10">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="text-white/40" size={18} />
            </div>
            <input 
              type="text" 
              placeholder="Add Ticker (e.g. NVDA)" 
              className="w-full lg:w-[250px] bg-black/40 border border-white/10 text-white rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-accent-primary/60 focus:ring-1 focus:ring-accent-primary/60 transition-all font-bold uppercase tracking-widest placeholder:normal-case placeholder:font-normal placeholder:tracking-normal shadow-inner"
              value={addTicker}
              onChange={(e) => setAddTicker(e.target.value.toUpperCase())}
            />
          </div>
          <button type="submit" className="btn bg-white text-black hover:bg-gray-200 px-6 font-extrabold rounded-xl shadow-lg transition-all" disabled={addLoading}>
            {addLoading ? <Loader2 className="animate-spin" size={20} /> : 'Track'}
          </button>
        </form>
      </div>

      {/* Advanced Card Grid */}
      {loading ? (
        <div className="glass-panel p-16 flex flex-col justify-center items-center gap-4">
          <Loader2 className="animate-spin text-accent-primary" size={40} />
          <p className="text-text-muted font-medium">Syncing with Quantum Engine...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {portfolio.map((asset, i) => (
            <div key={i} className="glass-panel p-0 relative overflow-hidden group border border-white/5 hover:border-accent-primary/50 transition-all duration-300 shadow-lg hover:shadow-glow flex flex-col bg-gradient-to-b from-white/5 to-transparent">
              
              {/* Colored status bar at top */}
              <div className={`h-1 w-full bg-accent-${asset.verdict_color}`}></div>
              
              <button 
                onClick={() => handleRemove(asset.ticker)}
                className="absolute top-4 right-4 text-white/30 hover:text-accent-danger transition-colors opacity-0 group-hover:opacity-100 p-2 bg-black/40 backdrop-blur-sm rounded-full"
              >
                <X size={14} />
              </button>
              
              <div className="p-6 flex-1">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-3xl font-extrabold tracking-tight mb-1">{asset.ticker}</h3>
                    <p className="text-white/60 font-medium text-lg flex items-center gap-2">
                      ${asset.current_price.toFixed(2)}
                      {asset.predicted_change_pct > 0 ? (
                        <TrendingUp size={16} className="text-accent-success" />
                      ) : (
                        <TrendingDown size={16} className="text-accent-danger" />
                      )}
                    </p>
                  </div>
                  <div className={`px-4 py-1.5 rounded-full text-xs font-bold border bg-accent-${asset.verdict_color}/10 border-accent-${asset.verdict_color}/30 text-accent-${asset.verdict_color} shadow-sm backdrop-blur-md`}>
                    {asset.verdict}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                    <span className="text-text-muted text-[10px] uppercase font-bold tracking-wider block mb-1">Q-Score</span>
                    <span className={`text-xl font-extrabold ${asset.composite_score > 0 ? 'text-accent-success' : 'text-accent-danger'}`}>
                      {asset.composite_score > 0 ? '+' : ''}{asset.composite_score}
                    </span>
                  </div>
                  <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                    <span className="text-text-muted text-[10px] uppercase font-bold tracking-wider block mb-1">Confidence</span>
                    <span className="text-xl font-extrabold text-white">{asset.confidence}%</span>
                  </div>
                  <div className="bg-black/30 p-3 rounded-xl border border-white/5 col-span-2 flex justify-between items-center">
                    <span className="text-text-muted text-[10px] uppercase font-bold tracking-wider">30-Day Tgt</span>
                    <span className="font-extrabold text-lg">
                      ${asset.predicted_price_30d.toFixed(2)} 
                      <span className={`text-sm ml-2 ${asset.predicted_change_pct > 0 ? 'text-accent-success' : 'text-accent-danger'}`}>
                        {asset.predicted_change_pct > 0 ? '+' : ''}{asset.predicted_change_pct.toFixed(2)}%
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Button at bottom */}
              <button 
                onClick={() => onAnalyzeClick(asset.ticker)}
                className="w-full bg-accent-primary/10 hover:bg-accent-primary/30 text-accent-primary font-bold py-4 transition-colors flex items-center justify-center gap-2 border-t border-accent-primary/20"
              >
                Deep-Dive Analysis <ArrowRight size={16} />
              </button>
            </div>
          ))}
          
          {portfolio.length === 0 && (
            <div className="col-span-full p-12 text-center border-2 border-dashed border-white/10 rounded-2xl bg-black/20">
              <Activity className="mx-auto text-white/20 mb-4" size={48} />
              <h3 className="text-xl font-bold text-white/60 mb-2">No active trackers</h3>
              <p className="text-white/40 max-w-sm mx-auto">
                Add an asset above to initialize the quantum engine for real-time monitoring and predictions.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
