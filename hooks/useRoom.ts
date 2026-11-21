"use client";

import { useCallback, useEffect, useState } from "react";
import type { RoomView } from "@/lib/types";

const POLL_MS = 1500;
const TICK_MS = 250;
const REQUEST_TIMEOUT_MS = 6000;

interface Options {
  /** When set, no network: this RoomView is returned as-is (mock mode). */
  mock?: RoomView | null;
}

/**
 * Polls the room every 1500 ms. The server owns the clock: secondsLeft is
 * phaseEndsAt - serverNow, displayed with a local 250 ms tick and re-synced
 * on every poll. On a failed poll the last good room is kept and `error` is set.
 */
export function useRoom(code: string | null, playerId: string | null, opts: Options = {}) {
  const mock = opts.mock ?? null;
  const [polled, setPolled] = useState<RoomView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [offsetMs, setOffsetMs] = useState(0); // serverNow - Date.now()
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (mock || !code || !playerId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ctrl: AbortController | undefined;

    const poll = async () => {
      ctrl = new AbortController();
      const kill = setTimeout(() => ctrl?.abort(), REQUEST_TIMEOUT_MS);
      const t0 = Date.now();
      try {
        const res = await fetch(
          `/api/room/${encodeURIComponent(code)}?playerId=${encodeURIComponent(playerId)}`,
          { cache: "no-store", signal: ctrl.signal },
        );
        const t1 = Date.now();
        const data = await res.json().catch(() => null);
        if (stopped) return;
        if (!res.ok || !data || typeof data.status !== "string") {
          setError((data && data.error) || `Server error (${res.status})`);
          setErrorStatus(res.status);
          return;
        }
        const serverMs = Date.parse(data.serverNow);
        // Assume the server stamped serverNow halfway through the round trip.
        if (!Number.isNaN(serverMs)) setOffsetMs(serverMs - (t0 + t1) / 2);
        setPolled(data as RoomView);
        setError(null);
        setErrorStatus(null);
        setNowMs(Date.now());
      } catch {
        if (stopped) return;
        setError("Network problem");
        setErrorStatus(null);
      } finally {
        clearTimeout(kill);
        if (!stopped) timer = setTimeout(poll, POLL_MS);
      }
    };

    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
      ctrl?.abort();
    };
  }, [code, playerId, mock, nonce]);

  /** Poll right now (call after a POST so the UI doesn't wait 1.5 s). */
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  const room = mock ?? polled;
  const offset = mock ? 0 : offsetMs;
  let secondsLeft: number | null = null;
  if (room?.phaseEndsAt) {
    const end = Date.parse(room.phaseEndsAt);
    if (!Number.isNaN(end)) secondsLeft = Math.max(0, Math.ceil((end - (nowMs + offset)) / 1000));
  }

  return {
    room,
    error: mock ? null : error,
    errorStatus: mock ? null : errorStatus,
    secondsLeft,
    refresh,
  };
}
