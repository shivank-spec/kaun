"use client";

import type { PlayerCard } from "@/lib/types";

export function formatClock(s: number | null) {
  if (s == null) return "--:--";
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Giant role banner. Teal for innocent, crimson for culprit. */
export function RoleBanner({ card, compact = false }: { card: PlayerCard; compact?: boolean }) {
  const [head, ...rest] = card.mission.split(/(?<=[.!?])\s+/);
  const tail = rest.join(" ");
  return (
    <div
      data-role={card.role}
      className={`${card.role === "culprit" ? "k-crimson" : "k-teal"} rounded-md text-center ${compact ? "px-3 py-2" : "px-4 py-5"}`}
    >
      <div className={`k-serif ${compact ? "text-[26px]" : "text-[44px]"}`}>{head}</div>
      {tail && <div className={`${compact ? "text-[13px]" : "text-[16px] mt-2"} font-medium opacity-95`}>{tail}</div>}
    </div>
  );
}

export function Clues({ card, compact = false }: { card: PlayerCard; compact?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      {card.clues.slice(0, 2).map((c, i) => (
        <div key={i} className={`k-paper k-mono ${compact ? "p-3 text-[14px]" : "p-4 text-[16px]"} leading-snug`}>
          <span className="opacity-60">CLUE {i + 1} / </span>
          {c}
        </div>
      ))}
      {card.role === "culprit" && card.objective && (
        <div className={`rounded-md border-2 border-[var(--k-crimson)] ${compact ? "p-3 text-[14px]" : "p-4 text-[16px]"} leading-snug`}>
          <div className="k-label !text-[var(--k-crimson)] mb-1">Your objective</div>
          {card.objective}
        </div>
      )}
    </div>
  );
}

export function ErrorLine({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-center text-[14px] text-[var(--k-yellow)]">
      {children}
    </p>
  );
}
