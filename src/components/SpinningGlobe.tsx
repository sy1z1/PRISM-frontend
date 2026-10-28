import { useEffect, useRef } from 'react';

export default function SpinningGlobe() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Increased radius to cover a much larger area
    const globeRadius = Math.min(width, height) * 0.48;
    let rotationAngle = 0;

    // More dense dots for a richer grid spread
    const dots: { lat: number; lon: number }[] = [];
    for (let lat = -80; lat <= 80; lat += 9) {
      for (let lon = -180; lon < 180; lon += 9) {
        dots.push({ lat, lon });
      }
    }

    const toRadians = (deg: number) => (deg * Math.PI) / 180;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;

      rotationAngle += 0.0035;

      // Larger atmospheric glow background
      const bgGlow = ctx.createRadialGradient(centerX, centerY, globeRadius * 0.3, centerX, centerY, globeRadius * 1.6);
      bgGlow.addColorStop(0, 'rgba(14, 165, 233, 0.22)');
      bgGlow.addColorStop(0.6, 'rgba(2, 132, 199, 0.07)');
      bgGlow.addColorStop(1, 'rgba(5, 8, 20, 0)');
      ctx.fillStyle = bgGlow;
      ctx.beginPath();
      ctx.arc(centerX, centerY, globeRadius * 1.6, 0, Math.PI * 2);
      ctx.fill();

      // Globe outer boundary ring
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(centerX, centerY, globeRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Render rotating grid nodes
      dots.forEach((dot) => {
        const radLat = toRadians(dot.lat);
        const radLon = toRadians(dot.lon + rotationAngle * (180 / Math.PI));

        const x = globeRadius * Math.cos(radLat) * Math.sin(radLon);
        const y = globeRadius * Math.sin(radLat);
        const z = globeRadius * Math.cos(radLat) * Math.cos(radLon);

        if (z > -globeRadius * 0.25) {
          const perspective = 500;
          const scale = perspective / (perspective + z);
          const projectedX = centerX + x * scale;
          const projectedY = centerY - y * scale;

          const alpha = (z + globeRadius) / (2 * globeRadius);

          ctx.fillStyle = `rgba(56, 189, 248, ${Math.max(0.25, alpha)})`;
          ctx.beginPath();
          ctx.arc(projectedX, projectedY, 2 * scale, 0, Math.PI * 2);
          ctx.fill();
        }
      });

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
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 1,
        pointerEvents: 'none',
      }}
    />
  );
}