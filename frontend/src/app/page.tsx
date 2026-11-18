"use client";

import { useState, useEffect, useRef, ReactNode } from 'react';
import Dashboard from '@/components/Dashboard';
import PortfolioScreener from '@/components/PortfolioScreener';
import PortfolioTracker from '@/components/PortfolioTracker';
import ProfileHistory from '@/components/ProfileHistory';
import BackgroundCanvas from '@/components/BackgroundCanvas';
import { Trash2, UserCircle, Hexagon } from 'lucide-react';
import Image from 'next/image';

const DEFAULT_PROFILES = ['Default', 'Retirement', 'Trading'];

// Reusable Scroll Section component for cinematic transitions
function ScrollSection({ id, children, className = '' }: { id: string, children: ReactNode, className?: string }) {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          // Optional: observer.unobserve(entry.target) if you only want it to animate once
        }
      },
      { threshold: 0.15 } // Trigger when 15% of the section is visible
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => {
      if (sectionRef.current) observer.unobserve(sectionRef.current);
    };
  }, []);

  return (
    <section 
      id={id} 
      ref={sectionRef} 
      className={`scroll-section ${isVisible ? 'is-visible' : ''} ${className}`}
    >
      {children}
    </section>
  );
}

export default function Home() {
  const [targetTicker, setTargetTicker] = useState<string>('');
  const [profiles, setProfiles] = useState<string[]>(DEFAULT_PROFILES);
  const [activeProfile, setActiveProfile] = useState<string>('Default');
  const [historyData, setHistoryData] = useState<any>({});

  useEffect(() => {
    const savedProfiles = localStorage.getItem('qa_profiles');
    const savedActive = localStorage.getItem('qa_activeProfile');
    const savedHistory = localStorage.getItem('qa_history');

    if (savedProfiles) setProfiles(JSON.parse(savedProfiles));
    if (savedActive) setActiveProfile(savedActive);
    
    if (savedHistory) {
      setHistoryData(JSON.parse(savedHistory));
    } else {
      const initHist: any = {};
      DEFAULT_PROFILES.forEach(p => { initHist[p] = { analyzedTickers: [], savedPortfolios: [] }; });
      setHistoryData(initHist);
      localStorage.setItem('qa_history', JSON.stringify(initHist));
    }
  }, []);

  const handleProfileChange = (newProfile: string) => {
    setActiveProfile(newProfile);
    localStorage.setItem('qa_activeProfile', newProfile);
  };

  const handleReset = () => {
    if (confirm(`Are you sure you want to reset all history for the ${activeProfile} profile?`)) {
      const newHistory = { ...historyData };
      newHistory[activeProfile] = { analyzedTickers: [], savedPortfolios: [] };
      setHistoryData(newHistory);
      localStorage.setItem('qa_history', JSON.stringify(newHistory));
    }
  };

  const handleSaveTicker = (ticker: string) => {
    if (!ticker) return;
    const currentHist = historyData[activeProfile] || { analyzedTickers: [], savedPortfolios: [] };
    if (!currentHist.analyzedTickers.includes(ticker)) {
      const updatedHist = {
        ...historyData,
        [activeProfile]: {
          ...currentHist,
          analyzedTickers: [ticker, ...currentHist.analyzedTickers]
        }
      };
      setHistoryData(updatedHist);
      localStorage.setItem('qa_history', JSON.stringify(updatedHist));
    }
  };

  const handleSavePortfolio = (portfolio: any) => {
    const currentHist = historyData[activeProfile] || { analyzedTickers: [], savedPortfolios: [] };
    const updatedHist = {
      ...historyData,
      [activeProfile]: {
        ...currentHist,
        savedPortfolios: [portfolio, ...currentHist.savedPortfolios]
      }
    };
    setHistoryData(updatedHist);
    localStorage.setItem('qa_history', JSON.stringify(updatedHist));
  };

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <main className="scroll-container relative w-full h-full text-[var(--text-main)] bg-[var(--bg-color)]">
      
      {/* ── 3D Flying Background Layer ── */}
      <BackgroundCanvas />

      {/* ── Navbar ── */}
      <nav className="fixed top-0 w-full h-[70px] flex justify-between items-center px-6 md:px-10 bg-[var(--glass-bg)] backdrop-blur-3xl border-b border-[var(--glass-border)] z-50 transition-all shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        {/* The drag region for the frameless window */}
        <div className="pywebview-drag-region absolute inset-0 z-0"></div>
        
        <div className="flex items-center gap-4 z-10">
          
          {/* Custom Window Controls */}
          <div className="flex items-center gap-2 mr-2">
            <button onClick={() => (window as any).pywebview?.api?.close_window()} className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-400 flex items-center justify-center transition-colors cursor-pointer"></button>
            <button onClick={() => (window as any).pywebview?.api?.minimize_window()} className="w-3 h-3 rounded-full bg-yellow-500/80 hover:bg-yellow-400 flex items-center justify-center transition-colors cursor-pointer"></button>
            <div className="w-3 h-3 rounded-full bg-white/10"></div>
          </div>
          
          <div className="flex items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity ml-2" onClick={() => scrollTo('hero')}>
            <div className="w-10 h-10 relative rounded-xl group">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-cover rounded-xl" />
              {/* 2-corner glare overlay */}
              <div className="absolute inset-0 rounded-xl shadow-[inset_1.5px_1.5px_2px_rgba(255,255,255,0.5),inset_-1.5px_-1.5px_2px_rgba(255,255,255,0.5)] pointer-events-none mix-blend-screen opacity-70 group-hover:opacity-100 transition-opacity"></div>
            </div>
            <span className="text-sm md:text-xl font-bold tracking-widest text-[var(--text-main)] uppercase">Agent Eminence</span>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-10 z-10">
          <button onClick={() => scrollTo('analyzer')} className="text-[var(--text-sub)] hover:text-[var(--text-main)] text-[10px] font-bold tracking-[0.2em] uppercase transition-colors">Analyzer</button>
          <button onClick={() => scrollTo('tracker')} className="text-[var(--text-sub)] hover:text-[var(--text-main)] text-[10px] font-bold tracking-[0.2em] uppercase transition-colors">Tracker</button>
          <button onClick={() => scrollTo('screener')} className="text-[var(--text-sub)] hover:text-[var(--text-main)] text-[10px] font-bold tracking-[0.2em] uppercase transition-colors">Screener</button>
          <button onClick={() => scrollTo('history')} className="text-[var(--text-sub)] hover:text-[var(--text-main)] text-[10px] font-bold tracking-[0.2em] uppercase transition-colors">History</button>
        </div>
        <div className="flex items-center gap-3 z-10">
          <UserCircle className="text-[var(--text-dim)] w-5 h-5" />
          <select 
            className="bg-transparent border-none text-[var(--text-main)] text-xs font-bold tracking-[0.1em] outline-none cursor-pointer appearance-none uppercase"
            value={activeProfile}
            onChange={(e) => handleProfileChange(e.target.value)}
          >
            {profiles.map(p => <option key={p} value={p} className="bg-black text-white">{p}</option>)}
          </select>
          <button onClick={handleReset} className="text-[var(--danger-color)] opacity-50 hover:opacity-100 transition-opacity ml-2">
            <Trash2 size={16} />
          </button>
        </div>
      </nav>

      {/* ── Section 1: Hero Splash (Also uses ScrollSection so it fades in initially) ── */}
      <ScrollSection id="hero" className="min-h-screen pt-[70px] z-10 flex flex-col items-center justify-center -mt-10">
        <div className="z-10 flex flex-col items-center text-center px-4 w-full max-w-4xl">
          <div className="w-16 h-16 md:w-20 md:h-20 relative mb-8 rounded-2xl group hover:scale-105 transition-all duration-700 cursor-pointer">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-cover rounded-2xl" />
            {/* 2-corner glare overlay */}
            <div className="absolute inset-0 rounded-2xl shadow-[inset_2px_2px_3px_rgba(255,255,255,0.5),inset_-2px_-2px_3px_rgba(255,255,255,0.5)] pointer-events-none mix-blend-screen opacity-80 group-hover:opacity-100 group-hover:shadow-[inset_2.5px_2.5px_5px_rgba(255,255,255,0.7),inset_-2.5px_-2.5px_5px_rgba(255,255,255,0.7)] transition-all duration-700"></div>
          </div>
          <h1 className="text-4xl md:text-6xl font-light mb-6 tracking-wide text-[var(--text-main)] drop-shadow-[0_0_10px_rgba(255,255,255,0.05)]">
            Agent Eminence
          </h1>
          <p className="text-[var(--text-sub)] text-xs md:text-sm font-medium tracking-[0.2em] uppercase max-w-xl opacity-80">
            Advanced Quantitative Research Environment
          </p>
          <button onClick={() => scrollTo('analyzer')} className="mt-16 text-[var(--text-dim)] hover:text-white border border-[var(--glass-border)] hover:border-[var(--card-hover-border)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.05)] px-8 py-3 rounded-full text-[10px] font-semibold tracking-widest uppercase transition-all duration-500 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
            Enter Vault
          </button>
        </div>

        <div className="absolute bottom-12 flex flex-col items-center gap-3 text-[var(--text-sub)] text-[0.6rem] tracking-[0.3em] uppercase cursor-pointer opacity-50 hover:opacity-100 transition-opacity" onClick={() => scrollTo('analyzer')}>
          <span>Scroll</span>
        </div>
      </ScrollSection>

      {/* ── Section 2: Analyzer ── */}
      <ScrollSection id="analyzer" className="z-10 w-full max-w-[1600px] mx-auto">
        <div className="mb-12 text-center">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tighter mb-4 drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">NEURAL ANALYZER</h2>
          <p className="text-[var(--text-sub)] tracking-[0.3em] text-xs font-bold uppercase">Real-time inference matrix</p>
        </div>
        <div className="glass-panel w-full p-4 md:p-10 flex-1 overflow-hidden relative">
          <Dashboard initialTicker={targetTicker} onAnalyzeComplete={handleSaveTicker} />
        </div>
      </ScrollSection>

      {/* ── Section 3: Tracker ── */}
      <ScrollSection id="tracker" className="z-10 w-full max-w-[1600px] mx-auto">
        <div className="mb-12 text-center">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tighter mb-4 drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">ASSET TRACKER</h2>
          <p className="text-[var(--text-sub)] tracking-[0.3em] text-xs font-bold uppercase">Global portfolio surveillance</p>
        </div>
        <div className="glass-panel w-full p-4 md:p-10 flex-1">
          <PortfolioTracker onAnalyzeClick={(t) => { setTargetTicker(t); scrollTo('analyzer'); }} />
        </div>
      </ScrollSection>

      {/* ── Section 4: Screener ── */}
      <ScrollSection id="screener" className="z-10 w-full max-w-[1600px] mx-auto">
        <div className="mb-12 text-center">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tighter mb-4 drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">QUANTUM SCREENER</h2>
          <p className="text-[var(--text-sub)] tracking-[0.3em] text-xs font-bold uppercase">Parametric asset filtering</p>
        </div>
        <div className="glass-panel w-full p-4 md:p-10 flex-1">
          <PortfolioScreener 
            onAnalyzeClick={(t) => { setTargetTicker(t); scrollTo('analyzer'); }} 
            onPortfolioGenerated={handleSavePortfolio}
          />
        </div>
      </ScrollSection>

      {/* ── Section 5: History ── */}
      <ScrollSection id="history" className="z-10 w-full max-w-[1600px] mx-auto">
        <div className="mb-12 text-center">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tighter mb-4 drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">SECURE LOGS</h2>
          <p className="text-[var(--text-sub)] tracking-[0.3em] text-xs font-bold uppercase">Immutable transaction history</p>
        </div>
        <div className="glass-panel w-full p-4 md:p-10 flex-1 mb-10">
          <ProfileHistory 
            history={historyData[activeProfile] || { analyzedTickers: [], savedPortfolios: [] }} 
            onAnalyzeClick={(t) => { setTargetTicker(t); scrollTo('analyzer'); }}
          />
        </div>
      </ScrollSection>

    </main>
  );
}
