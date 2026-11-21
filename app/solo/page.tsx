"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, InterrogateResponse, SoloCaseView, SoloVerdict } from "@/lib/types";

type Stage = "loading" | "brief" | "play" | "accuse" | "verdict" | "error";

const LOADING_LINES = [
  "Opening case file…",
  "Dusting for fingerprints…",
  "Waking up the suspects…",
  "Checking alibis…",
  "Brewing cha for the inspector…",
];
const CHIPS = ["Where were you?", "What did you see?", "Who looks guilty to you?", "What are you hiding?"];
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

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
  const [stage, setStage] = useState<Stage>("loading");
  const [view, setView] = useState<SoloCaseView | null>(null);
  const [line, setLine] = useState(0);
  const [active, setActive] = useState<string>("");
  const [chats, setChats] = useState<Record<string, ChatMessage[]>>({});
  const [clues, setClues] = useState<{ id: string; text: string; from: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [left, setLeft] = useState(150);
  const [showFile, setShowFile] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<SoloVerdict | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const startedAt = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  const load = useCallback(async () => {
    setStage("loading");
    setChats({});
    setClues([]);
    setVerdict(null);
    setShowFile(false);
    const q = new URLSearchParams(window.location.search);
    try {
      const v = await post<SoloCaseView>("/api/case", {
        setting: q.get("setting") || "Kolkata",
        tone: q.get("tone") || "desi",
      });
      setView(v);
      setActive(v.suspects[0].id);
      setLeft(v.durationSec);
      setStage("brief");
    } catch {
      setStage("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Rotating loading lines.
  useEffect(() => {
    if (stage !== "loading") return;
    const t = setInterval(() => setLine((l) => (l + 1) % LOADING_LINES.length), 1400);
    return () => clearInterval(t);
  }, [stage]);

  // Countdown, measured from a real timestamp so it cannot drift.
  useEffect(() => {
    if (stage !== "play" || !view) return;
    const t = setInterval(() => {
      const remaining = view.durationSec - Math.floor((Date.now() - startedAt.current) / 1000);
      setLeft(remaining);
      if (remaining <= 0) setStage("accuse");
    }, 250);
    return () => clearInterval(t);
  }, [stage, view]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [chats, active, thinking]);

  async function ask(text: string) {
    const message = text.trim();
    if (!message || thinking || !view) return;
    const suspectId = active;
    const history = chats[suspectId] ?? [];
    setDraft("");
    setChats((c) => ({ ...c, [suspectId]: [...history, { from: "you", text: message }] }));
    setThinking(true);
    try {
      const r = await post<InterrogateResponse>("/api/interrogate", {
        caseId: view.caseId,
        suspectId,
        message,
        history,
        foundClueIds: clues.map((c) => c.id),
      });
      setChats((c) => ({
        ...c,
        [suspectId]: [...(c[suspectId] ?? []), { from: "suspect", text: r.reply }],
      }));
      if (r.unlockedClue && !clues.some((c) => c.id === r.unlockedClue!.id)) {
        const from = view.suspects.find((s) => s.id === suspectId)?.name ?? "";
        setClues((c) => [...c, { ...r.unlockedClue!, from }]);
        setFresh(r.unlockedClue.text);
        setTimeout(() => setFresh(null), 2600);
      }
    } catch {
      setChats((c) => ({
        ...c,
        [suspectId]: [...(c[suspectId] ?? []), { from: "suspect", text: "…(the line went dead, ask again)" }],
      }));
    } finally {
      setThinking(false);
    }
  }

  async function accuse(suspectId: string) {
    if (!view) return;
    try {
      const v = await post<SoloVerdict>("/api/accuse", {
        caseId: view.caseId,
        suspectId,
        foundClueIds: clues.map((c) => c.id),
        secondsUsed: Math.floor((Date.now() - startedAt.current) / 1000),
      });
      setVerdict(v);
      setStage("verdict");
    } catch {
      setStage("error");
    }
  }

  async function narrate(text: string) {
    if (speaking) {
      audio.current?.pause();
      window.speechSynthesis?.cancel();
      return setSpeaking(false);
    }
    setSpeaking(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("no voice");
      const el = new Audio(URL.createObjectURL(await res.blob()));
      audio.current = el;
      el.onended = () => setSpeaking(false);
      await el.play();
    } catch {
      // Fall back to the phone's own voice.
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "hi-IN";
      u.rate = 0.95;
      u.onend = () => setSpeaking(false);
      window.speechSynthesis?.speak(u);
      if (!window.speechSynthesis) setSpeaking(false);
    }
  }

  /* ---------------- screens ---------------- */

  if (stage === "loading") {
    return (
      <main className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-8 text-center">
        <div className="paper h-40 w-32 -rotate-3 rounded-sm p-3 text-left">
          <p className="font-type text-[0.6rem] tracking-widest text-culprit">CONFIDENTIAL</p>
          <div className="mt-3 space-y-2">
            {[90, 70, 85, 50].map((w, i) => (
              <div key={i} className="h-1.5 animate-pulse rounded bg-ink/25" style={{ width: `${w}%` }} />
            ))}
          </div>
        </div>
        <p key={line} className="rise mt-10 font-serif text-3xl">
          {LOADING_LINES[line]}
        </p>
      </main>
    );
  }

  if (stage === "error" || !view) {
    return (
      <main className="relative z-10 flex min-h-dvh flex-col items-center justify-center gap-6 px-8 text-center">
        <p className="font-serif text-4xl">The detective lost signal.</p>
        <button className="btn btn-primary" onClick={load}>
          Retry
        </button>
        <Link href="/" className="text-sm text-muted underline">
          Home
        </Link>
      </main>
    );
  }

  if (stage === "brief") {
    return (
      <main className="relative z-10 flex min-h-dvh flex-col px-5 pb-6 pt-8">
        <p className="font-type text-xs tracking-[0.25em] text-taxi">NEW CASE</p>
        <h1 className="mt-2 font-serif text-[2.6rem] leading-[1]">{view.title}</h1>
        <p className="mt-3 text-[0.95rem] leading-snug text-paper/85">{view.crime}</p>
        <p className="mt-2 text-sm italic leading-snug text-paper/55">{view.intro}</p>

        <p className="mb-2 mt-5 font-type text-[0.7rem] tracking-[0.2em] text-muted">
          4 SUSPECTS · ONE IS LYING
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          {view.suspects.map((s, i) => (
            <div
              key={s.id}
              className="paper rise rounded-sm p-3"
              style={{ transform: `rotate(${[-1.5, 1.2, 1, -1][i]}deg)`, animationDelay: `${i * 70}ms` }}
            >
              <p className="font-serif text-xl leading-tight">{s.name}</p>
              <p className="font-type text-[0.65rem] uppercase tracking-wider text-culprit">{s.role}</p>
              <p className="mt-1.5 text-[0.72rem] leading-snug text-ink/75">“{s.public_alibi}”</p>
            </div>
          ))}
        </div>

        <div className="mt-auto pt-5">
          <p className="mb-3 text-center text-sm text-paper/70">
            Question them. Find the liar. You have {fmt(view.durationSec)}.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => {
              startedAt.current = Date.now();
              setStage("play");
            }}
          >
            Start interrogation
          </button>
        </div>
      </main>
    );
  }

  if (stage === "play") {
    const suspect = view.suspects.find((s) => s.id === active)!;
    const log = chats[active] ?? [];
    return (
      <main className="relative z-10 flex h-dvh flex-col">
        <header className="flex items-center justify-between px-5 pb-2 pt-4">
          <span className={`font-type text-4xl tabular-nums ${left <= 20 ? "urgent" : "text-taxi"}`}>
            {fmt(left)}
          </span>
          <button
            onClick={() => setShowFile(true)}
            className="min-h-11 rounded-full border border-paper/25 px-4 font-type text-xs tracking-wider"
          >
            CASE FILE · {clues.length}/{view.totalClues}
          </button>
        </header>

        <div className="flex gap-2 overflow-x-auto px-5 pb-3">
          {view.suspects.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={`min-h-12 shrink-0 rounded-xl border px-3.5 text-left ${
                active === s.id ? "border-taxi bg-taxi text-ink" : "border-paper/20 text-paper/80"
              }`}
            >
              <span className="block text-sm font-semibold leading-tight">{s.name.split(" ")[0]}</span>
              <span className="block text-[0.6rem] uppercase tracking-wide opacity-70">
                {(chats[s.id]?.length ?? 0) > 0 ? "questioned" : "not yet"}
              </span>
            </button>
          ))}
        </div>

        <div ref={scroller} className="flex-1 space-y-2.5 overflow-y-auto px-5 pb-3">
          <div className="paper rounded-sm p-3">
            <p className="font-serif text-xl leading-tight">{suspect.name}</p>
            <p className="font-type text-[0.65rem] uppercase tracking-wider text-culprit">{suspect.role}</p>
            <p className="mt-1 text-xs text-ink/75">Alibi: “{suspect.public_alibi}”</p>
          </div>
          {log.map((m, i) => (
            <div key={i} className={`rise flex ${m.from === "you" ? "justify-end" : "justify-start"}`}>
              <p
                className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[0.95rem] leading-snug ${
                  m.from === "you" ? "rounded-br-sm bg-taxi text-ink" : "rounded-bl-sm bg-paper/10"
                }`}
              >
                {m.text}
              </p>
            </div>
          ))}
          {thinking && <p className="text-sm italic text-muted">{suspect.name.split(" ")[0]} is sweating…</p>}
        </div>

        {fresh && (
          <div className="paper rise mx-5 mb-2 rounded-sm px-3 py-2">
            <p className="font-type text-[0.65rem] tracking-widest text-culprit">NEW CLUE</p>
            <p className="text-sm leading-snug">{fresh}</p>
          </div>
        )}

        <div className="space-y-2 px-5 pb-4">
          <div className="flex gap-2 overflow-x-auto">
            {CHIPS.map((c) => (
              <button
                key={c}
                onClick={() => ask(c)}
                disabled={thinking}
                className="min-h-10 shrink-0 rounded-full border border-paper/20 px-3 text-xs text-paper/80 disabled:opacity-40"
              >
                {c}
              </button>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              ask(draft);
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Ask ${suspect.name.split(" ")[0]} anything…`}
              className="min-h-14 flex-1 rounded-xl border border-paper/25 bg-transparent px-4 outline-none focus:border-taxi"
            />
            <button className="min-h-14 rounded-xl bg-paper/15 px-4 font-semibold" disabled={thinking}>
              Ask
            </button>
          </form>
          <button className="btn btn-danger" onClick={() => setStage("accuse")}>
            Accuse someone
          </button>
        </div>

        {showFile && (
          <div className="absolute inset-0 z-20 flex flex-col bg-ink/95 px-5 pb-6 pt-6">
            <p className="font-type text-xs tracking-[0.25em] text-taxi">CASE FILE</p>
            <h2 className="mt-1 font-serif text-3xl">{view.title}</h2>
            <div className="mt-4 flex-1 space-y-2.5 overflow-y-auto">
              {clues.length === 0 && (
                <p className="text-paper/60">No clues yet. Ask suspects what they saw.</p>
              )}
              {clues.map((c) => (
                <div key={c.id} className="paper rounded-sm p-3">
                  <p className="text-sm leading-snug">{c.text}</p>
                  <p className="mt-1 font-type text-[0.65rem] uppercase tracking-wider text-ink/55">
                    told by {c.from}
                  </p>
                </div>
              ))}
              <p className="pt-1 text-xs text-muted">Careful: not every clue points at the real culprit.</p>
            </div>
            <button className="btn btn-ghost" onClick={() => setShowFile(false)}>
              Back to interrogation
            </button>
          </div>
        )}
      </main>
    );
  }

  if (stage === "accuse") {
    return (
      <main className="relative z-10 flex min-h-dvh flex-col px-5 pb-6 pt-10">
        {left <= 0 && <p className="font-type text-xs tracking-[0.25em] text-culprit">TIME IS UP</p>}
        <h1 className="mt-1 font-serif text-6xl">Who did it?</h1>
        <div className="mt-6 space-y-3">
          {view.suspects.map((s) => (
            <button key={s.id} onClick={() => accuse(s.id)} className="paper block w-full rounded-sm p-4 text-left active:scale-[0.98]">
              <span className="block font-serif text-3xl leading-tight">{s.name}</span>
              <span className="font-type text-xs uppercase tracking-wider text-culprit">{s.role}</span>
            </button>
          ))}
        </div>
        {left > 0 && (
          <button className="btn btn-ghost mt-auto" onClick={() => setStage("play")}>
            Not yet, keep questioning
          </button>
        )}
      </main>
    );
  }

  // verdict
  const v = verdict!;
  return (
    <main className="relative z-10 flex min-h-dvh flex-col px-5 pb-6 pt-10">
      <div className={v.correct ? "text-innocent" : "text-culprit"}>
        <span className="stamp text-2xl">{v.correct ? "Case closed" : "Culprit escaped"}</span>
      </div>
      <p className="mt-6 font-type text-xs tracking-[0.25em] text-muted">THE CULPRIT WAS</p>
      <h1 className="font-serif text-6xl leading-[0.95]">{v.culpritName}</h1>

      <div className="paper mt-5 rounded-sm p-4">
        <p className="text-[0.95rem] leading-snug">{v.story}</p>
        <p className="mt-3 border-t border-ink/15 pt-3 text-sm italic">“{v.roast}”</p>
      </div>
      <button className="btn btn-ghost mt-3" onClick={() => narrate(`${v.story} ${v.roast}`)}>
        {speaking ? "Stop" : "Hear the reveal"}
      </button>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        {[
          ["Score", v.score],
          ["Clues", `${v.cluesFound}/3`],
          ["Verdict", v.correct ? "Right" : "Wrong"],
        ].map(([k, val]) => (
          <div key={k} className="rounded-xl border border-paper/15 py-3">
            <p className="font-type text-2xl text-taxi">{val}</p>
            <p className="text-[0.65rem] uppercase tracking-widest text-muted">{k}</p>
          </div>
        ))}
      </div>

      <div className="mt-auto space-y-3 pt-6">
        <button className="btn btn-primary" onClick={load}>
          New case
        </button>
        <Link href="/" className="btn btn-ghost">
          Play with friends
        </Link>
      </div>
    </main>
  );
}
