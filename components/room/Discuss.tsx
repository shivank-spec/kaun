"use client";

import { useState } from "react";
import type { RoomView } from "@/lib/types";
import { Clues, RoleBanner, formatClock } from "./Bits";

export function Discuss({ room, secondsLeft }: { room: RoomView; secondsLeft: number | null }) {
  const [hidden, setHidden] = useState(false);
  const card = room.you?.card;
  const urgent = secondsLeft != null && secondsLeft <= 20;

  return (
    <div className="k-screen">
      <div className="text-center">
        <div
          className={`k-mono text-[96px] leading-none ${urgent ? "text-[var(--k-crimson)] k-pulse" : "text-[var(--k-yellow)]"}`}
          role="timer"
          aria-label={`${secondsLeft ?? 0} seconds left`}
        >
          {formatClock(secondsLeft)}
        </div>
        <p className="k-serif text-[26px] mt-1">Talk out loud. Accuse someone.</p>
      </div>

      <div className="relative flex-1 min-h-0">
        <div className={`flex flex-col gap-2 ${hidden ? "k-blur" : ""}`} aria-hidden={hidden}>
          {card ? (
            <>
              <RoleBanner card={card} compact />
              <Clues card={card} compact />
            </>
          ) : (
            <p className="text-center text-[var(--k-muted)] py-8">You are watching this round.</p>
          )}
        </div>
        {hidden && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="k-serif text-[32px]">Screen hidden</span>
          </div>
        )}
      </div>

      {card && (
        <button type="button" className="k-btn k-btn-ghost" aria-pressed={hidden} onClick={() => setHidden((h) => !h)}>
          {hidden ? "Show my screen" : "Hide my screen"}
        </button>
      )}
    </div>
  );
}
