"use client";

import { useRef, useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';

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

export default function RSIChart({ data }: { data: any[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width, height } = useContainerSize(containerRef);

  if (!data || data.length === 0) return <div ref={containerRef} className="text-text-muted flex items-center justify-center h-full">No data available</div>;

  // Filter to only entries with a valid rsi_14 value
  const filtered = data.filter((d: any) => d.rsi_14 != null && d.rsi_14 !== undefined);
  
  if (filtered.length === 0) return <div ref={containerRef} className="text-text-muted flex items-center justify-center h-full">Calculating energy levels…</div>;

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {width > 0 && height > 0 && (
        <LineChart width={width} height={height} data={filtered} margin={{ top: 20, right: 30, left: -10, bottom: 0 }}>
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
            stroke="var(--text-muted)" 
            fontSize={11}
            tickLine={false}
            axisLine={false}
            domain={[0, 100]}
            ticks={[0, 30, 70, 100]}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'var(--bg-tertiary)', 
              borderColor: 'var(--border-glass)',
              borderRadius: 'var(--radius-md)'
            }}
          />
          
          <ReferenceLine y={70} stroke="var(--accent-danger)" strokeDasharray="3 3" opacity={0.5} label={{ position: 'insideTopLeft', value: 'Overheated', fill: 'var(--accent-danger)', fontSize: 10 }} />
          <ReferenceLine y={30} stroke="var(--accent-success)" strokeDasharray="3 3" opacity={0.5} label={{ position: 'insideBottomLeft', value: 'Undervalued', fill: 'var(--accent-success)', fontSize: 10 }} />
          
          <Line 
            type="monotone" 
            dataKey="rsi_14" 
            name="Energy" 
            stroke="#a78bfa" 
            strokeWidth={2.5} 
            dot={false}
            connectNulls={true}
            isAnimationActive={false}
          />
        </LineChart>
      )}
    </div>
  );
}
