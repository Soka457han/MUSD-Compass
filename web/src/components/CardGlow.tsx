"use client";

import { useEffect } from "react";

/** Moves the light spot of any `.glow` card to the pointer: one listener for the whole page, at most one update per frame, mouse only. */
export function CardGlow() {
  useEffect(() => {
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let frame = 0;
    let last: PointerEvent;
    const paint = () => {
      frame = 0;
      const card = (last.target as Element).closest?.<HTMLElement>(".glow");
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--gx", `${last.clientX - r.left}px`);
      card.style.setProperty("--gy", `${last.clientY - r.top}px`);
    };
    const move = (e: PointerEvent) => {
      last = e;
      frame ||= requestAnimationFrame(paint);
    };
    document.addEventListener("pointermove", move, { passive: true });
    return () => {
      document.removeEventListener("pointermove", move);
      cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
