"use client";

import { useRef, useState, useEffect } from 'react';
import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

/**
 * Custom hook to measure a container's dimensions.
 * Recharts ResponsiveContainer has a known bug where it reports -1 width/height
 * in certain flexbox/grid layouts. This hook uses ResizeObserver directly.
 */
function useContainerSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  
  useEffect(() => {
    if (!ref.current) return;
    
    const el = ref.current;
    // Initial measurement
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

export default function PredictionChart({ data, prediction, livePrediction }: { data: any[], prediction?: any, livePrediction?: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width, height } = useContainerSize(containerRef);

  // If we have a live prediction, show the real-time shifting chart
  if (livePrediction && data && data.length > 0) {
    const recentHistory = data.map((d) => ({
      date: d.date,
      price: d.close,
      mean_eigen: null,
      bull_eigen: null,
      bear_eigen: null,
      swarm_bounds: null,
    }));

    const lastPrice = recentHistory[recentHistory.length - 1].price;

    const bridgePoint = {
      date: livePrediction.bridgeDate,
      price: lastPrice,
      mean_eigen: lastPrice,
      bull_eigen: lastPrice,
      bear_eigen: lastPrice,
      swarm_bounds: [lastPrice, lastPrice],
    };

    const futureData = livePrediction.future_path.map((p: any) => ({
      date: p.date,
      price: null,
      mean_eigen: p.mean_eigen,
      bull_eigen: p.bull_eigen,
      bear_eigen: p.bear_eigen,
      swarm_bounds: [p.swarm_lower, p.swarm_upper],
    }));

    const chartData = [...recentHistory.slice(0, -1), bridgePoint, ...futureData];

    // To prevent ancient historical volatility from squishing the live prediction cone, 
    // we calculate the Y-axis domain based ONLY on the future prediction and the most recent 10 ticks.
    const recentChartData = [
      ...recentHistory.slice(-10),
      bridgePoint, 
      ...futureData
    ];

    let minPrice = Infinity;
    let maxPrice = -Infinity;
    
    recentChartData.forEach(d => {
      if (d.price !== null) {
        if (d.price < minPrice) minPrice = d.price;
        if (d.price > maxPrice) maxPrice = d.price;
      }
      if (d.mean_eigen !== null) {
        if (d.mean_eigen < minPrice) minPrice = d.mean_eigen;
        if (d.mean_eigen > maxPrice) maxPrice = d.mean_eigen;
      }
      if (d.swarm_bounds) {
        if (d.swarm_bounds[0] < minPrice) minPrice = d.swarm_bounds[0];
        if (d.swarm_bounds[1] > maxPrice) maxPrice = d.swarm_bounds[1];
      }
    });
    
    // In case there's somehow no valid data in the recent slice or NaNs sneaked through
    if (!isFinite(minPrice) || !isFinite(maxPrice)) {
        minPrice = lastPrice * 0.95;
        maxPrice = lastPrice * 1.05;
    } else if (Math.abs(maxPrice - minPrice) < 0.0001) {
        minPrice = minPrice * 0.95;
        maxPrice = maxPrice * 1.05;
    }
    
    const range = maxPrice - minPrice;
    // Use a smaller padding (10%) so the cone looks even wider and more pronounced
    const padding = range === 0 ? minPrice * 0.01 : range * 0.1;
    const yDomain = [minPrice - padding, maxPrice + padding];

    return (
      <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
        {width > 0 && height > 0 && (
          <ComposedChart width={width} height={height} data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorSwarmLive" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-glass)" vertical={false} />
            <XAxis 
              dataKey="date" 
              stroke="var(--text-muted)" 
              fontSize={10}
              tickLine={false}
              axisLine={false}
              minTickGap={20}
            />
            <YAxis 
              stroke="var(--text-muted)" 
              fontSize={11}
              tickLine={false}
              axisLine={false}
              domain={yDomain}
              tickFormatter={(val) => `$${val.toFixed(2)}`}
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
            
            <Line 
              type="monotone" 
              dataKey="price" 
              name="Live Price" 
              stroke="#ffffff" 
              strokeWidth={3} 
              dot={false}
              isAnimationActive={false}
              animationDuration={500}
              connectNulls={true}
            />
            
            <Area 
              type="monotone" 
              dataKey="swarm_bounds" 
              name="Possible Range" 
              stroke="none" 
              fill="url(#colorSwarmLive)"
              isAnimationActive={false}
              animationDuration={500}
            />
            
            <Line 
              type="monotone" 
              dataKey="bull_eigen" 
              name="Best Case" 
              stroke="var(--accent-success)" 
              strokeWidth={3} 
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
              animationDuration={500}
              connectNulls={true}
            />

            <Line 
              type="monotone" 
              dataKey="bear_eigen" 
              name="Worst Case" 
              stroke="var(--accent-danger)" 
              strokeWidth={3} 
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
              animationDuration={500}
              connectNulls={true}
            />

            <Line 
              type="monotone" 
              dataKey="mean_eigen" 
              name="Most Likely" 
              stroke="var(--accent-primary)" 
              strokeWidth={4} 
              dot={false}
              isAnimationActive={false}
              animationDuration={500}
              activeDot={{ r: 5, fill: 'var(--accent-primary)', strokeWidth: 0 }}
              connectNulls={true}
            />
          </ComposedChart>
        )}
      </div>
    );
  }

  // Fallback: show the static 30-day quantum prediction (initial load)
  if (!data || data.length === 0 || !prediction || !prediction.future_path) {
    return <div ref={containerRef} className="text-text-muted flex items-center justify-center h-full">Run analysis to see predictions</div>;
  }

  const recentHistory = data.map((d) => ({
    date: d.date,
    price: d.close,
    bull_eigen: null,
    bear_eigen: null,
    mean_eigen: null,
    swarm_bounds: null,
  }));

  const lastHistoricalPrice = recentHistory[recentHistory.length - 1].price;

  const futureData = prediction.future_path.map((p: any) => ({
    date: p.date,
    price: null,
    bull_eigen: p.bull_eigen,
    bear_eigen: p.bear_eigen,
    mean_eigen: p.mean_eigen,
    swarm_bounds: [p.swarm_lower, p.swarm_upper],
  }));

  const bridgePoint = {
    date: recentHistory[recentHistory.length - 1].date,
    price: lastHistoricalPrice,
    bull_eigen: lastHistoricalPrice,
    bear_eigen: lastHistoricalPrice,
    mean_eigen: lastHistoricalPrice,
    swarm_bounds: [lastHistoricalPrice, lastHistoricalPrice],
  };

  const chartData = [...recentHistory.slice(0, -1), bridgePoint, ...futureData];

  let minPrice = Infinity;
  let maxPrice = -Infinity;
  chartData.forEach(d => {
    if (d.price !== null) {
      if (d.price < minPrice) minPrice = d.price;
      if (d.price > maxPrice) maxPrice = d.price;
    }
    if (d.mean_eigen !== null) {
      if (d.mean_eigen < minPrice) minPrice = d.mean_eigen;
      if (d.mean_eigen > maxPrice) maxPrice = d.mean_eigen;
    }
    if (d.swarm_bounds) {
      if (d.swarm_bounds[0] < minPrice) minPrice = d.swarm_bounds[0];
      if (d.swarm_bounds[1] > maxPrice) maxPrice = d.swarm_bounds[1];
    }
  });
  
  const range = maxPrice - minPrice;
  const padding2 = range === 0 ? minPrice * 0.01 : range * 0.2;
  const yDomain = [minPrice - padding2, maxPrice + padding2];

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {width > 0 && height > 0 && (
        <ComposedChart width={width} height={height} data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorSwarm" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.15}/>
              <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0.02}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-glass)" vertical={false} />
          <XAxis 
            dataKey="date" 
            stroke="var(--text-muted)" 
            fontSize={11}
            tickLine={false}
            axisLine={false}
            minTickGap={20}
          />
          <YAxis 
            stroke="var(--text-muted)" 
            fontSize={11}
            tickLine={false}
            axisLine={false}
            domain={yDomain}
            tickFormatter={(val) => `$${val.toFixed(2)}`}
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
          
          <Line 
            type="monotone" 
            dataKey="price" 
            name="Past Price" 
            stroke="var(--text-primary)" 
            strokeWidth={2} 
            dot={false}
            connectNulls={true}
          />
          
          <Area 
            type="monotone" 
            dataKey="swarm_bounds" 
            name="Possible Range" 
            stroke="none" 
            fill="url(#colorSwarm)" 
          />
          
          <Line 
            type="monotone" 
            dataKey="bull_eigen" 
            name="Best Case" 
            stroke="var(--accent-success)" 
            strokeWidth={3} 
            strokeDasharray="4 4"
            dot={false} 
            connectNulls={true}
          />

          <Line 
            type="monotone" 
            dataKey="bear_eigen" 
            name="Worst Case" 
            stroke="var(--accent-danger)" 
            strokeWidth={3} 
            strokeDasharray="4 4"
            dot={false} 
            connectNulls={true}
          />

          <Line 
            type="monotone" 
            dataKey="mean_eigen" 
            name="Most Likely" 
            stroke="var(--accent-primary)" 
            strokeWidth={4} 
            dot={false} 
            activeDot={{ r: 6, fill: 'var(--accent-primary)', strokeWidth: 0 }}
            connectNulls={true}
          />
        </ComposedChart>
      )}
    </div>
  );
}
