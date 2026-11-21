# Paste into Claude Code on Laptop B (teammate)

You are building the **multiplayer screens** of "Kaun?", a 3-minute AI mystery party game, at a hackathon. Hands-off is 4:45 pm today. Another Claude on another laptop is building the backend at the same time, so follow the contract exactly.

## Setup
```bash
git clone https://github.com/shivank-spec/kaun.git && cd kaun && npm install && npm run dev
```
Read `docs/CONTRACT.md` and `lib/types.ts` first. They are the law.

## You own ONLY these paths (never edit anything else)
`app/room/**`, `components/room/**`, `hooks/**`, `public/sounds/**`

## Build
1. `hooks/useRoom.ts` — polls `GET /api/room/[code]?playerId=` every 1500 ms, returns `{ room: RoomView | null, error, secondsLeft }`. `secondsLeft` is computed from `phaseEndsAt - serverNow` (correct for clock drift using the offset between `serverNow` and `Date.now()`; tick the display locally every 250 ms but re-sync on every poll). Keep the last good state on a failed poll and show a small "Reconnecting…" banner.
2. `hooks/useSession.ts` — reads/writes `localStorage["kaun.session"] = { code, playerId, name }`.
3. `app/room/[code]/page.tsx` (client component) — if no session for this code, show a **Join** form (name only) → `POST /api/room/[code]/join`. Otherwise render by `room.status`:
   - `lobby` → huge room code, QR code of the page URL (use the `qrcode.react` package), share-link button (`navigator.share` with clipboard fallback), live player list. Host: setting input (Kolkata / This hackathon room / custom max 3 words), tone toggle (Desi Drama / Noir), **Start case** (disabled under 3 players) → `POST .../start`.
   - `generating` → "Opening case file…" with rotating one-liners.
   - `briefing` → full-screen face-down card "Tap to see your role. Don't show anyone." Flip → giant role banner from `you.card.mission` (teal for innocent, crimson for culprit), exactly the 2 clues, and the objective box for the culprit.
   - `discuss` → huge countdown, pinned role banner, the 2 clues, a "Hide my screen" blur toggle, text "Talk out loud. Accuse someone."
   - `vote` → "Who did it?" giant name cards (not yourself), one tap locks → `POST .../vote`. Show ticks for who has voted, never who they chose.
   - `reveal` → stamp "CASE CLOSED" or "CULPRIT ESCAPED", culprit name huge, `reveal.story`, a **Play audio** button that POSTs `reveal.story` to `/api/tts` and plays the returned mp3 (autoplay once, then keep the button because mobile Safari may block autoplay), vote breakdown, roast line. Host gets **Play again (same room)** → `POST .../again`.
4. Sounds in `public/sounds/`: a ticking loop for the last 20 s of `discuss`, a sting when `reveal` starts. Generate them with the Web Audio API in code if you cannot find free files quickly. Never block the UI on audio.

## Until the backend is ready
Create `app/room/[code]/mock.ts` exporting sample `RoomView` objects for every status, and support `?mock=lobby|briefing|discuss|vote|reveal` so every screen can be built and viewed now. Remove nothing later: the mock mode is handy for demos.

## Hard rules
- Mobile-first 375×812. No scrolling during play. Touch targets ≥ 56 px. No hover-only UI.
- Never run your own phase timer. The server moves phases; you only display.
- Style: dark warm near-black background `#0E0C0A`, aged-paper cards `#EFE6D3`, taxi-yellow `#F5B700` primary, crimson `#C1272D` culprit only, teal `#1F8A70` innocent only. Fonts: Instrument Serif for headlines, Geist for UI, a typewriter mono for clues and timers. Final visual components will arrive from Claude Design in `components/ui/**`; keep your markup simple so they can be swapped in.
- Commit small and often: `git pull --rebase && git push` every 20–30 minutes. Run `npm run build` before each push.
