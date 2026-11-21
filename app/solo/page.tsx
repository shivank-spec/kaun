"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import ShareCard from "@/components/ShareCard";
import { HowTo, countRound } from "@/components/ui/HowTo";
import {
  Avatar,
  Loading,
  Pips,
  TopBar,
  XpCard,
  addXp,
  readXp,
  ringOf,
  sfx,
  unlockSfx,
} from "@/components/ui/kit";
import type {
  AskMode,
  ChatMessage,
  InterrogateResponse,
  MapSpot,
  SoloCaseView,
  SoloVerdict,
} from "@/lib/types";

type Stage = "loading" | "brief" | "play" | "accuse" | "verdict" | "error";
type Sheet = null | "ask" | "confront" | "file" | "share";
interface FoundClue {
  id: string;
  text: string;
  from: string;
}

const COST: Record<AskMode, number> = { ask: 1, press: 2, confront: 1 };
const QUESTIONS = ["Where were you?", "What did you see?", "Who looks guilty to you?", "What are you hiding?"];
const ROOMS = ["Entrance", "Back room", "Side hall", "Main floor"];

async function post<T>(url: string, data: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Something went wrong");
  return json as T;
}

/** Where things sit on the map, as percentages of the map box. */
const roomBox = (r: number) => ({ left: (r % 2) * 50, top: Math.floor(r / 2) * 50 });
const suspectPos = (r: number) => ({ x: roomBox(r).left + 17, y: roomBox(r).top + 31 });
const spotPos = (r: number) => ({ x: roomBox(r).left + 36, y: roomBox(r).top + 19 });

export default function Solo() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("loading");
  const [view, setView] = useState<SoloCaseView | null>(null);
  const [active, setActive] = useState("");
  const [logs, setLogs] = useState<Record<string, ChatMessage[]>>({});
  const [clues, setClues] = useState<FoundClue[]>([]);
  const [seenSpots, setSeenSpots] = useState<string[]>([]);
  const [confronted, setConfronted] = useState<string[]>([]);
  const [cracks, setCracks] = useState(0);
  const [cleared, setCleared] = useState<string[]>([]);
  const [shaken, setShaken] = useState(false);
  const [used, setUsed] = useState(0);
  const [left, setLeft] = useState(150);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState<{ title: string; text: string } | null>(null);
  const [me, setMe] = useState({ x: 50, y: 50 });
  const [pick, setPick] = useState("");
  const [name, setName] = useState("");
  const [verdict, setVerdict] = useState<SoloVerdict | null>(null);
  const [xp, setXp] = useState({ gained: 0, total: 0 });
  const [voice, setVoice] = useState<"idle" | "loading" | "playing">("idle");
  const [listening, setListening] = useState(false);
  const startedAt = useRef(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = useCallback(async () => {
    setStage("loading");
    setLogs({});
    setClues([]);
    setSeenSpots([]);
    setConfronted([]);
    setCracks(0);
    setCleared([]);
    setUsed(0);
    setPick("");
    setVerdict(null);
    setSheet(null);
    setToast(null);
    setVoice("idle");
    audio.current?.pause();
    const q = new URLSearchParams(window.location.search);
    try {
      const seen: string[] = JSON.parse(localStorage.getItem("kaun.seen") || "[]");
      const v = await post<SoloCaseView>("/api/case", {
        setting: q.get("setting") || "Kolkata",
        tone: q.get("tone") || "desi",
        difficulty: q.get("difficulty") || "medium",
        seen,
      });
      localStorage.setItem("kaun.seen", JSON.stringify([...seen, v.title].slice(-60)));
      setView(v);
      setActive(v.suspects[0].id);
      setMe(suspectPos(v.suspects[0].room));
      setLeft(v.durationSec);
      setStage("brief");
    } catch {
      setStage("error");
    }
  }, []);

  useEffect(() => {
    setName(localStorage.getItem("kaun.name") || "");
    load();
  }, [load]);

  // The countdown is measured from a real timestamp so it cannot drift.
  useEffect(() => {
    if (stage !== "play" || !view) return;
    const t = setInterval(() => {
      const remaining = view.durationSec - Math.floor((Date.now() - startedAt.current) / 1000);
      setLeft((prev) => {
        if (remaining !== prev && remaining <= 10 && remaining > 0) sfx.tick(remaining <= 5);
        return remaining;
      });
      if (remaining <= 0) setStage("accuse");
    }, 250);
    return () => clearInterval(t);
  }, [stage, view]);

  function flash(title: string, text: string) {
    clearTimeout(toastTimer.current);
    setToast({ title, text });
    toastTimer.current = setTimeout(() => setToast(null), 3400);
  }

  function goTo(suspectId: string) {
    if (!view) return;
    const s = view.suspects.find((x) => x.id === suspectId)!;
    sfx.tap();
    setActive(suspectId);
    setMe(suspectPos(s.room));
  }

  function inspect(spot: MapSpot) {
    if (seenSpots.includes(spot.id)) return;
    setMe(spotPos(spot.room));
    setSeenSpots((s) => [...s, spot.id]);
    setTimeout(() => {
      sfx.clue();
      if (spot.id !== "scene") {
        setClues((c) => (c.some((k) => k.id === spot.id) ? c : [...c, { id: spot.id, text: spot.text, from: "Found at the scene" }]));
      }
      flash(spot.id === "scene" ? "The scene" : "Evidence found", spot.text);
    }, 420);
  }

  async function act(mode: AskMode, opts: { message?: string; clueId?: string } = {}) {
    if (!view || busy) return;
    if (used + COST[mode] > view.actions) return flash("Out of moves", "Not enough actions left for that. Make your accusation.");
    const suspectId = active;
    const suspect = view.suspects.find((s) => s.id === suspectId)!;
    const clue = clues.find((c) => c.id === opts.clueId);
    const say =
      mode === "press" ? "Stop dodging. Tell me the truth." : mode === "confront" ? `Explain this: ${clue?.text ?? ""}` : (opts.message ?? QUESTIONS[1]);
    const history = logs[suspectId] ?? [];
    setSheet(null);
    setDraft("");
    setBusy(true);
    setUsed((u) => u + COST[mode]);
    setLogs((l) => ({ ...l, [suspectId]: [...history, { from: "you", text: say }] }));
    try {
      const r = await post<InterrogateResponse>("/api/interrogate", {
        caseId: view.caseId,
        suspectId,
        message: say,
        history,
        foundClueIds: clues.map((c) => c.id),
        mode,
        clueId: opts.clueId,
      });
      setLogs((l) => ({ ...l, [suspectId]: [...(l[suspectId] ?? []), { from: "suspect", text: r.reply }] }));
      if (r.unlockedClue && !clues.some((c) => c.id === r.unlockedClue!.id)) {
        const found = r.unlockedClue;
        setClues((c) => [...c, { ...found, from: `${suspect.name} told you` }]);
        sfx.clue();
        flash("New clue", found.text);
      }
      if (r.contradiction && opts.clueId && !confronted.includes(opts.clueId)) {
        setConfronted((c) => [...c, opts.clueId!]);
        setCracks((n) => Math.min(2, n + 1));
        setShaken(true);
        setTimeout(() => setShaken(false), 450);
        sfx.crack();
        flash("Contradiction", `${suspect.name.split(" ")[0]}'s story just cracked.`);
      } else if (r.cleared) {
        setCleared((c) => (c.includes(suspectId) ? c : [...c, suspectId]));
      } else if (mode === "confront") {
        sfx.deny();
      }
    } catch {
      setLogs((l) => ({
        ...l,
        [suspectId]: [...(l[suspectId] ?? []), { from: "suspect", text: "(The line went dead. Try again.)" }],
      }));
      setUsed((u) => Math.max(0, u - COST[mode]));
    } finally {
      setBusy(false);
    }
  }

  // Speak a question instead of typing it (Chrome and Safari).
  function listen() {
    type Rec = {
      lang: string;
      interimResults: boolean;
      onresult: (e: { results: { 0: { transcript: string } }[] }) => void;
      onend: () => void;
      onerror: () => void;
      start: () => void;
    };
    const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor || listening) return;
    const rec = new Ctor();
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.onresult = (e) => act("ask", { message: e.results[0][0].transcript });
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    setListening(true);
    rec.start();
  }

  async function lockIn() {
    if (!view || !pick || busy) return;
    setBusy(true);
    try {
      const v = await post<SoloVerdict>("/api/accuse", {
        caseId: view.caseId,
        suspectId: pick,
        foundClueIds: clues.map((c) => c.id),
        confrontedClueIds: confronted,
        secondsUsed: Math.floor((Date.now() - startedAt.current) / 1000),
        name,
      });
      if (name.trim()) localStorage.setItem("kaun.name", name.trim());
      const gained = Math.round(v.score / 4) + 40;
      setXp({ gained, total: addXp(gained) });
      setVerdict(v);
      countRound();
      setStage("verdict");
      if (v.correct) sfx.win();
      else sfx.sting();
    } catch {
      flash("No signal", "Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function narrate(text: string) {
    if (voice === "playing") {
      audio.current?.pause();
      window.speechSynthesis?.cancel();
      return setVoice("idle");
    }
    setVoice("loading");
    try {
      const q = new URLSearchParams(window.location.search);
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, tone: q.get("tone") || "desi" }),
      });
      if (!res.ok) throw new Error("no voice");
      const el = new Audio(URL.createObjectURL(await res.blob()));
      audio.current = el;
      el.onended = () => setVoice("idle");
      await el.play();
      setVoice("playing");
    } catch {
      // Fall back to the phone's own voice.
      if (!window.speechSynthesis) return setVoice("idle");
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-IN";
      u.rate = 0.95;
      u.onend = () => setVoice("idle");
      window.speechSynthesis.speak(u);
      setVoice("playing");
    }
  }

  /* ---------------- screens ---------------- */

  if (stage === "loading") return <Loading />;

  if (stage === "error" || !view) {
    return (
      <main className="screen alarm items-center justify-center gap-5 text-center">
        <p className="eyebrow" style={{ color: "#ff8098" }}>Signal lost</p>
        <p className="display m-0 text-[32px]">The detective lost signal.</p>
        <button type="button" className="btn btn-primary tap" onClick={load}>
          Try again
        </button>
        <Link href="/" className="label underline">
          Back to home
        </Link>
      </main>
    );
  }

  const fileNo = String((view.title.length * 7) % 89 + 10).padStart(2, "0");

  if (stage === "brief") {
    return (
      <main key="brief" className="screen cold" onPointerDown={unlockSfx}>
        <TopBar onBack={() => router.push("/")} />
        {/router|wi-?fi|hackathon|server|techno/i.test(`${view.title} ${view.crime} ${view.setting}`) ? (
          <div
            className="mt-2 h-[clamp(96px,17vh,150px)] shrink-0 rounded-[14px] bg-cover bg-center"
            style={{ backgroundImage: "linear-gradient(180deg, transparent 45%, rgba(6,10,20,.7)), url(/art/briefing.jpg)", boxShadow: "inset 0 0 0 1px rgba(130,180,230,.22)" }}
            aria-hidden="true"
          />
        ) : (
          <div className="panel relative mt-2 flex h-[clamp(84px,14vh,120px)] shrink-0 items-end justify-between overflow-hidden p-3.5" aria-hidden="true">
            <span className="display absolute -right-1 -top-5 text-[120px] leading-none text-white/[0.06]">{fileNo}</span>
            <span className="label text-snow">Scene of the crime</span>
            <span className="label max-w-[60%] truncate text-right text-cyan">{view.setting}</span>
            <span className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, #5FDDF7, transparent)", animation: "sweep 3.2s linear infinite" }} />
          </div>
        )}
        <p className="eyebrow mt-4">Case file {fileNo}</p>
        <h1 className="display m-0 mt-1 text-[clamp(24px,7.4vw,30px)] uppercase">{view.title}</h1>
        {view.facts ? (
          <div className="panel mt-2.5 px-3.5 py-1">
            {(
              [
                ["What", view.facts.what],
                ["When", view.facts.when],
                ["Where", view.facts.where],
              ] as const
            ).map(([k, val]) => (
              <div key={k} className="flex gap-3 border-t border-white/5 py-2 first:border-0">
                <span className="label w-12 shrink-0 pt-0.5 text-cyan">{k}</span>
                <span className="text-[14px] leading-snug">{val}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="m-0 mt-2 text-[15px] leading-snug text-[#E3E8F2]">{view.crime}</p>
        )}

        <p className="label mt-4 text-snow">Suspects · one is lying</p>
        <div className="mt-2 grid min-h-[190px] flex-1 auto-rows-fr grid-cols-2 gap-2.5">
          {view.suspects.map((s, i) => (
            <div
              key={s.id}
              className="panel rise flex flex-col justify-center gap-0.5 px-3.5 py-3"
              style={{ borderLeft: `3px solid ${ringOf(i)}`, animationDelay: `${i * 70}ms` }}
            >
              <span className="text-[15px] font-semibold leading-tight">{s.name}</span>
              <span className="text-[12.5px] text-mist">{s.role}</span>
              <span className="mt-1.5 line-clamp-3 text-[12.5px] leading-snug text-fog">“{s.public_alibi}”</span>
            </div>
          ))}
        </div>

        <p className="label mb-3 mt-4 text-center">
          {view.difficulty} · {view.actions} moves · {Math.floor(view.durationSec / 60)}:{String(view.durationSec % 60).padStart(2, "0")} on the clock
        </p>
        <button
          type="button"
          className="btn btn-primary tap"
          onClick={() => {
            unlockSfx();
            sfx.tap();
            startedAt.current = Date.now();
            setStage("play");
            flash("How to play", `Tap a glowing spot to search it. Tap a suspect to question them. You have ${view.actions} moves.`);
          }}
        >
          Begin Investigation
          <Arrow />
        </button>
        <HowTo mode="solo" />
      </main>
    );
  }

  if (stage === "play") {
    const suspect = view.suspects.find((s) => s.id === active)!;
    const idx = view.suspects.findIndex((s) => s.id === active);
    const log = logs[active] ?? [];
    const last = [...log].reverse().find((m) => m.from === "suspect");
    const asked = [...log].reverse().find((m) => m.from === "you");
    const movesLeft = view.actions - used;
    return (
      <main key="play" className="screen" onPointerDown={unlockSfx}>
        <TopBar onBack={() => router.push("/")} />

        <div className="mt-1 flex shrink-0 items-end justify-between">
          <span className={`mono text-[clamp(32px,10vw,40px)] font-medium leading-none ${left <= 20 ? "urgent" : ""}`}>
            {String(Math.floor(Math.max(0, left) / 60)).padStart(2, "0")}:{String(Math.max(0, left) % 60).padStart(2, "0")}
          </span>
          <span className="flex flex-col items-end gap-1.5 pb-0.5">
            <span className="label text-snow">
              Actions: {movesLeft} / {view.actions}
            </span>
            <Pips total={view.actions} used={used} />
          </span>
        </div>
        <div className="mt-2 h-[3px] shrink-0 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full transition-[width] duration-300 ease-linear"
            style={{ width: `${Math.max(0, (left / view.durationSec) * 100)}%`, background: left <= 20 ? "#F0385A" : "#F4F6FA" }}
          />
        </div>

        <div className="mt-3 grid shrink-0 grid-cols-4 gap-2">
          {view.suspects.map((s, i) => {
            const on = s.id === active;
            const state = cleared.includes(s.id) ? "Cleared" : (logs[s.id]?.length ?? 0) > 0 ? "Questioned" : "Not yet";
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => goTo(s.id)}
                aria-pressed={on}
                className="tap flex flex-col items-center gap-1 rounded-[12px] border-0 px-1 pb-2 pt-2.5 text-snow"
                style={{
                  background: "linear-gradient(180deg, rgba(28,40,66,.9), rgba(12,18,34,.92))",
                  boxShadow: on ? "inset 0 0 0 1.5px #5FDDF7, 0 0 16px rgba(95,221,247,.25)" : "inset 0 0 0 1px rgba(130,180,230,.22)",
                }}
              >
                <Avatar name={s.name} index={i} size={36} dim={cleared.includes(s.id)} />
                <span className="w-full truncate text-center text-[13px] font-semibold">{s.name.split(" ")[0]}</span>
                <span className="label !text-[8.5px]" style={{ color: cleared.includes(s.id) ? "#B6F36A" : undefined }}>
                  {state}
                </span>
              </button>
            );
          })}
        </div>

        {/* The map: tap a suspect or a glowing spot and you walk there. */}
        <div className="relative mt-3 min-h-[150px] flex-1 overflow-hidden rounded-[14px]" style={{ background: "rgba(8,13,26,.72)", boxShadow: "inset 0 0 0 1px rgba(130,180,230,.18)" }}>
          {ROOMS.map((label, r) => (
            <div
              key={label}
              className="absolute rounded-[10px]"
              style={{
                left: `calc(${roomBox(r).left}% + 5px)`,
                top: `calc(${roomBox(r).top}% + 5px)`,
                width: "calc(50% - 10px)",
                height: "calc(50% - 10px)",
                background: "linear-gradient(180deg, rgba(30,42,70,.55), rgba(14,20,38,.6))",
                boxShadow: "inset 0 0 0 1px rgba(130,180,230,.16)",
              }}
            >
              <span className="label absolute left-2 top-1.5 !text-[8.5px] !text-slate">{label}</span>
            </div>
          ))}
          {view.suspects.map((s, i) => {
            const p = suspectPos(s.room);
            return (
              <button
                key={s.id}
                type="button"
                aria-label={`Walk to ${s.name}`}
                onClick={() => goTo(s.id)}
                className="tap absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-0 text-[11px] font-bold text-snow"
                style={{ left: `${p.x + 22}%`, top: `${p.y + 12}%`, background: "#101a30", boxShadow: `inset 0 0 0 1.5px ${ringOf(i)}` }}
              >
                {s.name[0]}
              </button>
            );
          })}
          {view.spots.map((spot) => {
            const p = spotPos(spot.room);
            const done = seenSpots.includes(spot.id);
            return (
              <button
                key={spot.id}
                type="button"
                aria-label={done ? `${spot.label}, inspected` : `Inspect ${spot.label}`}
                onClick={() => inspect(spot)}
                className="tap absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-0 bg-transparent"
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
              >
                {!done && <span className="absolute h-4 w-4 rounded-full" style={{ boxShadow: "0 0 0 1.5px #5FDDF7", animation: "ping 1.6s ease-out infinite" }} />}
                <span
                  className="h-3.5 w-3.5 rounded-full"
                  style={done ? { boxShadow: "inset 0 0 0 1.5px rgba(174,182,200,.45)" } : { background: "#5FDDF7", boxShadow: "0 0 12px #5FDDF7" }}
                />
              </button>
            );
          })}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
            style={{ left: `${me.x}%`, top: `${me.y}%`, boxShadow: "0 0 0 4px rgba(255,255,255,.18), 0 0 18px #fff", transition: "left 420ms cubic-bezier(.3,1.1,.4,1), top 420ms cubic-bezier(.3,1.1,.4,1)" }}
          />
        </div>

        <div className={`panel mt-3 shrink-0 p-3.5 ${shaken ? "shake" : ""}`}>
          <div className="flex items-start justify-between gap-3">
            <span className="label text-snow">
              Questioning {suspect.name.split(" ")[0]} · {suspect.role}
            </span>
            <span className="label shrink-0 text-right" style={{ color: cracks ? "#ff8098" : undefined }}>
              Contradictions {cracks} / 2
            </span>
          </div>
          <div className="mt-2.5 flex min-h-[64px] gap-2.5">
            <Avatar name={suspect.name} index={idx} size={32} />
            <div className="min-w-0 flex-1">
              {busy ? (
                <p className="blink m-0 text-[14px] text-mist">{suspect.name.split(" ")[0]} is thinking</p>
              ) : last ? (
                <>
                  {asked && <p className="label m-0 mb-1 normal-case tracking-normal !text-[11px]">You: {asked.text.slice(0, 70)}</p>}
                  <p key={last.text} className="rise m-0 text-[14.5px] leading-snug">
                    {last.text}
                  </p>
                </>
              ) : (
                <p className="m-0 text-[14px] leading-snug text-mist">
                  “{suspect.public_alibi}” Ask, press, then confront them with evidence.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 grid shrink-0 grid-cols-3 gap-2">
          <Action title="Ask" sub="1 action" disabled={busy || movesLeft < 1} onClick={() => setSheet("ask")} />
          <Action title="Press" sub="2 actions" disabled={busy || movesLeft < 2} onClick={() => act("press")} />
          <Action
            title="Confront"
            sub={clues.length ? "1 action" : "Needs a clue"}
            disabled={busy || movesLeft < 1 || clues.length === 0}
            onClick={() => setSheet("confront")}
          />
        </div>
        <div className="mt-2 grid shrink-0 grid-cols-[1fr_1.4fr] gap-2">
          <button type="button" className="btn btn-glass tap !min-h-[50px] !text-[15px]" onClick={() => setSheet("file")}>
            Case file · {clues.length}
          </button>
          <button type="button" className="btn btn-danger tap !min-h-[50px] !text-[15px]" onClick={() => { setToast(null); setStage("accuse"); }}>
            Accuse
            <Arrow />
          </button>
        </div>

        {toast && (
          <div className="panel rise pointer-events-none absolute inset-x-4 top-[68px] z-20 p-3.5" style={{ boxShadow: "inset 0 0 0 1.5px #5FDDF7, 0 12px 40px rgba(0,0,0,.6)" }}>
            <p className="eyebrow m-0">{toast.title}</p>
            <p className="m-0 mt-1 text-[14.5px] leading-snug">{toast.text}</p>
          </div>
        )}

        {sheet === "ask" && (
          <div className="scrim" role="dialog" aria-label="Ask a question">
            <button type="button" aria-label="Close" className="flex-1 border-0 bg-transparent" onClick={() => setSheet(null)} />
            <div className="sheet flex flex-col gap-3 p-5 pb-[max(20px,env(safe-area-inset-bottom))]">
              <span className="display text-[22px]">Ask {suspect.name.split(" ")[0]}</span>
              <div className="grid grid-cols-2 gap-2">
                {QUESTIONS.map((q) => (
                  <button key={q} type="button" className="chip tap !min-h-12 !text-[13.5px]" onClick={() => act("ask", { message: q })}>
                    {q}
                  </button>
                ))}
              </div>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (draft.trim()) act("ask", { message: draft });
                }}
              >
                <input className="field" placeholder="Or ask your own question" value={draft} onChange={(e) => setDraft(e.target.value)} />
                <button type="button" aria-label="Ask by voice" onClick={listen} className="btn btn-glass tap !w-14 shrink-0 !min-h-[52px]" style={listening ? { boxShadow: "inset 0 0 0 1.5px #F0385A" } : undefined}>
                  <Mic />
                </button>
              </form>
              <button type="button" className="btn btn-primary tap" disabled={!draft.trim()} onClick={() => act("ask", { message: draft })}>
                Ask · 1 action
              </button>
            </div>
          </div>
        )}

        {sheet === "confront" && (
          <div className="scrim" role="dialog" aria-label="Confront with evidence">
            <button type="button" aria-label="Close" className="flex-1 border-0 bg-transparent" onClick={() => setSheet(null)} />
            <div className="sheet flex max-h-[78%] flex-col gap-3 p-5 pb-[max(20px,env(safe-area-inset-bottom))]">
              <span className="display text-[22px]">Confront {suspect.name.split(" ")[0]} with</span>
              <div className="flex flex-col gap-2 overflow-y-auto">
                {clues.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="panel tap border-0 p-3 text-left text-snow"
                    onClick={() => act("confront", { clueId: c.id })}
                  >
                    <span className="block text-[14px] leading-snug">{c.text}</span>
                    <span className="label mt-1 block">{c.from}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {sheet === "file" && (
          <div className="scrim" role="dialog" aria-label="Case file">
            <button type="button" aria-label="Close" className="flex-1 border-0 bg-transparent" onClick={() => setSheet(null)} />
            <div className="sheet flex max-h-[82%] flex-col gap-3 p-5 pb-[max(20px,env(safe-area-inset-bottom))]">
              <div>
                <span className="eyebrow">Case file {fileNo}</span>
                <p className="display m-0 mt-1 text-[22px]">{view.title}</p>
              </div>
              <div className="flex flex-col gap-2 overflow-y-auto">
                {clues.length === 0 && <p className="m-0 text-mist">No clues yet. Question the suspects and inspect the glowing spots.</p>}
                {clues.map((c) => (
                  <div key={c.id} className="panel p-3">
                    <span className="block text-[14px] leading-snug">{c.text}</span>
                    <span className="label mt-1 block">{c.from}</span>
                  </div>
                ))}
                <p className="label m-0 mt-1 normal-case tracking-normal">Not every clue points at the real culprit.</p>
              </div>
              <button type="button" className="btn btn-glass tap" onClick={() => setSheet(null)}>
                Back to the floor
              </button>
            </div>
          </div>
        )}
      </main>
    );
  }

  if (stage === "accuse") {
    const timeUp = left <= 0;
    return (
      <main key="accuse" className="screen warm" onPointerDown={unlockSfx}>
        <TopBar onBack={timeUp ? undefined : () => setStage("play")} />
        <h1 className="display m-0 mt-2 text-center text-[clamp(26px,8vw,32px)] uppercase">Who did it?</h1>
        <p className="m-0 mt-1 text-center text-[14.5px] text-mist">
          {timeUp ? "Time is up. Tap the one you think did it." : "Tap the one you think did it. You only get one guess."}
        </p>
        <div className="mt-4 grid min-h-[260px] flex-1 auto-rows-fr grid-cols-2 gap-2.5">
          {view.suspects.map((s, i) => {
            const on = pick === s.id;
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  sfx.tap();
                  setPick(s.id);
                }}
                className="tap flex flex-col items-center justify-center gap-1.5 rounded-[14px] border-0 px-2 py-4 text-snow"
                style={{
                  background: on ? "linear-gradient(180deg, rgba(240,56,90,.28), rgba(40,10,22,.9))" : "linear-gradient(180deg, rgba(28,40,66,.86), rgba(12,18,34,.9))",
                  boxShadow: on ? "inset 0 0 0 1.5px #F0385A, 0 0 22px rgba(240,56,90,.3)" : "inset 0 0 0 1px rgba(130,180,230,.22)",
                }}
              >
                <Avatar name={s.name} index={i} size={58} />
                <span className="mt-1 text-center text-[16px] font-bold leading-tight">{s.name}</span>
                <span className="label">{s.role}</span>
                <span className="label mt-1" style={{ color: cleared.includes(s.id) ? "#B6F36A" : undefined }}>
                  {cleared.includes(s.id) ? "Explained themselves" : (logs[s.id]?.length ?? 0) > 0 ? "Questioned" : "Never questioned"}
                </span>
              </button>
            );
          })}
        </div>
        <input
          className="field mt-3 shrink-0"
          placeholder="Your name for the leaderboard (optional)"
          value={name}
          maxLength={16}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="button" className="btn btn-danger tap mt-3" disabled={!pick || busy} onClick={lockIn}>
          {busy ? "Checking" : pick ? `Accuse ${view.suspects.find((s) => s.id === pick)!.name.split(" ")[0]}` : "Tap a suspect to accuse"}
        </button>
        {toast && (
          <div className="panel rise pointer-events-none absolute inset-x-4 top-20 z-20 p-3.5">
            <p className="eyebrow m-0">{toast.title}</p>
            <p className="m-0 mt-1 text-[14.5px]">{toast.text}</p>
          </div>
        )}
      </main>
    );
  }

  // verdict
  const v = verdict!;
  const culpritIdx = view.suspects.findIndex((s) => s.id === v.culpritId);
  const accusedName = view.suspects.find((s) => s.id === pick)?.name ?? "";
  return (
    <main key="verdict" className={`screen ${v.correct ? "cold" : "alarm"}`} onPointerDown={unlockSfx}>
      <TopBar onBack={() => router.push("/")} />
      <p className="eyebrow mt-2" style={{ color: v.correct ? "#5FDDF7" : "#ff8098" }}>
        Case file {fileNo} · {v.correct ? "You cracked it" : `You accused ${accusedName.split(" ")[0]}`}
      </p>
      <div className="mt-2 flex items-center gap-3">
        <Avatar name={v.culpritName} index={culpritIdx} size={56} />
        <h1 className="display m-0 min-w-0 flex-1 text-[clamp(30px,9.5vw,42px)]">{v.culpritName}</h1>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span
          className="flex shrink-0 items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[13px] font-bold tracking-[0.06em] text-white"
          style={{ background: v.correct ? "#F0385A" : "#2a3350", animation: "riseIn 380ms ease-out both" }}
        >
          {v.correct ? "CULPRIT CAUGHT" : "CULPRIT ESCAPED"}
        </span>
        <span className="text-[13.5px] leading-snug text-mist">{v.correct ? "Case closed." : "The real culprit got away."}</span>
      </div>

      <div className="panel mt-4 p-3.5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={voice === "playing" ? "Stop narration" : "Play narration"}
            onClick={() => narrate(`${v.story} ${v.roast}`)}
            className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-0 bg-white text-ink"
          >
            {voice === "playing" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z" /></svg>
            )}
          </button>
          <span className="flex h-8 flex-1 items-center gap-[3px]" aria-hidden="true">
            {Array.from({ length: 34 }, (_, i) => (
              <span
                key={i}
                className="w-[3px] rounded-full bg-white/45"
                style={{
                  height: `${28 + ((i * 37) % 60)}%`,
                  animation: voice === "playing" ? `wave ${0.6 + (i % 5) * 0.12}s ease-in-out ${i * 0.03}s infinite` : undefined,
                }}
              />
            ))}
          </span>
        </div>
        <p className="m-0 mt-3 text-[14.5px] leading-snug">{v.story}</p>
        <p className="m-0 mt-2 text-[13.5px] italic leading-snug text-mist">“{v.roast}”</p>
        <p className="label m-0 mt-2">
          {voice === "loading" ? "Narrator is clearing his throat" : voice === "playing" ? "Narrator" : "Narrator · tap to hear the verdict"}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          ["Score", String(v.score)],
          ["Clues", `${v.cluesFound}/3`],
          ["Cracks", `${v.contradictions}/2`],
        ].map(([k, val]) => (
          <div key={k} className="panel py-2.5 text-center">
            <p className="mono m-0 text-[20px] font-medium">{val}</p>
            <p className="label m-0">{k}</p>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <XpCard gained={xp.gained} total={xp.total || readXp()} note={v.correct ? "Solved" : "Unsolved"} />
      </div>

      {v.leaderboard && v.leaderboard.top.length > 0 && (
        <div className="panel mt-3 p-3.5">
          <p className="label m-0 text-snow">Today&apos;s top detectives · {v.leaderboard.solvedToday} solved</p>
          <ol className="m-0 mt-2 list-none p-0">
            {v.leaderboard.top.slice(0, 5).map((r, i) => (
              <li key={i} className="flex items-baseline justify-between border-t border-white/5 py-1.5 text-[14px] first:border-0">
                <span>
                  <span className="mono mr-2.5 text-slate">{i + 1}</span>
                  {r.name}
                </span>
                <span className="mono text-cyan">{r.score}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-auto flex shrink-0 flex-col gap-2.5 pt-4">
        <button type="button" className="btn btn-primary tap" onClick={load}>
          New case
          <Arrow />
        </button>
        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" className="btn btn-glass tap !text-[15px]" onClick={() => setSheet("share")}>
            Share result
          </button>
          <Link href="/" className="btn btn-glass tap !text-[15px]">
            Play with friends
          </Link>
        </div>
      </div>

      {sheet === "share" && (
        <div className="scrim" role="dialog" aria-label="Share your result">
          <button type="button" aria-label="Close" className="min-h-10 flex-1 border-0 bg-transparent" onClick={() => setSheet(null)} />
          <div className="sheet flex max-h-[90%] flex-col gap-3 overflow-y-auto p-5 pb-[max(20px,env(safe-area-inset-bottom))]">
            <ShareCard
              headline={v.correct ? `${v.culpritName} caught red-handed` : `${v.culpritName} walks free`}
              caseTitle={view.title}
              roast={v.roast}
              caught={v.correct}
              votes={[{ voterName: name.trim() || "The detective", targetName: accusedName || "nobody" }]}
            />
            <button type="button" className="btn btn-glass tap" onClick={() => setSheet(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function Action({ title, sub, disabled, onClick }: { title: string; sub: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        sfx.tap();
        onClick();
      }}
      className="btn btn-glass tap !min-h-[58px] flex-col !gap-0.5"
    >
      <span className="text-[15px] font-bold tracking-[0.04em]">{title.toUpperCase()}</span>
      <span className="label !text-[9px]">{sub}</span>
    </button>
  );
}
function Arrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
function Mic() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.500 6.500 0 0 0 13 0M12 17.500V21" />
    </svg>
  );
}
