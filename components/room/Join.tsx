"use client";

import { useState } from "react";
import { post } from "./api";
import { ErrorLine } from "./Bits";

export function Join({
  code,
  defaultName,
  note,
  onJoined,
}: {
  code: string;
  defaultName?: string;
  note?: string;
  onJoined: (playerId: string, name: string) => void;
}) {
  const [name, setName] = useState(defaultName ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const clean = name.trim();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!clean || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const { playerId } = await post<{ playerId: string }>(`/api/room/${code}/join`, { name: clean });
      onJoined(playerId, clean);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not join");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="k-screen justify-center">
      <div className="text-center">
        <div className="k-label">Joining case room</div>
        <div className="k-mono text-[64px] tracking-[0.2em] text-[var(--k-yellow)]">{code}</div>
      </div>
      <h1 className="k-serif text-[40px] text-center">Who are you?</h1>
      {note && <p className="text-center text-[14px] text-[var(--k-muted)]">{note}</p>}
      <input
        className="k-input text-center"
        placeholder="Your name"
        value={name}
        maxLength={16}
        autoFocus
        autoComplete="off"
        autoCapitalize="words"
        enterKeyHint="go"
        aria-label="Your name"
        onChange={(e) => setName(e.target.value)}
      />
      <button className="k-btn" disabled={!clean || busy}>
        {busy ? "Joining..." : "Join the case"}
      </button>
      <ErrorLine>{err}</ErrorLine>
    </form>
  );
}
