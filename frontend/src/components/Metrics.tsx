export default function Metrics({ info, history, prediction }: { info: any, history: any[], prediction: any }) {
  if (!info || !history || history.length === 0) return null;

  const latest = history[history.length - 1];

  const formatNum = (num: any) => {
    if (num === "N/A" || num == null) return "N/A";
    if (typeof num === "number") {
      if (num > 1e9) return `$${(num / 1e9).toFixed(2)}B`;
      if (num > 1e6) return `$${(num / 1e6).toFixed(2)}M`;
      return num.toLocaleString();
    }
    return num;
  };

  const formatRatio = (num: any) => {
    if (num === "N/A" || num == null) return "N/A";
    return typeof num === "number" ? num.toFixed(2) : num;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="metric-card bg-bg-secondary rounded-lg border border-border-glass p-4">
          <span className="metric-label">Company Size</span>
          <span className="metric-value">{formatNum(info.marketCap)}</span>
        </div>
        <div className="metric-card bg-bg-secondary rounded-lg border border-border-glass p-4">
          <span className="metric-label">Current Price</span>
          <span className="metric-value">${formatRatio(info.currentPrice)}</span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="metric-card bg-bg-secondary rounded-lg border border-border-glass p-4">
          <span className="metric-label">Valuation (P/E)</span>
          <span className="metric-value">{formatRatio(info.trailingPE)}</span>
        </div>
        <div className="metric-card bg-bg-secondary rounded-lg border border-border-glass p-4">
          <span className="metric-label">Momentum Score</span>
          <span className={`metric-value ${latest.rsi_14 > 70 ? 'metric-negative' : latest.rsi_14 < 30 ? 'metric-positive' : ''}`}>
            {latest.rsi_14 ? latest.rsi_14.toFixed(1) : 'N/A'}
          </span>
        </div>
      </div>

      {prediction && prediction.black_scholes && (
        <div className="metric-card bg-bg-tertiary rounded-lg border border-accent-primary p-4 mt-2">
          <span className="metric-label text-accent-primary flex items-center gap-2">
            Black-Scholes Prediction (30 Days)
          </span>
          <div className="flex justify-between items-center mt-2">
            <div className="flex flex-col">
              <span className="text-xs text-text-muted">Expected Low</span>
              <span className="text-lg font-bold text-accent-danger">${prediction.black_scholes.lower_bound_30d.toFixed(2)}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs text-text-muted">Expected Move</span>
              <span className="text-sm font-semibold">±${prediction.black_scholes.expected_move.toFixed(2)}</span>
            </div>
            <div className="flex flex-col text-right">
              <span className="text-xs text-text-muted">Expected High</span>
              <span className="text-lg font-bold text-accent-success">${prediction.black_scholes.upper_bound_30d.toFixed(2)}</span>
            </div>
          </div>
          <p className="text-xs text-text-secondary mt-3 italic">{prediction.black_scholes.insight}</p>
        </div>
      )}
      
      <div className="mt-2 text-sm text-text-muted text-center">
        Sector: {info.sector} | Industry: {info.industry}
      </div>
    </div>
  );
}
