"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

export interface Session {
  code: string;
  playerId: string;
  name: string;
}

const KEY = "kaun.session";
const EVT = "kaun:session";

// Fallback for browsers where localStorage throws (private mode, blocked storage).
let memory: string | null = null;

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVT, cb);
  };
}

function getSnapshot(): string | null {
  try {
    return window.localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
}

// undefined = "not hydrated yet" so callers can avoid flashing the Join form.
function getServerSnapshot(): string | null | undefined {
  return undefined;
}

function parse(raw: string | null | undefined): Session | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (v && typeof v.code === "string" && typeof v.playerId === "string") {
      return { code: v.code, playerId: v.playerId, name: typeof v.name === "string" ? v.name : "" };
    }
  } catch {}
  return null;
}

export function useSession() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const session = useMemo(() => parse(raw), [raw]);

  const save = useCallback((s: Session) => {
    memory = JSON.stringify(s);
    try {
      window.localStorage.setItem(KEY, memory);
    } catch {}
    window.dispatchEvent(new Event(EVT));
  }, []);

  const clear = useCallback(() => {
    memory = null;
    try {
      window.localStorage.removeItem(KEY);
    } catch {}
    window.dispatchEvent(new Event(EVT));
  }, []);

  return { session, ready: raw !== undefined, save, clear };
}
