# Paste into Gemini (3 separate tasks — send one at a time)

Context for all three: "Kaun?" is a 3-minute AI mystery party game set in Kolkata, built in Next.js (App Router) + TypeScript + Tailwind. Give me complete files, no placeholders, no "TODO".

---

## TASK 1 — `lib/fallback-cases.ts` (most important)

Write a TypeScript file that exports `export const FALLBACK_CASES: CaseFile[]` with **4 hand-written, funny, logically airtight mystery cases** set in Kolkata. These are used when the AI is slow, so the game never stalls on stage.

Use exactly these types (import them with `import type { CaseFile } from "./types";`):

```ts
interface Suspect { id: string; name: string; role: string; persona: string; speaking_style: string; public_alibi: string; innocent_secret: string; }
interface Clue { id: string; text: string; held_by: string; points_to: string; is_red_herring: boolean; }
interface CaseFile {
  title: string; setting: string; crime: string; intro: string;
  suspects: Suspect[];          // exactly 4, ids "s1".."s4"
  culprit_id: string;
  motive: string; method: string;
  timeline: string[];           // 4-6 short beats with times
  clues: Clue[];                // exactly 5: 3 true (is_red_herring false) + 2 red herrings, ids "c1".."c5"
  alibi_hole: string; culprit_objective: string;
  ending_caught: string; ending_escaped: string; roast: string;
}
```

Rules for every case:
- Petty, funny crimes only (no murder, nothing dark): the last rosogolla at KC Das, a missing Durga Puja pandal crown, a stolen tram bell on Park Street, the hackathon Wi-Fi router unplugged at AIC Techno.
- Pick the culprit first, then make everything consistent. The 3 true clues must together prove the culprit. `points_to` of a true clue is the culprit's id. Each true clue is `held_by` a DIFFERENT innocent suspect.
- The 2 red herrings point to innocent suspects and are explained by that suspect's `innocent_secret` (embarrassing but harmless).
- `alibi_hole`: the single fact that breaks the culprit's `public_alibi`.
- `culprit_objective`: a specific lie the culprit must push, e.g. "Convince everyone the lights went out at 8:00 pm."
- `speaking_style`: distinct per suspect (Hinglish, dramatic, nervous, posh…).
- `intro`, `ending_caught`, `ending_escaped`: 2–3 sentences each in dramatic CID-style Hinglish narration ("Kuch toh gadbad hai…"). `roast`: one savage but friendly line about the culprit.
- No two suspects share a name. Use everyday Kolkata names.

---

## TASK 2 — `components/ShareCard.tsx`

Write a client React component (`"use client"`) that draws a shareable **1080×1920 "newspaper front page"** onto an HTML canvas and offers download/share. No external libraries.

Props:
```ts
{ headline: string; caseTitle: string; roast: string; caught: boolean;
  votes: { voterName: string; targetName: string }[]; siteUrl?: string }
```
Design: aged paper background `#EFE6D3` with subtle noise, masthead "THE KAUN? TIMES" in a serif, date line "Kolkata · Late City Edition", huge headline, a red rubber stamp rotated −8° saying "CASE CLOSED" (or "CULPRIT ESCAPED" in black when `caught` is false), the roast in italic quotes, a "WHO BLAMED WHOM" list of votes, footer "Play at {siteUrl}". Wrap long text properly. Wait for `document.fonts.ready` before drawing.
Show a scaled preview (max-width 320px) and two buttons: **Download** (PNG) and **Share** (`navigator.share` with a File when supported, otherwise download).

---

## TASK 3 — `README.md`

Write the GitHub README for the hackathon submission (Vibe Coders Hackathon 3, Calcutta AI Club, "Play" track). Sections: one-line pitch · Play it (https://kaun.vercel.app) · How a round works (solo and with friends, as short numbered steps) · How it meets the 3 Play rules (no sign-up, understood in 30 s, round under 3 min) · What the AI actually does (builds a solvable logic puzzle: culprit chosen first, 3 true clues, 2 red herrings, an alibi hole, a secret objective for the culprit; plays 4 suspects who each keep their own story straight; narrates one of two endings depending on the vote) · How it is built (Next.js, Supabase Postgres, server-owned game clock, secrets never sent to the browser, fallback cases if the AI is slow) · Built in one day by a team of 2, with which AI tools · Leave a `## Demo video` heading with a placeholder link line. Plain, confident writing. No emoji walls.
