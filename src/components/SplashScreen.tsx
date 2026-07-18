import { useEffect, useRef, useState } from "react";

/**
 * Greenery splash. Displays an animated Goan jungle scene with a glowing
 * "tap here" flower. The tap does two things:
 *   1. Visually — triggers a bloom / petal-burst animation.
 *   2. Silently — unlocks browser audio autoplay via a muted <audio> play(),
 *      then flips sessionStorage.gs_shorts_sound = "on" so ShortsFeed starts
 *      unmuted.
 * Auto-dismisses after ~7.5s even if the user never taps.
 */
export function SplashScreen({
  duration = 7500,
  children,
}: {
  duration?: number;
  children?: React.ReactNode;
}) {
  const [done, setDone] = useState(false);
  const [fading, setFading] = useState(false);
  const [bloomed, setBloomed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("gs_splash")) {
      setDone(true);
      return;
    }
    const fadeAt = setTimeout(() => setFading(true), duration - 600);
    const t = setTimeout(() => {
      setDone(true);
      sessionStorage.setItem("gs_splash", "1");
    }, duration);
    return () => {
      clearTimeout(t);
      clearTimeout(fadeAt);
    };
  }, [duration]);

  function handleTap() {
    if (bloomed) return;
    setBloomed(true);
    // Silently unlock autoplay-with-sound
    try {
      const a = audioRef.current;
      if (a) {
        a.muted = false;
        a.volume = 0.001;
        a.play().catch(() => {});
      }
      sessionStorage.setItem("gs_shorts_sound", "on");
    } catch {}
    // Fade out a bit sooner so they feel the reward instantly
    setTimeout(() => setFading(true), 700);
    setTimeout(() => {
      setDone(true);
      sessionStorage.setItem("gs_splash", "1");
    }, 1300);
  }

  return (
    <>
      <div style={{ visibility: done ? "visible" : "hidden" }}>{children}</div>
      {!done && (
        <div
          className={`fixed inset-0 z-[100] overflow-hidden transition-opacity duration-500 ${
            fading ? "opacity-0" : "opacity-100"
          }`}
          style={{
            background:
              "radial-gradient(ellipse at 50% 20%, #7dd3a0 0%, #22a06b 35%, #0f6f45 70%, #063d27 100%)",
          }}
        >
          {/* Silent audio primer for autoplay unlock */}
          <audio ref={audioRef} src="data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjIwLjEwMAAAAAAAAAAAAAAA//tQwAADB8AhSmwhIID3wIakwIhAApAK/pM/O1c/mB5vf/vLwjZ3jV///N//iP//dP//8p//iP//9P//1p//i///9////+VRlAWQqihkKAOhpKKgABEEBEEBAKGgQCAgIAgIgg" preload="auto" muted />

          {/* Layer 1: Palm silhouette */}
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 400 800"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden
          >
            {/* Distant hills */}
            <path d="M0 550 Q100 480 200 520 T400 490 L400 800 L0 800 Z" fill="#0a5136" opacity="0.55" />
            <path d="M0 620 Q120 560 240 600 T400 580 L400 800 L0 800 Z" fill="#083e29" opacity="0.7" />

            {/* Palm trunks */}
            {[
              { x: 55, s: 1 },
              { x: 340, s: 0.9 },
              { x: 200, s: 1.1 },
            ].map((p, i) => (
              <g key={i} transform={`translate(${p.x} 620) scale(${p.s})`} style={{ transformOrigin: "center bottom", animation: `sway ${4 + i}s ease-in-out infinite alternate` }}>
                <path d="M-4 0 Q0 -80 -3 -180 Q0 -260 -2 -340" stroke="#1e2f1a" strokeWidth="9" fill="none" strokeLinecap="round" />
                {/* Fronds */}
                {[-70, -35, 0, 35, 70, 105, -105].map((rot, j) => (
                  <path
                    key={j}
                    d="M0 0 Q40 -20 90 -10 Q60 -6 45 8 Q80 0 110 15"
                    stroke="#0f6b3a"
                    strokeWidth="6"
                    fill="none"
                    strokeLinecap="round"
                    transform={`translate(-2 -340) rotate(${rot})`}
                    style={{ transformOrigin: "0 0" }}
                  />
                ))}
              </g>
            ))}

            {/* Foreground grass */}
            {Array.from({ length: 28 }).map((_, i) => (
              <path
                key={i}
                d={`M${i * 15} 780 Q${i * 15 + 3} 740 ${i * 15 + 6} 780`}
                stroke="#0a4f2e"
                strokeWidth="3"
                fill="none"
                style={{ animation: `sway ${2 + (i % 3)}s ease-in-out infinite alternate`, transformOrigin: `${i * 15}px 780px` }}
              />
            ))}
          </svg>

          {/* Floating petals / fireflies */}
          {Array.from({ length: 18 }).map((_, i) => (
            <span
              key={i}
              className="pointer-events-none absolute rounded-full"
              style={{
                left: `${(i * 37) % 100}%`,
                top: `${(i * 53) % 90}%`,
                width: `${4 + (i % 4)}px`,
                height: `${4 + (i % 4)}px`,
                background: i % 3 === 0 ? "#fde68a" : i % 3 === 1 ? "#fbbf24" : "#fecaca",
                boxShadow: "0 0 12px currentColor",
                color: i % 3 === 0 ? "#fde68a" : "#fbbf24",
                opacity: 0.85,
                animation: `float ${6 + (i % 5)}s ease-in-out ${i * 0.3}s infinite`,
              }}
            />
          ))}

          {/* Brand */}
          <div className="absolute inset-x-0 top-[14%] flex flex-col items-center text-white drop-shadow-lg">
            <div className="h-24 w-24 overflow-hidden rounded-3xl border-4 border-white/60 bg-white shadow-2xl">
              <img src="/logo.png" alt="Goa Social" className="h-full w-full object-cover" />
            </div>
            <h1 className="mt-5 text-4xl font-extrabold tracking-tight">Goa Social</h1>
            <p className="mt-1 text-sm opacity-90">Susegad. Always.</p>
          </div>

          {/* The "tap here" flower */}
          <button
            onClick={handleTap}
            aria-label="Tap the flower to enter"
            className="absolute left-1/2 top-[58%] -translate-x-1/2 focus:outline-none"
            style={{ animation: bloomed ? "none" : "breath 1.6s ease-in-out infinite" }}
          >
            <div className="relative">
              {/* Halo */}
              <span
                className="absolute inset-0 -m-6 rounded-full bg-yellow-200/40 blur-xl"
                style={{ animation: "pulse 1.8s ease-in-out infinite" }}
              />
              {/* Flower */}
              <svg width="110" height="110" viewBox="0 0 100 100" aria-hidden>
                {[0, 60, 120, 180, 240, 300].map((rot, i) => (
                  <ellipse
                    key={i}
                    cx="50"
                    cy="28"
                    rx="12"
                    ry="20"
                    fill={i % 2 === 0 ? "#f472b6" : "#fb7185"}
                    transform={`rotate(${rot} 50 50)`}
                    style={{
                      transformOrigin: "50px 50px",
                      transition: "transform 700ms cubic-bezier(.34,1.56,.64,1)",
                      transform: bloomed
                        ? `rotate(${rot}deg) translateY(-18px) scale(1.3)`
                        : `rotate(${rot}deg)`,
                    }}
                  />
                ))}
                <circle cx="50" cy="50" r="12" fill="#fde047" stroke="#f59e0b" strokeWidth="2" />
              </svg>
              {/* Petal burst */}
              {bloomed &&
                Array.from({ length: 14 }).map((_, i) => (
                  <span
                    key={i}
                    className="absolute left-1/2 top-1/2 h-3 w-3 rounded-full"
                    style={{
                      background: ["#f472b6", "#fde047", "#fb7185", "#a7f3d0"][i % 4],
                      animation: `burst 900ms ease-out forwards`,
                      transform: `rotate(${(i * 360) / 14}deg) translateY(0)`,
                    }}
                  />
                ))}
            </div>
            <p className="mt-3 text-center text-sm font-semibold text-white drop-shadow">
              {bloomed ? "Welcome 🌸" : "✨ Tap the flower"}
            </p>
          </button>

          <style>{`
            @keyframes sway { from { transform: rotate(-2deg); } to { transform: rotate(2deg); } }
            @keyframes float {
              0%, 100% { transform: translate(0,0); opacity: .5; }
              50% { transform: translate(20px, -30px); opacity: 1; }
            }
            @keyframes breath {
              0%, 100% { transform: translateX(-50%) scale(1); }
              50% { transform: translateX(-50%) scale(1.08); }
            }
            @keyframes pulse {
              0%, 100% { transform: scale(1); opacity: .5; }
              50% { transform: scale(1.4); opacity: .9; }
            }
            @keyframes burst {
              0% { transform: rotate(var(--r,0)) translateY(0) scale(1); opacity: 1; }
              100% { transform: rotate(var(--r,0)) translateY(-140px) scale(.2); opacity: 0; }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
