"use client";

import { useEffect, useState } from "react";

/* Shared building blocks for every screen. Purely visual: no data fetching. */

export const RING = ["#F5A524", "#A78BFA", "#5FB4FF", "#B6F36A", "#FF7A9C", "#5FDDF7", "#FFD166", "#7EE6B8"];
export const ringOf = (i: number) => RING[i % RING.length];
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";
export const fmt = (s: number) =>
  `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, "0")}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

export function TopBar({
  onBack,
  right,
}: {
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <header className="flex h-11 shrink-0 items-center justify-between">
      <div className="flex w-11 justify-start">
        {onBack && (
          <button
            type="button"
            aria-label="Back"
            onClick={onBack}
            className="tap -ml-2 flex h-11 w-11 items-center justify-center border-0 bg-transparent text-snow"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
        )}
      </div>
      <span className="display text-[19px] tracking-[0.06em]">ALIBI</span>
      <div className="flex w-11 justify-end">{right}</div>
    </header>
  );
}

export function Avatar({
  name,
  index,
  size = 44,
  dim = false,
}: {
  name: string;
  index: number;
  size?: number;
  dim?: boolean;
}) {
  const c = ringOf(index);
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full font-bold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        color: "#F4F6FA",
        background: "radial-gradient(circle at 35% 30%, #23324f, #0c1323)",
        boxShadow: `inset 0 0 0 2px ${c}, 0 0 ${dim ? 0 : 14}px ${c}55`,
        opacity: dim ? 0.55 : 1,
      }}
    >
      {initials(name)}
    </span>
  );
}

/** Big mono countdown with a draining bar under it. */
export function Timer({
  seconds,
  total,
  label,
  sub,
}: {
  seconds: number;
  total: number;
  label?: string;
  sub?: string;
}) {
  const pct = Math.max(0, Math.min(100, (seconds / Math.max(1, total)) * 100));
  const urgent = seconds <= 20;
  return (
    <div className="shrink-0">
      <div className="flex items-end justify-between gap-3">
        <span
          className={`mono text-[clamp(34px,10.5vw,44px)] font-medium leading-none ${urgent ? "urgent" : ""}`}
          aria-live="off"
        >
          {fmt(seconds)}
        </span>
        <span className="pb-1 text-right">
          {label && <span className="label block text-snow">{label}</span>}
          {sub && <span className="label block">{sub}</span>}
        </span>
      </div>
      <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-[width] duration-300 ease-linear"
          style={{ width: `${pct}%`, background: urgent ? "#F0385A" : "#F4F6FA" }}
        />
      </div>
    </div>
  );
}

export function Meter({ value, color = "#5FDDF7" }: { value: number; color?: string }) {
  return (
    <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }}
      />
    </div>
  );
}

export function Pips({ total, used }: { total: number; used: number }) {
  return (
    <span className="flex gap-1.5" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className="h-3 w-3 rounded-full transition-all duration-300"
          style={
            i < total - used
              ? { background: "#5FDDF7", boxShadow: "0 0 8px rgba(95,221,247,.7)" }
              : { boxShadow: "inset 0 0 0 1.5px rgba(174,182,200,.5)" }
          }
        />
      ))}
    </span>
  );
}

const LINES = [
  "Opening the case file",
  "Dusting for fingerprints",
  "Waking up the suspects",
  "Checking alibis",
  "Pulling the CCTV",
];

export function Loading({ title }: { title?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % LINES.length), 1500);
    return () => clearInterval(t);
  }, []);
  return (
    <main className="screen cold items-center justify-center text-center">
      <div className="relative h-40 w-40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/art/scanner.png" alt="" className="h-40 w-40 opacity-90" />
        <span className="absolute inset-3 overflow-hidden rounded-full">
          <span
            className="absolute inset-x-0 h-1/3"
            style={{
              background: "linear-gradient(180deg, transparent, rgba(95,221,247,.55), transparent)",
              animation: "sweep 1.8s linear infinite",
            }}
          />
        </span>
      </div>
      <p className="eyebrow mt-8">{title ?? "New case"}</p>
      <p key={i} className="rise display mt-2 text-[26px]">
        {LINES[i]}
      </p>
    </main>
  );
}

/* ---------- XP: a small local progression so every round feels like it counted ---------- */

const RANKS = ["Rookie", "Constable", "Analyst", "Inspector", "Detective", "Chief"];
const PER_LEVEL = 600;

export function readXp() {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem("kaun.xp") || 0) || 0;
}
export function addXp(n: number) {
  const next = readXp() + Math.max(0, Math.round(n));
  localStorage.setItem("kaun.xp", String(next));
  return next;
}
export function levelOf(xp: number) {
  const level = Math.floor(xp / PER_LEVEL) + 1;
  return {
    level,
    rank: RANKS[Math.min(RANKS.length - 1, level - 1)],
    into: xp % PER_LEVEL,
    need: PER_LEVEL,
  };
}

export function XpCard({ gained, total, note }: { gained: number; total: number; note?: string }) {
  const lv = levelOf(total);
  return (
    <div className="panel p-3.5">
      <div className="flex items-baseline justify-between">
        <span className="mono text-[15px] font-medium text-snow">+{gained} XP</span>
        {note && <span className="label">{note}</span>}
      </div>
      <div className="mt-2">
        <Meter value={(lv.into / lv.need) * 100} />
      </div>
      <p className="label mt-2">
        LVL {String(lv.level).padStart(2, "0")} · {lv.rank} · {lv.into} / {lv.need} XP
      </p>
    </div>
  );
}

/* ---------- tiny sound effects (Web Audio, no files) ---------- */

let ctx: AudioContext | null = null;
export function unlockSfx() {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  } catch {}
}
function tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0) {
  try {
    if (!ctx || ctx.state !== "running") return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.03);
  } catch {}
}
export const sfx = {
  tap: () => tone(660, 0.06, "triangle", 0.08),
  clue: () => {
    tone(880, 0.12, "sine", 0.12);
    tone(1320, 0.18, "sine", 0.1, 0.09);
  },
  crack: () => {
    tone(196, 0.25, "sawtooth", 0.12);
    tone(147, 0.4, "sawtooth", 0.1, 0.12);
  },
  deny: () => tone(160, 0.14, "square", 0.07),
  tick: (urgent = false) => tone(urgent ? 1500 : 1050, 0.05, "square", 0.07),
  sting: () => {
    tone(55, 1.4, "sawtooth", 0.22);
    [466.16, 369.99, 311.13].forEach((f, i) => tone(f, 1.0, "sawtooth", 0.08, 0.05 + i * 0.16));
  },
  win: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.3, "triangle", 0.1, i * 0.1)),
};
