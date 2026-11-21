# Kaun? — API contract (everyone builds against this)

Types live in `lib/types.ts`. All bodies are JSON. Errors: `{ "error": "message" }` with a 4xx/5xx status.

## Who owns what (never edit another owner's files)
| Owner | Files |
|---|---|
| **Laptop A — Claude Code (Shivank)** | `lib/**`, `app/api/**`, `supabase/**`, `app/solo/**`, `app/page.tsx` |
| **Laptop B — Claude Code (teammate)** | `app/room/**`, `components/room/**`, `hooks/**`, `public/sounds/**` |
| **Gemini (Shivank)** | `lib/fallback-cases.ts`, `components/ShareCard.tsx`, `README.md` |
| **Claude Design (Shivank)** | `components/ui/**`, `app/tokens.css` (pasted in by Laptop A) |

## Solo
- `POST /api/case` body `{ setting?: string, tone?: "desi"|"noir" }` → `SoloCaseView`
- `POST /api/interrogate` body `{ caseId, suspectId, message, history: ChatMessage[], foundClueIds: string[] }` → `InterrogateResponse`
- `POST /api/accuse` body `{ caseId, suspectId, foundClueIds: string[], secondsUsed: number }` → `SoloVerdict`

## Multiplayer
- `POST /api/room` body `{ name, setting?, tone?, demo? }` → `{ code, playerId }` (creator is host)
- `POST /api/room/[code]/join` body `{ name }` → `{ playerId }` (only while `lobby`)
- `GET  /api/room/[code]?playerId=...` → `RoomView` (**poll every 1500 ms**)
- `POST /api/room/[code]/start` body `{ playerId, setting?, tone? }` → `{ ok: true }` (host only, min 3 players)
- `POST /api/room/[code]/vote` body `{ playerId, targetId }` → `{ ok: true }`
- `POST /api/room/[code]/again` body `{ playerId }` → `{ ok: true }` (host only; back to `lobby`, same players)

## Voice
- `POST /api/tts` body `{ text, tone? }` → `audio/mpeg`

## Rules every client must follow
1. **The server owns the clock.** Never run your own phase timer. Countdown = `phaseEndsAt - serverNow`, re-synced on every poll. The server moves the phase forward itself.
2. **Phases:** `lobby → generating → briefing (20 s) → discuss (100 s, 45 s in demo) → vote (30 s) → reveal`. Render purely from `RoomView.status`.
3. **Secrets:** a player only ever receives their own `you.card`. The culprit is unknown to the client until `reveal`.
4. **Reconnect:** save `{ code, playerId, name }` in `localStorage` key `kaun.session`. On load, if it exists, go straight to `/room/[code]` and resume.
5. **No sign-up.** Name + 4-letter code only.
6. Mobile-first 375×812, no scrolling during active play, touch targets ≥ 56 px.
