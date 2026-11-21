# Alibi

_Built as "Kaun?" and renamed on the day; the repository keeps the original name._

A 3-minute AI mystery party game set in Kolkata. Interrogate four suspects on your own, or get a secret role card and accuse your friends out loud. A dramatic CID-style narrator reveals who did it.

Built in one day for the **Play** track at **Vibe Coders Hackathon Edition 3** (Calcutta AI Club, AIC Techno, 21 November 2026).

**Play it:** https://playalibi.vercel.app

## Demo video

_Link added at submission._

## How a round works

**Solo (2.5 minutes, 6 moves)**
1. Tap **Play Solo**. A new case opens: a missing rosogolla at KC Das, an unplugged router on the hackathon floor, or a setting you type yourself.
2. You get a map of the scene, four suspects and **six moves**. Tap a glowing spot to search it. Tap a suspect to walk up to them.
3. **Ask** (1 move) gets an answer and sometimes a clue. **Press** (2 moves) makes an innocent suspect crack and admit their embarrassing secret. **Confront** (1 move) puts a piece of evidence in front of them: do it to the culprit with real evidence and their story breaks.
4. The evidence lying around the scene points at the wrong people. The truth comes from the witnesses. Accuse someone before the clock or your moves run out.
5. The narrator reads the reveal, you earn XP, and your score goes on today's leaderboard.

**With friends (2.5 minutes)**
1. Tap **Play with friends** and share the 4-letter code or QR. Friends join with only a name.
2. Every phone shows a secret card: **YOU ARE INNOCENT** with two things you saw, or **YOU ARE THE CULPRIT** with a lie you must sell.
3. Argue out loud for 100 seconds. Tap a player to mark who you doubt, and everyone's **doubt meter** moves live. Halfway through, the **Hot Seat** freezes every screen and puts one player on the spot with an awkward question.
4. Everyone votes on their phone. The narrator reveals the truth and roasts the culprit. One tap plays again with a new case.

A room always has at least five suspects. If fewer friends are playing, AI suspects fill the seats: their evidence drops into the room one piece at a time during the discussion, and they vote.

There are three difficulty levels. New players start on Easy and a three-step "How to play" appears the first time.

## How it meets the three Play rules

| Rule | How |
|---|---|
| No sign-up, in within a minute | No accounts or email. A name and a 4-letter code. Solo needs nothing at all. |
| Understood in 30 seconds | Every screen leads with one line: who you are and what to do. No rulebook. |
| One round under 3 minutes | A server-owned clock: 20 s to read your card, 100 s to argue, 30 s to vote. |

## What the AI actually does

- **Writes a solvable puzzle, not a loose story.** The model returns structured JSON: it picks the culprit first, then a motive, a method and a timeline, then three true clues each held by a different innocent, two red herrings explained by harmless secrets, the hole in the culprit's alibi, and a lie the culprit must push. `validateCase` in `lib/generate-case.ts` rejects any case that breaks those rules before it reaches a player.
- **Plays four suspects who keep their stories straight.** Each suspect has a persona, an alibi and a secret. The culprit lies and gets flustered when pressed on the alibi hole. Innocent suspects dodge, then admit their embarrassing secret.
- **Writes the multiplayer case about the real players**, by name, and makes it a puzzle: at most one clue names the culprit directly; the rest point through details players must match up by talking.
- **Narrates the ending** in a generated voice, with a different ending depending on whether the room caught the culprit.

## How it is built

- **Next.js 16 (App Router), TypeScript, Tailwind**, deployed on Vercel.
- **Supabase Postgres**, reached only from the server. Tables: `rooms`, `players`, `scores`, `case_pool`, `tts_cache` (see `supabase/schema.sql`).
- **The server owns the game clock.** Each phase has a `phase_ends_at` timestamp and the server moves the room forward. Phones poll every 1.5 seconds and only display, so they cannot drift apart, and a refreshed phone drops straight back into the right phase (`lib/rooms.ts`).
- **Secrets never reach the wrong phone.** In multiplayer each player receives only their own card until the reveal. In solo the whole case is AES-encrypted into the case token, so the browser carries it but cannot read it (`lib/seal.ts`).
- **Built to survive free AI limits.** Calls rotate across five free quotas (three Groq models, two Gemini models) in `lib/ai.ts`. Solo cases are served mostly from a bank of cases the AI wrote earlier (`lib/pool.ts`). Case writing has a hard 13-second budget.
- **It keeps working with the AI switched off.** If every provider fails, a new case comes from the bank or from four hand-written cases, and suspects answer from the case facts and can still give up their clues.
- **One narration per room.** Narrator audio is generated once and cached, so four phones cost one voice call (`app/api/tts/route.ts`).
- **The rules decide, the AI performs.** Whether a move unlocks a clue, clears a suspect or breaks the culprit's story is decided by code in `lib/solo.ts`; the model only writes the line the suspect says.
- **Scores are computed on the server** from the sealed case, so the leaderboard cannot be faked from the browser.

`/api/health` reports which AI providers and the database are answering.

## Run it locally

```bash
npm install
# .env.local needs GROQ_API_KEY (and optionally GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
npm run dev
npm test
```

Without Supabase keys the game uses an in-memory store, which is enough for local play.

## Who built what

A team of two, in one day, with AI tools:

- **Claude Code (laptop A):** case engine, solo mode, server routes, database, voice, resilience.
- **Claude Code (laptop B):** the multiplayer room screens and sounds.
- **Gemini:** the four hand-written fallback cases, the share card, the first draft of this README.
- **Claude Design:** the visual design.

The prompts we gave each tool are in `docs/`, and the contract they all built against is `docs/CONTRACT.md`.
