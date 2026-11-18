"use client";

import { Clock, TrendingUp, Briefcase } from 'lucide-react';

export default function ProfileHistory({ 
  history, 
  onAnalyzeClick 
}: { 
  history: { analyzedTickers: string[], savedPortfolios: any[] },
  onAnalyzeClick: (ticker: string) => void
}) {
  
  if (!history || (history.analyzedTickers.length === 0 && history.savedPortfolios.length === 0)) {
    return (
      <div className="glass-panel p-16 text-center flex flex-col items-center justify-center animate-fade-in delay-200 shadow-glow relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
        <Clock className="text-text-muted mb-6 opacity-40 animate-pulse" size={64} />
        <h3 className="text-2xl font-bold mb-3 text-white">No History Found</h3>
        <p className="text-text-secondary max-w-md mx-auto text-lg leading-relaxed">
          You haven't run any analysis or generated any portfolios on this profile yet. Switch tabs to get started, and your history will automatically save here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 animate-fade-in delay-100">
      
      {/* Analyzed Tickers Section */}
      {history.analyzedTickers.length > 0 && (
        <div className="glass-panel p-6">
          <div className="flex items-center gap-2 mb-6 border-b border-border-glass pb-4">
            <TrendingUp className="text-accent-primary" />
            <h2 className="text-xl font-bold">Previously Analyzed Assets</h2>
          </div>
          <div className="flex flex-wrap gap-4">
            {history.analyzedTickers.map((ticker) => (
              <button 
                key={ticker}
                onClick={() => onAnalyzeClick(ticker)}
                className="bg-black/40 backdrop-blur-md px-8 py-6 rounded-2xl border border-white/10 hover:border-accent-primary hover:bg-white/5 transition-all duration-300 flex flex-col items-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] hover:shadow-[0_0_20px_rgba(59,130,246,0.2)] group"
              >
                <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-accent-primary group-hover:to-accent-secondary transition-all drop-shadow-sm">{ticker}</span>
                <span className="text-sm font-semibold text-accent-secondary mt-3 opacity-80 group-hover:opacity-100 transition-opacity">Re-Analyze &rarr;</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Saved Portfolios Section */}
      {history.savedPortfolios.length > 0 && (
        <div className="glass-panel p-6">
          <div className="flex items-center gap-2 mb-6 border-b border-border-glass pb-4">
            <Briefcase className="text-accent-success" />
            <h2 className="text-xl font-bold">Generated Portfolios</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {history.savedPortfolios.map((portfolio, idx) => (
              <div key={idx} className="bg-black/30 backdrop-blur-xl p-6 rounded-2xl border border-white/10 hover:border-white/20 transition-all shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                <div className="flex justify-between items-start mb-5 border-b border-white/10 pb-4">
                  <div>
                    <span className="text-2xl font-black text-white">${portfolio.summary.total_capital.toLocaleString()}</span>
                    <p className="text-sm text-text-muted font-medium mt-1">{portfolio.summary.time_horizon} Year Horizon</p>
                  </div>
                  <div className="text-right">
                    <span className="text-accent-success font-extrabold text-xl bg-accent-success/10 px-3 py-1 rounded-lg">{portfolio.summary.blended_roi.toFixed(1)}% ROI</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  {portfolio.portfolio.map((asset: any) => (
                    <span key={asset.ticker} className="text-sm px-3 py-1.5 bg-white/5 rounded-lg border border-white/10 text-white font-medium shadow-sm">
                      <strong className="text-accent-primary">{asset.ticker}</strong> {asset.allocation_pct.toFixed(0)}%
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
