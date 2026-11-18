"use client";

import { useRef, useEffect, useCallback, useState } from 'react';

interface BrainDiagnostics {
  model_names: string[];
  weights: number[];
  accuracies: number[];
  prediction_count: number;
}

// ─── 3D Math Utilities ───
interface Vec3 { x: number; y: number; z: number; }

function rotateY(v: Vec3, angle: number): Vec3 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: v.x * cos + v.z * sin, y: v.y, z: -v.x * sin + v.z * cos };
}

function rotateX(v: Vec3, angle: number): Vec3 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: v.x, y: v.y * cos - v.z * sin, z: v.y * sin + v.z * cos };
}

function project(v: Vec3, cx: number, cy: number, fov: number): { x: number; y: number; scale: number } {
  const z = v.z + fov;
  const scale = fov / (z > 0.1 ? z : 0.1);
  return { x: cx + v.x * scale, y: cy + v.y * scale, scale };
}

// ─── Particle System ───
interface Particle {
  t: number;       // progress along connection [0, 1]
  speed: number;
  fromIdx: number;  // model index
  alpha: number;
}

// ─── Model Node Colors ───
const MODEL_COLORS = [
  '#34d399', // GARCH - emerald
  '#60a5fa', // OU - blue
  '#f472b6', // Merton - pink
  '#fbbf24', // Kalman - amber
  '#a78bfa', // ARIMA - violet
  '#2dd4bf', // Wavelet - teal
  '#fb923c', // Fourier - orange
  '#e879f9', // Regime - fuchsia
  '#38bdf8', // Black-Scholes - sky
  '#84cc16', // SMA - lime
  '#f87171', // WMA - red
  '#facc15', // EMA - yellow
  '#c084fc', // Trend - purple
  '#22d3ee', // Momentum - cyan
];

const SHORT_NAMES = [
  'GARCH', 'O-U', 'MERTON', 'KALMAN', 'ARIMA',
  'WAVELET', 'FOURIER', 'REGIME', 'B-S',
  'SMA', 'WMA', 'EMA', 'TREND', 'MOMENTUM'
];
const NUM_MODELS = SHORT_NAMES.length;

export default function QuantBrain3D({ diagnostics }: { diagnostics: BrainDiagnostics | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const rotationRef = useRef({ y: 0, x: -0.3 });
  const mouseRef = useRef({ isDragging: false, lastX: 0, lastY: 0 });
  const timeRef = useRef(0);
  const diagRef = useRef<BrainDiagnostics | null>(null);
  const [hasDragged, setHasDragged] = useState(false);
  const hasDraggedRef = useRef(false);

  // Update diagnostics ref without re-triggering animation
  useEffect(() => {
    diagRef.current = diagnostics;
  }, [diagnostics]);

  // Start animation loop
  useEffect(() => {
    let animId: number;
    
    // Initialize particles locally to avoid React immutability lint errors on refs
    const particles: Particle[] = [];
    for (let i = 0; i < 70; i++) { // Increased particles for 14 nodes
      particles.push({
        t: Math.random(),
        speed: 0.003 + Math.random() * 0.005,
        fromIdx: Math.floor(Math.random() * NUM_MODELS),
        alpha: 0.3 + Math.random() * 0.7,
      });
    }

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    
    // Only resize if necessary to avoid layout thrashing
    const displayWidth = canvas.clientWidth * dpr;
    const displayHeight = canvas.clientHeight * dpr;
    
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }
    
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // Reset transform before drawing

    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    const cx = W / 2;
    const cy = H / 2;
    const fov = 400;
    const radius = Math.min(W, H) * 0.30;

    const diag = diagRef.current;
    const weights = diag?.weights || new Array(NUM_MODELS).fill(1 / NUM_MODELS);
    const accuracies = diag?.accuracies || new Array(NUM_MODELS).fill(100);
    const count = diag?.prediction_count || 0;

    timeRef.current += 0.008;
    const time = timeRef.current;

    const ry = rotationRef.current.y + time * 0.15; // Continuous slow rotation
    const rx = rotationRef.current.x + Math.sin(time * 0.5) * 0.05; // Gentle float

    // ─── BACKGROUND ───
    ctx.clearRect(0, 0, W, H);

    // Subtle radial glow
    const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.6);
    bgGrad.addColorStop(0, 'rgba(139, 92, 246, 0.04)');
    bgGrad.addColorStop(0.5, 'rgba(59, 130, 246, 0.02)');
    bgGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // ─── COMPUTE 3D POSITIONS ───
    const nodePositions: Vec3[] = [];
    for (let i = 0; i < NUM_MODELS; i++) {
      const angle = (i / NUM_MODELS) * Math.PI * 2;
      const yOffset = Math.sin(angle * 1.5) * radius * 0.25;
      let pos: Vec3 = {
        x: Math.cos(angle) * radius,
        y: yOffset,
        z: Math.sin(angle) * radius,
      };
      pos = rotateY(pos, ry);
      pos = rotateX(pos, rx);
      nodePositions.push(pos);
    }

    // Center node (ensemble)
    let centerPos: Vec3 = { x: 0, y: 0, z: 0 };
    centerPos = rotateY(centerPos, ry);
    centerPos = rotateX(centerPos, rx);

    const centerProj = project(centerPos, cx, cy, fov);

    // ─── DRAW CONNECTIONS ───
    for (let i = 0; i < NUM_MODELS; i++) {
      const proj = project(nodePositions[i], cx, cy, fov);
      const w = weights[i];
      const normalizedW = w * NUM_MODELS; // normalized so 1/NUM_MODELS = 1.0

      // Connection line
      const lineGrad = ctx.createLinearGradient(proj.x, proj.y, centerProj.x, centerProj.y);
      lineGrad.addColorStop(0, MODEL_COLORS[i]);
      lineGrad.addColorStop(1, `rgba(139, 92, 246, ${0.3 * normalizedW})`);

      ctx.beginPath();
      ctx.moveTo(proj.x, proj.y);
      ctx.lineTo(centerProj.x, centerProj.y);
      ctx.strokeStyle = lineGrad;
      ctx.lineWidth = Math.max(0.5, normalizedW * 2.5);
      ctx.globalAlpha = 0.15 + normalizedW * 0.35;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // ─── DRAW PARTICLES ───
    for (let j = 0; j < particles.length; j++) {
      const p = particles[j];
      p.t += p.speed * (1 + weights[p.fromIdx] * NUM_MODELS);
      if (p.t > 1) {
        p.t = 0;
        p.fromIdx = Math.floor(Math.random() * NUM_MODELS);
        p.alpha = 0.3 + Math.random() * 0.7;
      }

      const nodePos = nodePositions[p.fromIdx];
      // Interpolate from node to center
      const pPos: Vec3 = {
        x: nodePos.x * (1 - p.t) + centerPos.x * p.t,
        y: nodePos.y * (1 - p.t) + centerPos.y * p.t,
        z: nodePos.z * (1 - p.t) + centerPos.z * p.t,
      };
      const pProj = project(pPos, cx, cy, fov);

      const particleSize = 1.5 * pProj.scale * 0.003;
      ctx.beginPath();
      ctx.arc(pProj.x, pProj.y, Math.max(0.5, particleSize), 0, Math.PI * 2);
      ctx.fillStyle = MODEL_COLORS[p.fromIdx];
      ctx.globalAlpha = p.alpha * (1 - p.t * 0.5);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // ─── DRAW MODEL NODES ───
    // Sort by z-depth for proper overlapping
    const sortedIndices = [...Array(NUM_MODELS)].map((_, i) => i).sort((a, b) => nodePositions[a].z - nodePositions[b].z);

    for (const i of sortedIndices) {
      const proj = project(nodePositions[i], cx, cy, fov);
      const w = weights[i];
      const acc = accuracies[i];
      const normalizedW = w * NUM_MODELS;
      const baseSize = 12 + normalizedW * 14;
      const pulse = Math.sin(time * 2 + i) * 2;
      const size = (baseSize + pulse) * proj.scale * 0.0025;

      // Outer glow
      const glowGrad = ctx.createRadialGradient(proj.x, proj.y, 0, proj.x, proj.y, size * 3);
      glowGrad.addColorStop(0, MODEL_COLORS[i] + '40');
      glowGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(proj.x - size * 3, proj.y - size * 3, size * 6, size * 6);

      // Node body
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, Math.max(4, size), 0, Math.PI * 2);
      const nodeGrad = ctx.createRadialGradient(proj.x - size * 0.3, proj.y - size * 0.3, 0, proj.x, proj.y, size);
      nodeGrad.addColorStop(0, MODEL_COLORS[i]);
      nodeGrad.addColorStop(1, MODEL_COLORS[i] + '80');
      ctx.fillStyle = nodeGrad;
      ctx.fill();

      // Node border
      ctx.strokeStyle = MODEL_COLORS[i];
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.6;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Label
      const labelY = proj.y - size - 8;
      ctx.font = `bold ${Math.max(9, 11 * proj.scale * 0.0025)}px 'Inter', sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#e2e8f0';
      ctx.globalAlpha = Math.min(1, proj.scale * 0.003);
      ctx.fillText(SHORT_NAMES[i], proj.x, labelY);

      // Weight percentage
      ctx.font = `${Math.max(8, 9 * proj.scale * 0.0025)}px 'JetBrains Mono', monospace`;
      ctx.fillStyle = MODEL_COLORS[i];
      ctx.fillText(`${(w * 100).toFixed(1)}%`, proj.x, proj.y + size + 14);

      // Accuracy mini-bar
      const barW = 30 * proj.scale * 0.0025;
      const barH = 3;
      const barX = proj.x - barW / 2;
      const barY = proj.y + size + 18;
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = acc > 98 ? '#34d399' : acc > 95 ? '#fbbf24' : '#f87171';
      ctx.fillRect(barX, barY, barW * (acc / 100), barH);
      ctx.globalAlpha = 1;
    }

    // ─── DRAW CENTER NODE (ENSEMBLE) ───
    const centerSize = 22 + Math.sin(time * 1.5) * 3;
    const cSize = centerSize * centerProj.scale * 0.0025;

    // Outer rings
    for (let ring = 3; ring > 0; ring--) {
      ctx.beginPath();
      ctx.arc(centerProj.x, centerProj.y, cSize + ring * 8, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(139, 92, 246, ${0.05 * ring})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Core glow
    const coreGlow = ctx.createRadialGradient(centerProj.x, centerProj.y, 0, centerProj.x, centerProj.y, cSize * 4);
    coreGlow.addColorStop(0, 'rgba(139, 92, 246, 0.25)');
    coreGlow.addColorStop(0.4, 'rgba(99, 102, 241, 0.08)');
    coreGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = coreGlow;
    ctx.fillRect(centerProj.x - cSize * 4, centerProj.y - cSize * 4, cSize * 8, cSize * 8);

    // Core body
    ctx.beginPath();
    ctx.arc(centerProj.x, centerProj.y, Math.max(8, cSize), 0, Math.PI * 2);
    const cGrad = ctx.createRadialGradient(
      centerProj.x - cSize * 0.2, centerProj.y - cSize * 0.2, 0,
      centerProj.x, centerProj.y, cSize
    );
    cGrad.addColorStop(0, '#c084fc');
    cGrad.addColorStop(0.5, '#8b5cf6');
    cGrad.addColorStop(1, '#6d28d9');
    ctx.fillStyle = cGrad;
    ctx.fill();

    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.8;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Center label
    ctx.font = "bold 10px 'Inter', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('BRAIN', centerProj.x, centerProj.y + 3);

    // Learning cycles counter
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.fillStyle = '#a78bfa';
    ctx.fillText(`${count} cycles`, centerProj.x, centerProj.y + cSize + 16);

    // ─── HUD TEXT ───
    ctx.textAlign = 'left';
    ctx.font = "bold 11px 'Inter', sans-serif";
    ctx.fillStyle = 'rgba(226, 232, 240, 0.6)';
    ctx.fillText('QUANT BRAIN v1.0', 12, 20);

    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.fillStyle = 'rgba(167, 139, 250, 0.5)';
    ctx.fillText(`9 MODELS • BAYESIAN META-LEARNER`, 12, 34);

    // Top-right: dominant model
    if (diag) {
      const maxIdx = weights.indexOf(Math.max(...weights));
      ctx.textAlign = 'right';
      ctx.font = "bold 10px 'Inter', sans-serif";
      ctx.fillStyle = MODEL_COLORS[maxIdx];
      ctx.fillText(`DOMINANT: ${SHORT_NAMES[maxIdx]}`, W - 12, 20);
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.fillStyle = 'rgba(226, 232, 240, 0.4)';
      ctx.fillText(`${(weights[maxIdx] * 100).toFixed(1)}% weight`, W - 12, 34);
    }

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Mouse handlers for interactive rotation
  const handleMouseDown = (e: React.MouseEvent) => {
    mouseRef.current.isDragging = true;
    mouseRef.current.lastX = e.clientX;
    mouseRef.current.lastY = e.clientY;
    if (!hasDraggedRef.current) {
      hasDraggedRef.current = true;
      setHasDragged(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!mouseRef.current.isDragging) return;
    const dx = e.clientX - mouseRef.current.lastX;
    const dy = e.clientY - mouseRef.current.lastY;
    rotationRef.current.y += dx * 0.005;
    rotationRef.current.x += dy * 0.005;
    rotationRef.current.x = Math.max(-1.2, Math.min(1.2, rotationRef.current.x));
    mouseRef.current.lastX = e.clientX;
    mouseRef.current.lastY = e.clientY;
  };

  const handleMouseUp = () => {
    mouseRef.current.isDragging = false;
  };

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing rounded-xl"
      style={{ touchAction: 'none', display: 'block' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    />
  );
}
