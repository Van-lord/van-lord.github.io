"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FluidAlbumCanvas } from "./FluidAlbumCanvas";

type Phase = "waiting" | "visible" | "leaving";
type IntroRenderer = "loading" | "fluid" | "fallback";

export function AlbumIntro({ title, firstPhotoUrl }: { title: string; firstPhotoUrl?: string }) {
  const [phase, setPhase] = useState<Phase>("waiting");
  const [mounted, setMounted] = useState(true);
  const [renderer, setRenderer] = useState<IntroRenderer>("loading");
  const [allowFluid, setAllowFluid] = useState(false);
  const timers = useRef<number[]>([]);
  const compactMobile = useRef(false);

  function clearTimers() {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  }

  function leave() {
    clearTimers();
    setPhase("leaving");
    timers.current.push(window.setTimeout(() => setMounted(false), compactMobile.current ? 700 : 1050));
  }

  const handleFluidReady = useCallback(() => setRenderer("fluid"), []);
  const handleFluidUnavailable = useCallback(() => setRenderer("fallback"), []);

  useEffect(() => {
    document.documentElement.classList.add("album-intro-active");
    document.body.classList.add("album-intro-active");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    compactMobile.current = window.matchMedia("(max-width: 700px) and (orientation: portrait)").matches;
    if (reducedMotion || compactMobile.current) {
      setRenderer("fallback");
    } else {
      setAllowFluid(true);
    }
    const revealDelay = reducedMotion ? 20 : compactMobile.current ? 40 : 180;
    const leaveDelay = reducedMotion ? 350 : compactMobile.current ? 1700 : 6100;
    const unmountDelay = reducedMotion ? 500 : compactMobile.current ? 2400 : 7150;
    timers.current.push(window.setTimeout(() => setPhase("visible"), revealDelay));
    timers.current.push(window.setTimeout(() => setPhase("leaving"), leaveDelay));
    timers.current.push(window.setTimeout(() => setMounted(false), unmountDelay));

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") leave();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      clearTimers();
      window.removeEventListener("keydown", onKeyDown);
      document.documentElement.classList.remove("album-intro-active");
      document.body.classList.remove("album-intro-active");
    };
  }, []);

  useEffect(() => {
    if (!mounted) {
      document.documentElement.classList.remove("album-intro-active");
      document.body.classList.remove("album-intro-active");
    }
  }, [mounted]);

  if (!mounted) return null;
  return (
    <button
      type="button"
      className={`album-cinematic-intro is-${phase}${renderer === "fluid" ? " has-fluid" : ""}${renderer === "fallback" ? " has-fallback" : ""}`}
      onClick={leave}
      aria-label={`Enter ${title} photo story`}
    >
      {allowFluid ? (
        <FluidAlbumCanvas
          title={title}
          firstPhotoUrl={firstPhotoUrl}
          onReady={handleFluidReady}
          onUnavailable={handleFluidUnavailable}
        />
      ) : null}
      <span className="album-intro-center" aria-hidden={renderer === "fluid"}>
        <strong>{title}</strong>
      </span>
    </button>
  );
}
