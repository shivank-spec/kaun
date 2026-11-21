"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import ShareCard from "@/components/ShareCard";
import { HowTo, countRound } from "@/components/ui/HowTo";
import { Avatar, Meter, Timer, TopBar, addXp, firstSentence, levelOf, readXp, ringOf, sfx } from "@/components/ui/kit";
import { post } from "@/components/room/api";
import type { Difficulty, PlayerCard, RoomView, Tone } from "@/lib/types";

/* The multiplayer screens. Each one renders purely from the RoomView the
   server sends; the server owns the clock and moves the phases. */

export interface RoomActions {
  start: (setting: string, tone: Tone, difficulty: Difficulty) => Promise<void>;
  vote: (targetId: string) => Promise<void>;
  again: () => Promise<void>;
  doubt: (targetId: string | null) => Promise<void>;
  skip: () => Promise<void>;
  pause: () => Promise<void>;
  ask: (targetId: string, question: string) => Promise<{ reply?: string; delivered?: boolean }>;
  power: (power: PowerKind, opts?: { targetId?: string; evidenceId?: string }) => Promise<{ real?: boolean; clearedName?: string; extra?: number }>;
  home: () => void;
}

type Props = { room: RoomView; actions: RoomActions; secondsLeft: number | null };

type PowerKind = "plant" | "blackout" | "detector" | "clear" | "extra";
const indexOf = (room: RoomView, id: string) => Math.max(0, room.players.findIndex((p) => p.id === id));
const first = (name: string) => name.split(" ")[0];
/** First name, unless two players share it: then the full name, so nobody is confused. */
function label(room: RoomView, name: string) {
  const f = first(name).toLowerCase();
  return room.players.filter((p) => first(p.name).toLowerCase() === f).length > 1 ? name : first(name);
}

/* ---------------- join ---------------- */

export function Join({
  code,
  defaultName,
  note,
  onJoined,
  onHome,
}: {
  code: string;
  defaultName?: string;
  note?: string;
  onJoined: (playerId: string, name: string) => void;
  onHome: () => void;
}) {
  const [name, setName] = useState(defaultName ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!defaultName) setName(localStorage.getItem("kaun.name") || "");
  }, [defaultName]);

  async function join() {
    const clean = name.trim().slice(0, 16);
    if (!clean) return setError("Enter your name");
    setBusy(true);
    setError("");
    try {
      const r = await post<{ playerId: string }>(`/api/room/${code}/join`, { name: clean });
      localStorage.setItem("kaun.name", clean);
      onJoined(r.playerId, clean);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="screen cold">
      <TopBar onBack={onHome} />
      <div className="flex flex-1 flex-col justify-center gap-5">
        <div className="text-center">
          <p className="eyebrow m-0">Party room</p>
          <p className="display m-0 mt-2 text-[clamp(40px,14vw,56px)] tracking-[0.12em] text-cyan" style={{ textShadow: "0 0 24px rgba(95,221,247,.5)" }}>
            {code}
          </p>
          <p className="m-0 mt-2 text-[15px] text-mist">{note ?? "You are joining this room."}</p>
        </div>
        <input
          autoFocus
          className="field"
          placeholder="Your name"
          value={name}
          maxLength={16}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && join()}
        />
        {error && <p className="m-0 text-center text-[14px] text-[#ff8098]">{error}</p>}
        <button type="button" className="btn btn-primary tap" disabled={busy} onClick={join}>
          {busy ? "Joining" : "Join the room"}
        </button>
      </div>
    </main>
  );
}

/* ---------------- lobby ---------------- */

const SETTINGS = ["Kolkata", "This hackathon room"];

export function Lobby({ room, actions }: Props) {
  const host = room.you?.isHost ?? false;
  const [setting, setSetting] = useState(room.settings.setting);
  const [custom, setCustom] = useState(SETTINGS.includes(room.settings.setting) ? "" : room.settings.setting);
  const [tone, setTone] = useState<Tone>(room.settings.tone);
  const [difficulty, setDifficulty] = useState<Difficulty>(room.settings.difficulty ?? "medium");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [qr, setQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/room/${room.code}`;
  const humans = room.players.filter((p) => !p.isBot);
  const aiSeats = Math.min(4, Math.max(0, 6 - humans.length));
  const enough = humans.length >= 2;
  const hostName = room.players.find((p) => p.isHost)?.name ?? "the host";

  async function share() {
    sfx.tap();
    try {
      if (navigator.share) {
        await navigator.share({ title: "Alibi", text: `Join my Alibi room: ${room.code}`, url });
        return;
      }
    } catch {
      return; // the share sheet was dismissed
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  async function start() {
    setBusy(true);
    setError("");
    try {
      await actions.start("Anywhere", room.settings.tone, difficulty);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="screen cold">
      <TopBar onBack={actions.home} right={host ? <Crown /> : null} />
      <h1 className="display m-0 mt-1 text-center text-[clamp(24px,7.5vw,30px)] uppercase tracking-[0.02em]">Party Lobby</h1>
      <p className="m-0 mt-1 text-center text-[14.5px] text-mist">Get everyone in, then start the investigation.</p>

      <div className="panel mt-4 shrink-0 p-3.5">
        <p className="label m-0 text-center text-snow">Room code</p>
        <div className="mt-2.5 flex justify-center gap-2.5">
          {room.code.split("").map((ch, i) => (
            <span
              key={i}
              className="display flex h-[clamp(52px,16vw,62px)] w-[clamp(52px,16vw,62px)] items-center justify-center rounded-[12px] text-[clamp(26px,8.5vw,34px)] text-cyan"
              style={{ background: "rgba(95,221,247,.1)", boxShadow: "inset 0 0 0 1.5px rgba(95,221,247,.55), 0 0 18px rgba(95,221,247,.18)", textShadow: "0 0 16px rgba(95,221,247,.6)" }}
            >
              {ch}
            </span>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" className="btn btn-glass tap !min-h-12 !text-[14.5px]" onClick={share}>
            {copied ? "Link copied" : "Share link"}
          </button>
          <button type="button" className="btn btn-glass tap !min-h-12 !text-[14.5px]" onClick={() => setQr(true)}>
            Show QR
          </button>
        </div>
      </div>

      <p className="eyebrow mt-4 text-center">
        {humans.length} {humans.length === 1 ? "player" : "players"} · {aiSeats} AI {aiSeats === 1 ? "suspect" : "suspects"}
      </p>
      <div className="mt-2 grid flex-1 grid-cols-2 content-start gap-2.5">
        {room.players.map((p, i) => (
          <div key={p.id} className="panel rise flex items-center gap-2.5 p-2.5">
            <Avatar name={p.name} index={i} size={40} />
            <span className="min-w-0">
              <span className="block truncate text-[14.5px] font-semibold leading-tight">{p.name}</span>
              <span className="label block !text-[9.5px]">{p.isHost ? "Host" : p.isBot ? "AI bot" : "Player"}{p.id === room.you?.id ? " · you" : ""}</span>
              <span className="flex items-center gap-1 text-[11.5px] font-semibold text-lime">
                <span className="h-1.5 w-1.5 rounded-full bg-lime" />
                Ready
              </span>
            </span>
          </div>
        ))}
        {/* Empty seats are filled by AI suspects, so a room always has six. */}
        {["Asha", "Vikram", "Meera", "Kabir"].slice(0, aiSeats).map((name, k) => (
          <div key={name} className="panel flex items-center gap-2.5 p-2.5" style={{ opacity: 0.82 }}>
            <Avatar name={name} index={humans.length + k} size={40} />
            <span className="min-w-0">
              <span className="block truncate text-[14.5px] font-semibold leading-tight">{name}</span>
              <span className="label block !text-[9.5px] text-cyan">AI suspect</span>
              <span className="block text-[11.5px] text-mist">Plays and votes</span>
            </span>
          </div>
        ))}
        {room.players.length < 8 && (
          <div className="flex min-h-[64px] items-center justify-center rounded-[14px] text-[13px] text-slate" style={{ boxShadow: "inset 0 0 0 1px rgba(130,180,230,.18)", borderStyle: "dashed" }}>
            <span className="blink">Waiting for a friend</span>
          </div>
        )}
      </div>

      {host && (
        <div className="mt-3 flex shrink-0 flex-col gap-2">
          <p className="label m-0 text-center">Difficulty</p>
          <div className="grid grid-cols-3 gap-1.5">
            {(["easy", "medium", "hard"] as const).map((d) => (
              <button key={d} type="button" className="chip tap !px-1 !text-[13px] capitalize" aria-pressed={difficulty === d} onClick={() => setDifficulty(d)}>
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="label mb-2.5 mt-3 text-center text-snow">
        {error ? error : !enough ? "Need at least 2 players" : aiSeats > 0 ? `${aiSeats} AI ${aiSeats === 1 ? "suspect plays" : "suspects play"} with you` : "Everyone is ready"}
      </p>
      {host ? (
        <button type="button" className="btn btn-primary tap" disabled={!enough || busy} onClick={start}>
          {busy ? "Opening the case" : "Start Round"}
          <Arrow />
        </button>
      ) : (
        <div className="btn btn-glass">
          <span className="blink">Waiting for {first(hostName)} to start</span>
        </div>
      )}

      <HowTo mode="party" />

      {qr && (
        <div className="scrim" role="dialog" aria-label="QR code">
          <button type="button" aria-label="Close" className="flex-1 border-0 bg-transparent" onClick={() => setQr(false)} />
          <div className="sheet flex flex-col items-center gap-4 p-6 pb-[max(24px,env(safe-area-inset-bottom))]">
            <span className="display text-[22px]">Scan to join {room.code}</span>
            <span className="rounded-[14px] bg-white p-3.5">
              <QRCodeSVG value={url} size={212} />
            </span>
            <button type="button" className="btn btn-primary tap" onClick={() => setQr(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

/* ---------------- briefing: hold to reveal your secret role ---------------- */

/** A quoted line the player can read out, with a label above it. */
function Line({ k, v, color }: { k: string; v: string; color: string }) {
  return (
    <div className="rounded-[10px] bg-black/30 px-3 py-2">
      <p className="label m-0" style={{ color }}>
        {k}
      </p>
      <p className="m-0 mt-0.5 text-[14.5px] leading-snug">{v}</p>
    </div>
  );
}

/** Everything one player needs: who they are, what to say, what they know. */
function RoleCard({ card, compact = false }: { card: PlayerCard; compact?: boolean }) {
  const culprit = card.role === "culprit";
  const color = culprit ? "#F0385A" : "#5FDDF7";
  const [head, ...rest] = card.mission.split(". ");
  return (
    <div
      className="rounded-[16px] p-4"
      style={{
        background: culprit ? "linear-gradient(180deg, rgba(240,56,90,.24), rgba(40,10,22,.9))" : "linear-gradient(180deg, rgba(95,221,247,.2), rgba(8,22,38,.9))",
        boxShadow: `inset 0 0 0 1.5px ${color}, 0 0 26px ${color}33`,
      }}
    >
      <p className="display m-0 uppercase" style={{ color, fontSize: compact ? 22 : "clamp(26px,8.5vw,34px)" }}>
        {head.replace(/\.$/, "")}
      </p>
      <p className="m-0 mt-1 text-[14.5px] leading-snug">
        {culprit
          ? "You did it. Stay calm, tell your cover story, and get them to accuse someone else."
          : `${rest.join(". ")} Tell people what you saw.`}
      </p>
      <div className="mt-3 flex flex-col gap-1.5">
        {card.job && <Line k="In this case you are" v={card.job} color={color} />}
        {card.story && <Line k={culprit ? "Your cover story · say this if asked" : "Your story · say this if asked"} v={`“${card.story}”`} color={color} />}
        {card.clues.map((c, i) => (
          <Line key={i} k={culprit ? "Use this to blame someone" : "What you saw · tell the room"} v={c} color={color} />
        ))}
        {card.objective && <Line k="The lie you need them to believe" v={card.objective} color="#ff8098" />}
        {card.role === "culprit" ? (
          <Line k="Your secret powers · once each" v="Plant fake evidence against someone. Cut the lights for 10 seconds." color="#ff8098" />
        ) : (
          <Line
            k="Your secret power · once"
            v={
              card.powers?.clear
                ? "Background check: confirm one suspect who is innocent."
                : card.powers?.extra
                  ? "Extra questions: ask three more questions."
                  : "Lie detector: test one piece of evidence to see if it was planted."
            }
            color={color}
          />
        )}
      </div>
    </div>
  );
}

export function Briefing({ room, actions, secondsLeft }: Props) {
  const [step, setStep] = useState<"case" | "scan" | "role">("case");
  const [hold, setHold] = useState(0);
  const raf = useRef<number | undefined>(undefined);
  const t0 = useRef(0);
  const card = room.you?.card;
  const facts = room.case?.facts;

  const begin = () => {
    t0.current = performance.now();
    const tick = () => {
      const p = Math.min(1, (performance.now() - t0.current) / 650);
      setHold(p);
      if (p >= 1) {
        setStep("role");
        sfx.clue();
      } else raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };
  const end = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    setHold(0);
  };
  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  const clock = (
    <span className="label rounded-full px-2.5 py-1.5 text-snow" style={{ boxShadow: "inset 0 0 0 1px rgba(130,180,230,.4)" }}>
      Starts in {secondsLeft ?? 0}s
    </span>
  );

  if (step === "case") {
    return (
      <main className="screen cold">
        <TopBar />
        <div className="mt-1 flex items-center justify-between gap-3">
          <span className="eyebrow">Step 1 of 2 · The case</span>
          {clock}
        </div>
        <h1 className="display m-0 mt-3 text-[clamp(28px,9vw,36px)]">{room.case?.title}</h1>
        <div className="panel mt-4 px-4 py-1">
          <Fact k="What" v={facts?.what ?? room.case?.crime ?? ""} />
          {facts?.when && <Fact k="When" v={facts.when} />}
          <Fact k="Where" v={facts?.where ?? (room.case?.setting ?? "").split(/ [–-] |,| \(/)[0]} />
        </div>
        <p className="m-0 mt-4 text-[15px] leading-snug text-[#E3E8F2]">{room.case?.intro}</p>
        <p className="label mt-4 text-snow">The suspects</p>
        <div className="mt-2 flex flex-1 flex-wrap content-start gap-2">
          {room.players.map((p, i) => (
            <span key={p.id} className="panel flex items-center gap-2 px-2.5 py-1.5">
              <Avatar name={p.name} index={i} size={26} />
              <span className="text-[13.5px] font-semibold">
                {label(room, p.name)}
                {p.id === room.you?.id ? " (you)" : ""}
              </span>
              <span className="label !text-[9px]">{p.isBot ? "AI" : ""}</span>
            </span>
          ))}
        </div>
        <button type="button" className="btn btn-primary tap mt-3" onClick={() => { sfx.tap(); setStep("scan"); }}>
          Next: see your secret role
          <Arrow />
        </button>
      </main>
    );
  }

  return (
    <main className={`screen ${step === "role" && card?.role === "culprit" ? "alarm" : "cold"}`}>
      <TopBar />
      <div className="mt-1 flex items-center justify-between gap-3">
        <span className="eyebrow">Step 2 of 2 · Your secret role</span>
        {clock}
      </div>

      {step === "scan" || !card ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <h1 className="display m-0 text-[clamp(28px,9vw,36px)]">
            Hold to reveal
            <br />
            who you are
          </h1>
          <button
            type="button"
            aria-label="Press and hold to reveal your secret role"
            onPointerDown={begin}
            onPointerUp={end}
            onPointerLeave={end}
            onPointerCancel={end}
            onContextMenu={(e) => e.preventDefault()}
            className="relative mt-6 h-[clamp(180px,54vw,240px)] w-[clamp(180px,54vw,240px)] touch-none select-none rounded-full border-0 bg-transparent p-0"
            style={{ WebkitTouchCallout: "none" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/art/scanner.png" alt="" draggable={false} className="h-full w-full" style={{ filter: `brightness(${1 + hold * 0.8})`, transform: `scale(${1 - hold * 0.04})` }} />
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
              <circle cx="50" cy="50" r="48" fill="none" stroke="#5FDDF7" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={`${hold * 301.6} 301.6`} />
            </svg>
          </button>
          <p className="m-0 mt-6 text-[15px]">Don&apos;t let anyone see your screen</p>
          <p className="label mt-2">Press and hold the scanner</p>
        </div>
      ) : (
        <div className="rise mt-3 flex min-h-0 flex-1 flex-col gap-3">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <RoleCard card={card} />
          </div>
          {room.you?.isHost ? (
            <button type="button" className="btn btn-primary tap" onClick={() => void actions.skip().catch(() => {})}>
              Everyone has read their card? Start
              <Arrow />
            </button>
          ) : (
            <p className="label mb-1 text-center text-snow">Read it carefully · the discussion starts in {secondsLeft ?? 0}s</p>
          )}
        </div>
      )}
    </main>
  );
}

/* ---------------- discussion: flashcards ---------------- */

/** One row of the case card: a label and a plain fact. */
function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-3 border-t border-white/10 py-3 first:border-0">
      <span className="label w-14 shrink-0 pt-1 text-cyan">{k}</span>
      <span className="text-[16px] leading-snug">{v}</span>
    </div>
  );
}

/** A face-down card on the table. Tap to open it. */
function Tool({
  title,
  accent,
  badge,
  hot,
  d,
  onOpen,
}: {
  title: string;
  accent: string;
  badge?: string;
  hot?: boolean;
  d: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        sfx.tap();
        onOpen();
      }}
      className="tap relative flex h-[62px] flex-col items-center justify-center gap-1 rounded-[14px] border-0 px-1 text-snow"
      style={{
        background: "linear-gradient(180deg, rgba(28,40,66,.9), rgba(12,18,34,.94))",
        boxShadow: `inset 0 0 0 1px ${hot ? accent : "rgba(130,180,230,.22)"}`,
      }}
    >
      {badge && (
        <span className="mono absolute -right-1 -top-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium text-ink" style={{ background: accent }}>
          {badge}
        </span>
      )}
      <span style={{ color: accent }}>
        <Glyph d={d} />
      </span>
      <span className="text-[13px] font-semibold leading-none">{title}</span>
    </button>
  );
}

export function Discuss({ room, actions, secondsLeft }: Props) {
  const you = room.you;
  const card = you?.card;
  const total = room.phaseTotalSec ?? (room.settings.demo ? 45 : 100);
  const hot = room.hotSeat ?? null;
  const hotLeft = hot ? Math.max(0, Math.ceil((Date.parse(hot.endsAt) - Date.parse(room.serverNow)) / 1000)) : 0;
  const evidence = room.botClues ?? [];
  const [open, setOpen] = useState<string | null>(null); // "case" | "role" | "evidence" | player id
  const [fresh, setFresh] = useState(0); // evidence the player has not opened yet
  const [asksLeft, setAsksLeft] = useState(3);
  const [tested, setTested] = useState<Record<string, boolean>>({}); // evidence id -> real?
  const [powerBusy, setPowerBusy] = useState(false);
  const powers = card?.powers ?? {};
  const [cleared, setCleared] = useState<string | null>(null);
  const powersLeft = Object.values(powers).filter(Boolean).length;
  const dark = room.blackoutUntil ? Math.max(0, Math.ceil((Date.parse(room.blackoutUntil) - Date.parse(room.serverNow)) / 1000)) : 0;
  const wasDark = useRef(false);

  useEffect(() => {
    if (dark > 0 && !wasDark.current) {
      wasDark.current = true;
      setOpen(null);
      sfx.sting();
    }
    if (dark === 0) wasDark.current = false;
  }, [dark]);

  async function power(kind: PowerKind, opts: { targetId?: string; evidenceId?: string } = {}) {
    if (powerBusy) return;
    setPowerBusy(true);
    try {
      const r = await actions.power(kind, opts);
      if (kind === "detector" && opts.evidenceId) {
        setTested((t) => ({ ...t, [opts.evidenceId!]: r.real !== false }));
        if (r.real === false) sfx.crack();
        else sfx.clue();
      } else if (kind === "clear") {
        setCleared(r.clearedName ?? null);
        sfx.clue();
      } else if (kind === "extra") {
        setAsksLeft((n) => n + (r.extra ?? 3));
        sfx.clue();
        setOpen(null);
      } else {
        sfx.crack();
        setOpen(null);
      }
    } catch {
      // the server refused (already used, or the phase moved on)
    } finally {
      setPowerBusy(false);
    }
  }
  const [asking, setAsking] = useState(false);
  const [talk, setTalk] = useState<Record<string, { q: string; a: string }[]>>({});
  const poke = you?.poke ?? null;
  const pokeLeft = poke ? Math.max(0, Math.ceil((Date.parse(poke.endsAt) - Date.parse(room.serverNow)) / 1000)) : 0;
  const lastPoke = useRef<string | null>(null);
  // Each player closes a question on their own phone once it has been answered.
  const [closed, setClosed] = useState<string[]>([]);
  const pokeKey = poke ? `p:${poke.question}${poke.endsAt}` : "";
  const hotKey = hot ? `h:${hot.question}` : "";
  const showPoke = Boolean(poke) && !closed.includes(pokeKey);
  const showHot = Boolean(hot) && !closed.includes(hotKey);

  useEffect(() => {
    if (poke && lastPoke.current !== poke.question + poke.endsAt) {
      lastPoke.current = poke.question + poke.endsAt;
      setOpen(null);
      sfx.crack();
    }
  }, [poke]);

  async function ask(targetId: string, question: string, isBot: boolean) {
    if (asking || asksLeft <= 0) return;
    setAsking(true);
    setAsksLeft((n) => n - 1);
    sfx.tap();
    try {
      const r = await actions.ask(targetId, question);
      const a = isBot ? (r.reply ?? "...") : "Sent to their phone. Make them answer out loud.";
      setTalk((t) => ({ ...t, [targetId]: [...(t[targetId] ?? []), { q: question, a }] }));
      if (isBot) sfx.clue();
    } catch {
      setAsksLeft((n) => n + 1);
    } finally {
      setAsking(false);
    }
  }
  const seenEvidence = useRef(evidence.length);
  const lastHot = useRef<string | null>(null);

  useEffect(() => {
    if (hot && lastHot.current !== hot.question) {
      lastHot.current = hot.question;
      setOpen(null);
      sfx.crack();
    }
  }, [hot]);

  // New evidence lands on the table: light up the evidence card.
  useEffect(() => {
    if (evidence.length > seenEvidence.current) {
      setFresh((n) => n + (evidence.length - seenEvidence.current));
      seenEvidence.current = evidence.length;
      sfx.clue();
    }
  }, [evidence.length]);

  const others = room.players.filter((p) => p.id !== you?.id);
  const opened = others.find((p) => p.id === open);

  return (
    <main className="screen">
      <TopBar />
      <div className="mt-1">
        <Timer seconds={secondsLeft ?? 0} total={total} label="Discussion" sub="Talk it out loud" />
      </div>
      {card?.story && (
        <p className="m-0 mt-3 truncate text-[14px] text-mist">
          <span className="text-cyan">Your story:</span> “{card.story}”
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="m-0 text-[17px] font-semibold text-snow">Tap a suspect to question them</p>
        <span className="label shrink-0 text-cyan">{asksLeft} left</span>
      </div>

      {/* The suspects: one clear row each. */}
      <div className={`mt-2.5 grid min-h-0 flex-1 auto-rows-[minmax(60px,104px)] content-start gap-2 overflow-y-auto ${others.length > 5 ? "grid-cols-2" : "grid-cols-1"}`}>
        {others.map((p) => {
          const i = indexOf(room, p.id);
          const doubted = you?.doubting === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                sfx.tap();
                setOpen(p.id);
              }}
              className="tap flex h-full min-h-[60px] w-full items-center gap-3 rounded-[16px] border-0 px-3.5 py-2 text-left text-snow"
              style={{
                background: "linear-gradient(180deg, rgba(28,40,66,.9), rgba(12,18,34,.94))",
                boxShadow: `inset 0 0 0 1px ${doubted ? "#F0385A" : "rgba(130,180,230,.22)"}`,
              }}
            >
              <Avatar name={p.name} index={i} size={38} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[17px] font-semibold leading-tight">{label(room, p.name)}</span>
                <span className="block truncate text-[13px] leading-tight text-mist">
                  {doubted ? "You doubt them" : p.isBot ? "AI suspect" : "Player"}
                  {(p.doubt ?? 0) > 0 ? ` · ${p.doubt}% doubt` : ""}
                </span>
              </span>
              <span className="shrink-0 text-[14px] font-semibold text-cyan">Ask</span>
            </button>
          );
        })}
      </div>

      {/* Everything else lives in one small bar. */}
      <div className="mt-3 grid shrink-0 auto-cols-fr grid-flow-col gap-2">
        <Tool title="Case" accent="#5FDDF7" onOpen={() => setOpen("case")} d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5" />
        <Tool
          title="My role"
          accent={card?.role === "culprit" ? "#F0385A" : "#5FDDF7"}
          onOpen={() => setOpen("role")}
          d="M12 3a4 4 0 0 1 4 4v3h1.500v10h-11V10H8V7a4 4 0 0 1 4-4zM10 10h4V7a2 2 0 0 0-4 0z"
        />
        <Tool
          title="Evidence"
          accent="#B6F36A"
          badge={fresh ? `${fresh} new` : String(evidence.length)}
          hot={fresh > 0}
          onOpen={() => {
            setFresh(0);
            setOpen("evidence");
          }}
          d="M10.500 4a6.500 6.500 0 1 0 4.100 11.600l4.900 4.900 1.400-1.400-4.900-4.900A6.500 6.500 0 0 0 10.500 4zm0 2a4.500 4.500 0 1 1 0 9 4.500 4.500 0 0 1 0-9z"
        />
        {(powersLeft > 0 || cleared) && (
          <Tool title="Power" accent={card?.role === "culprit" ? "#F0385A" : "#FFC857"} badge={powersLeft ? String(powersLeft) : undefined} onOpen={() => setOpen("powers")} d="M13 2L5 14h6l-1 8 8-12h-6z" />
        )}
      </div>

      {you?.isHost ? (
        <button type="button" className="btn btn-primary tap mt-3" onClick={() => void actions.skip().catch(() => {})}>
          End the discussion and vote
          <Arrow />
        </button>
      ) : (
        <p className="label mb-1 mt-3 text-center text-snow">The host starts the vote when everyone is ready</p>
      )}

      {/* The opened flashcard. */}
      {open && !showHot && (showPoke ? false : true) && (
        <div className="scrim !justify-center px-5" role="dialog" aria-label="Card">
          <button type="button" aria-label="Close card" className="absolute inset-0 border-0 bg-transparent" onClick={() => setOpen(null)} />
          <div className="rise relative flex max-h-[82%] flex-col gap-3 overflow-y-auto">
            {open === "case" && (
              <div className="panel p-5">
                <p className="eyebrow m-0">The case</p>
                <p className="display m-0 mt-1 text-[26px]">{room.case?.title}</p>
                <div className="mt-3">
                  <Fact k="What" v={room.case?.facts?.what ?? room.case?.crime ?? ""} />
                  {room.case?.facts?.when && <Fact k="When" v={room.case.facts.when} />}
                  <Fact k="Where" v={room.case?.facts?.where ?? (room.case?.setting ?? "").split(/ [–-] |,| \(/)[0]} />
                </div>
              </div>
            )}
            {open === "role" && card && <RoleCard card={card} />}
            {open === "evidence" && (
              <div className="panel p-5">
                <p className="eyebrow m-0" style={{ color: "#B6F36A" }}>Evidence</p>
                <p className="m-0 mt-1 text-[14px] text-mist">Found by the AI suspects. Everyone can see these.</p>
                <div className="mt-3 flex flex-col gap-2">
                  {evidence.length === 0 && <p className="blink m-0 text-mist">The first piece is on its way.</p>}
                  {evidence.map((e, i) => (
                    <div key={i} className="rounded-[12px] bg-black/30 px-3.5 py-2.5">
                      <p className="m-0 text-[15px] leading-snug">{e.text}</p>
                      <p className="label m-0 mt-1">Reported by {e.from}</p>
                      {e.id && tested[e.id] !== undefined ? (
                        <p className="label m-0 mt-1.5" style={{ color: tested[e.id] ? "#B6F36A" : "#F0385A" }}>
                          {tested[e.id] ? "Lie detector: this is real" : "Lie detector: FAKE. Someone planted this."}
                        </p>
                      ) : (
                        powers.detector &&
                        e.id && (
                          <button type="button" className="chip tap mt-2 !min-h-10 !text-[13px]" disabled={powerBusy} onClick={() => power("detector", { evidenceId: e.id })}>
                            Use lie detector on this
                          </button>
                        )
                      )}
                    </div>
                  ))}
                </div>
                {evidence.length > 0 && (
                  <>
                    <p className="label m-0 mt-4 text-snow">Who does this point at?</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {others.map((p) => {
                        const on = you?.doubting === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            aria-pressed={on}
                            className="chip tap !min-h-11 !px-3"
                            style={on ? { background: "rgba(240,56,90,.2)", boxShadow: "inset 0 0 0 1.5px #F0385A", color: "#F4F6FA" } : undefined}
                            onClick={() => {
                              sfx.tap();
                              void actions.doubt(on ? null : p.id).catch(() => {});
                            }}
                          >
                            {label(room, p.name)} · {p.doubt ?? 0}%
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
            {open === "powers" && (
              <div className="panel p-5">
                <p className="eyebrow m-0" style={{ color: card?.role === "culprit" ? "#ff8098" : "#FFC857" }}>
                  {card?.role === "culprit" ? "Secret powers · once each" : "Your secret power · one use"}
                </p>
                {powers.detector && (
                  <>
                    <p className="display m-0 mt-2 text-[22px]">Lie detector</p>
                    <p className="m-0 mt-1 text-[14px] leading-snug text-mist">Test one piece of evidence. You will learn if it is real or was planted by the culprit.</p>
                    <button type="button" className="btn btn-primary tap mt-3 !min-h-12" onClick={() => { setFresh(0); setOpen("evidence"); }}>
                      Open the evidence
                    </button>
                  </>
                )}
                {powers.clear && !cleared && (
                  <>
                    <p className="display m-0 mt-2 text-[22px]">Background check</p>
                    <p className="m-0 mt-1 text-[14px] leading-snug text-mist">Find out one suspect who definitely did not do it. Only you will know.</p>
                    <button type="button" className="btn btn-primary tap mt-3 !min-h-12" disabled={powerBusy} onClick={() => power("clear")}>
                      Run the check
                    </button>
                  </>
                )}
                {cleared && (
                  <>
                    <p className="display m-0 mt-2 text-[22px]" style={{ color: "#B6F36A" }}>{label(room, cleared)} is innocent</p>
                    <p className="m-0 mt-1 text-[14px] leading-snug text-mist">Confirmed by your background check. Cross them off your list.</p>
                  </>
                )}
                {powers.extra && (
                  <>
                    <p className="display m-0 mt-2 text-[22px]">Extra questions</p>
                    <p className="m-0 mt-1 text-[14px] leading-snug text-mist">Get three more questions to ask the suspects.</p>
                    <button type="button" className="btn btn-primary tap mt-3 !min-h-12" disabled={powerBusy} onClick={() => power("extra")}>
                      Give me 3 more
                    </button>
                  </>
                )}
                {powers.plant && (
                  <>
                    <p className="display m-0 mt-2 text-[22px]">Frame someone</p>
                    <p className="m-0 mt-1 text-[14px] leading-snug text-mist">A fake tip against them appears in everyone&apos;s evidence. Nobody will know it was you.</p>
                    <div className="mt-2.5 grid grid-cols-2 gap-2">
                      {others.map((p) => (
                        <button key={p.id} type="button" className="chip tap !min-h-11" disabled={powerBusy} onClick={() => power("plant", { targetId: p.id })}>
                          {label(room, p.name)}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {powers.blackout && (
                  <>
                    <p className="display m-0 mt-5 text-[22px]">Cut the lights</p>
                    <p className="m-0 mt-1 text-[14px] leading-snug text-mist">Every phone goes dark for 10 seconds, yours too. Use it when they are getting close.</p>
                    <button type="button" className="btn btn-danger tap mt-2.5 !min-h-12" disabled={powerBusy} onClick={() => power("blackout")}>
                      Cut the lights now
                    </button>
                  </>
                )}
              </div>
            )}
            {opened && (
              <div className="panel flex flex-col items-center gap-2 p-6 text-center">
                <Avatar name={opened.name} index={indexOf(room, opened.id)} size={72} />
                <p className="display m-0 mt-1 text-[28px]">{label(room, opened.name)}</p>
                <p className="label m-0 text-snow">
                  {opened.caseRole ?? "Suspect"}
                  {opened.isBot ? " · AI suspect" : ""}
                </p>
                {opened.alibi && (
                  <>
                    <p className="label m-0 mt-3">Their story</p>
                    <p className="m-0 text-[16px] leading-snug">“{opened.alibi}”</p>
                  </>
                )}
                <div className="mt-3 flex w-full flex-col gap-2 text-left">
                  {(talk[opened.id] ?? []).map((t, i) => (
                    <div key={i} className="rise rounded-[12px] bg-black/30 px-3.5 py-2.5">
                      <p className="label m-0">You asked: {t.q}</p>
                      <p className="m-0 mt-1 text-[15px] leading-snug">{t.a}</p>
                    </div>
                  ))}
                  {asking && <p className="blink m-0 text-center text-[14px] text-mist">{opened.isBot ? `${first(opened.name)} is choosing their words` : "Sending"}</p>}
                </div>
                <p className="label m-0 mt-2 text-snow">
                  {asksLeft > 0
                    ? opened.isBot
                      ? `Question them · ${asksLeft} left`
                      : `Put them on the spot · ${asksLeft} left`
                    : "No questions left this round"}
                </p>
                <div className="grid w-full grid-cols-1 gap-1.5">
                  {["Where exactly were you?", "What did you see?", "Who do you think did it?"].map((q) => (
                    <button key={q} type="button" className="chip tap !min-h-11 !text-[14px]" disabled={asking || asksLeft <= 0} onClick={() => ask(opened.id, q, Boolean(opened.isBot))}>
                      {q}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className={`btn tap mt-2 ${you?.doubting === opened.id ? "btn-danger" : "btn-glass"}`}
                  onClick={() => {
                    sfx.tap();
                    void actions.doubt(you?.doubting === opened.id ? null : opened.id).catch(() => {});
                  }}
                >
                  {you?.doubting === opened.id ? "You doubt them" : "I doubt them"} · {opened.doubt ?? 0}% of the room
                </button>
              </div>
            )}
            <button type="button" className="btn btn-primary tap" onClick={() => setOpen(null)}>
              Close card
            </button>
          </div>
        </div>
      )}

      {dark > 0 && (
        <div className="scrim !justify-center px-6" role="alert" style={{ zIndex: 55, background: "#000" }}>
          <div className="text-center">
            <p className="eyebrow blink m-0" style={{ color: "#F0385A" }}>Blackout</p>
            <p className="display m-0 mt-3 text-[clamp(34px,11vw,48px)]">Someone cut the lights</p>
            <p className="mono m-0 mt-4 text-[40px] text-[#F0385A]">{dark}</p>
            <p className="label mt-3">Who just did that? Look at their faces.</p>
          </div>
        </div>
      )}

      {poke && showPoke && !showHot && (
        <div className="scrim !justify-center px-6" role="alert" style={{ background: "rgba(8,22,38,.94)" }}>
          <div className="rise text-center">
            <p className="eyebrow m-0">{first(poke.fromName)} is asking you</p>
            <p className="display m-0 mt-4 text-[clamp(28px,9vw,38px)]">{poke.question}</p>
            <p className="label mt-5">Answer out loud. Everyone is listening.</p>
            {card?.story && (
              <div className="panel mt-5 px-4 py-3 text-left">
                <p className="label m-0 text-cyan">Your story</p>
                <p className="m-0 mt-1 text-[15px] leading-snug">“{card.story}”</p>
              </div>
            )}
            <button type="button" className="btn btn-primary tap mt-6" onClick={() => { sfx.tap(); setClosed((c) => [...c, pokeKey]); }}>
              Done, back to the case
            </button>
          </div>
        </div>
      )}

      {hot && showHot && (
        <div className="scrim !justify-center px-6" role="alert" style={{ background: "rgba(40,6,18,.92)" }}>
          <div className="rise text-center">
            <p className="eyebrow m-0" style={{ color: "#ff8098" }}>
              Hot seat
            </p>
            <p className="display m-0 mt-3 text-[clamp(44px,15vw,64px)]">{first(hot.playerName)}</p>
            <p className="m-0 mt-4 text-[19px] leading-snug">{hot.question}</p>
            <p className="label mt-5">Answer out loud. Everyone is watching.</p>
            {hot.playerId === you?.id && card?.story && (
              <div className="panel mt-5 px-4 py-3 text-left">
                <p className="label m-0 text-cyan">Your story</p>
                <p className="m-0 mt-1 text-[15px] leading-snug">“{card.story}”</p>
              </div>
            )}
            <button type="button" className="btn btn-primary tap mt-6" onClick={() => { sfx.tap(); setClosed((c) => [...c, hotKey]); }}>
              Done, back to the case
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function Glyph({ d }: { d: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.800" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/* ---------------- vote ---------------- */

export function Vote({ room, actions, secondsLeft }: Props) {
  const you = room.you;
  const voted = Boolean(you?.votedFor);
  const [pick, setPick] = useState<string>(you?.votedFor ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const total = room.phaseTotalSec ?? (room.settings.demo ? 20 : 30);
  const votesIn = room.players.filter((p) => p.hasVoted).length;

  async function lock() {
    if (!pick || voted) return;
    setBusy(true);
    setError("");
    try {
      await actions.vote(pick);
      sfx.crack();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="screen warm">
      <TopBar />
      <h1 className="display m-0 mt-1 text-center text-[clamp(26px,8vw,32px)] uppercase">Who did it?</h1>
      <p className="m-0 mt-1 text-center text-[14.5px] text-mist">Tap the person you think did it, then lock it in.</p>
      <div className="mt-3">
        <Timer seconds={secondsLeft ?? 0} total={total} label="Voting phase" sub={`${votesIn} / ${room.players.length} votes in`} />
      </div>

      <div className="mt-3 grid min-h-[240px] flex-1 auto-rows-fr grid-cols-2 gap-2.5 overflow-y-auto">
        {room.players.map((p, i) => {
          const mine = p.id === you?.id;
          if (mine) return null;
          const on = (you?.votedFor ?? pick) === p.id;
          return (
            <button
              key={p.id}
              type="button"
              disabled={mine || voted}
              aria-pressed={on}
              onClick={() => {
                sfx.tap();
                setPick(p.id);
              }}
              className="tap flex flex-col items-center justify-center gap-1 rounded-[14px] border-0 px-2 pb-2.5 pt-3.5 text-snow disabled:!opacity-100"
              style={{
                background: on ? "linear-gradient(180deg, rgba(240,56,90,.28), rgba(40,10,22,.9))" : "linear-gradient(180deg, rgba(28,40,66,.86), rgba(12,18,34,.9))",
                boxShadow: on ? "inset 0 0 0 1.5px #F0385A, 0 0 22px rgba(240,56,90,.3)" : "inset 0 0 0 1px rgba(130,180,230,.22)",
                opacity: mine ? 0.55 : 1,
              }}
            >
              <Avatar name={p.name} index={i} size={46} />
              <span className="w-full truncate text-center text-[16px] font-bold leading-tight">{label(room, p.name)}</span>
              <span className="label line-clamp-2 text-center">{mine ? "You" : (p.caseRole ?? (p.isBot ? "AI bot" : "Suspect"))}</span>
              <span className="mt-1.5 w-full px-1">
                <Meter value={p.doubt ?? 0} color="#F0385A" />
              </span>
              <span className="flex w-full items-center justify-between px-1">
                <span className="label !text-[9px]">Doubt {p.doubt ?? 0}%</span>
                {p.hasVoted && <span className="h-1.5 w-1.5 rounded-full bg-white" aria-label="has voted" />}
              </span>
            </button>
          );
        })}
      </div>

      <p className="label mb-2.5 mt-3 text-center text-snow">
        {error ? error : voted ? "Locked. Waiting for the others." : pick ? "One tap locks it. No changing your mind." : "Tap a suspect to accuse"}
      </p>
      <button type="button" className="btn btn-danger tap" disabled={!pick || voted || busy} onClick={lock}>
        {voted ? "Accusation locked" : pick ? `Lock accusation: ${label(room, room.players.find((p) => p.id === pick)?.name ?? "")}` : "Lock Accusation"}
      </button>
    </main>
  );
}

/* ---------------- verdict ---------------- */

export function Verdict({ room, actions }: Props) {
  const r = room.reveal!;
  const you = room.you;
  const [voice, setVoice] = useState<"idle" | "loading" | "playing">("loading");
  const [share, setShare] = useState(false);
  const [full, setFull] = useState(false);
  const [busy, setBusy] = useState(false);
  const [xp, setXp] = useState({ gained: 0, total: 0 });
  const audio = useRef<HTMLAudioElement | null>(null);
  const text = r.narration || `${r.story} ${r.roast}`;
  const culpritIdx = indexOf(room, r.culpritId);
  const tally = room.players
    .map((p, i) => ({ p, i, n: r.votes.filter((v) => v.targetId === p.id).length }))
    .sort((a, b) => b.n - a.n);
  const max = Math.max(1, ...tally.map((t) => t.n));

  // XP is awarded once per round, on this phone.
  useEffect(() => {
    const key = `kaun.xp.${room.code}.${r.culpritId}.${r.votes.length}.${r.story.length}`;
    if (!you) return;
    if (sessionStorage.getItem(key)) return setXp({ gained: Number(sessionStorage.getItem(key)), total: readXp() });
    const wasCulprit = you.id === r.culpritId;
    const votedRight = r.votes.some((v) => v.voterId === you.id && v.targetId === r.culpritId);
    const gained = 100 + (wasCulprit ? (r.caught ? 0 : 250) : votedRight ? 150 : 0);
    sessionStorage.setItem(key, String(gained));
    countRound();
    setXp({ gained, total: addXp(gained) });
  }, [room.code, r, you]);

  // Fetch the narration once and try to play it. Phones may block autoplay,
  // so the play button always stays.
  useEffect(() => {
    let cancelled = false;
    setVoice("loading");
    (async () => {
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, tone: room.settings.tone }),
        });
        if (!res.ok) throw new Error("no voice");
        const el = new Audio(URL.createObjectURL(await res.blob()));
        if (cancelled) return;
        audio.current = el;
        el.onended = () => setVoice("idle");
        el.onpause = () => setVoice("idle");
        el.play().then(() => setVoice("playing")).catch(() => setVoice("idle"));
      } catch {
        if (!cancelled) setVoice("idle");
      }
    })();
    return () => {
      cancelled = true;
      audio.current?.pause();
    };
  }, [text, room.settings.tone]);

  function toggle() {
    if (voice === "playing") {
      audio.current?.pause();
      window.speechSynthesis?.cancel();
      return setVoice("idle");
    }
    if (audio.current) {
      audio.current.currentTime = 0;
      audio.current.play().then(() => setVoice("playing")).catch(() => {});
      return;
    }
    if (!window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-IN";
    u.rate = 0.95;
    u.onend = () => setVoice("idle");
    window.speechSynthesis.speak(u);
    setVoice("playing");
  }

  const youWon = you ? (you.id === r.culpritId ? !r.caught : r.caught) : false;

  return (
    <main className={`screen ${r.caught ? "alarm" : "warm"}`}>
      <TopBar right={you?.isHost ? <Crown /> : null} />
      <p className="eyebrow mt-1" style={{ color: r.caught ? "#ff8098" : "#c4b5fd" }}>
        {room.case?.title ?? "Case file"} · {r.accusedName ? `The room accused ${first(r.accusedName)}` : "The room could not agree"}
      </p>
      <div className="mt-2 flex items-center gap-3">
        <Avatar name={r.culpritName} index={culpritIdx} size={56} />
        <h1 className="display m-0 min-w-0 flex-1 text-[clamp(32px,10.5vw,46px)]">{r.culpritName}</h1>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span
          className="flex shrink-0 items-center rounded-[8px] px-3 py-1.5 text-[13px] font-bold tracking-[0.06em] text-white"
          style={{ background: r.caught ? "#F0385A" : "#4c3d8f", animation: "riseIn 380ms ease-out both" }}
        >
          {r.caught ? "CULPRIT CAUGHT" : "CULPRIT ESCAPED"}
        </span>
        <span className="text-[13.5px] leading-snug text-mist">
          {you ? (youWon ? "You win this round." : "You lose this round.") : r.caught ? "Case closed." : "They got away with it."}
        </span>
      </div>

      {(r.tricks?.length ?? 0) > 0 && (
        <div className="mt-4 rounded-[12px] px-3.5 py-2.5" style={{ background: "rgba(240,56,90,.12)", boxShadow: "inset 0 0 0 1px rgba(240,56,90,.45)" }}>
          <p className="label m-0 text-[#ff8098]">Dirty tricks this round</p>
          {r.tricks!.map((t, i) => (
            <p key={i} className="m-0 mt-1 text-[14.5px] font-medium leading-snug">{t}</p>
          ))}
        </div>
      )}
      <p className="label mt-4 text-snow">How the room voted</p>
      <div className="mt-1.5 flex shrink-0 flex-col gap-1.5">
        {tally.map(({ p, i, n }) => (
          <div key={p.id} className="grid grid-cols-[84px_1fr_18px] items-center gap-2.5 text-[13.5px]">
            <span className="truncate font-semibold">
              {label(room, p.name)}
              {p.isBot ? <span className="label ml-1 !text-[9px]">AI</span> : null}
            </span>
            <Meter value={(n / max) * 100} color={n ? ringOf(i) : "transparent"} />
            <span className="mono text-right">{n}</span>
          </div>
        ))}
      </div>

      <div className="panel mt-3.5 p-3.5">
        <div className="flex items-center gap-3">
          <button type="button" aria-label={voice === "playing" ? "Stop narration" : "Play narration"} onClick={toggle} className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-0 bg-white text-ink">
            {voice === "playing" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z" /></svg>
            )}
          </button>
          <span className="flex h-8 flex-1 items-center gap-[3px]" aria-hidden="true">
            {Array.from({ length: 34 }, (_, i) => (
              <span key={i} className="w-[3px] rounded-full bg-white/45" style={{ height: `${28 + ((i * 37) % 60)}%`, animation: voice === "playing" ? `wave ${0.6 + (i % 5) * 0.12}s ease-in-out ${i * 0.03}s infinite` : undefined }} />
            ))}
          </span>
        </div>
        <p className="m-0 mt-3 text-[16px] font-medium leading-snug">{full ? r.story : firstSentence(r.narration || r.story)}</p>
        {full && <p className="m-0 mt-2 text-[14px] italic leading-snug text-mist">“{r.roast}”</p>}
        <button type="button" className="tap label mt-2.5 border-0 bg-transparent p-0 text-cyan underline" onClick={() => setFull((f) => !f)}>
          {full ? "Show less" : "Read the full story"}
        </button>
      </div>

      <p className="label mt-3 text-center">
        +{xp.gained} XP · Level {levelOf(xp.total || readXp()).level} {levelOf(xp.total || readXp()).rank}
      </p>

      <div className="mt-auto flex shrink-0 flex-col gap-2.5 pt-4">
        {you?.isHost ? (
          <button
            type="button"
            className="btn btn-primary tap"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              audio.current?.pause();
              await actions.again().catch(() => setBusy(false));
            }}
          >
            Play again · same room
            <Arrow />
          </button>
        ) : (
          <div className="btn btn-glass">
            <span className="blink">Host can start the next case</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" className="btn btn-glass tap !text-[15px]" onClick={() => setShare(true)}>
            Share result
          </button>
          <button
            type="button"
            className="btn btn-glass tap !text-[15px]"
            onClick={() => {
              audio.current?.pause();
              actions.home();
            }}
          >
            Back to home
          </button>
        </div>
      </div>

      {share && (
        <div className="scrim" role="dialog" aria-label="Share">
          <button type="button" aria-label="Close" className="min-h-10 flex-1 border-0 bg-transparent" onClick={() => setShare(false)} />
          <div className="sheet flex max-h-[90%] flex-col gap-3 overflow-y-auto p-5 pb-[max(20px,env(safe-area-inset-bottom))]">
            <ShareCard
              headline={r.caught ? `${r.culpritName} arrested` : `${r.culpritName} walks free`}
              caseTitle={room.case?.title ?? "Alibi"}
              roast={r.roast}
              caught={r.caught}
              votes={r.votes.map((v) => ({ voterName: v.voterName, targetName: v.targetName }))}
            />
            <button type="button" className="btn btn-glass tap" onClick={() => setShare(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

/* ---------------- icons ---------------- */

function Arrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
function Crown() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#F5A524" aria-label="You are the host">
      <path d="M3 8l4.500 4L12 5l4.500 7L21 8l-2 10H5z" />
    </svg>
  );
}
