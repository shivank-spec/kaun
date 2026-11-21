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
  firstSentence,
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
type Sheet = null | "scene" | "suspect" | "confront" | "file" | "share";
interface FoundClue {
  id: string;
  text: string;
  from: string;
}

const COST: Record<AskMode, number> = { ask: 1, press: 2, confront: 1 };
const QUESTIONS = ["Where were you?", "What did you see?", "Who looks guilty to you?", "What are you hiding?"];

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
  const [crackedIds, setCrackedIds] = useState<string[]>([]);
  const [shaken, setShaken] = useState(false);
  const [used, setUsed] = useState(0);
  const [left, setLeft] = useState(150);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState<{ title: string; text: string } | null>(null);
  const [pick, setPick] = useState("");
  const [name, setName] = useState("");
  const [verdict, setVerdict] = useState<SoloVerdict | null>(null);
  const [xp, setXp] = useState({ gained: 0, total: 0 });
  const [voice, setVoice] = useState<"idle" | "loading" | "playing">("idle");
  const [listening, setListening] = useState(false);
  const [full, setFull] = useState(false);
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
    setCrackedIds([]);
    setUsed(0);
    setPick("");
    setVerdict(null);
    setFull(false);
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

  function inspect(spot: MapSpot) {
    if (seenSpots.includes(spot.id)) return;
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
        setCrackedIds((c) => (c.includes(suspectId) ? c : [...c, suspectId]));
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
        {/* The case scrolls if it is long; the button below always stays in view. */}
        <div className="min-h-0 flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        <p className="eyebrow mt-2">Case file {fileNo}</p>
        <h1 className="display m-0 mt-1 text-[clamp(24px,7.4vw,30px)] uppercase">{view.title}</h1>
        <p className="m-0 mt-2 text-[15.5px] leading-snug text-[#E3E8F2]">{view.intro}</p>
        {view.facts && (
          <div className="panel mt-3 px-3.5 py-1">
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
        )}
        <div className="mt-3 rounded-[12px] px-3.5 py-2.5" style={{ background: "rgba(95,221,247,.1)", boxShadow: "inset 0 0 0 1px rgba(95,221,247,.45)" }}>
          <p className="label m-0 text-cyan">Your job</p>
          <p className="m-0 mt-0.5 text-[15px] font-semibold leading-snug">{view.goal} Four people were there. One of them is lying to you.</p>
        </div>

        <p className="label mt-4 text-snow">The four suspects and what they claim</p>
        <div className="mt-2 grid grid-cols-2 gap-2.5 pb-1">
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

        </div>
        <p className="label mb-2.5 mt-3 text-center">
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
    const movesLeft = view.actions - used;
    const spotsLeft = view.spots.filter((x) => !seenSpots.includes(x.id)).length;
    const suspect = view.suspects.find((x) => x.id === active)!;
    const idx = view.suspects.findIndex((x) => x.id === active);
    const log = logs[active] ?? [];
    const statusOf = (id: string) =>
      crackedIds.includes(id)
        ? { text: "Story cracked", color: "#F0385A" }
        : cleared.includes(id)
          ? { text: "Cleared", color: "#B6F36A" }
          : (logs[id]?.length ?? 0) > 0
            ? { text: "Questioned", color: "#AEB6C8" }
            : { text: "Tap to question", color: "#5FDDF7" };
    // One line that always says what to do next.
    const guide =
      cracks >= 1
        ? "Someone's story just cracked. If you're sure, accuse them."
        : spotsLeft === view.spots.length && used === 0
          ? "Start by searching the scene. Then tap a suspect to question them."
          : clues.length > 0 && confronted.length === 0 && used > 0
            ? "You have evidence. Open a suspect and show it to them."
            : movesLeft <= 1
              ? "Almost out of moves. Time to accuse someone."
              : "Question each suspect. The liar's story won't hold up.";

    return (
      <main key="play" className="screen" onPointerDown={unlockSfx}>
        <TopBar onBack={() => router.push("/")} />

        <div className="mt-1 flex shrink-0 items-end justify-between">
          <span className={`mono text-[clamp(32px,10vw,40px)] font-medium leading-none ${left <= 20 ? "urgent" : ""}`}>
            {String(Math.floor(Math.max(0, left) / 60)).padStart(2, "0")}:{String(Math.max(0, left) % 60).padStart(2, "0")}
          </span>
          <span className="flex flex-col items-end gap-1.5 pb-0.5">
            <span className="label text-snow">
              {movesLeft} {movesLeft === 1 ? "move" : "moves"} left
            </span>
            <Pips total={view.actions} used={used} />
          </span>
        </div>
        <div className="mt-2 h-[3px] shrink-0 overflow-hidden rounded-full bg-white/10">
          <div className="h-full transition-[width] duration-300 ease-linear" style={{ width: `${Math.max(0, (left / view.durationSec) * 100)}%`, background: left <= 20 ? "#F0385A" : "#F4F6FA" }} />
        </div>

        <div className="mt-3 shrink-0 rounded-[12px] px-3.5 py-2.5" style={{ background: "rgba(95,221,247,.1)", boxShadow: "inset 0 0 0 1px rgba(95,221,247,.45)" }}>
          <p className="label m-0 text-cyan">What to do</p>
          <p key={guide} className="rise m-0 mt-0.5 text-[15px] font-medium leading-snug">{guide}</p>
        </div>

        <div className="mt-3 grid min-h-[280px] flex-1 auto-rows-fr grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => {
              sfx.tap();
              setSheet("scene");
            }}
            className="tap col-span-2 flex items-center justify-between gap-3 rounded-[16px] border-0 px-4 py-3 text-left text-snow"
            style={{ background: "linear-gradient(180deg, rgba(28,40,66,.9), rgba(12,18,34,.94))", boxShadow: "inset 0 0 0 1px rgba(130,180,230,.22), inset 0 3px 0 #B6F36A" }}
          >
            <span>
              <span className="block text-[16px] font-bold leading-tight">Search the scene</span>
              <span className="label mt-1 block">{spotsLeft ? `${spotsLeft} things to find · free` : "Everything found"}</span>
            </span>
            <span className="mono text-[22px] text-lime">{view.spots.length - spotsLeft}/{view.spots.length}</span>
          </button>
          {view.suspects.map((x, i) => {
            const st = statusOf(x.id);
            return (
              <button
                key={x.id}
                type="button"
                onClick={() => {
                  sfx.tap();
                  setActive(x.id);
                  setSheet("suspect");
                }}
                className="tap flex flex-col items-center justify-center gap-1 rounded-[16px] border-0 px-2 py-3 text-center text-snow"
                style={{ background: "linear-gradient(180deg, rgba(28,40,66,.9), rgba(12,18,34,.94))", boxShadow: `inset 0 0 0 1px rgba(130,180,230,.22), inset 0 3px 0 ${ringOf(i)}` }}
              >
                <Avatar name={x.name} index={i} size={42} dim={cleared.includes(x.id)} />
                <span className="w-full truncate text-[15px] font-bold leading-tight">{x.name}</span>
                <span className="line-clamp-1 w-full text-[12px] text-mist">{x.role}</span>
                <span className="label !text-[9px]" style={{ color: st.color }}>
                  {st.text}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 grid shrink-0 grid-cols-[1fr_1.4fr] gap-2">
          <button type="button" className="btn btn-glass tap !min-h-[54px] !text-[15px]" onClick={() => setSheet("file")}>
            My clues · {clues.length}
          </button>
          <button type="button" className="btn btn-danger tap !min-h-[54px] !text-[15px]" onClick={() => { setToast(null); setStage("accuse"); }}>
            I know who did it
            <Arrow />
          </button>
        </div>

        {toast && (
          <div className="panel rise pointer-events-none absolute inset-x-4 top-[68px] z-40 p-3.5" style={{ boxShadow: "inset 0 0 0 1.5px #5FDDF7, 0 12px 40px rgba(0,0,0,.6)" }}>
            <p className="eyebrow m-0">{toast.title}</p>
            <p className="m-0 mt-1 text-[14.5px] leading-snug">{toast.text}</p>
          </div>
        )}

        {/* Searching the scene: three things to turn over. */}
        {sheet === "scene" && (
          <div className="scrim !justify-center px-5" role="dialog" aria-label="The scene">
            <button type="button" aria-label="Close" className="absolute inset-0 border-0 bg-transparent" onClick={() => setSheet(null)} />
            <div className="rise relative flex max-h-[86%] flex-col gap-3 overflow-y-auto">
              <div className="panel p-5">
                <p className="eyebrow m-0" style={{ color: "#B6F36A" }}>The scene</p>
                <p className="m-0 mt-1 text-[14px] text-mist">Tap each one to look closer. Searching is free.</p>
                <div className="mt-3 flex flex-col gap-2">
                  {view.spots.map((spot, i) => {
                    const done = seenSpots.includes(spot.id);
                    return done ? (
                      <div key={spot.id} className="rise rounded-[12px] bg-black/30 px-3.5 py-2.5">
                        <p className="label m-0" style={{ color: "#B6F36A" }}>{spot.id === "scene" ? "What happened here" : "Evidence"}</p>
                        <p className="m-0 mt-1 text-[15px] leading-snug">{spot.text}</p>
                      </div>
                    ) : (
                      <button key={spot.id} type="button" className="chip tap !min-h-[52px] text-left" onClick={() => inspect(spot)}>
                        {spot.id === "scene" ? "Look around the room" : `Something odd, no. ${i}`} · tap to inspect
                      </button>
                    );
                  })}
                </div>
              </div>
              <button type="button" className="btn btn-primary tap" onClick={() => setSheet(null)}>
                Back to the suspects
              </button>
            </div>
          </div>
        )}

        {/* Questioning one suspect. */}
        {sheet === "suspect" && (
          <div className="scrim !justify-center px-5" role="dialog" aria-label={`Questioning ${suspect.name}`}>
            <button type="button" aria-label="Close" className="absolute inset-0 border-0 bg-transparent" onClick={() => setSheet(null)} />
            <div className="rise relative flex max-h-[90%] flex-col gap-3 overflow-y-auto">
              <div className={`panel p-4 ${shaken ? "shake" : ""}`}>
                <div className="flex items-center gap-3">
                  <Avatar name={suspect.name} index={idx} size={48} />
                  <span className="min-w-0">
                    <span className="display block truncate text-[22px]">{suspect.name}</span>
                    <span className="label block text-snow">{suspect.role}</span>
                  </span>
                </div>
                <p className="label m-0 mt-3">Their story</p>
                <p className="m-0 text-[15px] leading-snug">“{suspect.public_alibi}”</p>

                <div className="mt-3 flex flex-col gap-2">
                  {log.slice(-4).map((m, i) => (
                    <p key={i} className={`m-0 rounded-[12px] px-3 py-2 text-[14.5px] leading-snug ${m.from === "you" ? "ml-8 bg-cyan/15 text-right" : "mr-4 bg-black/30"}`}>
                      {m.text}
                    </p>
                  ))}
                  {busy && <p className="blink m-0 text-[14px] text-mist">{suspect.name.split(" ")[0]} is thinking</p>}
                </div>

                <p className="label m-0 mt-4 text-snow">
                  {movesLeft > 0 ? `Ask a question · 1 move each · ${movesLeft} left` : "No moves left"}
                </p>
                <div className="mt-2 grid grid-cols-1 gap-1.5">
                  {QUESTIONS.slice(0, 3).map((q) => (
                    <button key={q} type="button" className="chip tap !min-h-11 !text-[14px]" disabled={busy || movesLeft < 1} onClick={() => act("ask", { message: q })}>
                      {q}
                    </button>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <button type="button" className="btn btn-glass tap !min-h-12 flex-col !gap-0 !text-[14px]" disabled={busy || movesLeft < 2} onClick={() => act("press")}>
                    Push harder
                    <span className="label !text-[9px]">2 moves · they may crack</span>
                  </button>
                  <button type="button" className="btn btn-glass tap !min-h-12 flex-col !gap-0 !text-[14px]" disabled={busy || movesLeft < 1 || clues.length === 0} onClick={() => setSheet("confront")}>
                    Show them evidence
                    <span className="label !text-[9px]">{clues.length ? "1 move" : "find a clue first"}</span>
                  </button>
                </div>
              </div>
              <button type="button" className="btn btn-primary tap" onClick={() => setSheet(null)}>
                Back to the suspects
              </button>
            </div>
          </div>
        )}

        {sheet === "confront" && (
          <div className="scrim" role="dialog" aria-label="Show them evidence">
            <button type="button" aria-label="Close" className="flex-1 border-0 bg-transparent" onClick={() => setSheet("suspect")} />
            <div className="sheet flex max-h-[78%] flex-col gap-3 p-5 pb-[max(20px,env(safe-area-inset-bottom))]">
              <span className="display text-[22px]">Show {suspect.name.split(" ")[0]} which clue?</span>
              <div className="flex flex-col gap-2 overflow-y-auto">
                {clues.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="panel tap border-0 p-3 text-left text-snow"
                    onClick={() => {
                      setSheet("suspect");
                      void act("confront", { clueId: c.id });
                    }}
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
          <div className="scrim" role="dialog" aria-label="My clues">
            <button type="button" aria-label="Close" className="flex-1 border-0 bg-transparent" onClick={() => setSheet(null)} />
            <div className="sheet flex max-h-[82%] flex-col gap-3 p-5 pb-[max(20px,env(safe-area-inset-bottom))]">
              <div>
                <span className="eyebrow">My clues</span>
                <p className="display m-0 mt-1 text-[22px]">{view.title}</p>
              </div>
              <div className="flex flex-col gap-2 overflow-y-auto">
                {clues.length === 0 && <p className="m-0 text-mist">Nothing yet. Search the scene and question the suspects.</p>}
                {clues.map((c) => (
                  <div key={c.id} className="panel p-3">
                    <span className="block text-[14px] leading-snug">{c.text}</span>
                    <span className="label mt-1 block">{c.from}</span>
                  </div>
                ))}
                <p className="label m-0 mt-1 normal-case tracking-normal">Careful: not every clue points at the real culprit.</p>
              </div>
              <button type="button" className="btn btn-glass tap" onClick={() => setSheet(null)}>
                Close
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
        <p className="m-0 mt-3 text-[16px] font-medium leading-snug">{full ? v.story : firstSentence(v.story)}</p>
        {full && <p className="m-0 mt-2 text-[14px] italic leading-snug text-mist">“{v.roast}”</p>}
        <button type="button" className="tap label mt-2.5 border-0 bg-transparent p-0 text-cyan underline" onClick={() => setFull((f) => !f)}>
          {full ? "Show less" : "Read the full story"}
        </button>
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
