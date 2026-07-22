import { useEffect, useRef, useState } from "react";
import splashForest from "@/assets/goa-splash-forest.jpg";

export function SplashScreen({
  duration = 6000,
  children,
}: {
  duration?: number;
  children?: React.ReactNode;
}) {
  const [done, setDone] = useState(false);
  const [fading, setFading] = useState(false);
  const [bloomed, setBloomed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("gs_splash")) {
      setDone(true);
      return;
    }
    startedAtRef.current = Date.now();
    const fadeAt = window.setTimeout(() => setFading(true), Math.max(3000, duration - 650));
    const finishAt = window.setTimeout(() => finish(), duration);
    return () => {
      window.clearTimeout(fadeAt);
      window.clearTimeout(finishAt);
    };
  }, [duration]);

  function finish() {
    setDone(true);
    sessionStorage.setItem("gs_splash", "1");
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
    const waitForFirstShort = Math.max(3000 - elapsed, 0);
    window.setTimeout(() => setFading(true), waitForFirstShort + 520);
    window.setTimeout(finish, waitForFirstShort + 980);
  }

  return (
    <>
      <div style={{ visibility: done ? "visible" : "hidden" }}>{children}</div>
      {!done && (
        <button
          type="button"
          onPointerDown={handleEnter}
          className={`fixed inset-0 z-[100] block overflow-hidden bg-black text-left transition-opacity duration-700 ${
            fading ? "opacity-0" : "opacity-100"
          }`}
          aria-label="Enter Goa Social"
        >
          <audio
            ref={audioRef}
            src="data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjIwLjEwMAAAAAAAAAAAAAAA//tQwAADB8AhSmwhIID3wIakwIhAApAK/pM/O1c/mB5vf/vLwjZ3jV///N//iP//dP//8p//iP//9P//1p//i///9////+VRlAWQqihkKAOhpKKgABEEBEEBAKGgQCAgIAgIgg"
            preload="auto"
            muted
          />

          <img
            src={splashForest}
            alt=""
            width={1024}
            height={1536}
            className={`absolute inset-0 h-full w-full object-cover transition duration-[1600ms] ${
              bloomed ? "scale-110 brightness-125 saturate-125" : "scale-105 brightness-75 saturate-110"
            }`}
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_58%,transparent_0%,rgba(0,0,0,.18)_28%,rgba(0,0,0,.72)_78%)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />

          <div className="absolute inset-0 opacity-70 mix-blend-screen">
            {Array.from({ length: 42 }).map((_, i) => (
              <span
                key={i}
                className="absolute rounded-full bg-amber-200"
                style={{
                  left: `${(i * 23 + 11) % 100}%`,
                  top: `${(i * 37 + 7) % 100}%`,
                  width: `${2 + (i % 3)}px`,
                  height: `${2 + (i % 3)}px`,
                  boxShadow: "0 0 18px rgba(252, 211, 77, .95)",
                  animation: `gsFirefly ${5 + (i % 6)}s ease-in-out ${i * 0.17}s infinite`,
                }}
              />
            ))}
          </div>

          <div className="absolute inset-x-0 top-[9%] flex flex-col items-center px-8 text-center text-white">
            <div className="h-20 w-20 overflow-hidden rounded-[1.35rem] border border-white/40 bg-white/90 shadow-2xl shadow-black/40">
              <img src="/logo.png" alt="Goa Social" className="h-full w-full object-cover" />
            </div>
            <h1 className="mt-5 text-4xl font-extrabold tracking-tight drop-shadow-2xl">Goa Social</h1>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.45em] text-emerald-100/90">Susegad Network</p>
          </div>

          <div className="absolute left-1/2 top-[58%] -translate-x-1/2 -translate-y-1/2">
            <div className={`relative h-40 w-40 ${bloomed ? "animate-none" : "gs-breathe"}`}>
              <span className="absolute inset-0 rounded-full border border-emerald-100/20 bg-emerald-300/10 shadow-[0_0_70px_rgba(134,239,172,.45)] backdrop-blur-[2px]" />
              <span className="absolute inset-5 rounded-full border border-amber-200/40" />
              <span className="absolute inset-10 rounded-full bg-black/35 backdrop-blur-md" />
              <span className="absolute inset-[3.45rem] rounded-full bg-amber-200 shadow-[0_0_36px_rgba(253,224,71,.9)]" />
              {Array.from({ length: 18 }).map((_, i) => (
                <span
                  key={i}
                  className="absolute left-1/2 top-1/2 h-1.5 w-16 origin-left rounded-full bg-gradient-to-r from-emerald-100/90 to-transparent"
                  style={{
                    transform: `rotate(${i * 20}deg) translateX(${bloomed ? 34 : 18}px) scaleX(${bloomed ? 1.6 : 1})`,
                    opacity: bloomed ? 0 : 0.58,
                    transition: "transform 800ms cubic-bezier(.2,.9,.18,1), opacity 700ms ease",
                  }}
                />
              ))}
              {bloomed &&
                Array.from({ length: 28 }).map((_, i) => (
                  <span
                    key={i}
                    className="absolute left-1/2 top-1/2 h-2 w-10 origin-left rounded-full bg-gradient-to-r from-amber-100 to-emerald-200/0"
                    style={{
                      transform: `rotate(${(i * 360) / 28}deg) translateX(${44 + (i % 5) * 8}px)`,
                      animation: "gsBloom 900ms ease-out forwards",
                    }}
                  />
                ))}
            </div>
            <p className="mt-5 text-center text-xs font-bold uppercase tracking-[0.34em] text-white drop-shadow-2xl">
              {bloomed ? "Opening" : "Tap to enter"}
            </p>
          </div>

          <div className="absolute inset-x-8 bottom-[9%] flex items-center justify-between border-t border-white/20 pt-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-50/80">
            <span>North</span>
            <span>Stories</span>
            <span>South</span>
          </div>

          <style>{`
            @keyframes gsFirefly {
              0%, 100% { transform: translate3d(0,0,0); opacity: .25; }
              40% { transform: translate3d(18px,-26px,0); opacity: .95; }
              70% { transform: translate3d(-12px,-44px,0); opacity: .45; }
            }
            @keyframes gsBloom {
              from { opacity: 1; filter: blur(0); }
              to { opacity: 0; filter: blur(4px); }
            }
            .gs-breathe { animation: gsBreath 2.1s ease-in-out infinite; }
            @keyframes gsBreath {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.06); }
            }
            @media (prefers-reduced-motion: reduce) {
              .gs-breathe, .fixed span { animation: none !important; }
            }
          `}</style>
        </button>
      )}
    </>
  );
}