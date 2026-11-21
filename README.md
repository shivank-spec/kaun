# Kaun?

A 3-minute AI mystery party game set in Kolkata where friends interrogate suspects, argue over petty crimes, and get roasted by a dramatic CID-style narrator.

Built for the **Play** track at **Vibe Coders Hackathon Edition 3** (Calcutta AI Club, AIC Techno).

## Play it

Live at: https://playkaun.vercel.app

## How a round works

**Solo mode:**
1. Tap Play solo and the AI writes a brand-new Kolkata case (a missing rosogolla at KC Das, an unplugged router at AIC Techno).
2. Interrogate 4 AI suspects in 2.5 minutes. Three are innocent but hiding something embarrassing, and one is actively lying.
3. Lock in your accusation before the clock hits zero and hear the dramatic reveal.

**With friends (party mode):**
1. Create a room and share the 4-letter code; friends join on their phones with just a name.
2. Everyone gets a secret role card: one player is the culprit with a mandatory lie to push, and the rest hold partial clues and red herrings.
3. Argue, defend, and accuse out loud before the timer runs out.
4. Vote on your phone for who did it, listen to the voiced narrator reveal, and share the front-page newspaper receipt.

## How it meets the 3 Play rules

- **No sign-up to play:** Zero accounts, passwords, or email prompts. Players enter a name and a 4-letter room code and are inside the lobby in under 20 seconds.
- **Understood in 30 seconds:** Every phone screen opens with a high-contrast role banner ("YOU ARE INNOCENT" or "YOU ARE THE CULPRIT") and a single-sentence objective with two short clues. No rulebook or verbal explanation required.
- **One round under 3 minutes:** A strict server-synced countdown (20 seconds to read your card, 100 seconds of discussion, 30 seconds of voting) keeps a full round at 2.5 minutes, with one-tap replay.

## What the AI actually does

- **Constructs a solvable logic puzzle:** Instead of improvising loose stories, the model returns structured JSON by picking the culprit first, then building 3 interlocking true clues (each held by a different innocent), 2 red herrings tied to harmless personal secrets, a specific hole in the culprit's alibi, and a secret lie the culprit must convince the room of. Every case is then checked by code (`validateCase`) before it is allowed into a game.
- **Roleplays 4 consistent suspects:** In solo interrogations, each suspect responds in their own voice (Hinglish, dramatic, nervous, or posh) while defending their alibi or hiding their innocent secret, and only gives up a clue when the question earns it.
- **Delivers dynamic voiced endings:** Depending on whether the group catches the culprit or frames an innocent friend, the narrator switches between two CID-style Hinglish endings and roasts the culprit on a shareable newspaper front page.

## How it is built

- **Frontend and API:** Next.js (App Router), TypeScript, and Tailwind CSS deployed on Vercel, with an HTML5 Canvas generator for shareable 1080x1920 front-page cards.
- **Multiplayer sync and state:** Supabase Postgres with a server-owned game clock (`phase_ends_at` timestamps) so every phone stays synchronised across phases and survives browser refreshes via `localStorage` session recovery.
- **Strict secret isolation:** In multiplayer, culprit identity and private clues are filtered on the server and never sent to a client until the reveal. In solo, the whole case is AES-encrypted into the case token, so the browser carries it but cannot read it.
- **Zero-stall fallback:** If the AI is slow or returns an illogical case, the server falls back to hand-written, logically airtight Kolkata cases so a round never stalls.
- **Models:** Groq-hosted `gpt-oss-120b` for case writing and suspect roleplay (about 3 seconds per case), Groq Orpheus for the narrator's voice.

Built in one day by a team of 2 using Claude Code, Claude Design and Gemini.

## Demo video

_Link added at submission._
