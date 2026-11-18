import { useEffect, useRef, useState } from "react";

/** True on phone-width screens (under 640 px). False during server rendering and the first client render. */
export function useIsNarrow(maxWidth = 640): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth - 0.02}px)`);
    const update = () => {
      setNarrow(mq.matches);
    };
    update();
    mq.addEventListener("change", update);
    return () => {
      mq.removeEventListener("change", update);
    };
  }, [maxWidth]);
  return narrow;
}

/** Width of an element in CSS pixels, kept current with a ResizeObserver. */
export function useContainerWidth<T extends HTMLElement>(fallback = 760) {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.round(w));
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, []);
  return { ref, width };
}
