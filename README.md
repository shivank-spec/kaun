# Alibi

_Built as "Kaun?" and renamed on the day; the repository keeps the original name._

A 3-minute AI mystery party game set in Kolkata. Interrogate four suspects on your own, or get a secret role card and accuse your friends out loud. A dramatic CID-style narrator reveals who did it.

Built in one day for the **Play** track at **Vibe Coders Hackathon Edition 3** (Calcutta AI Club, AIC Techno, 21 November 2026).

**Play it:** https://playalibi.vercel.app

## Demo video

[Watch the 60-second demo](https://github.com/shivank-spec/kaun/blob/main/demo/Alibi-demo.mp4)

## How a round works

**Solo (under 3 minutes)**
1. Tap **Play Solo**. A new case opens in a neutral setting anyone can picture: a locker room, a studio, a lab, a kitchen.
2. You get the crime (what, when, where), four suspects and a small number of moves. Search the scene, then tap a suspect to question them.
3. **Ask** gets an answer and sometimes a clue. **Push harder** makes an innocent suspect admit their embarrassing secret. **Show them evidence** breaks the culprit's story if the evidence is real.
4. Accuse someone before the clock or your moves run out.
5. The narrator reads the reveal, you earn XP, and your score goes on today's leaderboard.

**With friends**
1. Tap **Play with Friends** and share the 4-letter code or QR. Friends join with only a name.
2. A room always has **six to eight suspects and never an empty seat**. AI suspects fill the seats your friends do not, with different names in every room.
3. Every phone shows a secret card: **INNOCENT** with what you saw, **CULPRIT** with a lie to sell, or sometimes **ACCOMPLICE**: you know who did it and must help them escape.
4. Talk it out loud. Tap any suspect to question them: an AI suspect answers in character (and lies if guilty), a friend gets the question on their own screen and answers out loud.
5. **Secret powers, one use each, different every round.** Innocents get a Lie detector (is this evidence planted?), Rule out two (cross two innocent suspects off your list) or a Double vote. The culprit can plant fake evidence or cut the lights, which destroys one piece of evidence for good.
6. Everyone votes. The end screen shows who did it, **why**, how the room voted, and every dirty trick that was played. One tap plays again with a new case.

In rooms with fewer than four friends, an AI suspect can be the culprit. It frames a real player, cuts the lights, or both, and never votes for itself.

There are three difficulty levels. New players start on Easy and a three-step "How to play" appears the first time. The host can pause the clock or end a phase early at any time.

## How it meets the three Play rules

| Rule | How |
|---|---|
| No sign-up, in within a minute | No accounts or email. A name and a 4-letter code. Solo needs nothing at all. |
| Understood in 30 seconds | Every screen leads with one line: who you are and what to do. No rulebook. |
| One round under 3 minutes | Solo runs on a 2:00 to 2:50 clock. With friends the server owns the clock and the host ends the discussion as soon as the room is ready; left alone, the longest setting gives 3:00 of discussion. |

## What the AI actually does

- **Writes a solvable puzzle, not a loose story.** The model returns structured JSON: it picks the culprit first, then a motive, a method and a timeline, then three true clues each held by a different innocent, two red herrings explained by harmless secrets, the hole in the culprit's alibi, and a lie the culprit must push. `validateCase` in `lib/generate-case.ts` rejects any case that breaks those rules before it reaches a player.
- **Plays the suspects, in solo and in rooms, and keeps their stories straight.** Each suspect has a persona, an alibi and a secret. The culprit lies and gets flustered when pressed on the alibi hole. Innocent suspects dodge, then admit their embarrassing secret.
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
