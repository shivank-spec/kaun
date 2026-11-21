"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { RoomView, Tone } from "@/lib/types";
import type { RoomActions } from "./api";
import { ErrorLine } from "./Bits";

const PRESETS = ["Kolkata", "This hackathon room"];
const MIN_PLAYERS = 3;

function threeWords(v: string) {
  const parts = v.replace(/\s+/g, " ").trimStart().split(" ");
  return parts.slice(0, 3).join(" ").slice(0, 40);
}

export function Lobby({ room, actions }: { room: RoomView; actions: RoomActions }) {
  const isHost = !!room.you?.isHost;
  const initial = room.settings.setting;
  const [preset, setPreset] = useState<string>(PRESETS.includes(initial) || !initial ? initial || PRESETS[0] : "custom");
  const [custom, setCustom] = useState(PRESETS.includes(initial) ? "" : initial);
  const [tone, setTone] = useState<Tone>(room.settings.tone ?? "desi");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const url = typeof window === "undefined" ? "" : `${window.location.origin}/room/${room.code}`;
  const enough = room.players.length >= MIN_PLAYERS;
  const setting = preset === "custom" ? custom.trim() || PRESETS[0] : preset;

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Kaun?", text: `Join my case. Room code ${room.code}`, url });
        return;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // user closed the sheet
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErr(`Share this link: ${url}`);
    }
  }

  async function start() {
    setBusy(true);
    setErr(null);
    try {
      await actions.start(setting, tone);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not start");
    }
    setBusy(false);
  }

  return (
    <div className="k-screen k-scroll">
      <div className="text-center">
        <div className="k-label">Room code</div>
        <div className="k-mono text-[72px] leading-none tracking-[0.18em] pl-[0.18em] text-[var(--k-yellow)]">{room.code}</div>
      </div>

      <div className="flex items-center gap-3">
        <div className="k-paper p-2 shrink-0">{url && <QRCodeSVG value={url} size={104} bgColor="#EFE6D3" fgColor="#1B1611" />}</div>
        <div className="flex-1 flex flex-col gap-2">
          <p className="text-[14px] text-[var(--k-muted)]">Scan to join, or send the link.</p>
          <button type="button" className="k-btn k-btn-ghost" onClick={share}>
            {copied ? "Link copied" : "Share link"}
          </button>
        </div>
      </div>

      <div>
        <div className="k-label mb-2">
          Suspects ({room.players.length}){!enough && ` / need ${MIN_PLAYERS}`}
        </div>
        <ul className="flex flex-wrap gap-2">
          {room.players.map((p) => (
            <li key={p.id} className="k-paper k-fade px-3 py-2 text-[16px] font-semibold">
              {p.name}
              {p.isHost && <span className="ml-1 text-[11px] font-bold opacity-60">HOST</span>}
              {p.id === room.you?.id && <span className="ml-1 text-[11px] font-bold opacity-60">YOU</span>}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex-1" />

      {isHost ? (
        <div className="flex flex-col gap-2">
          <div className="k-label">Where did it happen?</div>
          <div className="flex gap-2">
            {PRESETS.map((p) => (
              <button key={p} type="button" className="k-chip" aria-pressed={preset === p} onClick={() => setPreset(p)}>
                {p}
              </button>
            ))}
            <button type="button" className="k-chip" aria-pressed={preset === "custom"} onClick={() => setPreset("custom")}>
              Custom
            </button>
          </div>
          {preset === "custom" && (
            <input
              className="k-input"
              placeholder="Max 3 words, e.g. Goa beach shack"
              value={custom}
              autoFocus
              aria-label="Custom setting, max 3 words"
              onChange={(e) => setCustom(threeWords(e.target.value))}
            />
          )}
          <div className="flex gap-2">
            <button type="button" className="k-chip" aria-pressed={tone === "desi"} onClick={() => setTone("desi")}>
              Desi Drama
            </button>
            <button type="button" className="k-chip" aria-pressed={tone === "noir"} onClick={() => setTone("noir")}>
              Noir
            </button>
          </div>
          <button type="button" className="k-btn" disabled={!enough || busy} onClick={start}>
            {busy ? "Starting..." : enough ? "Start case" : `Need ${MIN_PLAYERS - room.players.length} more`}
          </button>
        </div>
      ) : (
        <p className="k-pulse text-center text-[16px] text-[var(--k-muted)] py-4">Waiting for the host to start the case...</p>
      )}
      <ErrorLine>{err}</ErrorLine>
    </div>
  );
}
