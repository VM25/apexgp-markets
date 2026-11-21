"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { store } from "./store";

/** Subscribe to the app store. The returned object is the live store; components re-render on every change. */
export function useApp() {
  useSyncExternalStore(store.subscribe, store.getVersion, store.getServerVersion);
  return store;
}

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Measured width of an element, for responsive SVG charts. */
export function useWidth<T extends HTMLElement>(fallback = 320): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(fallback);
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(Math.max(120, Math.floor(el.getBoundingClientRect().width)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatch(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return match;
}

/** Fetch a static JSON resource with loading / error state. */
export function useData<T>(loader: () => Promise<T>, key: string): { data: T | null; error: string | null; reload: () => void } {
  const [state, setState] = useState<{ data: T | null; error: string | null }>({ data: null, error: null });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let alive = true;
    loader()
      .then((data) => alive && setState({ data, error: null }))
      .catch((err: unknown) => alive && setState({ data: null, error: err instanceof Error ? err.message : "Could not load data." }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce]);
  return { ...state, reload: () => setNonce((n) => n + 1) };
}
