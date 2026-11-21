"use client";

import { useEffect, useState } from "react";

const STEPS = {
  solo: [
    ["Search", "Tap the glowing dots on the map to find evidence."],
    ["Question", "Tap a suspect, then Ask, Press or Confront. You have a few moves, so choose well."],
    ["Accuse", "Press Accuse and pick who did it. One of the four is lying."],
  ],
  party: [
    ["Read the case and your card", "Everyone sees the case. Then you get a secret card: who you are, your story, and what you saw."],
    ["Question each other", "Tell people what you saw. Ask where they were. One of you is the culprit and is lying."],
    ["Vote", "Tap who you think did it and lock it in. If most of you pick the culprit, you win. If not, the culprit wins."],
  ],
} as const;

/**
 * A three-step explainer. Shows by itself the first time someone plays a mode,
 * and can be opened again with `open`.
 */
export function HowTo({ mode, open, onClose }: { mode: keyof typeof STEPS; open?: boolean; onClose?: () => void }) {
  const key = "kaun.howto"; // shown once per device, whichever mode comes first
  const [first, setFirst] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem(key)) setFirst(true);
  }, [key]);
  if (!open && !first) return null;
  const close = () => {
    localStorage.setItem(key, "1");
    setFirst(false);
    onClose?.();
  };
  return (
    <div className="scrim" role="dialog" aria-label="How to play" style={{ zIndex: 50 }}>
      <button type="button" aria-label="Close" className="flex-1 border-0 bg-transparent" onClick={close} />
      <div className="sheet flex flex-col gap-4 p-6 pb-[max(24px,env(safe-area-inset-bottom))]">
        <div>
          <span className="eyebrow">How to play</span>
          <p className="display m-0 mt-1 text-[24px]">{mode === "solo" ? "Find the liar" : "Find the culprit among you"}</p>
        </div>
        <ol className="m-0 flex list-none flex-col gap-3.5 p-0">
          {STEPS[mode].map(([title, text], i) => (
            <li key={title} className="flex gap-3.5">
              <span className="mono flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] text-cyan" style={{ boxShadow: "inset 0 0 0 1.5px #5FDDF7" }}>
                {i + 1}
              </span>
              <span>
                <span className="block text-[16px] font-semibold leading-tight">{title}</span>
                <span className="block text-[14px] leading-snug text-mist">{text}</span>
              </span>
            </li>
          ))}
        </ol>
        <button type="button" className="btn btn-primary tap" onClick={close}>
          Got it
        </button>
      </div>
    </div>
  );
}

/** Easy until someone has finished three rounds, then whatever they pick. */
export function roundsPlayed() {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem("kaun.rounds") || 0) || 0;
}
export function countRound() {
  localStorage.setItem("kaun.rounds", String(roundsPlayed() + 1));
}
