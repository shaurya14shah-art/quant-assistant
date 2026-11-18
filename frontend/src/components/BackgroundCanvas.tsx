"use client";

import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  z: number;
  char: string;
}

export default function BackgroundCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const MAX_Z = 1500;
    const FOV = 400;
    const SPEED = 3;
    const PARTICLE_COUNT = 800;
    const particles: Particle[] = [];

    const initParticles = () => {
      particles.length = 0;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
          x: (Math.random() - 0.5) * 3000,
          y: (Math.random() - 0.5) * 3000,
          z: Math.random() * MAX_Z,
          char: Math.random() > 0.5 ? '1' : '0'
        });
      }
    };

    initParticles();

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    window.addEventListener('resize', handleResize);

    const render = () => {
      // Clear with solid black for deep contrast
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.z -= SPEED;

        // Reset particle to the back when it passes the camera
        if (p.z <= 1) {
          p.z = MAX_Z;
          p.x = (Math.random() - 0.5) * 3000;
          p.y = (Math.random() - 0.5) * 3000;
          p.char = Math.random() > 0.5 ? '1' : '0';
        }

        // 3D Projection
        const scale = FOV / p.z;
        const x2d = p.x * scale + cx;
        const y2d = p.y * scale + cy;

        // Only draw if within bounds
        if (x2d >= 0 && x2d <= width && y2d >= 0 && y2d <= height) {
          // Opacity increases as Z approaches 0
          const opacity = Math.max(0, 1 - (p.z / MAX_Z));
          // Size increases as Z approaches 0
          const fontSize = Math.max(1, 16 * scale);

          ctx.font = `${fontSize}px monospace`;
          ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
          ctx.fillText(p.char, x2d, y2d);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed top-0 left-0 w-full h-full pointer-events-none z-0"
    />
  );
}
