"use client";

import { useState } from "react";
import type { RoomView } from "@/lib/types";
import { Clues, RoleBanner } from "./Bits";

export function Briefing({ room, secondsLeft }: { room: RoomView; secondsLeft: number | null }) {
  const [flipped, setFlipped] = useState(false);
  const card = room.you?.card;

  return (
    <div className="k-screen">
      <div className="flex items-baseline justify-between">
        <div className="k-serif text-[24px] truncate pr-3">{room.case?.title ?? "Your case"}</div>
        <div className="k-mono text-[20px] text-[var(--k-yellow)]">{secondsLeft ?? ""}</div>
      </div>
      <div className="k-flip flex-1 min-h-0" data-flipped={flipped}>
        <div className="k-flip-inner">
          <button
            type="button"
            className="k-face k-cardback flex flex-col items-center justify-center gap-4 p-6 text-center"
            onClick={() => setFlipped(true)}
            aria-hidden={flipped}
            tabIndex={flipped ? -1 : 0}
          >
            <span className="k-serif text-[120px] text-[var(--k-yellow)]">?</span>
            <span className="k-serif text-[36px]">Tap to see your role.</span>
            <span className="k-mono text-[16px] text-[var(--k-yellow)]">Don&apos;t show anyone.</span>
          </button>
          <div className="k-face k-face-back flex flex-col gap-3 bg-[var(--k-bg)]" aria-hidden={!flipped}>
            {card ? (
              <>
                <RoleBanner card={card} />
                {room.case?.crime && <p className="text-[14px] text-[var(--k-muted)] leading-snug">{room.case.crime}</p>}
                <Clues card={card} />
                <div className="flex-1" />
                <button type="button" className="k-btn k-btn-ghost" onClick={() => setFlipped(false)} tabIndex={flipped ? 0 : -1}>
                  Hide card
                </button>
              </>
            ) : (
              <p className="m-auto text-center text-[var(--k-muted)]">You are watching this round.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
