# Paste this whole thing into Claude Design (Laptop B)

Design the complete mobile UI for **"Kaun?"**, a 3-minute AI mystery party game set in Kolkata. Strangers must understand each screen in 30 seconds with nobody explaining. It is played on a phone held in one hand, in a noisy room.

## Hard rules
- **Mobile-first, 375×812.** Vertical only. No sidebars, no hover states, no scrolling during active play. Also looks fine centred on desktop (max-width 430px column on a dark background).
- **One job per screen.** A huge one-line mission at the top, then the action. No paragraphs of instructions anywhere.
- **Giant touch targets** (min 56px tall). Buttons full width.
- **No sign-up, no email, no avatars to upload.** Only a name and a 4-letter room code.
- Deliver as **React + Tailwind components** (Next.js App Router, TypeScript), one file per screen, with props for all dynamic text. No data fetching inside components: every value comes in as a prop, every action is an `onX` callback prop.
- No emoji as icons. No purple gradients. No generic "AI app" look.

## Look and feel
- **Kolkata noir detective case file.** Near-black warm background (#0E0C0A), aged paper cards (#EFE6D3) with subtle grain, typewriter-style stamps ("CONFIDENTIAL", "CASE CLOSED").
- **One accent:** taxi yellow (#F5B700) for primary buttons and the timer. **Crimson (#C1272D)** only for "culprit". **Teal-green (#1F8A70)** only for "innocent".
- **Fonts:** Instrument Serif for headlines and case titles, Geist (or Inter Tight) for UI, Special Elite or IBM Plex Mono for stamps, clues and timers.
- Motion: cards flip to reveal secrets, stamps thud in, the timer pulses red in the last 20 seconds. Keep animations under 400ms.
- Real texture and photography feel, not flat colour blocks: paper grain, a faint Kolkata skyline or tram-line photo behind the home screen, red evidence string, polaroid-style suspect cards.

## Screens to design (in this order)

1. **Home** — Logo "Kaun?" big. Tagline: "A new mystery every 3 minutes." Three buttons: **Play solo** (primary), **Play with friends**, **Join with code** (4-letter input). Small toggles: Setting = `Kolkata` / `This hackathon room` / custom text (max 3 words). Tone = `Desi Drama` / `Noir`.

2. **Generating** — "Opening case file…" with a case folder animating open and rotating one-liners ("Dusting for fingerprints…"). Must look good for up to 8 seconds.

3. **Solo: Case briefing** — Case title, 2-line crime summary, 4 suspect polaroid cards (name, role, one-line alibi). Button: **Start interrogation**. Timer starts on tap.

4. **Solo: Interrogation** — Top: countdown timer (2:30) and "Clues found 1/3". Tabs or a horizontal row of the 4 suspects; tapping one opens their chat. Chat bubbles (suspect replies in their own voice), text input + 3 suggested question chips. A **Case file** drawer showing unlocked clues. Sticky bottom button: **Accuse someone**.

5. **Solo: Accuse** — "Who did it?" 4 huge suspect cards, tap one, confirm.

6. **Multiplayer: Lobby** — Giant room code + QR code + "Share link" button. Live list of joined players (names only). Host sees setting/tone toggles and **Start case** (disabled until 3 players). Others see "Waiting for host…".

7. **Multiplayer: Secret card** — Full-screen card, face down: "Tap to see your role. Don't show anyone." Flips to a **massive role banner**:
   - Innocent (teal): "YOU ARE INNOCENT. Find who stole the rosogolla."
   - Culprit (crimson): "YOU ARE THE CULPRIT. Lie. Blame someone else."
   Below it: exactly 2 clue bullets. Culprit also gets a "Secret objective" box.

8. **Multiplayer: Discussion** — Huge countdown at top. Role banner stays pinned (smaller). Their 2 clues. A "Hide my screen" button that blurs everything. Text: "Talk out loud. Accuse someone."

9. **Multiplayer: Hot seat (optional overlay)** — Screen freezes, one player's name in huge type, an incriminating question, 15-second countdown.

10. **Multiplayer: Vote** — "Who did it?" Huge player-name cards, one tap locks the vote. Shows who has voted (ticks), never who they voted for.

11. **Reveal** — Dramatic: stamp "CASE CLOSED" or "CULPRIT ESCAPED". Culprit name huge. The narrator's story text with a **Play audio / Replay** button. Vote breakdown (who voted for whom). Solo version shows a detective score (time, clues found, verdict).

12. **Share card** — A vertical 1080×1920 "newspaper front page" for Instagram Stories: headline ("BREAKING: Aarav arrested in KC Das rosogolla heist"), one-line roast, vote breakdown, "Play at playkaun.vercel.app". Buttons under it: **Download**, **Play again (same room)**.

## States to include
Loading, error ("The detective lost signal. Retry"), reconnecting banner, empty lobby, timer under 20 s, vote locked.

## Example content to use in the mock-ups
Case: "The Last Rosogolla at KC Das". Suspects/players: Shivank, Rohan, Priya, Aarav. Clues: "Someone had syrup on their sleeve at 8:15 pm." "The shop CCTV went blank for 2 minutes." Roast: "Aarav, even the rosogolla had a better alibi."

Give me every screen as a separate component file plus a `tokens.css` with the colours and fonts.
