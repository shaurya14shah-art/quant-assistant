/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useRef } from 'react';
import { Brain, Loader2, Network, X, Calculator, Activity, Play, Pause, Download, Upload, RotateCcw } from 'lucide-react';
import QuantBrain3D from './QuantBrain3D';
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';

declare global {
  interface Window {
    pywebview?: any;
  }
}
const LiveDashboardWidget = ({ diagnostics, allModels }: { diagnostics: any, allModels: any[] }) => {
  if (!diagnostics) return null;
  return (
    <div className="mt-4 p-5 bg-black/50 border border-violet-500/20 rounded-xl animate-fade-in shadow-[0_0_20px_rgba(139,92,246,0.1)] w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 border-b border-white/10 pb-3 gap-2">
        <h5 className="font-bold text-violet-300 flex items-center gap-2">
          <Activity size={16} className="text-emerald-400 animate-pulse" /> Live Bayesian Variables
        </h5>
        <div className="flex gap-3 text-xs font-mono">
          <span className="text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded border border-emerald-500/20 flex items-center gap-2">
            lr = {(diagnostics.learning_rate || 0.15).toFixed(4)}
          </span>
          <span className="text-fuchsia-400 bg-fuchsia-400/10 px-2 py-1 rounded border border-fuchsia-500/20 flex items-center gap-2">
            α = {(diagnostics.error_sensitivity || 100.0).toFixed(1)}
          </span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-2">
        {allModels.map((model: any, i: number) => (
          <div key={i} className="bg-white/5 p-4 rounded border border-white/10 relative overflow-hidden group hover:border-violet-500/30 transition-colors">
            <div 
              className="absolute left-0 bottom-0 top-0 bg-violet-500/10 transition-all duration-700 ease-out z-0"
              style={{ width: `${(model.weight * 100).toFixed(1)}%` }}
            />
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-sm sm:text-xl uppercase font-bold tracking-wider text-text-secondary truncate min-w-[200px]">{model.name}</span>
              <div className="flex gap-3 justify-end items-center">
                <span className="text-xs font-mono text-violet-300 font-bold whitespace-nowrap">W: {model.weight.toFixed(4)}</span>
                <span className="text-xs text-white/40 font-mono whitespace-nowrap" title="Latest prediction error">E: {model.error.toFixed(4)}</span>
                <span className="text-xs text-white/40 font-mono whitespace-nowrap" title="Lifetime accuracy">Acc: {model.accuracy.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function NeuralEngineTab({ diagnostics }: { diagnostics: any }) {
  const [showMath, setShowMath] = useState(false);
  const [activeEquation, setActiveEquation] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePauseToggle = async () => {
    try {
      setIsProcessing(true);
      const endpoint = isPaused ? '/api/brain/resume' : '/api/brain/pause';
      const res = await fetch(endpoint, { method: 'POST' });
      if (res.ok) {
        setIsPaused(!isPaused);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = async () => {
    try {
      setIsProcessing(true);
      const res = await fetch('/api/brain/export');
      const data = await res.json();
      const jsonString = JSON.stringify(data, null, 2);
      
      if (window.pywebview && window.pywebview.api) {
        await window.pywebview.api.save_state(jsonString);
      } else {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `quant_brain_state_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImportClick = async () => {
    if (window.pywebview && window.pywebview.api) {
      try {
        setIsProcessing(true);
        const content = await window.pywebview.api.load_state();
        if (content) {
          const state = JSON.parse(content);
          await fetch('/api/brain/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state)
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsProcessing(false);
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setIsProcessing(true);
        const content = event.target?.result as string;
        const state = JSON.parse(content);
        await fetch('/api/brain/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state)
        });
      } catch (e) {
        console.error(e);
      } finally {
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleReset = async () => {
    if (confirm("Are you sure you want to wipe all learned patterns? This will reset the QuantBrain weights back to uniform distribution.")) {
      try {
        setIsProcessing(true);
        await fetch('/api/brain/reset', { method: 'POST' });
      } finally {
        setIsProcessing(false);
      }
    }
  };
  
  const controlPanel = (
    <div className="glass-panel p-4 flex flex-wrap items-center justify-between gap-4 border border-violet-500/20 shadow-[0_0_15px_rgba(139,92,246,0.1)] mb-3">
      <div className="flex items-center gap-2">
        <Activity size={18} className={isPaused ? "text-amber-400" : "text-emerald-400 animate-pulse"} />
        <span className="text-sm font-bold tracking-wide">
          {isPaused ? "ENGINE PAUSED" : "ENGINE RUNNING"}
        </span>
      </div>
      
      <div className="flex flex-wrap items-center gap-2">
        <button 
          onClick={handlePauseToggle}
          disabled={isProcessing}
          className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-2 ${isPaused ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'bg-amber-500/20 border-amber-500/30 text-amber-300 hover:bg-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]'}`}
        >
          {isPaused ? <><Play size={14} /> Resume</> : <><Pause size={14} /> Pause</>}
        </button>
        
        <button 
          onClick={handleExport}
          disabled={isProcessing}
          className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/30 text-blue-300 text-xs font-bold transition-all flex items-center gap-2 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
        >
          <Download size={14} /> Export
        </button>
        
        <button 
          onClick={handleImportClick}
          disabled={isProcessing}
          className="px-3 py-1.5 rounded-lg bg-fuchsia-500/20 hover:bg-fuchsia-500/40 border border-fuchsia-500/30 text-fuchsia-300 text-xs font-bold transition-all flex items-center gap-2 shadow-[0_0_10px_rgba(217,70,239,0.2)]"
        >
          <Upload size={14} /> Import
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleImport} 
          accept=".json" 
          className="hidden" 
        />
        
        <button 
          onClick={handleReset}
          disabled={isProcessing}
          className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 text-red-300 text-xs font-bold transition-all flex items-center gap-2 shadow-[0_0_10px_rgba(239,68,68,0.2)]"
        >
          <RotateCcw size={14} /> Reset
        </button>
      </div>
    </div>
  );

  if (!diagnostics) {
    return (
      <div className="animate-fade-in delay-100 flex flex-col gap-3 relative">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
        {controlPanel}
        <div className="flex flex-col items-center justify-center h-96 glass-panel animate-fade-in">
          <Loader2 className="animate-spin text-accent-primary mb-2" size={32} />
          <h3 className="text-xl text-white font-bold tracking-wide">Initializing Neural Engine...</h3>
          <p className="text-xs text-text-secondary mt-2">Loading global Bayesian weights</p>
        </div>
      </div>
    );
  }

  // Use all 9 models, sorted by weight
  const allModels = (diagnostics.model_names || []).map((name: string, i: number) => ({
    name,
    weight: diagnostics.weights?.[i] || 0,
    accuracy: diagnostics.accuracies?.[i] || 0,
    error: diagnostics.avg_errors?.[i] || 0,
  })).sort((a: any, b: any) => b.weight - a.weight);

  return (
    <div className="animate-fade-in delay-100 flex flex-col gap-3 relative">
      {/* Background ambient glows */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[120px] -z-10 pointer-events-none"></div>

      {/* Control Panel */}
      {controlPanel}

      {/* Top Section: Global Status & 3D Visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Left: Global Status Panel */}
        <div className="glass-panel p-6 flex flex-col justify-between border-t-violet-500/50 border-t-2 shadow-[0_0_30px_rgba(139,92,246,0.1)]">
          <div>
            <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <Brain className="text-violet-400" size={28} />
                <h2 className="text-xs font-bold tracking-tight">Global Neural Engine</h2>
              </div>
              <button 
                onClick={() => setShowMath(true)}
                className="px-3 py-1.5 rounded-lg bg-violet-500/20 hover:bg-violet-500/40 border border-violet-500/30 text-violet-300 text-xs font-bold transition-all flex items-center gap-2 shadow-[0_0_10px_rgba(139,92,246,0.2)] hover:shadow-[0_0_15px_rgba(139,92,246,0.4)]"
              >
                <Calculator size={14} /> View Math
              </button>
            </div>
            <p className="text-text-secondary text-xs mb-6 leading-relaxed">
              The QuantBrain utilizes a Bayesian meta-learner to continually optimize a 9-model ensemble.
              This engine runs globally on your device and <strong className="text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded">never resets</strong> when switching assets.
              It learns universal market patterns, dynamically shifting weight towards the most accurate models.
            </p>
            
            <div className="bg-black/50 rounded-xl p-2 border border-white/5 mb-2 shadow-inner">
              <span className="text-text-muted text-[11px] uppercase tracking-widest font-bold block mb-2">Continuous Learning Cycles</span>
              <span className="font-extrabold text-5xl text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400 drop-shadow-md font-mono">
                {diagnostics.prediction_count.toLocaleString()}
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-xs text-text-secondary font-mono bg-white/5 p-5 rounded-lg border border-white/[0.06]">
            <span className="flex items-center gap-2"><Network size={14} className="text-violet-400"/> Models Active: {allModels.length}</span>
            <span className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></div>
              <span className="text-emerald-400">Learning...</span>
            </span>
          </div>
        </div>
        
        {/* Right: 3D Visualizer */}
        <div className="lg:col-span-2 h-[450px] glass-panel overflow-hidden border border-white/5 relative p-0 bg-black/40">
            <div className="absolute top-2 left-5 z-10 bg-black/80 backdrop-blur-md px-4 py-2 rounded-lg border border-white/10 flex items-center gap-2 shadow-lg">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                <span className="text-xs font-mono font-bold text-white tracking-widest">LIVE TOPOLOGY</span>
            </div>
            <QuantBrain3D diagnostics={diagnostics} />
        </div>
      </div>

      {/* Bottom Section: Full 9-Model Grid */}
      <div className="glass-panel p-8 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-2 mb-8 border-b border-white/10 pb-5">
            <Network className="text-fuchsia-400" size={24} />
            <div>
              <h2 className="text-xl font-bold tracking-tight">Ensemble Anatomy</h2>
              <p className="text-xs text-text-muted mt-2 font-mono">Real-time Bayesian weight distribution across all 9 sub-models</p>
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {allModels.map(({ name, weight, accuracy, error }: any) => {
            const barWidth = Math.max(weight * 100 * diagnostics.model_names.length, 2);
            const isDominant = weight > (1.5 / diagnostics.model_names.length);
            const isWeak = weight < (0.5 / diagnostics.model_names.length);
            const barColor = isDominant ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)]' 
              : isWeak ? 'bg-red-500/80' 
              : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]';
            
            return (
              <div key={name} className={`bg-black/40 rounded-2xl p-2 border transition-all duration-500 hover:scale-[1.02] ${isDominant ? 'border-emerald-500/40 bg-emerald-900/10' : 'border-white/[0.08] hover:border-white/20'}`}>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-white tracking-wide truncate pr-3">{name}</span>
                  <div className="flex flex-col items-end bg-black/40 px-2 py-1 rounded border border-white/5">
                      <span className="text-xs font-mono text-emerald-400 font-bold">{accuracy.toFixed(2)}% acc</span>
                  </div>
                </div>
                
                <div className="w-full bg-white/5 rounded-full h-2 mb-2.5 overflow-hidden shadow-inner">
                  <div
                    className={`h-2 rounded-full transition-all duration-1000 ${barColor}`}
                    style={{ width: `${Math.min(barWidth, 100)}%` }}
                  />
                </div>
                
                <div className="flex justify-between items-center text-xs font-mono mt-2 pt-3 border-t border-white/5">
                  <span className="text-text-secondary">Weight: <span className="text-white font-bold text-xs">{(weight * 100).toFixed(1)}%</span></span>
                  <span className="text-text-muted">Err: {error.toFixed(4)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* LaTeX Math Modal */}
      {showMath && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2.5 sm:p-6 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-bg-secondary border border-white/10 rounded-2xl max-w-7xl w-[95vw] max-h-[95vh] h-full flex flex-col shadow-[0_0_50px_rgba(139,92,246,0.15)] relative overflow-hidden">
            
            {/* Header (fixed at top) */}
            <div className="p-2.5 sm:p-2 shrink-0 border-b border-white/10 bg-bg-secondary z-10">
              <button 
                onClick={() => setShowMath(false)}
                className="absolute top-6 right-6 text-text-muted hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
              <h3 className="text-xs font-bold mb-2 flex items-center gap-2 text-white">
                <Brain className="text-violet-400" /> Neural Engine & Sub-Models Mathematics
              </h3>
              <p className="text-text-secondary">The Bayesian Meta-Learner continuous optimization algorithms and the 9 internal predictive models.</p>
            </div>
            
            {/* Scrollable Body */}
            <div className="p-2.5 sm:p-2 pb-32 flex-1 overflow-y-auto min-h-0 space-y-8 text-xs leading-relaxed text-text-primary custom-scrollbar">
              
              {/* Part 1: Meta-Learner */}
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-white border-b border-white/10 pb-2 flex items-center gap-2">
                  <Network className="text-fuchsia-400" size={20} /> Part 1: The Bayesian Meta-Learner
                </h3>
                
                <div className="bg-black/40 p-6 rounded-xl border border-white/5">
                  <h4 className="text-xs font-bold mb-2 text-violet-300">The Core Weight Update Equation</h4>
                  <p className="mb-2">Instead of relying on a single static model, the QuantBrain runs an ensemble of 9 models in parallel. After every real-world price observation, it evaluates how wrong each model was and updates their weights dynamically using an exponentially decaying Bayesian update.</p>
                  <div 
                    onClick={() => setActiveEquation(activeEquation === 'core' ? null : 'core')}
                    className="bg-black/60 p-4 rounded-lg overflow-x-auto text-center my-2 border border-white/10 hover:border-violet-500/50 cursor-pointer transition-all duration-300 text-xs group"
                  >
                    <Latex>{'$$ W_{i, t+1} = (1 - lr) \\times W_{i, t} + lr \\times e^{-\\alpha \\times E_i^2} $$'}</Latex>
                    <div className="text-xs text-violet-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest font-bold">
                      CLICK TO MONITOR LIVE VARIABLES
                    </div>
                  </div>
                  <ul className="list-disc pl-5 space-y-2 text-text-secondary mb-2">
                    <li><Latex>{'$W_{i, t}$'}</Latex>: The current weight of model <Latex>{'$i$'}</Latex>.</li>
                    <li><Latex>{'$lr$'}</Latex>: Learning Rate (default <Latex>{'$0.15$'}</Latex>).</li>
                    <li><Latex>{'$\\alpha$'}</Latex>: Error Sensitivity. This is dynamically scaled inversely to market volatility to prevent weights from crushing to zero during high turbulence.</li>
                    <li><Latex>{'$E_i$'}</Latex>: The relative error of model <Latex>{'$i$'}</Latex>'s prediction.</li>
                  </ul>

                  {activeEquation === 'core' && <LiveDashboardWidget diagnostics={diagnostics} allModels={allModels} />}

                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-black/40 p-6 rounded-xl border border-white/5">
                    <h4 className="text-xs font-bold mb-2 text-emerald-300">Normalization & Regularization</h4>
                    <p className="mb-2">To ensure the ensemble stays balanced and one model doesn't permanently dominate, the engine applies a regularization term pushing the distribution slightly back towards uniform.</p>
                    <div 
                      onClick={() => setActiveEquation(activeEquation === 'norm' ? null : 'norm')}
                      className="bg-black/60 p-5 rounded-lg overflow-x-auto text-center my-2 border border-white/10 hover:border-violet-500/50 cursor-pointer transition-all duration-300 group"
                    >
                      <Latex>{'$$ W_{i}^{norm} = 0.90 \\left( \\frac{W_i}{\\sum W_j} \\right) + 0.10 \\left( \\frac{1}{N} \\right) $$'}</Latex>
                    </div>
                  </div>
                  
                  <div className="bg-black/40 p-6 rounded-xl border border-white/5">
                    <h4 className="text-xs font-bold mb-2 text-fuchsia-300">Ensemble Prediction</h4>
                    <p className="mb-2">The final forecasted price path is the weighted average of all 9 models' independent simulations.</p>
                    <div 
                      onClick={() => setActiveEquation(activeEquation === 'ensemble' ? null : 'ensemble')}
                      className="bg-black/60 p-5 rounded-lg overflow-x-auto text-center my-2 border border-white/10 hover:border-violet-500/50 cursor-pointer transition-all duration-300 group"
                    >
                      <Latex>{'$$ \\text{Price}_{t} = \\sum_{i=1}^{9} W_i \\times \\text{Pred}_{i, t} $$'}</Latex>
                    </div>
                  </div>
                </div>
              </div>

              {/* Part 2: Sub-Models */}
              <div className="space-y-6 pt-4">
                <h3 className="text-xl font-bold text-white border-b border-white/10 pb-2 flex items-center gap-2">
                  <Brain className="text-emerald-400" size={20} /> Part 2: The 9 Sub-Models Anatomy
                </h3>
                
                <div className="grid grid-cols-1 gap-4">
                  
                  {/* Model 1 */}
                  <div className="bg-black/40 p-6 rounded-xl border border-white/5 hover:border-white/20 transition-colors">
                    <h4 className="text-lg font-bold text-white mb-2">1. GARCH(1,1) Volatility</h4>
                    <p className="text-sm text-text-secondary mb-3">Captures volatility clustering (big moves beget big moves) using autoregressive conditional heteroskedasticity.</p>
                    <div 
                      onClick={() => setActiveEquation(activeEquation === 'model_1' ? null : 'model_1')}
                      className="bg-black/60 p-4 rounded-lg overflow-x-auto text-center border border-white/10 text-base hover:border-violet-500/50 cursor-pointer transition-all duration-300 group mt-2"
                    >
                      <Latex>{'$$ \\sigma^2_t = \\omega + \\alpha \\epsilon_{t-1}^2 + \\beta \\sigma^2_{t-1} $$'}</Latex>
                    
                      <div className="text-xs text-violet-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest font-bold">
                        CLICK TO MONITOR LIVE VARIABLES
                      </div>
                    </div>
                    {activeEquation === 'model_1' && <LiveDashboardWidget diagnostics={diagnostics} allModels={allModels} />}
                  </div>

                  {/* Model 2 */}
                  <div className="bg-black/40 p-6 rounded-xl border border-white/5 hover:border-white/20 transition-colors">
                    <h4 className="text-lg font-bold text-white mb-2">2. Ornstein-Uhlenbeck (Mean Reversion)</h4>
                    <p className="text-sm text-text-secondary mb-3">Models prices reverting to a long-term moving average mean <Latex>{'$\\mu$'}</Latex> at a speed <Latex>{'$\\theta$'}</Latex>.</p>
                    <div 
                      onClick={() => setActiveEquation(activeEquation === 'model_2' ? null : 'model_2')}
                      className="bg-black/60 p-4 rounded-lg overflow-x-auto text-center border border-white/10 text-base hover:border-violet-500/50 cursor-pointer transition-all duration-300 group mt-2"
                    >
                      <Latex>{'$$ dX_t = \\theta (\\mu - X_t) dt + \\sigma dW_t $$'}</Latex>
                    
                      <div className="text-xs text-violet-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest font-bold">
                        CLICK TO MONITOR LIVE VARIABLES
                      </div>
                    </div>
                    {activeEquation === 'model_2' && <LiveDashboardWidget diagnostics={diagnostics} allModels={allModels} />}
                  </div>

                  {/* Model 3 */}
                  <div className="bg-black/40 p-6 rounded-xl border border-white/5 hover:border-white/20 transition-colors">
                    <h4 className="text-lg font-bold text-white mb-2">3. Merton Jump Diffusion</h4>
                    <p className="text-sm text-text-secondary mb-3">Combines Geometric Brownian Motion with a Poisson process <Latex>{'$J_t$'}</Latex> to simulate sudden market crashes/spikes.</p>
                    <div 
                      onClick={() => setActiveEquation(activeEquation === 'model_3' ? null : 'model_3')}
                      className="bg-black/60 p-4 rounded-lg overflow-x-auto text-center border border-white/10 text-base hover:border-violet-500/50 cursor-pointer transition-all duration-300 group mt-2"
                    >
                      <Latex>{'$$ dS_t = \\mu S_t dt + \\sigma S_t dW_t + S_t dJ_t $$'}</Latex>
                    
                      <div className="text-xs text-violet-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest font-bold">
                        CLICK TO MONITOR LIVE VARIABLES
                      </div>
                    </div>
                    {activeEquation === 'model_3' && <LiveDashboardWidget diagnostics={diagnostics} allModels={allModels} />}
                  </div>

                  {/* Model 4 */}
                  <div className="bg-black/40 p-6 rounded-xl border border-white/5 hover:border-white/20 transition-colors">
                    <h4 className="text-lg font-bold text-white mb-2">4. Kalman Filter</h4>
                    <p className="text-sm text-text-secondary mb-3">A state-space model that dynamically estimates the true underlying trend by filtering out market noise.</p>
                    <div 
                      onClick={() => setActiveEquation(activeEquation === 'model_4' ? null : 'model_4')}
                      className="bg-black/60 p-4 rounded-lg overflow-x-auto text-center border border-white/10 text-base hover:border-violet-500/50 cursor-pointer transition-all duration-300 group mt-2"
                    >
                      <Latex>{'$$ x_{k|k} = x_{k|k-1} + K_k (z_k - H_k x_{k|k-1}) $$'}</Latex>
                    
                      <div className="text-xs text-violet-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest font-bold">
                        CLICK TO MONITOR LIVE VARIABLES
                      </div>
                    </div>
                    {activeEquation === 'model_4' && <LiveDashboardWidget diagnostics={diagnostics} allModels={allModels} />}
                  </div>

                  {/* Model 5 */}
                  <div className="bg-black/40 p-6 rounded-xl border border-white/5 hover:border-white/20 transition-colors">
                    <h4 className="text-lg font-bold text-white mb-2">5. ARIMA (Trend Extrapolation)</h4>
                    <p className="text-sm text-text-secondary mb-3">Autoregressive Integrated Moving Average. Captures linear temporal trends and autocorrelations.</p>
                    <div 
                      onClick={() => setActiveEquation(activeEquation === 'model_5' ? null : 'model_5')}
                      className="bg-black/60 p-4 rounded-lg overflow-x-auto text-center border border-white/10 text-base hover:border-violet-500/50 cursor-pointer transition-all duration-300 group mt-2"
                    >
                      <Latex>{'$$ y_t = c + \\sum_{i=1}^p \\phi_i y_{t-i} + \\sum_{j=1}^q \\theta_j \\epsilon_{t-j} $$'}</Latex>
                    
                      <div className="text-xs text-violet-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest font-bold">
                        CLICK TO MONITOR LIVE VARIABLES
                      </div>
                    </div>
                    {activeEquation === 'model_5' && <LiveDashboardWidget diagnostics={diagnostics} allModels={allModels} />}
                  </div>

                  {/* Model 6 */}
                  <div className="bg-black/40 p-6 rounded-xl border border-white/5 hover:border-white/20 transition-colors">
                    <h4 className="text-lg font-bold text-white mb-2">6. Wavelet Denoising</h4>
                    <p className="text-sm text-text-secondary mb-3">Uses multi-resolution Discrete Wavelet Transforms to separate macro trends from micro-fluctuations.</p>
                    <div 
                      onClick={() => setActiveEquation(activeEquation === 'model_6' ? null : 'model_6')}
                      className="bg-black/60 p-4 rounded-lg overflow-x-auto text-center border border-white/10 text-base hover:border-violet-500/50 cursor-pointer transition-all duration-300 group mt-2"
                    >
                      <Latex>{'$$ x(t) = \\sum c_k \\phi(t-k) + \\sum d_{j,k} \\psi_{j,k}(t) $$'}</Latex>
                    
                      <div className="text-xs text-violet-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest font-bold">
                        CLICK TO MONITOR LIVE VARIABLES
                      </div>
                    </div>
                    {activeEquation === 'model_6' && <LiveDashboardWidget diagnostics={diagnostics} allModels={allModels} />}
                  </div>

                  {/* Model 7 */}
                  <div className="bg-black/40 p-6 rounded-xl border border-white/5 hover:border-white/20 transition-colors">
                    <h4 className="text-lg font-bold text-white mb-2">7. Fourier Harmonics</h4>
                    <p className="text-sm text-text-secondary mb-3">Extracts cyclical seasonality and repeating frequency patterns using the Fast Fourier Transform (FFT).</p>
                    <div 
                      onClick={() => setActiveEquation(activeEquation === 'model_7' ? null : 'model_7')}
                      className="bg-black/60 p-4 rounded-lg overflow-x-auto text-center border border-white/10 text-base hover:border-violet-500/50 cursor-pointer transition-all duration-300 group mt-2"
                    >
                      <Latex>{'$$ X_k = \\sum_{n=0}^{N-1} x_n e^{-i 2\\pi k n / N} $$'}</Latex>
                    
                      <div className="text-xs text-violet-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest font-bold">
                        CLICK TO MONITOR LIVE VARIABLES
                      </div>
                    </div>
                    {activeEquation === 'model_7' && <LiveDashboardWidget diagnostics={diagnostics} allModels={allModels} />}
                  </div>

                  {/* Model 8 */}
                  <div className="bg-black/40 p-6 rounded-xl border border-white/5 hover:border-white/20 transition-colors">
                    <h4 className="text-lg font-bold text-white mb-2">8. Regime Detection (HMM)</h4>
                    <p className="text-sm text-text-secondary mb-3">Uses K-Means to identify hidden Bull/Bear states <Latex>{'$S_t$'}</Latex> and projects Markov transition probabilities.</p>
                    <div 
                      onClick={() => setActiveEquation(activeEquation === 'model_8' ? null : 'model_8')}
                      className="bg-black/60 p-4 rounded-lg overflow-x-auto text-center border border-white/10 text-base hover:border-violet-500/50 cursor-pointer transition-all duration-300 group mt-2"
                    >
                      <Latex>{'$$ P(R_t \\mid S_t=i) \\sim \\mathcal{N}(\\mu_i, \\sigma_i^2) $$'}</Latex>
                    
                      <div className="text-xs text-violet-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest font-bold">
                        CLICK TO MONITOR LIVE VARIABLES
                      </div>
                    </div>
                    {activeEquation === 'model_8' && <LiveDashboardWidget diagnostics={diagnostics} allModels={allModels} />}
                  </div>

                  {/* Model 9 */}
                  <div className="bg-black/40 p-6 rounded-xl border border-white/5 hover:border-white/20 transition-colors">
                    <h4 className="text-lg font-bold text-white mb-2">9. Black-Scholes Boundary Mapping</h4>
                    <p className="text-sm text-text-secondary mb-3">Calculates the risk-neutral expected price path and maximum theoretical implied move bounds using option pricing logic.</p>
                    <div 
                      onClick={() => setActiveEquation(activeEquation === 'model_9' ? null : 'model_9')}
                      className="bg-black/60 p-4 rounded-lg overflow-x-auto text-center border border-white/10 text-base hover:border-violet-500/50 cursor-pointer transition-all duration-300 group mt-2"
                    >
                      <Latex>{'$$ S_t = S_0 \\exp\\left( (r - \\frac{\\sigma^2}{2})t + \\sigma \\sqrt{t} Z \\right) $$'}</Latex>
                    
                      <div className="text-xs text-violet-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest font-bold">
                        CLICK TO MONITOR LIVE VARIABLES
                      </div>
                    </div>
                    {activeEquation === 'model_9' && <LiveDashboardWidget diagnostics={diagnostics} allModels={allModels} />}
                  </div>

                  {/* Model 10 */}
                  <div className="bg-black/40 p-6 rounded-xl border border-white/5 hover:border-white/20 transition-colors">
                    <h4 className="text-lg font-bold text-white mb-2">10. Simple Moving Average (SMA)</h4>
                    <p className="text-sm text-text-secondary mb-3">Unweighted mean of the previous N data points to smooth out short-term fluctuations.</p>
                    <div 
                      onClick={() => setActiveEquation(activeEquation === 'model_10' ? null : 'model_10')}
                      className="bg-black/60 p-4 rounded-lg overflow-x-auto text-center border border-white/10 text-base hover:border-violet-500/50 cursor-pointer transition-all duration-300 group mt-2"
                    >
                      <Latex>{'$$ \\text{SMA}_k = \\frac{1}{n} \\sum_{i=k-n+1}^{k} P_i $$'}</Latex>
                    
                      <div className="text-xs text-violet-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest font-bold">
                        CLICK TO MONITOR LIVE VARIABLES
                      </div>
                    </div>
                    {activeEquation === 'model_10' && <LiveDashboardWidget diagnostics={diagnostics} allModels={allModels} />}
                  </div>

                  {/* Model 11 */}
                  <div className="bg-black/40 p-6 rounded-xl border border-white/5 hover:border-white/20 transition-colors">
                    <h4 className="text-lg font-bold text-white mb-2">11. Weighted Moving Average (WMA)</h4>
                    <p className="text-sm text-text-secondary mb-3">Linearly weights recent data points heavier than older ones for faster response times.</p>
                    <div 
                      onClick={() => setActiveEquation(activeEquation === 'model_11' ? null : 'model_11')}
                      className="bg-black/60 p-4 rounded-lg overflow-x-auto text-center border border-white/10 text-base hover:border-violet-500/50 cursor-pointer transition-all duration-300 group mt-2"
                    >
                      <Latex>{'$$ \\text{WMA}_M = \\frac{n P_M + (n-1) P_{M-1} + \\dots + 2 P_{M-n+2} + P_{M-n+1}}{n + (n-1) + \\dots + 2 + 1} $$'}</Latex>
                    
                      <div className="text-xs text-violet-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest font-bold">
                        CLICK TO MONITOR LIVE VARIABLES
                      </div>
                    </div>
                    {activeEquation === 'model_11' && <LiveDashboardWidget diagnostics={diagnostics} allModels={allModels} />}
                  </div>

                  {/* Model 12 */}
                  <div className="bg-black/40 p-6 rounded-xl border border-white/5 hover:border-white/20 transition-colors">
                    <h4 className="text-lg font-bold text-white mb-2">12. Exponential Moving Average (EMA)</h4>
                    <p className="text-sm text-text-secondary mb-3">Applies exponentially decreasing weights over time, strongly prioritizing the latest values.</p>
                    <div 
                      onClick={() => setActiveEquation(activeEquation === 'model_12' ? null : 'model_12')}
                      className="bg-black/60 p-4 rounded-lg overflow-x-auto text-center border border-white/10 text-base hover:border-violet-500/50 cursor-pointer transition-all duration-300 group mt-2"
                    >
                      <Latex>{'$$ \\text{EMA}_t = P_t \\cdot \\alpha + \\text{EMA}_{t-1} \\cdot (1 - \\alpha) $$'}</Latex>
                    
                      <div className="text-xs text-violet-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest font-bold">
                        CLICK TO MONITOR LIVE VARIABLES
                      </div>
                    </div>
                    {activeEquation === 'model_12' && <LiveDashboardWidget diagnostics={diagnostics} allModels={allModels} />}
                  </div>

                  {/* Model 13 */}
                  <div className="bg-black/40 p-6 rounded-xl border border-white/5 hover:border-white/20 transition-colors">
                    <h4 className="text-lg font-bold text-white mb-2">13. Linear Trend</h4>
                    <p className="text-sm text-text-secondary mb-3">Ordinary Least Squares (OLS) regression to estimate the underlying directional trend line.</p>
                    <div 
                      onClick={() => setActiveEquation(activeEquation === 'model_13' ? null : 'model_13')}
                      className="bg-black/60 p-4 rounded-lg overflow-x-auto text-center border border-white/10 text-base hover:border-violet-500/50 cursor-pointer transition-all duration-300 group mt-2"
                    >
                      <Latex>{'$$ \\hat{y}_i = \\beta_0 + \\beta_1 x_i $$'}</Latex>
                    
                      <div className="text-xs text-violet-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest font-bold">
                        CLICK TO MONITOR LIVE VARIABLES
                      </div>
                    </div>
                    {activeEquation === 'model_13' && <LiveDashboardWidget diagnostics={diagnostics} allModels={allModels} />}
                  </div>

                  {/* Model 14 */}
                  <div className="bg-black/40 p-6 rounded-xl border border-white/5 hover:border-white/20 transition-colors">
                    <h4 className="text-lg font-bold text-white mb-2">14. Rate of Change (Momentum)</h4>
                    <p className="text-sm text-text-secondary mb-3">Measures the velocity of price movement between two periods to extrapolate short-term trajectory.</p>
                    <div 
                      onClick={() => setActiveEquation(activeEquation === 'model_14' ? null : 'model_14')}
                      className="bg-black/60 p-4 rounded-lg overflow-x-auto text-center border border-white/10 text-base hover:border-violet-500/50 cursor-pointer transition-all duration-300 group mt-2"
                    >
                      <Latex>{'$$ \\text{ROC} = \\frac{\\text{Close} - \\text{Close}_{n}}{\\text{Close}_{n}} \\times 100 $$'}</Latex>
                    
                      <div className="text-xs text-violet-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest font-bold">
                        CLICK TO MONITOR LIVE VARIABLES
                      </div>
                    </div>
                    {activeEquation === 'model_14' && <LiveDashboardWidget diagnostics={diagnostics} allModels={allModels} />}
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
