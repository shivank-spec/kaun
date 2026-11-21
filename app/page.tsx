"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { LeaderboardView, Tone } from "@/lib/types";

const SETTINGS = ["Kolkata", "This hackathon room"] as const;

export default function Home() {
  const router = useRouter();
  const [setting, setSetting] = useState<string>("Kolkata");
  const [custom, setCustom] = useState("");
  const [tone, setTone] = useState<Tone>("desi");
  const [mode, setMode] = useState<"menu" | "host" | "join">("menu");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [demo, setDemo] = useState(false);
  const [rejoin, setRejoin] = useState<string | null>(null);
  const [board, setBoard] = useState<LeaderboardView | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setDemo(q.get("demo") === "true");
    setName(localStorage.getItem("kaun.name") || "");
    // Reconnect: if a game is in progress, offer to jump back in.
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
    const join = q.get("join");
    if (join) {
      setCode(join.toUpperCase().slice(0, 4));
      setMode("join");
    }
  }, []);

  const chosenSetting = custom.trim() || setting;
  const soloHref = `/solo?setting=${encodeURIComponent(chosenSetting)}&tone=${tone}`;

  async function host() {
    if (!name.trim()) return setError("Enter your name");
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, setting: chosenSetting, tone, demo }),
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
      setError((e as Error).message || "Could not create a room");
      setBusy(false);
    }
  }

  function join() {
    if (code.length !== 4) return setError("Enter the 4-letter code");
    router.push(`/room/${code}`);
  }

  return (
    <main className="relative z-10 flex min-h-dvh flex-col px-6 pb-8 pt-14">
      <div className="rise">
        <p className="font-type text-xs tracking-[0.3em] text-taxi">CASE FILE · KOLKATA</p>
        <h1 className="mt-3 font-serif text-[5.5rem] leading-[0.85]">Kaun?</h1>
        <p className="mt-4 max-w-[17rem] text-lg leading-snug text-paper/80">
          A new mystery every 3 minutes. One of them is lying.
        </p>
      </div>

      <div className="mt-auto space-y-3 pt-10">
        {mode === "menu" && (
          <>
            <div className="mb-4 space-y-3 rise">
              <div>
                <p className="mb-2 font-type text-[0.7rem] tracking-[0.2em] text-muted">WHERE</p>
                <div className="flex gap-2">
                  {SETTINGS.map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setSetting(s);
                        setCustom("");
                      }}
                      className={`min-h-11 flex-1 rounded-full border px-3 text-sm ${
                        !custom.trim() && setting === s
                          ? "border-taxi bg-taxi/15 text-taxi"
                          : "border-paper/20 text-paper/70"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <input
                  value={custom}
                  onChange={(e) => setCustom(e.target.value.slice(0, 30))}
                  placeholder="or type your own: our college canteen"
                  className="mt-2 min-h-11 w-full rounded-full border border-paper/20 bg-transparent px-4 text-sm outline-none placeholder:text-paper/35 focus:border-taxi"
                />
              </div>
              <div>
                <p className="mb-2 font-type text-[0.7rem] tracking-[0.2em] text-muted">NARRATOR</p>
                <div className="flex gap-2">
                  {(
                    [
                      ["desi", "Desi Drama"],
                      ["noir", "Noir"],
                    ] as const
                  ).map(([t, label]) => (
                    <button
                      key={t}
                      onClick={() => setTone(t)}
                      className={`min-h-11 flex-1 rounded-full border px-3 text-sm ${
                        tone === t ? "border-taxi bg-taxi/15 text-taxi" : "border-paper/20 text-paper/70"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {rejoin && (
              <button className="btn btn-danger" onClick={() => router.push(`/room/${rejoin}`)}>
                Rejoin room {rejoin}
              </button>
            )}
            <button className="btn btn-primary" onClick={() => router.push(soloHref)}>
              Play solo
            </button>
            <button className="btn btn-ghost" onClick={() => setMode("host")}>
              Play with friends
            </button>
            <button className="btn btn-ghost" onClick={() => setMode("join")}>
              Join with code
            </button>
          </>
        )}

        {mode === "host" && (
          <div className="space-y-3 rise">
            <p className="font-serif text-3xl">Your name, detective?</p>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 16))}
              onKeyDown={(e) => e.key === "Enter" && host()}
              placeholder="Name"
              className="min-h-14 w-full rounded-xl border border-paper/25 bg-transparent px-4 text-lg outline-none focus:border-taxi"
            />
            <button className="btn btn-primary" disabled={busy} onClick={host}>
              {busy ? "Opening room…" : "Create room"}
            </button>
            <button className="btn btn-ghost" onClick={() => setMode("menu")}>
              Back
            </button>
          </div>
        )}

        {mode === "join" && (
          <div className="space-y-3 rise">
            <p className="font-serif text-3xl">Enter the room code</p>
            <input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 4))}
              onKeyDown={(e) => e.key === "Enter" && join()}
              placeholder="ABCD"
              className="min-h-16 w-full rounded-xl border border-paper/25 bg-transparent text-center font-type text-4xl tracking-[0.4em] outline-none focus:border-taxi"
            />
            <button className="btn btn-primary" onClick={join}>
              Join
            </button>
            <button className="btn btn-ghost" onClick={() => setMode("menu")}>
              Back
            </button>
          </div>
        )}

        {error && <p className="text-center text-sm text-culprit">{error}</p>}
        <p className="pt-2 text-center font-type text-[0.65rem] tracking-[0.15em] text-muted">
          {board && board.playedToday > 0
            ? `${board.playedToday} CASES PLAYED TODAY · TOP: ${board.top[0]?.name?.toUpperCase() ?? "NOBODY YET"} ${board.top[0]?.score ?? ""}`
            : "NO SIGN-UP · 3 MINUTES · PLAY AGAIN FOREVER"}
        </p>
      </div>
    </main>
  );
}
