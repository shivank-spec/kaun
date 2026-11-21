"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { sfx, unlockSfx } from "@/components/ui/kit";
import type { Difficulty, LeaderboardView, Tone } from "@/lib/types";

type SettingId = "kolkata" | "room" | "custom";
const SETTINGS: { id: SettingId; label: string; value: string }[] = [
  { id: "kolkata", label: "Kolkata", value: "Kolkata" },
  { id: "room", label: "This Room", value: "This hackathon room" },
  { id: "custom", label: "Custom", value: "" },
];

export default function Home() {
  const router = useRouter();
  const [settingId, setSettingId] = useState<SettingId>("kolkata");
  const [custom, setCustom] = useState("");
  const [tone, setTone] = useState<Tone>("desi");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [code, setCode] = useState(["", "", "", ""]);
  const [sheet, setSheet] = useState<null | "settings" | "name">(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [demo, setDemo] = useState(false);
  const [rejoin, setRejoin] = useState<string | null>(null);
  const [board, setBoard] = useState<LeaderboardView | null>(null);
  const cells = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setDemo(q.get("demo") === "true");
    setName(localStorage.getItem("kaun.name") || "");
    const saved = localStorage.getItem("kaun.prefs");
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (p.settingId) setSettingId(p.settingId);
        if (p.custom) setCustom(p.custom);
        if (p.tone) setTone(p.tone);
        if (p.difficulty) setDifficulty(p.difficulty);
      } catch {}
    }
    // If this phone was in a game that is still running, offer a way back in.
    try {
      const sess = JSON.parse(localStorage.getItem("kaun.session") || "null");
      if (sess?.code && sess?.playerId) {
        fetch(`/api/room/${sess.code}?playerId=${sess.playerId}`, { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .then((room) => room?.you && setRejoin(sess.code))
          .catch(() => {});
      }
    } catch {}
    fetch("/api/leaderboard", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setBoard)
      .catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem("kaun.prefs", JSON.stringify({ settingId, custom, tone, difficulty }));
  }, [settingId, custom, tone, difficulty]);

  const setting =
    settingId === "custom" ? custom.trim() || "Kolkata" : SETTINGS.find((s) => s.id === settingId)!.value;

  function typeCell(i: number, raw: string) {
    const letters = raw.replace(/[^a-zA-Z]/g, "").toUpperCase();
    // A paste of the whole code lands in one cell: spread it out.
    const next = [...code];
    if (letters.length > 1) {
      letters.slice(0, 4).split("").forEach((ch, k) => (next[k] = ch));
    } else {
      next[i] = letters;
    }
    setCode(next);
    setMsg("");
    const filled = next.join("");
    if (filled.length === 4) {
      sfx.tap();
      router.push(`/room/${filled}`);
    } else if (letters && i < 3) {
      cells.current[i + 1]?.focus();
    }
  }

  async function host() {
    if (!name.trim()) return setMsg("Enter your name");
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, setting, tone, demo, difficulty }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      localStorage.setItem("kaun.name", name.trim());
      localStorage.setItem(
        "kaun.session",
        JSON.stringify({ code: data.code, playerId: data.playerId, name: name.trim() }),
      );
      router.push(`/room/${data.code}`);
    } catch (e) {
      setMsg((e as Error).message || "Could not create a room");
      setBusy(false);
    }
  }

  const status = msg
    ? msg
    : board && board.playedToday > 0
      ? `${board.playedToday} cases played today${board.top[0] ? ` · top ${board.top[0].name} ${board.top[0].score}` : ""}`
      : "Enter a room code to join";

  return (
    <main className="screen" onPointerDown={unlockSfx}>
      <header className="flex h-11 shrink-0 items-center justify-between">
        <span className="display text-[20px] tracking-[0.02em]">KAUN?</span>
        <button
          type="button"
          aria-label="Settings"
          onClick={() => setSheet("settings")}
          className="tap flex h-11 w-11 items-center justify-end border-0 bg-transparent text-snow"
        >
          <Gear size={24} />
        </button>
      </header>

      {/* The cube takes whatever height is left, so tall and short phones both look composed. */}
      <div className="flex min-h-[120px] flex-1 items-center justify-center" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/art/cube.png"
          alt=""
          className="h-full max-h-[300px] w-auto object-contain"
          style={{ animation: "floaty 7s ease-in-out infinite", filter: "drop-shadow(0 0 30px rgba(95,221,247,.25))" }}
        />
      </div>

      <div className="flex shrink-0 flex-col items-center gap-1.5 pb-[clamp(16px,4vh,36px)]">
        <h1 className="display m-0 text-[clamp(56px,19vw,78px)] leading-none tracking-[-0.03em]" aria-label="Kaun?">
          <span className="metal">Kaun</span>
          <span style={{ color: "#5FDDF7", WebkitTextFillColor: "#5FDDF7", textShadow: "0 0 22px rgba(95,221,247,.55)" }}>
            ?
          </span>
        </h1>
        <p className="m-0 text-[17px] text-[#E3E8F2]">Find the culprit. Hide your role.</p>
      </div>

      <div className="flex shrink-0 flex-col gap-3">
        {rejoin && (
          <button type="button" className="btn btn-danger tap rise" onClick={() => router.push(`/room/${rejoin}`)}>
            Rejoin room {rejoin}
          </button>
        )}
        <button
          type="button"
          className="btn btn-primary tap"
          onClick={() => {
            sfx.tap();
            setSheet("name");
          }}
        >
          <People />
          Play with Friends
        </button>
        <button
          type="button"
          className="btn btn-glass tap justify-between px-5"
          onClick={() => {
            sfx.tap();
            router.push(`/solo?setting=${encodeURIComponent(setting)}&tone=${tone}&difficulty=${difficulty}`);
          }}
        >
          <span className="flex items-center gap-2.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M7 4v16l13-8z" />
            </svg>
            Play Solo
          </span>
          <span className="mono text-[14px] font-medium text-mist">{{ easy: "02:50", medium: "02:30", hard: "02:00" }[difficulty]}</span>
        </button>

        <div role="group" aria-label="Room code" className="mt-1 flex justify-center gap-3">
          {code.map((ch, i) => (
            <input
              key={i}
              ref={(el) => {
                cells.current[i] = el;
              }}
              value={ch}
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={4}
              placeholder={"ABCD"[i]}
              aria-label={`Room code letter ${i + 1}`}
              onChange={(e) => typeCell(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !code[i] && i > 0) {
                  const next = [...code];
                  next[i - 1] = "";
                  setCode(next);
                  cells.current[i - 1]?.focus();
                }
              }}
              className="h-[58px] w-[58px] rounded-[12px] border-0 p-0 text-center text-[26px] font-bold uppercase text-snow outline-none placeholder:text-[#59627a]"
              style={{
                background: "linear-gradient(180deg, rgba(28,40,66,.94), rgba(12,18,34,.94))",
                boxShadow: `inset 0 0 0 1px ${ch ? "#5FDDF7" : "rgba(130,180,230,.28)"}, inset 0 1px 0 rgba(255,255,255,.12)`,
              }}
            />
          ))}
        </div>
        <p role="status" className="label m-0 h-[14px] text-center text-snow">
          {status}
        </p>

        <div role="group" aria-label="Difficulty" className="grid grid-cols-3 gap-1.5">
          {(["easy", "medium", "hard"] as const).map((d) => (
            <button
              key={d}
              type="button"
              className="chip tap !min-h-11 capitalize"
              aria-pressed={difficulty === d}
              onClick={() => {
                sfx.tap();
                setDifficulty(d);
              }}
            >
              {d}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button type="button" className="btn btn-glass tap !min-h-12 !rounded-full !text-[15px] !font-medium" onClick={() => setSheet("settings")}>
            <Gear size={18} />
            {SETTINGS.find((s) => s.id === settingId)!.label === "Custom" ? custom.trim() || "Custom" : SETTINGS.find((s) => s.id === settingId)!.label}
          </button>
          <button
            type="button"
            className="btn btn-glass tap !min-h-12 !rounded-full !text-[15px] !font-medium"
            aria-label={`Narrator: ${tone === "desi" ? "Drama" : "Noir"}. Tap to switch.`}
            onClick={() => {
              sfx.tap();
              setTone(tone === "desi" ? "noir" : "desi");
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 9.5v5h3.5L12 18V6L7.500 9.500zM15.500 9a4 4 0 0 1 0 6M18 6.500a7.500 7.500 0 0 1 0 11" />
            </svg>
            {tone === "desi" ? "Drama" : "Noir"}
          </button>
        </div>
      </div>

      {sheet === "settings" && (
        <div className="scrim" role="dialog" aria-label="Settings">
          <button type="button" aria-label="Close" className="flex-1 border-0 bg-transparent" onClick={() => setSheet(null)} />
          <div className="sheet flex flex-col gap-4 p-6 pb-[max(24px,env(safe-area-inset-bottom))]">
            <span className="display text-[24px]">Settings</span>
            <div className="flex flex-col gap-2">
              <span className="eyebrow">Where it happens</span>
              <div className="grid grid-cols-3 gap-1.5">
                {SETTINGS.map((s) => (
                  <button key={s.id} type="button" className="chip tap" aria-pressed={settingId === s.id} onClick={() => setSettingId(s.id)}>
                    {s.label}
                  </button>
                ))}
              </div>
              {settingId === "custom" && (
                <input
                  autoFocus
                  className="field"
                  placeholder="Up to 3 words: our college canteen"
                  value={custom}
                  onChange={(e) => {
                    const w = e.target.value.split(/\s+/).filter(Boolean);
                    setCustom(w.length > 3 ? w.slice(0, 3).join(" ") : e.target.value.slice(0, 36));
                  }}
                />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <span className="eyebrow">Narrator</span>
              <div className="grid grid-cols-2 gap-1.5">
                <button type="button" className="chip tap" aria-pressed={tone === "desi"} onClick={() => setTone("desi")}>
                  Drama
                </button>
                <button type="button" className="chip tap" aria-pressed={tone === "noir"} onClick={() => setTone("noir")}>
                  Noir
                </button>
              </div>
            </div>
            <button type="button" className="btn btn-primary tap" onClick={() => setSheet(null)}>
              Done
            </button>
          </div>
        </div>
      )}

      {sheet === "name" && (
        <div className="scrim" role="dialog" aria-label="Your name">
          <button type="button" aria-label="Close" className="flex-1 border-0 bg-transparent" onClick={() => setSheet(null)} />
          <div className="sheet flex flex-col gap-4 p-6 pb-[max(24px,env(safe-area-inset-bottom))]">
            <div>
              <span className="eyebrow">Party room</span>
              <p className="display m-0 mt-1 text-[24px]">What should we call you?</p>
            </div>
            <input
              autoFocus
              className="field"
              placeholder="Your name"
              value={name}
              maxLength={16}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && host()}
            />
            {msg && <p className="m-0 text-[14px] text-[#ff8098]">{msg}</p>}
            <button type="button" className="btn btn-primary tap" disabled={busy} onClick={host}>
              {busy ? "Opening room" : "Create room"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function Gear({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
    </svg>
  );
}
function People() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="7" r="3.4" />
      <path d="M5 20c0-3.900 3.100-6.500 7-6.500s7 2.600 7 6.500z" />
      <circle cx="5.5" cy="9.5" r="2.3" />
      <circle cx="18.5" cy="9.5" r="2.3" />
    </svg>
  );
}
