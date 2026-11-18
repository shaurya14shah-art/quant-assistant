"use client";

import { useRef, useState, useEffect } from 'react';
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

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

export default function StockChart({ data, prediction }: { data: any[], prediction?: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width, height } = useContainerSize(containerRef);

  if (!data || data.length === 0) return <div ref={containerRef} className="text-text-muted">No data available</div>;

  // Combine historical data and future predictions into one array
  let chartData = [...data];
  
  if (prediction && prediction.future_path) {
    const futureData = prediction.future_path.map((p: any) => ({
      date: p.date,
      predicted_close: p.predicted_close,
      upper_bound: prediction.black_scholes.upper_bound_30d,
      lower_bound: prediction.black_scholes.lower_bound_30d,
    }));
    
    chartData = [...chartData, ...futureData];
    
    // Connect the prediction line to the last historical point
    const lastHistoricalIndex = data.length - 1;
    chartData[lastHistoricalIndex].predicted_close = chartData[lastHistoricalIndex].close;
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {width > 0 && height > 0 && (
        <ComposedChart width={width} height={height} data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-glass)" vertical={false} />
          <XAxis 
            dataKey="date" 
            stroke="var(--text-muted)" 
            fontSize={12}
            tickLine={false}
            axisLine={false}
            minTickGap={30}
          />
          <YAxis 
            stroke="var(--text-muted)" 
            fontSize={12}
            tickLine={false}
            axisLine={false}
            domain={['auto', 'auto']}
            tickFormatter={(val) => `$${val.toFixed(0)}`}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'var(--bg-tertiary)', 
              borderColor: 'var(--border-glass)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)'
            }}
            itemStyle={{ color: 'var(--text-primary)' }}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          
          <Line 
            type="monotone" 
            dataKey="close" 
            name="Current Price" 
            stroke="var(--accent-primary)" 
            strokeWidth={2} 
            dot={false}
            activeDot={{ r: 6, fill: 'var(--accent-primary)' }}
          />
          <Line 
            type="monotone" 
            dataKey="sma_20" 
            name="Short-Term Trend (20d)" 
            stroke="var(--accent-warning)" 
            strokeWidth={1.5} 
            dot={false} 
          />
          <Line 
            type="monotone" 
            dataKey="sma_50" 
            name="Medium-Term Trend (50d)" 
            stroke="var(--accent-secondary)" 
            strokeWidth={1.5} 
            dot={false} 
          />
          
          {prediction && (
            <>
              <Line 
                type="monotone" 
                dataKey="predicted_close" 
                name="Predicted Growth Path" 
                stroke="var(--accent-success)" 
                strokeWidth={2} 
                strokeDasharray="5 5"
                dot={false} 
              />
              <Line 
                type="step" 
                dataKey="upper_bound" 
                name="BS Expected High" 
                stroke="rgba(16, 185, 129, 0.5)" 
                strokeWidth={1.5} 
                strokeDasharray="3 3"
                dot={false} 
              />
              <Line 
                type="step" 
                dataKey="lower_bound" 
                name="BS Expected Low" 
                stroke="rgba(239, 68, 68, 0.5)" 
                strokeWidth={1.5} 
                strokeDasharray="3 3"
                dot={false} 
              />
            </>
          )}
        </ComposedChart>
      )}
    </div>
  );
}
