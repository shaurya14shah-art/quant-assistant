"use client";

import { useState } from 'react';
import { Loader2, DollarSign, Target, Clock, Shield, Briefcase, TrendingUp, AlertTriangle } from 'lucide-react';

export default function PortfolioScreener({ 
  onAnalyzeClick,
  onPortfolioGenerated
}: { 
  onAnalyzeClick: (ticker: string) => void,
  onPortfolioGenerated?: (portfolio: any) => void
}) {
  const [capital, setCapital] = useState<string>('10000');
  const [targetRoi, setTargetRoi] = useState<string>('15');
  const [riskTolerance, setRiskTolerance] = useState<string>('Medium');
  const [timeHorizon, setTimeHorizon] = useState<string>('5');
  
  const [loading, setLoading] = useState(false);
  const [portfolioData, setPortfolioData] = useState<any>(null);
  const [error, setError] = useState('');

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setPortfolioData(null);

    try {
      const res = await fetch('/api/screener', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capital: parseFloat(capital),
          target_roi: parseFloat(targetRoi),
          risk_tolerance: riskTolerance,
          time_horizon_years: parseFloat(timeHorizon)
        })
      });

      if (!res.ok) throw new Error('Failed to generate portfolio');
      const data = await res.json();
      setPortfolioData(data);
      
      if (onPortfolioGenerated) {
        onPortfolioGenerated(data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 animate-fade-in delay-100">
      <div className="glass-panel p-6 md:p-8">
        <div className="flex items-center gap-2 mb-6 border-b border-border-glass pb-4">
          <Briefcase className="text-accent-primary" />
          <h2 className="text-2xl font-bold">Robo-Advisor Parameters</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="input-group">
            <label className="metric-label flex items-center gap-1"><DollarSign size={14}/> Capital ($)</label>
            <input 
              type="number" 
              className="input-field" 
              value={capital} 
              onChange={(e) => setCapital(e.target.value)}
              min="100"
              required
            />
          </div>

          <div className="input-group">
            <label className="metric-label flex items-center gap-1"><Target size={14}/> Target Annual ROI (%)</label>
            <input 
              type="number" 
              className="input-field" 
              value={targetRoi} 
              onChange={(e) => setTargetRoi(e.target.value)}
              min="1"
              max="200"
              required
            />
          </div>

          <div className="input-group">
            <label className="metric-label flex items-center gap-1"><Clock size={14}/> Time Horizon (Years)</label>
            <input 
              type="number" 
              className="input-field" 
              value={timeHorizon} 
              onChange={(e) => setTimeHorizon(e.target.value)}
              min="0.5"
              step="0.5"
              required
            />
          </div>

          <div className="input-group">
            <label className="metric-label flex items-center gap-1"><Shield size={14}/> Risk Tolerance</label>
            <select 
              className="input-field appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23ffffff%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-right bg-[length:12px] pr-8" 
              value={riskTolerance} 
              onChange={(e) => setRiskTolerance(e.target.value)}
            >
              <option value="Low">Low (Dividends, Stability)</option>
              <option value="Medium">Medium (Blue Chips, Growth)</option>
              <option value="High">High (High Beta, Aggressive)</option>
            </select>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button type="button" onClick={handleGenerate} className="btn btn-primary px-8" disabled={loading}>
            {loading ? <Loader2 className="animate-spin mr-2" size={18} /> : <TrendingUp className="mr-2" size={18} />}
            Generate Portfolio
          </button>
        </div>
        {error && <p className="text-accent-danger mt-4 text-sm font-medium"><AlertTriangle className="inline mr-1" size={14}/> {error}</p>}
      </div>

      {portfolioData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in delay-200">
          
          {/* Summary Box */}
          <div className="glass-panel p-8 flex flex-col justify-center relative overflow-hidden shadow-glow">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent-primary via-accent-secondary to-accent-success"></div>
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><Target size={18} className="text-accent-primary"/> Projection Summary</h3>
            <div className="flex flex-col gap-5">
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <span className="text-text-muted font-medium">Total Capital</span>
                <span className="font-extrabold text-xl text-white">${portfolioData.summary.total_capital.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <span className="text-text-muted font-medium">Blended Expected ROI</span>
                <span className="font-extrabold text-xl text-accent-success bg-accent-success/10 px-2 py-1 rounded-md">{portfolioData.summary.blended_roi.toFixed(1)}% / yr</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <span className="text-text-muted font-medium">Time Horizon</span>
                <span className="font-extrabold text-xl text-white">{portfolioData.summary.time_horizon} Years</span>
              </div>
              <div className="flex justify-between items-center pt-3">
                <span className="text-text-muted font-medium">Projected Future Value</span>
                <span className="font-black text-3xl text-transparent bg-clip-text bg-gradient-to-r from-white to-accent-secondary drop-shadow-md">${portfolioData.summary.projected_value.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
              </div>
            </div>
          </div>

          {/* Allocations */}
          <div className="lg:col-span-2 glass-panel p-6 shadow-glow relative overflow-hidden">
            <div className="absolute -top-32 -right-32 w-64 h-64 bg-accent-secondary/10 rounded-full blur-3xl pointer-events-none"></div>
            <h3 className="text-lg text-text-secondary mb-6 relative z-10">Suggested Allocation</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
              {portfolioData.portfolio.map((asset: any, i: number) => (
                <div key={i} className="bg-black/30 backdrop-blur-xl p-5 rounded-2xl border border-white/10 hover:border-accent-primary/60 transition-all duration-300 flex flex-col justify-between shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] group">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="text-2xl font-bold text-white group-hover:text-accent-primary transition-colors">{asset.ticker}</span>
                        <p className="text-sm text-text-muted mt-1">{asset.name}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-accent-secondary font-extrabold text-xl">{asset.allocation_pct.toFixed(0)}%</span>
                        <p className="text-sm text-text-muted mt-1">${asset.allocation_usd.toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
                      </div>
                    </div>
                    <div className="mt-5">
                      <span className="inline-block px-3 py-1.5 bg-accent-primary/10 rounded-full text-xs font-semibold text-accent-primary mb-3 border border-accent-primary/20">
                        {asset.type} • Exp. Return: {asset.expected_return}%
                      </span>
                      <p className="text-sm text-text-secondary leading-relaxed">{asset.rationale}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => onAnalyzeClick(asset.ticker)}
                    className="mt-6 text-sm flex items-center font-bold text-accent-secondary hover:text-white transition-colors self-start opacity-80 hover:opacity-100"
                  >
                    Deep-Dive Analysis &rarr;
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
