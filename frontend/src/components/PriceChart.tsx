"use client";

import { useRef, useState, useEffect } from 'react';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

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

export default function PriceChart({ data, prediction }: { data: any[], prediction?: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width, height } = useContainerSize(containerRef);

  if (!data || data.length === 0) return <div ref={containerRef} className="text-text-muted flex items-center justify-center h-full">No data available</div>;

  let chartData = [...data];
  if (prediction && prediction.historical_streamlined) {
     chartData = chartData.map((d, i) => ({
         ...d,
         streamlined_close: prediction.historical_streamlined[i]?.streamlined_close
     }));
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {width > 0 && height > 0 && (
        <ComposedChart width={width} height={height} data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.6}/>
              <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorStreamlined" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--accent-secondary)" />
              <stop offset="50%" stopColor="var(--accent-primary)" />
              <stop offset="100%" stopColor="var(--accent-success)" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-glass)" vertical={false} />
          <XAxis 
            dataKey="date" 
            stroke="var(--text-muted)" 
            fontSize={11}
            tickLine={false}
            axisLine={false}
            minTickGap={40}
          />
          <YAxis 
            yAxisId="left"
            stroke="var(--text-muted)" 
            fontSize={11}
            tickLine={false}
            axisLine={false}
            domain={['auto', 'auto']}
            tickFormatter={(val) => `$${val.toFixed(0)}`}
          />
          <YAxis 
            yAxisId="right"
            orientation="right"
            stroke="var(--text-muted)" 
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) => `${(val/1e6).toFixed(0)}M`}
            domain={[0, 'auto']}
            hide={true}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'rgba(28, 28, 33, 0.8)', 
              borderColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px rgba(59, 130, 246, 0.3)',
              backdropFilter: 'blur(12px)',
              padding: '12px'
            }}
            itemStyle={{ color: '#fff', fontWeight: 'bold' }}
            labelStyle={{ color: 'var(--text-muted)', marginBottom: '4px' }}
          />
          <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: '20px', fontSize: '13px', fontWeight: 'bold' }} />
          
          <Bar 
            yAxisId="right"
            dataKey="volume" 
            name="Volume" 
            fill="var(--border-focus)" 
            opacity={0.3}
            barSize={4}
            isAnimationActive={false}
          />
          <Line 
            yAxisId="left"
            type="monotone" 
            dataKey="close" 
            name="Price" 
            stroke="var(--text-muted)" 
            strokeWidth={1} 
            opacity={0.5}
            dot={false}
            isAnimationActive={false}
          />
          {prediction && (
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="streamlined_close" 
              name="Smoothed Trend" 
              stroke="url(#colorStreamlined)" 
              strokeWidth={3} 
              dot={false}
              isAnimationActive={false}
              activeDot={{ r: 6, fill: 'var(--accent-success)', strokeWidth: 0 }}
            />
          )}
          <Line 
            yAxisId="left"
            type="monotone" 
            dataKey="sma_20" 
            name="Short Trend" 
            stroke="var(--accent-warning)" 
            strokeWidth={1.5} 
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      )}
    </div>
  );
}
