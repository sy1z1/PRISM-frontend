import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  baseAlpha: number;
}

export default function CyberGridBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Respect user reduced-motion preferences
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let animationFrameId: number;
    let width = window.innerWidth;
    let height = window.innerHeight;

    const setCanvasSize = () => {
      if (!canvas || !ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    setCanvasSize();
    window.addEventListener('resize', setCanvasSize);

    // Calibrated node count based on viewport area to avoid overcrowding on smaller screens
    const particleCount = Math.min(52, Math.max(24, Math.floor((width * height) / 32000)));
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.32,
        vy: (Math.random() - 0.5) * 0.32,
        size: Math.random() * 1.4 + 1,
        baseAlpha: Math.random() * 0.25 + 0.2,
      });
    }

    let gridOffset = 0;
    const gridSpacing = 48;
    const connectionDistance = 145;

    const drawFrame = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Deep Geospatial Navy Base Gradient
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#020617');
      bgGrad.addColorStop(0.5, '#060d1f');
      bgGrad.addColorStop(1, '#091326');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Subtle Precision Coordinate Grid
      if (!prefersReducedMotion) {
        gridOffset = (gridOffset + 0.18) % gridSpacing;
      }

      ctx.lineWidth = 1;

      for (let x = gridOffset; x < width; x += gridSpacing) {
        const grad = ctx.createLinearGradient(x, 0, x, height);
        grad.addColorStop(0, 'rgba(56, 189, 248, 0)');
        grad.addColorStop(0.5, 'rgba(56, 189, 248, 0.045)');
        grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.strokeStyle = grad;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      for (let y = gridOffset; y < height; y += gridSpacing) {
        const grad = ctx.createLinearGradient(0, y, width, y);
        grad.addColorStop(0, 'rgba(14, 165, 233, 0)');
        grad.addColorStop(0.5, 'rgba(14, 165, 233, 0.045)');
        grad.addColorStop(1, 'rgba(14, 165, 233, 0)');
        ctx.strokeStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 3. Spatial Network Nodes & Telemetry Links
      const centerX = width / 2;
      const centerY = height / 2;
      const safeZoneRadius = Math.min(width, height) * 0.34;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (!prefersReducedMotion) {
          p.x += p.vx;
          p.y += p.vy;

          if (p.x < 0 || p.x > width) p.vx *= -1;
          if (p.y < 0 || p.y > height) p.vy *= -1;
        }

        // Attenuate opacity near the center card so nodes never compete with form text
        const distFromCenter = Math.hypot(p.x - centerX, p.y - centerY);
        const centerAttenuation =
          distFromCenter < safeZoneRadius
            ? 0.25 + 0.75 * (distFromCenter / safeZoneRadius)
            : 1;

        const nodeAlpha = p.baseAlpha * centerAttenuation;

        ctx.fillStyle = `rgba(56, 189, 248, ${nodeAlpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.hypot(dx, dy);

          if (dist < connectionDistance) {
            const proximityAlpha = (1 - dist / connectionDistance) * 0.16 * centerAttenuation;
            const lineGrad = ctx.createLinearGradient(p.x, p.y, p2.x, p2.y);
            lineGrad.addColorStop(0, `rgba(56, 189, 248, ${proximityAlpha.toFixed(3)})`);
            lineGrad.addColorStop(1, `rgba(2, 132, 199, ${(proximityAlpha * 0.3).toFixed(3)})`);

            ctx.strokeStyle = lineGrad;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      // 4. Central Optical Vignette & Ambient Depth
      const vignette = ctx.createRadialGradient(
        centerX,
        centerY,
        Math.min(width, height) * 0.1,
        centerX,
        centerY,
        Math.max(width, height) * 0.75
      );
      vignette.addColorStop(0, 'rgba(2, 6, 23, 0.55)');
      vignette.addColorStop(0.45, 'rgba(2, 6, 23, 0.22)');
      vignette.addColorStop(1, 'rgba(2, 6, 23, 0.65)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);

      if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(drawFrame);
      }
    };

    drawFrame();

    return () => {
      window.removeEventListener('resize', setCanvasSize);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 1,
        pointerEvents: 'none',
        display: 'block',
      }}
    />
  );
}