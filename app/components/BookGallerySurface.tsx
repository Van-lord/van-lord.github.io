"use client";

import { useEffect, useRef, useState, type CSSProperties, type TransitionEvent } from "react";
import { createPortal } from "react-dom";
import { GalleryIndex } from "../../static-gallery/GalleryApp";
import type { GalleryPagePlacement } from "./DeskScene";
import "../../public/gallery-page.css";
import "../../public/book-gallery.css";

export type BookGalleryPhase = "hidden" | "preparing" | "page" | "expanding" | "active";

type BookGallerySurfaceProps = {
  placement: GalleryPagePlacement | null;
  phase: BookGalleryPhase;
  layout?: "portrait" | "wide";
  onExpanded: () => void;
};

const fullViewportMatrix = "matrix(1, 0, 0, 1, 0, 0)";
const pageMatrix = ({ a, b, c, d, e, f }: GalleryPagePlacement) => `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`;

// A portrait page keeps one CSS pixel's horizontal and vertical scale equal.
// The physical page can gain a little margin when Safari changes its toolbar
// height; the archive itself is never flattened to fill a landscape rectangle.
function fitPortraitPage(placement: GalleryPagePlacement, width: number, height: number): GalleryPagePlacement {
  const horizontal = Math.hypot(placement.a, placement.b);
  const vertical = Math.hypot(placement.c, placement.d);
  if (!horizontal || !vertical) return placement;
  const scale = Math.min(horizontal, vertical);
  const a = placement.a / horizontal * scale;
  const b = placement.b / horizontal * scale;
  const c = placement.c / vertical * scale;
  const d = placement.d / vertical * scale;
  return {
    a, b, c, d,
    e: placement.e + ((placement.a - a) * width + (placement.c - c) * height) / 2,
    f: placement.f + ((placement.b - b) * width + (placement.d - d) * height) / 2,
  };
}

/** The last physical album page and the usable archive are one DOM surface. */
export function BookGallerySurface({ placement, phase, layout = "wide", onExpanded }: BookGallerySurfaceProps) {
  const [mounted, setMounted] = useState(false);
  const [expandedTarget, setExpandedTarget] = useState(false);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const surface = useRef<HTMLElement>(null);
  const lastPlacement = useRef<GalleryPagePlacement | null>(null);
  const phaseRef = useRef(phase);
  const expandedCallback = useRef(onExpanded);
  const completed = useRef(false);

  phaseRef.current = phase;
  if (phase === "page" && placement) lastPlacement.current = placement;

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const width = window.innerWidth;
      const height = window.innerHeight;
      setViewport((current) => current.width === width && current.height === height ? current : { width, height });
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(measure); };
    measure();
    setMounted(true);
    window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
    };
  }, []);
  useEffect(() => { expandedCallback.current = onExpanded; }, [onExpanded]);

  function finishExpansion() {
    if (phaseRef.current !== "expanding" || completed.current) return;
    completed.current = true;
    expandedCallback.current();
  }

  useEffect(() => {
    if (phase === "hidden") {
      lastPlacement.current = null;
      surface.current?.scrollTo({ top: 0, left: 0 });
    }
    if (phase !== "expanding") {
      setExpandedTarget(false);
      completed.current = false;
      return;
    }

    completed.current = false;
    setExpandedTarget(false);
    let secondFrame = 0;
    let finishTimer = 0;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Commit the physical-page transform before choosing the fullscreen
    // destination, including when WebGL falls back or motion is reduced.
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        if (phaseRef.current !== "expanding") return;
        setExpandedTarget(true);
        finishTimer = window.setTimeout(finishExpansion, motion.matches ? 0 : 1150);
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      window.clearTimeout(finishTimer);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "active") return;
    const frame = window.requestAnimationFrame(() => {
      const heading = surface.current?.querySelector<HTMLElement>("#gallery-index-title");
      if (!heading) return;
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [phase]);

  if (!mounted || phase === "hidden") return null;

  const width = viewport.width || window.innerWidth;
  const height = viewport.height || window.innerHeight;
  const fallback = layout === "portrait"
    ? { a: .78, b: 0, c: 0, d: .78, e: width * .11, f: height * .12 }
    : { a: .42, b: 0, c: 0, d: .32, e: width * .5, f: height * .4 };
  const rawSource = placement ?? lastPlacement.current ?? fallback;
  const source = layout === "portrait" ? fitPortraitPage(rawSource, width, height) : rawSource;
  const fillsViewport = phase === "active" || (phase === "expanding" && expandedTarget);
  const visible = phase === "active" || phase === "expanding" || (phase === "page" && Boolean(placement));
  const style: CSSProperties = {
    width,
    height,
    transform: fillsViewport ? fullViewportMatrix : pageMatrix(source),
  };
  const transitionEnded = (event: TransitionEvent<HTMLElement>) => {
    if (event.target === event.currentTarget && event.propertyName === "transform") finishExpansion();
  };

  // Preparing the archive decodes its cover photographs before the final
  // paper leaf reveals it. Its controls stay inert until expansion ends.
  return createPortal(<section
    ref={surface}
    className="book-gallery-surface"
    style={style}
    data-phase={phase}
    data-layout={layout}
    data-visible={visible}
    data-expanding={phase === "expanding" && expandedTarget}
    aria-label="Photography gallery"
    aria-hidden={phase !== "active"}
    inert={phase !== "active"}
    onTransitionEnd={transitionEnded}
  ><GalleryIndex /></section>, document.body);
}
