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
  onExpanded: () => void;
};

const fullViewportMatrix = "matrix(1, 0, 0, 1, 0, 0)";
const pageMatrix = ({ a, b, c, d, e, f }: GalleryPagePlacement) => `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`;

/** The last physical album page and the usable archive are one DOM surface. */
export function BookGallerySurface({ placement, phase, onExpanded }: BookGallerySurfaceProps) {
  const [mounted, setMounted] = useState(false);
  const [expandedTarget, setExpandedTarget] = useState(false);
  const surface = useRef<HTMLElement>(null);
  const lastPlacement = useRef<GalleryPagePlacement | null>(null);
  const phaseRef = useRef(phase);
  const expandedCallback = useRef(onExpanded);
  const completed = useRef(false);

  phaseRef.current = phase;
  if (phase === "page" && placement) lastPlacement.current = placement;

  useEffect(() => { setMounted(true); }, []);
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

  const source = placement ?? lastPlacement.current ?? {
    a: .42, b: 0, c: 0, d: .32,
    e: window.innerWidth * .5, f: window.innerHeight * .4,
  };
  const fillsViewport = phase === "active" || (phase === "expanding" && expandedTarget);
  const visible = phase === "active" || phase === "expanding" || (phase === "page" && Boolean(placement));
  const style: CSSProperties = { transform: fillsViewport ? fullViewportMatrix : pageMatrix(source) };
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
    data-visible={visible}
    data-expanding={phase === "expanding" && expandedTarget}
    aria-label="Photography gallery"
    aria-hidden={phase !== "active"}
    inert={phase !== "active"}
    onTransitionEnd={transitionEnded}
  ><GalleryIndex /></section>, document.body);
}
