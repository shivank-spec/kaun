"use client";

import { useEffect, useState } from "react";
import type { RoomView } from "@/lib/types";

const LINES = [
  "Dusting for fingerprints...",
  "Bribing a witness with chai...",
  "Planting a red herring...",
  "Choosing who among you did it...",
  "Rehearsing alibis...",
  "Hiding the evidence badly...",
];

export function Generating({ room }: { room: RoomView }) {
  const [i, setI] = useState(0);
  // Cosmetic rotation only. The server decides when this phase ends.
  useEffect(() => {
    const id = setInterval(() => setI((n) => n + 1), 2200);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="k-screen items-center justify-center text-center">
      <div className="k-label">{room.settings.setting}</div>
      <h1 className="k-serif text-[52px] k-pulse">Opening case file...</h1>
      <p key={i} className="k-mono k-fade text-[16px] text-[var(--k-yellow)] min-h-[48px]">
        {LINES[i % LINES.length]}
      </p>
    </div>
  );
}
