/**
 * Loads the WebGL scene only when the device can afford it, and always ships a
 * CSS-only 2D fallback. This is what keeps the homepage fast on phones.
 */
import { Component, Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

const HeroScene = lazy(() => import('./HeroScene.jsx'));

function useCapability() {
  const reduce = useReducedMotion();
  const [state, setState] = useState({ ready: false, webgl: false, lowPower: false, small: false });

  useEffect(() => {
    const canvas = document.createElement('canvas');
    let webgl = false;
    try {
      webgl = !!(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')));
    } catch {
      webgl = false;
    }
    const memory = navigator.deviceMemory || 8;
    const cores = navigator.hardwareConcurrency || 8;
    const small = window.matchMedia('(max-width: 767px)').matches;
    const lowPower = memory <= 4 || cores <= 4 || window.matchMedia('(prefers-reduced-data: reduce)').matches;
    // Defer one frame so the hero text paints first.
    const id = requestAnimationFrame(() => setState({ ready: true, webgl, lowPower, small }));
    return () => cancelAnimationFrame(id);
  }, []);

  return { ...state, reduce };
}

/** Pure-CSS stand-in: animated orbital rings around a glowing core. */
export function Fallback2D({ compact = false }) {
  const dots = useMemo(
    () => Array.from({ length: 26 }, (_, i) => ({
      left: `${(i * 37.5) % 100}%`,
      top: `${(i * 61.3) % 100}%`,
      delay: `${(i % 7) * 0.45}s`,
      size: 2 + (i % 3),
    })),
    [],
  );

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div className="absolute left-1/2 top-1/2 h-[62vmin] w-[62vmin] -translate-x-1/2 -translate-y-1/2">
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(34,211,238,0.30),rgba(168,85,247,0.16)_45%,transparent_70%)] blur-2xl" />
        <div className="absolute inset-[12%] animate-[spin_38s_linear_infinite] rounded-full border border-cyan-300/25" />
        <div className="absolute inset-[22%] animate-[spin_26s_linear_infinite_reverse] rounded-full border border-violet-400/25" />
        <div className="absolute inset-[32%] rounded-full border border-blue-400/20" />
        <div className="absolute inset-[40%] rounded-full bg-[radial-gradient(circle_at_35%_30%,rgba(103,232,249,0.85),rgba(59,130,246,0.5)_45%,rgba(5,6,15,0.95)_75%)] shadow-[0_0_90px_-10px_rgba(34,211,238,0.65)]" />
        {dots.map((d, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-cyan-200/70 animate-pulse"
            style={{ left: d.left, top: d.top, width: d.size, height: d.size, animationDelay: d.delay }}
          />
        ))}
        {!compact && (
          <svg className="absolute inset-0 h-full w-full opacity-40" viewBox="0 0 100 100" fill="none">
            {Array.from({ length: 22 }, (_, i) => {
              const a = (i / 22) * Math.PI * 2;
              const b = ((i * 3.7) / 22) * Math.PI * 2;
              return (
                <line
                  key={i}
                  x1={50 + Math.cos(a) * 30}
                  y1={50 + Math.sin(a) * 30}
                  x2={50 + Math.cos(b) * 30}
                  y2={50 + Math.sin(b) * 30}
                  stroke="url(#netGrad)"
                  strokeWidth="0.15"
                />
              );
            })}
            <defs>
              <linearGradient id="netGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
            </defs>
          </svg>
        )}
      </div>
    </div>
  );
}

export default function SceneStage({ className = '' }) {
  const cap = useCapability();
  const [failed, setFailed] = useState(false);

  // Mobile, low-memory and reduced-motion visitors get the fast 2D treatment.
  const use2D = !cap.webgl || cap.lowPower || cap.small || cap.reduce || failed;

  return (
    <div className={`absolute inset-0 ${className}`}>
      {/* the CSS glow sits under the canvas so the scene reads as emissive */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[80vmin] w-[80vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.16),rgba(168,85,247,0.1)_45%,transparent_70%)] blur-3xl" />
      {!cap.ready || use2D ? (
        <Fallback2D compact={cap.small} />
      ) : (
        <Suspense fallback={<Fallback2D />}>
          <ErrorBoundary onError={() => setFailed(true)}>
            <HeroScene reducedMotion={cap.reduce} detail={1} />
          </ErrorBoundary>
        </Suspense>
      )}
    </div>
  );
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError?.();
  }
  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
