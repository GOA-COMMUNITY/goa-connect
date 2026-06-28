import { useEffect, useState } from "react";

/**
 * Branded splash with palm wave animation. Auto-dismisses after `duration`
 * ms. Renders children underneath so they can warm up (preload first short)
 * while the splash is visible.
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

  useEffect(() => {
    // Skip splash on subsequent navigations in the same tab
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

  return (
    <>
      {/* Children mount underneath so the first short preloads during splash */}
      <div style={{ visibility: done ? "visible" : "hidden" }}>{children}</div>
      {!done && (
        <div
          className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-br from-primary via-primary/90 to-blue-600 text-primary-foreground transition-opacity duration-500 ${
            fading ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="relative">
            <div className="absolute -inset-12 animate-ping rounded-full bg-white/20" />
            <div className="absolute -inset-6 animate-pulse rounded-full bg-white/30" />
            <div className="relative flex h-32 w-32 items-center justify-center rounded-3xl bg-white text-7xl shadow-2xl animate-bounce">
              🌴
            </div>
          </div>
          <h1 className="mt-10 text-5xl font-extrabold tracking-tight animate-fade-in">
            Goa Social
          </h1>
          <p className="mt-3 text-base font-medium opacity-90 animate-fade-in">
            Susegad. Always.
          </p>
          <div className="mt-10 flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-2 w-2 rounded-full bg-white animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
