"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomView } from "@/lib/types";
import type { RoomActions } from "./api";
import { ErrorLine } from "./Bits";

type AudioState = "idle" | "loading" | "playing" | "error";

/** Narration: fetches the mp3 once, tries autoplay once, always keeps a button. */
function useNarration(text: string, tone: string, enabled: boolean) {
  const [state, setState] = useState<AudioState>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loadRef = useRef<Promise<HTMLAudioElement> | null>(null);

  const load = useCallback(() => {
    if (!loadRef.current) {
      loadRef.current = (async () => {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, tone }),
        });
        if (!res.ok) throw new Error("tts failed");
        const blob = await res.blob();
        if (!blob.size) throw new Error("empty audio");
        const audio = new Audio(URL.createObjectURL(blob));
        audio.onended = () => setState("idle");
        audio.onpause = () => setState("idle");
        audioRef.current = audio;
        return audio;
      })();
      loadRef.current.catch(() => {
        loadRef.current = null; // allow a retry on the next tap
      });
    }
    return loadRef.current;
  }, [text, tone]);

  const play = useCallback(async () => {
    setState("loading");
    try {
      const audio = await load();
      audio.currentTime = 0;
      await audio.play();
      setState("playing");
    } catch (e) {
      const blocked = e instanceof DOMException && e.name === "NotAllowedError";
      setState(blocked ? "idle" : "error");
    }
  }, [load]);

  const stop = useCallback(() => audioRef.current?.pause(), []);

  useEffect(() => {
    if (!enabled) return;
    // One autoplay attempt. Mobile Safari will reject it, which is expected: the
    // button stays, and the mp3 is already warm so the tap plays instantly.
    load()
      .then((audio) => audio.play())
      .then(() => setState("playing"))
      .catch(() => {});
    return () => {
      audioRef.current?.pause();
    };
  }, [enabled, load]);

  return { state, play, stop };
}

export function Reveal({ room, actions, mock }: { room: RoomView; actions: RoomActions; mock: boolean }) {
  const reveal = room.reveal;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const narration = useNarration(reveal?.story ?? "", room.settings.tone, !!reveal && !mock);

  if (!reveal) return <div className="k-screen items-center justify-center k-pulse">Sealing the verdict...</div>;

  async function again() {
    setBusy(true);
    setErr(null);
    try {
      await actions.again();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not restart");
    }
    setBusy(false);
  }

  const label = { idle: "▶ Play the verdict", loading: "Loading voice...", playing: "■ Stop", error: "Voice unavailable. Tap to retry" }[
    narration.state
  ];

  return (
    <div className="k-screen k-scroll">
      <div className="text-center pt-2">
        <div className={`k-stamp k-serif text-[40px] ${reveal.caught ? "text-[var(--k-yellow)]" : "text-[var(--k-crimson)]"}`}>
          {reveal.caught ? "CASE CLOSED" : "CULPRIT ESCAPED"}
        </div>
      </div>

      <div className="text-center">
        <div className="k-label">The culprit was</div>
        <div className="k-serif text-[72px] text-[var(--k-crimson)] break-words">{reveal.culpritName}</div>
        <div className="text-[14px] text-[var(--k-muted)]">
          {reveal.accusedName ? `The room accused ${reveal.accusedName}.` : "Nobody was accused."}
        </div>
      </div>

      <p className="k-paper p-4 text-[16px] leading-snug">{reveal.story}</p>

      <button
        type="button"
        className="k-btn shrink-0"
        disabled={narration.state === "loading"}
        onClick={() => (narration.state === "playing" ? narration.stop() : narration.play())}
      >
        {label}
      </button>

      <p className="k-serif text-[24px] leading-tight text-center text-[var(--k-yellow)]">&ldquo;{reveal.roast}&rdquo;</p>

      <div>
        <div className="k-label mb-1">Who voted for whom</div>
        <ul className="k-mono text-[14px] grid grid-cols-1 gap-1">
          {reveal.votes.length === 0 && <li className="text-[var(--k-muted)]">No votes were cast.</li>}
          {reveal.votes.map((v) => (
            <li key={v.voterId} className="flex justify-between gap-2 border-b border-[var(--k-line)] py-1">
              <span>{v.voterName}</span>
              <span className={v.targetId === reveal.culpritId ? "text-[var(--k-yellow)]" : "text-[var(--k-muted)]"}>
                → {v.targetName} {v.targetId === reveal.culpritId ? "✓" : "✗"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {room.you?.isHost ? (
        <button type="button" className="k-btn k-btn-ghost shrink-0" disabled={busy} onClick={again}>
          {busy ? "Resetting..." : "Play again (same room)"}
        </button>
      ) : (
        <p className="text-center text-[14px] text-[var(--k-muted)] py-2">Waiting for the host to play again...</p>
      )}
      <ErrorLine>{err}</ErrorLine>
    </div>
  );
}
