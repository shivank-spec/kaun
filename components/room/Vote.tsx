"use client";

import { useState } from "react";
import type { RoomView } from "@/lib/types";
import type { RoomActions } from "./api";
import { ErrorLine } from "./Bits";

export function Vote({ room, secondsLeft, actions }: { room: RoomView; secondsLeft: number | null; actions: RoomActions }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const meId = room.you?.id;
  const me = room.players.find((p) => p.id === meId);
  const others = room.players.filter((p) => p.id !== meId);
  const locked = !!picked || !!me?.hasVoted;
  const canVote = !!room.you?.card || !!me; // spectators without a seat cannot vote

  async function vote(id: string) {
    if (locked) return;
    setPicked(id);
    setErr(null);
    try {
      await actions.vote(id);
    } catch (e) {
      setPicked(null);
      setErr(e instanceof Error ? e.message : "Vote failed. Tap again.");
    }
  }

  return (
    <div className="k-screen">
      <div className="flex items-baseline justify-between">
        <h1 className="k-serif text-[52px]">Who did it?</h1>
        <div className="k-mono text-[32px] text-[var(--k-yellow)]" role="timer">
          {secondsLeft ?? ""}
        </div>
      </div>

      <div className={`grid flex-1 min-h-0 gap-3 auto-rows-fr ${others.length > 4 ? "grid-cols-2" : "grid-cols-1"}`}>
        {others.map((p) => {
          const mine = picked === p.id;
          return (
            <button
              key={p.id}
              type="button"
              disabled={!canVote || (locked && !mine)}
              aria-pressed={mine}
              onClick={() => vote(p.id)}
              className={`min-h-[56px] rounded-lg px-2 k-serif break-words transition-opacity ${
                others.length > 4 ? "text-[30px]" : "text-[44px]"
              } ${mine ? "bg-[var(--k-yellow)] text-[var(--k-ink)]" : "k-paper"} ${locked && !mine ? "opacity-30" : ""}`}
            >
              {p.name}
              {mine && <span className="block font-sans text-[12px] font-bold tracking-widest">LOCKED</span>}
            </button>
          );
        })}
      </div>

      <ErrorLine>{err}</ErrorLine>
      <div>
        <div className="k-label mb-1 text-center">{locked ? "Vote locked. Waiting for the rest." : "One tap locks your vote."}</div>
        <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[14px]">
          {room.players.map((p) => {
            const voted = p.hasVoted || (p.id === meId && locked);
            return (
              <li key={p.id} className={voted ? "text-[var(--k-yellow)]" : "text-[var(--k-muted)]"}>
                {voted ? "✓" : "…"} {p.name}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
