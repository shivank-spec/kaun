"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import ShareCard from "@/components/ShareCard";
import { Avatar, Meter, Timer, TopBar, XpCard, addXp, readXp, ringOf, sfx } from "@/components/ui/kit";
import { post } from "@/components/room/api";
import type { Difficulty, PlayerCard, RoomView, Tone } from "@/lib/types";

/* The multiplayer screens. Each one renders purely from the RoomView the
   server sends; the server owns the clock and moves the phases. */

export interface RoomActions {
  start: (setting: string, tone: Tone, difficulty: Difficulty) => Promise<void>;
  vote: (targetId: string) => Promise<void>;
  again: () => Promise<void>;
  doubt: (targetId: string | null) => Promise<void>;
  home: () => void;
}

type Props = { room: RoomView; actions: RoomActions; secondsLeft: number | null };

const indexOf = (room: RoomView, id: string) => Math.max(0, room.players.findIndex((p) => p.id === id));
const first = (name: string) => name.split(" ")[0];

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
  const enough = humans.length >= 2;
  const hostName = room.players.find((p) => p.isHost)?.name ?? "the host";

  async function share() {
    sfx.tap();
    try {
      if (navigator.share) {
        await navigator.share({ title: "Kaun?", text: `Join my Kaun? room: ${room.code}`, url });
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
      await actions.start(custom.trim() || setting, tone, difficulty);
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

      <p className="eyebrow mt-4 text-center">Players · {room.players.length} / 8</p>
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
        {room.players.length < 8 && (
          <div className="flex min-h-[64px] items-center justify-center rounded-[14px] text-[13px] text-slate" style={{ boxShadow: "inset 0 0 0 1px rgba(130,180,230,.18)", borderStyle: "dashed" }}>
            <span className="blink">Waiting for a friend</span>
          </div>
        )}
      </div>

      {host && (
        <div className="mt-3 flex shrink-0 flex-col gap-2">
          <div className="grid grid-cols-3 gap-1.5">
            {SETTINGS.map((s) => (
              <button key={s} type="button" className="chip tap !px-1 !text-[13px]" aria-pressed={!custom.trim() && setting === s} onClick={() => { setSetting(s); setCustom(""); }}>
                {s === "Kolkata" ? "Kolkata" : "This Room"}
              </button>
            ))}
            <button type="button" className="chip tap !px-1 !text-[13px]" aria-pressed={tone === "noir"} onClick={() => setTone(tone === "desi" ? "noir" : "desi")}>
              {tone === "desi" ? "Drama" : "Noir"}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {(["easy", "medium", "hard"] as const).map((d) => (
              <button key={d} type="button" className="chip tap !px-1 !text-[13px] capitalize" aria-pressed={difficulty === d} onClick={() => setDifficulty(d)}>
                {d}
              </button>
            ))}
          </div>
          <input
            className="field !min-h-11 !text-[14px]"
            placeholder="Or set it anywhere: our college canteen"
            value={custom}
            onChange={(e) => {
              const w = e.target.value.split(/\s+/).filter(Boolean);
              setCustom(w.length > 3 ? w.slice(0, 3).join(" ") : e.target.value.slice(0, 36));
            }}
          />
        </div>
      )}

      <p className="label mb-2.5 mt-3 text-center text-snow">
        {error ? error : !enough ? "Need at least 2 players" : humans.length === 2 ? "An AI bot will take the third seat" : "Everyone is ready"}
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

/** Everyone's public story: who they are in the case and where they say they were. */
function Stories({ room }: { room: RoomView }) {
  const withStory = room.players.filter((p) => p.caseRole || p.alibi);
  if (!withStory.length) return null;
  return (
    <div>
      <p className="label m-0 text-snow">Everyone&apos;s story</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {room.players.map((p, i) => (
          <div key={p.id} className="panel px-3 py-2.5" style={{ borderLeft: `3px solid ${ringOf(i)}` }}>
            <span className="block truncate text-[14px] font-semibold leading-tight">
              {first(p.name)}
              {p.id === room.you?.id ? " (you)" : ""}
            </span>
            <span className="block truncate text-[12px] text-mist">{p.caseRole ?? (p.isBot ? "AI bot" : "Suspect")}</span>
            {p.alibi && <span className="mt-1 line-clamp-3 block text-[12px] leading-snug text-fog">“{p.alibi}”</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- briefing: hold to reveal your secret role ---------------- */

function RoleCard({ card, compact = false }: { card: PlayerCard; compact?: boolean }) {
  const culprit = card.role === "culprit";
  const color = culprit ? "#F0385A" : "#5FDDF7";
  const [head, ...rest] = card.mission.split(". ");
  return (
    <div
      className="rounded-[14px] p-3.5"
      style={{
        background: culprit ? "linear-gradient(180deg, rgba(240,56,90,.24), rgba(40,10,22,.88))" : "linear-gradient(180deg, rgba(95,221,247,.2), rgba(8,22,38,.88))",
        boxShadow: `inset 0 0 0 1.5px ${color}, 0 0 26px ${color}33`,
      }}
    >
      <p className="display m-0 uppercase" style={{ color, fontSize: compact ? 20 : "clamp(26px,8.5vw,34px)" }}>
        {head.replace(/\.$/, "")}
      </p>
      <p className="m-0 mt-1 text-[14.5px] leading-snug">{rest.join(". ")}</p>
      <ul className="m-0 mt-3 flex list-none flex-col gap-1.5 p-0">
        {card.clues.map((c, i) => (
          <li key={i} className="rounded-[10px] bg-black/30 px-3 py-2 text-[13.5px] leading-snug">
            <span className="label mr-2" style={{ color }}>
              {culprit ? "Deflect" : "You saw"}
            </span>
            {c}
          </li>
        ))}
      </ul>
      {card.objective && (
        <p className="m-0 mt-2 rounded-[10px] px-3 py-2 text-[13.5px] leading-snug" style={{ boxShadow: "inset 0 0 0 1px rgba(240,56,90,.6)" }}>
          <span className="label mr-2 text-[#ff8098]">Secret objective</span>
          {card.objective}
        </p>
      )}
    </div>
  );
}

export function Briefing({ room, secondsLeft }: Props) {
  const [shown, setShown] = useState(false);
  const [hold, setHold] = useState(0);
  const raf = useRef<number | undefined>(undefined);
  const t0 = useRef(0);
  const card = room.you?.card;

  const begin = () => {
    if (shown) return;
    t0.current = performance.now();
    const step = () => {
      const p = Math.min(1, (performance.now() - t0.current) / 650);
      setHold(p);
      if (p >= 1) {
        setShown(true);
        sfx.clue();
      } else raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  };
  const end = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    if (!shown) setHold(0);
  };
  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  return (
    <main className={`screen ${shown && card?.role === "culprit" ? "alarm" : "cold"}`}>
      <TopBar />
      <div className="mt-1 flex items-center justify-between">
        <span className="eyebrow">{room.case?.title ?? "Case file"}</span>
        <span className="label text-snow">Discussion in {secondsLeft ?? 0}s</span>
      </div>
      <p className="m-0 mt-1.5 text-[14px] leading-snug text-mist">{room.case?.crime}</p>

      {!shown || !card ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <h1 className="display m-0 text-[clamp(28px,9vw,36px)]">
            Tap &amp; Hold
            <br />
            to Reveal
          </h1>
          <button
            type="button"
            aria-label="Press and hold to reveal your secret role"
            onPointerDown={begin}
            onPointerUp={end}
            onPointerLeave={end}
            onPointerCancel={end}
            onContextMenu={(e) => e.preventDefault()}
            className="relative mt-6 h-[clamp(190px,56vw,250px)] w-[clamp(190px,56vw,250px)] touch-none select-none rounded-full border-0 bg-transparent p-0"
            style={{ WebkitTouchCallout: "none" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/art/scanner.png" alt="" draggable={false} className="h-full w-full" style={{ filter: `brightness(${1 + hold * 0.8})`, transform: `scale(${1 - hold * 0.04})` }} />
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
              <circle cx="50" cy="50" r="48" fill="none" stroke="#5FDDF7" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={`${hold * 301.6} 301.6`} />
            </svg>
          </button>
          <p className="m-0 mt-6 text-[15px]">Keep your role private</p>
          <p className="label mt-2">Press and hold the scanner</p>
        </div>
      ) : (
        <div className="rise mt-3 flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto">
            <RoleCard card={card} />
            <Stories room={room} />
          </div>
          <button type="button" className="btn btn-glass tap" onClick={() => { setShown(false); setHold(0); }}>
            Hide my role
          </button>
        </div>
      )}
    </main>
  );
}

/* ---------------- discussion ---------------- */

export function Discuss({ room, actions, secondsLeft }: Props) {
  const [hidden, setHidden] = useState(false);
  const you = room.you;
  const card = you?.card;
  const total = room.phaseTotalSec ?? (room.settings.demo ? 45 : 100);
  const hot = room.hotSeat ?? null;
  const hotLeft = hot ? Math.max(0, Math.ceil((Date.parse(hot.endsAt) - Date.parse(room.serverNow)) / 1000)) : 0;
  const lastHot = useRef<string | null>(null);

  useEffect(() => {
    if (hot && lastHot.current !== hot.question) {
      lastHot.current = hot.question;
      sfx.crack();
    }
  }, [hot]);

  return (
    <main className="screen">
      <TopBar />
      <div className="mt-1">
        <Timer seconds={secondsLeft ?? 0} total={total} label="Discussion" sub="Talk out loud" />
      </div>

      <div className="mt-3 grid shrink-0 gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(4, room.players.length)}, minmax(0, 1fr))` }}>
        {room.players.map((p, i) => {
          const mine = p.id === you?.id;
          const doubted = you?.doubting === p.id;
          return (
            <button
              key={p.id}
              type="button"
              disabled={mine}
              aria-pressed={doubted}
              aria-label={mine ? `${p.name}, you` : `Doubt ${p.name}`}
              onClick={() => {
                sfx.tap();
                void actions.doubt(doubted ? null : p.id).catch(() => {});
              }}
              className="tap flex flex-col items-center gap-1 rounded-[12px] border-0 px-1 pb-2 pt-2.5 text-snow disabled:!opacity-100"
              style={{
                background: "linear-gradient(180deg, rgba(28,40,66,.9), rgba(12,18,34,.92))",
                boxShadow: doubted ? "inset 0 0 0 1.5px #F0385A, 0 0 16px rgba(240,56,90,.3)" : "inset 0 0 0 1px rgba(130,180,230,.22)",
              }}
            >
              <Avatar name={p.name} index={i} size={36} />
              <span className="w-full truncate text-center text-[13px] font-semibold">{first(p.name)}</span>
              <span className="w-[70%]">
                <Meter value={p.doubt ?? 0} color="#F0385A" />
              </span>
              <span className="label !text-[8.5px]">{mine ? "You" : p.isBot ? "Bot" : `Doubt ${p.doubt ?? 0}%`}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto">
        {card && (
          <div style={hidden ? { filter: "blur(14px)", opacity: 0.6 } : undefined} className="transition-[filter,opacity] duration-200">
            <RoleCard card={card} compact />
          </div>
        )}
        {(room.botClues?.length ?? 0) > 0 && (
          <div className="panel p-3">
            <p className="label m-0 text-snow">{room.botClues![0].from} saw · everyone can see this</p>
            {room.botClues!.map((b, i) => (
              <p key={i} className="m-0 mt-1.5 text-[13.5px] leading-snug text-mist">
                {b.text}
              </p>
            ))}
          </div>
        )}
        <div className="panel p-3">
          <p className="eyebrow m-0">Status</p>
          <p className="m-0 mt-1 text-[14px] leading-snug">
            Argue it out. Tap a player above to mark who you doubt. Voting opens when the clock hits zero.
          </p>
        </div>
        <Stories room={room} />
      </div>

      <button type="button" className="btn btn-glass tap mt-3" onClick={() => setHidden((h) => !h)}>
        {hidden ? "Show my card" : "Hide my card"}
      </button>

      {hot && (
        <div className="scrim !justify-center px-6" role="alert" style={{ background: "rgba(40,6,18,.92)" }}>
          <div className="rise text-center">
            <p className="eyebrow m-0" style={{ color: "#ff8098" }}>
              Hot seat · {hotLeft}s
            </p>
            <p className="display m-0 mt-3 text-[clamp(44px,15vw,64px)]">{first(hot.playerName)}</p>
            <p className="m-0 mt-4 text-[19px] leading-snug">{hot.question}</p>
            <p className="label mt-5">Answer out loud. Everyone is watching.</p>
          </div>
        </div>
      )}
    </main>
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
      <p className="m-0 mt-1 text-center text-[14.5px] text-mist">Lock your accusation before time runs out.</p>
      <div className="mt-3">
        <Timer seconds={secondsLeft ?? 0} total={total} label="Voting phase" sub={`${votesIn} / ${room.players.length} votes in`} />
      </div>

      <div className="mt-3 grid min-h-[240px] flex-1 auto-rows-fr grid-cols-2 gap-2.5 overflow-y-auto">
        {room.players.map((p, i) => {
          const mine = p.id === you?.id;
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
              <span className="w-full truncate text-center text-[16px] font-bold leading-tight">{p.name}</span>
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
        {voted ? "Accusation locked" : pick ? `Lock accusation: ${first(room.players.find((p) => p.id === pick)?.name ?? "")}` : "Lock Accusation"}
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
          style={{ background: r.caught ? "#F0385A" : "#4c3d8f", animation: "stampIn 420ms cubic-bezier(.2,1.4,.4,1) both", transformOrigin: "left center" }}
        >
          {r.caught ? "CULPRIT CAUGHT" : "CULPRIT ESCAPED"}
        </span>
        <span className="text-[13.5px] leading-snug text-mist">
          {you ? (youWon ? "You win this round." : "You lose this round.") : r.caught ? "Case closed." : "They got away with it."}
        </span>
      </div>

      <p className="label mt-4 text-snow">Votes received</p>
      <div className="mt-1.5 flex shrink-0 flex-col gap-1.5">
        {tally.map(({ p, i, n }) => (
          <div key={p.id} className="grid grid-cols-[84px_1fr_18px] items-center gap-2.5 text-[13.5px]">
            <span className="truncate font-semibold">{first(p.name)}</span>
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
        <p className="m-0 mt-3 text-[14.5px] leading-snug">{r.story}</p>
        <p className="m-0 mt-2 text-[13.5px] italic leading-snug text-mist">“{r.roast}”</p>
        <p className="label m-0 mt-2">{voice === "loading" ? "Narrator is clearing his throat" : "Narrator · tap to hear the verdict"}</p>
      </div>

      <div className="mt-3">
        <XpCard gained={xp.gained} total={xp.total || readXp()} note={youWon ? "Round won" : "Round lost"} />
      </div>

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
            <span className="blink">Waiting for the host to deal the next case</span>
          </div>
        )}
        <button type="button" className="btn btn-glass tap !text-[15px]" onClick={() => setShare(true)}>
          Share the front page
        </button>
      </div>

      {share && (
        <div className="scrim" role="dialog" aria-label="Share">
          <button type="button" aria-label="Close" className="min-h-10 flex-1 border-0 bg-transparent" onClick={() => setShare(false)} />
          <div className="sheet flex max-h-[90%] flex-col gap-3 overflow-y-auto p-5 pb-[max(20px,env(safe-area-inset-bottom))]">
            <ShareCard
              headline={r.caught ? `${r.culpritName} arrested` : `${r.culpritName} walks free`}
              caseTitle={room.case?.title ?? "Kaun?"}
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
