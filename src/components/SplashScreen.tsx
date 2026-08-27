import { useEffect, useRef, useState } from "react";
import { releaseWarmup } from "@/lib/shorts-warmup";


/**
 * Cinematic Goa Social intro.
 * Pure CSS transform/opacity animation (GPU only) — no heavy images, no layout thrash.
 * Tapping anywhere unlocks browser audio for the shorts feed.
 */
export function SplashScreen({
  duration = 1200,
  children,
}: {
  duration?: number;
  children?: React.ReactNode;
}) {
  const [done, setDone] = useState(false);
  const [fading, setFading] = useState(false);
  const [bloomed, setBloomed] = useState(false);
  const [logoReady, setLogoReady] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("gs_splash")) {
      setDone(true);
      return;
    }
    startedAtRef.current = Date.now();
    const fadeAt = window.setTimeout(() => setFading(true), Math.max(500, duration - 400));
    const finishAt = window.setTimeout(() => finish(), duration);
    return () => {
      window.clearTimeout(fadeAt);
      window.clearTimeout(finishAt);
    };
  }, [duration]);

  function finish() {
    setDone(true);
    sessionStorage.setItem("gs_splash", "1");
    releaseWarmup();
    window.dispatchEvent(new Event("gs-enable-shorts-sound"));
  }


  function handleEnter() {
    if (bloomed) return;
    setBloomed(true);
    try {
      const a = audioRef.current;
      if (a) {
        a.muted = false;
        a.volume = 0.001;
        a.play().catch(() => {});
      }
      sessionStorage.setItem("gs_shorts_sound", "on");
      window.dispatchEvent(new Event("gs-enable-shorts-sound"));
    } catch {}
    const elapsed = Date.now() - startedAtRef.current;
    const wait = Math.max(650 - elapsed, 0);
    window.setTimeout(() => setFading(true), wait + 80);
    window.setTimeout(finish, wait + 420);
  }

  return (
    <>
      <div style={{ visibility: done ? "visible" : "hidden" }}>{children}</div>
      {!done && (
        <button
          type="button"
          onPointerDown={handleEnter}
          className={`gs-splash fixed inset-0 z-[100] block overflow-hidden text-left ${
            fading ? "gs-splash--out" : ""
          } ${bloomed ? "gs-splash--bloom" : ""}`}
          aria-label="Enter Goa Social"
        >
          <audio
            ref={audioRef}
            src="data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjIwLjEwMAAAAAAAAAAAAAAA//tQwAADB8AhSmwhIID3wIakwIhAApAK/pM/O1c/mB5vf/vLwjZ3jV///N//iP//dP//8p//iP//9P//1p//i///9////+VRlAWQqihkKAOhpKKgABEEBEEBAKGgQCAgIAgIgg"
            preload="auto"
            muted
          />

          {/* sky */}
          <div className="gs-sky absolute inset-0" />
          {/* sun */}
          <div className="gs-sun absolute left-1/2 top-[46%] h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full" />
          {/* haze bands */}
          <div className="gs-haze absolute inset-x-0 top-[38%] h-64" />
          {/* sea */}
          <div className="gs-sea absolute inset-x-0 bottom-0 h-[42%]">
            <span className="gs-shimmer absolute inset-x-0 top-0 h-full" />
          </div>

          {/* horizon silhouettes */}
          <svg
            className="gs-ridge absolute inset-x-0 bottom-[34%] w-full"
            viewBox="0 0 1440 220"
            preserveAspectRatio="none"
            aria-hidden
          >
            <path
              d="M0 190 L120 150 L230 178 L340 120 L470 172 L600 138 L740 182 L880 130 L1010 176 L1140 142 L1280 184 L1440 152 L1440 220 L0 220 Z"
              fill="rgba(2,20,16,.92)"
            />
          </svg>

          {/* palms */}
          <div className="gs-palms pointer-events-none absolute inset-x-0 bottom-[26%] h-[46%]">
            {[
              { left: "6%", scale: 1.15, delay: "0s", flip: false },
              { left: "24%", scale: 0.78, delay: ".35s", flip: true },
              { left: "76%", scale: 0.9, delay: ".18s", flip: false },
              { left: "92%", scale: 1.25, delay: ".5s", flip: true },
            ].map((p, i) => (
              <svg
                key={i}
                className="gs-palm absolute bottom-0"
                style={{
                  left: p.left,
                  transform: `translateX(-50%) scale(${p.scale}) ${p.flip ? "scaleX(-1)" : ""}`,
                  animationDelay: p.delay,
                }}
                width="220"
                height="320"
                viewBox="0 0 220 320"
                aria-hidden
              >
                <g fill="rgba(1,14,11,.95)">
                  <path d="M104 320 C104 240 100 180 92 120 L108 118 C118 180 120 244 120 320 Z" />
                  <path d="M100 122 C60 96 30 92 4 104 C34 74 74 74 102 106 Z" />
                  <path d="M104 116 C86 74 58 48 26 40 C70 36 102 66 114 108 Z" />
                  <path d="M110 112 C118 66 146 34 188 22 C158 48 138 82 124 116 Z" />
                  <path d="M112 122 C150 92 186 88 216 100 C184 74 142 76 110 108 Z" />
                  <path d="M106 118 C104 78 112 44 128 16 C124 56 122 90 120 120 Z" />
                </g>
              </svg>
            ))}
          </div>

          {/* drifting embers */}
          <div className="pointer-events-none absolute inset-0">
            {Array.from({ length: 18 }).map((_, i) => (
              <span
                key={i}
                className="gs-ember absolute rounded-full"
                style={{
                  left: `${(i * 53 + 9) % 100}%`,
                  bottom: `${(i * 31 + 12) % 55}%`,
                  width: `${1.5 + (i % 3) * 0.8}px`,
                  height: `${1.5 + (i % 3) * 0.8}px`,
                  animationDuration: `${7 + (i % 5) * 1.6}s`,
                  animationDelay: `${i * 0.4}s`,
                }}
              />
            ))}
          </div>

          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_46%,transparent_28%,rgba(0,0,0,.55)_82%)]" />

          {/* wordmark — placeholder pulses until the real logo decodes, then bursts */}
          <div className="absolute inset-x-0 top-[16%] flex flex-col items-center px-8 text-center text-white">
            <div className="relative h-20 w-20">
              <span
                className={`gs-backlight absolute inset-0 rounded-full ${logoReady ? "gs-backlight--on" : ""}`}
                aria-hidden
              />
              {!logoReady && (
                <span className="gs-mark-skeleton absolute inset-0 rounded-[1.3rem] ring-1 ring-white/20" aria-hidden />
              )}
              <div
                className={`absolute inset-0 overflow-hidden rounded-[1.3rem] ring-1 ring-white/25 shadow-[0_18px_50px_-12px_rgba(0,0,0,.8)] ${
                  logoReady ? "gs-mark-burst" : "opacity-0"
                }`}
              >
                <img
                  src="/logo.png"
                  alt="Goa Social"
                  className="h-full w-full object-cover"
                  decoding="async"
                  onLoad={() => setLogoReady(true)}
                  onError={() => setLogoReady(true)}
                />
              </div>
            </div>
            <h1 className="gs-title mt-6 text-[2.6rem] font-semibold leading-none tracking-[-0.02em]">
              Goa Social
            </h1>
            <p className="gs-sub mt-4 text-[10px] font-medium uppercase tracking-[0.62em] text-emerald-100/70">
              Susegad Network
            </p>
          </div>


          {/* enter ring */}
          <div className="absolute left-1/2 bottom-[19%] -translate-x-1/2 text-center">
            <div className="gs-ring relative mx-auto h-20 w-20">
              <span className="gs-ring-a absolute inset-0 rounded-full border border-white/35" />
              <span className="gs-ring-b absolute inset-0 rounded-full border border-amber-200/45" />
              <span className="absolute inset-[34%] rounded-full bg-amber-100 shadow-[0_0_28px_rgba(253,230,138,.85)]" />
            </div>
            <p className="gs-cta mt-5 text-[10px] font-semibold uppercase tracking-[0.42em] text-white/85">
              {bloomed ? "Entering" : "Tap to enter"}
            </p>
          </div>

          {/* progress hairline */}
          <div className="absolute inset-x-0 bottom-0 h-[2px] bg-white/10">
            <span className="gs-progress block h-full bg-gradient-to-r from-emerald-300 via-amber-200 to-emerald-300" style={{ animationDuration: `${duration}ms` }} />
          </div>

          <style>{`
            .gs-splash { background:#02100d; transition: opacity 700ms cubic-bezier(.4,0,.2,1), filter 700ms; }
            .gs-splash--out { opacity:0; filter: blur(6px); }
            .gs-sky {
              background:
                radial-gradient(120% 80% at 50% 62%, rgba(255,196,120,.35), transparent 55%),
                linear-gradient(180deg,#04131b 0%, #0a2a2f 32%, #16463f 56%, #2c5c46 72%, #071a18 100%);
              animation: gsSkyIn 2.6s cubic-bezier(.16,1,.3,1) both;
            }
            @keyframes gsSkyIn { from { transform: scale(1.08); opacity:.4 } to { transform:none; opacity:1 } }
            .gs-sun {
              background: radial-gradient(circle, rgba(255,241,199,.98) 0%, rgba(255,196,110,.72) 38%, rgba(255,150,70,.18) 62%, transparent 74%);
              filter: blur(1px);
              animation: gsSunRise 3.4s cubic-bezier(.16,1,.3,1) both;
            }
            @keyframes gsSunRise { from { transform: translate(-50%, 40%) scale(.72); opacity:0 } to { transform: translate(-50%,-50%) scale(1); opacity:1 } }
            .gs-haze { background: linear-gradient(180deg, transparent, rgba(255,203,140,.18), transparent); animation: gsDrift 14s ease-in-out infinite alternate; }
            @keyframes gsDrift { from { transform: translate3d(-4%,0,0) } to { transform: translate3d(4%,0,0) } }
            .gs-sea { background: linear-gradient(180deg, rgba(9,44,45,.9), rgba(2,16,13,1)); }
            .gs-shimmer {
              background: repeating-linear-gradient(180deg, rgba(255,220,160,.10) 0 1px, transparent 1px 9px);
              mask-image: linear-gradient(180deg, rgba(0,0,0,.9), transparent 70%);
              animation: gsShimmer 6s linear infinite;
            }
            @keyframes gsShimmer { from { transform: translateY(0) } to { transform: translateY(9px) } }
            .gs-ridge { height: 16vh; animation: gsUp 1.6s .25s cubic-bezier(.16,1,.3,1) both; }
            .gs-palm { transform-origin: 50% 100%; animation: gsSway 7s ease-in-out infinite alternate; opacity:.98 }
            @keyframes gsSway { from { rotate: -1.4deg } to { rotate: 1.6deg } }
            .gs-palms { animation: gsUp 1.9s .1s cubic-bezier(.16,1,.3,1) both; }
            @keyframes gsUp { from { transform: translateY(26px); opacity:0 } to { transform:none; opacity:1 } }
            .gs-ember { background: rgba(255,226,168,.95); box-shadow: 0 0 12px rgba(255,205,120,.9); animation-name: gsEmber; animation-timing-function: ease-in-out; animation-iteration-count: infinite; opacity:0 }
            @keyframes gsEmber {
              0% { transform: translate3d(0,0,0); opacity:0 }
              18% { opacity:.9 }
              100% { transform: translate3d(26px,-140px,0); opacity:0 }
            }
            .gs-mark-skeleton {
              background: linear-gradient(120deg, rgba(255,255,255,.06), rgba(255,226,168,.22), rgba(255,255,255,.06));
              background-size: 220% 100%;
              animation: gsSkeleton 1.4s ease-in-out infinite;
            }
            @keyframes gsSkeleton { from { background-position: 180% 0 } to { background-position: -60% 0 } }
            .gs-backlight {
              opacity: 0; transform: scale(.6);
              background: radial-gradient(circle, rgba(255,226,150,.95) 0%, rgba(255,190,80,.45) 42%, transparent 72%);
              filter: blur(10px);
            }
            .gs-backlight--on { animation: gsBacklight 1.1s cubic-bezier(.16,1,.3,1) forwards; }
            @keyframes gsBacklight {
              0% { opacity:0; transform: scale(.55) }
              35% { opacity:1; transform: scale(2.1) }
              100% { opacity:.55; transform: scale(1.55) }
            }
            .gs-mark-burst { animation: gsMarkBurst 900ms cubic-bezier(.16,1,.3,1) both; }
            @keyframes gsMarkBurst {
              0% { transform: scale(.55) rotate(-8deg); opacity:0; filter: brightness(2.4) }
              45% { transform: scale(1.22) rotate(2deg); opacity:1; filter: brightness(1.5) }
              100% { transform: none; opacity:1; filter:none }
            }

            .gs-title { animation: gsTitle 1.8s .45s cubic-bezier(.16,1,.3,1) both; text-shadow: 0 22px 60px rgba(0,0,0,.65); }
            @keyframes gsTitle { from { letter-spacing:.32em; opacity:0; transform: translateY(10px) } to { letter-spacing:-.02em; opacity:1; transform:none } }
            .gs-sub { animation: gsFade 1.4s 1.15s both; }
            .gs-cta { animation: gsFade 1.2s 1.5s both, gsPulse 2.4s 2.6s ease-in-out infinite; }
            @keyframes gsFade { from { opacity:0 } to { opacity:1 } }
            @keyframes gsPulse { 0%,100% { opacity:.6 } 50% { opacity:1 } }
            .gs-ring { animation: gsFade 1s 1.3s both; }
            .gs-ring-a { animation: gsRing 2.8s ease-out infinite; }
            .gs-ring-b { animation: gsRing 2.8s .9s ease-out infinite; }
            @keyframes gsRing { 0% { transform: scale(.55); opacity:.9 } 100% { transform: scale(1.5); opacity:0 } }
            .gs-progress { width:0; animation-name: gsProgress; animation-timing-function: linear; animation-fill-mode: forwards; }
            @keyframes gsProgress { from { width:0 } to { width:100% } }
            .gs-splash--bloom .gs-sun { animation: none; transform: translate(-50%,-50%) scale(2.6); opacity:1; transition: transform 900ms cubic-bezier(.16,1,.3,1); }
            .gs-splash--bloom .gs-sky { filter: brightness(1.45) saturate(1.2); transition: filter 700ms ease; }
            .gs-splash--bloom .gs-ring { transform: scale(1.35); opacity:0; transition: all 700ms cubic-bezier(.16,1,.3,1); }
            @media (prefers-reduced-motion: reduce) {
              .gs-splash * { animation: none !important; transition: none !important; }
            }
          `}</style>
        </button>
      )}
    </>
  );
}
