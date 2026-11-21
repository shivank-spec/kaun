"use client";

import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo } from "react";
import { Briefing, Discuss, Join, Lobby, Verdict, Vote, type RoomActions } from "@/components/game/RoomScreens";
import { post } from "@/components/room/api";
import { Loading, sfx, unlockSfx } from "@/components/ui/kit";
import { useRoom } from "@/hooks/useRoom";
import { useSession } from "@/hooks/useSession";

export default function RoomPage() {
  return (
    <Suspense fallback={null}>
      <RoomRoute />
    </Suspense>
  );
}

function RoomRoute() {
  const params = useParams<{ code: string }>();
  const code = String(params.code ?? "").toUpperCase();
  const { ready } = useSession();
  if (!ready) return null; // wait for hydration so we never flash the Join form
  return <Room key={code} code={code} />;
}

function Room({ code }: { code: string }) {
  const router = useRouter();
  const { session, save, clear } = useSession();
  // A refreshed phone picks its seat back up from localStorage.
  const mine = session && session.code.toUpperCase() === code ? session : null;
  const { room, error, errorStatus, secondsLeft, refresh } = useRoom(code, mine?.playerId ?? null);
  const status = room?.status ?? null;

  const actions = useMemo<RoomActions>(() => {
    const base = `/api/room/${code}`;
    const playerId = mine?.playerId;
    const run = async (path: string, body: object) => {
      await post(`${base}/${path}`, { playerId, ...body });
      refresh();
    };
    return {
      start: (setting, tone, difficulty) => run("start", { setting, tone, difficulty }),
      vote: (targetId) => run("vote", { targetId }),
      again: () => run("again", {}),
      doubt: (targetId) => run("doubt", { targetId }),
      skip: () => run("skip", {}),
      pause: () => run("pause", {}),
      power: (power, opts) => post<{ real?: boolean; clearedName?: string; extra?: number }>(`${base}/power`, { playerId, power, ...opts }).then((r) => {
        refresh();
        return r;
      }),
      ask: (targetId, question) =>
        post<{ reply?: string; delivered?: boolean }>(`${base}/ask`, { playerId, targetId, question }),
      home: () => {
        clear(); // leaving the room on purpose: no Rejoin button afterwards
        router.push("/");
      },
    };
  }, [code, mine?.playerId, refresh, router, clear]);

  // Sound: a tick for the last ten seconds of talking, a sting on the reveal.
  useEffect(() => {
    if (status === "discuss" && !room?.paused && secondsLeft != null && secondsLeft > 0 && secondsLeft <= 10) sfx.tick(secondsLeft <= 5);
  }, [status, secondsLeft, room?.paused]);
  useEffect(() => {
    if (status === "reveal") sfx.sting();
    // Ask the server to get the narrator ready while everyone is still arguing.
    if (status === "discuss" && mine?.playerId) {
      void post(`/api/room/${code}/warm`, { playerId: mine.playerId }).catch(() => {});
    }
    if (status === "briefing" || status === "vote") sfx.clue();
  }, [status, code, mine?.playerId]);

  // While this phone is in the room, keep its seat marked as recent.
  useEffect(() => {
    if (!mine?.playerId) return;
    // Its own key, so updating it never changes the session React is watching.
    const touch = () => {
      try {
        localStorage.setItem("kaun.active", String(Date.now()));
      } catch {}
    };
    touch();
    const t = setInterval(touch, 60000);
    return () => clearInterval(t);
  }, [mine?.playerId]);

  // Keep the phone awake during a round.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> };
    };
    const acquire = () => {
      if (document.visibilityState !== "visible") return;
      nav.wakeLock
        ?.request("screen")
        .then((l) => {
          lock = l;
        })
        .catch(() => {});
    };
    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      document.removeEventListener("visibilitychange", acquire);
      void lock?.release().catch(() => {});
    };
  }, []);

  let body: React.ReactNode;
  if (!mine) {
    body = <Join code={code} defaultName={session?.name} onJoined={(playerId, name) => save({ code, playerId, name })} onHome={() => router.push("/")} />;
  } else if (!room) {
    body = error ? (
      <main className="screen alarm items-center justify-center gap-4 text-center">
        <p className="eyebrow m-0" style={{ color: "#ff8098" }}>
          {errorStatus === 404 ? "No such room" : "Signal lost"}
        </p>
        <p className="display m-0 text-[30px]">{errorStatus === 404 ? `Room ${code} does not exist.` : "Can't reach the room."}</p>
        <p className="m-0 text-mist">{errorStatus === 404 ? "Check the code and try again." : "Still trying to reconnect."}</p>
        <button
          type="button"
          className="btn btn-primary tap"
          onClick={() => {
            clear();
            router.push("/");
          }}
        >
          Back to home
        </button>
      </main>
    ) : (
      <Loading title={`Finding room ${code}`} />
    );
  } else if (!room.you) {
    body =
      room.status === "lobby" ? (
        <Join code={code} defaultName={mine.name} note="Your seat was lost. Join again." onJoined={(playerId, name) => save({ code, playerId, name })} onHome={() => router.push("/")} />
      ) : (
        <main className="screen warm items-center justify-center gap-4 text-center">
          <p className="eyebrow m-0">Round in progress</p>
          <p className="display m-0 text-[28px]">This room is mid-case.</p>
          <p className="m-0 text-mist">You can join when the round ends.</p>
          <button type="button" className="btn btn-glass tap" onClick={() => router.push("/")}>
            Back to home
          </button>
        </main>
      );
  } else {
    // While paused the server sends no end time, so show the frozen clock.
    const props = { room, actions, secondsLeft: room.paused ? (room.pausedSecondsLeft ?? 0) : secondsLeft };
    switch (room.status) {
      case "lobby":
        body = <Lobby {...props} />;
        break;
      case "generating":
        body = <Loading title="Writing your case" />;
        break;
      case "briefing":
        body = <Briefing {...props} />;
        break;
      case "discuss":
        body = <Discuss {...props} />;
        break;
      case "vote":
        body = <Vote {...props} />;
        break;
      case "reveal":
        body = room.reveal ? <Verdict {...props} /> : <Loading title="Opening the verdict" />;
        break;
    }
  }

  return (
    // Keyed by phase so every change of phase plays the screen transition.
    <div key={status ?? "none"} className="relative" onPointerDown={unlockSfx}>
      {body}
      {/* Host control: freeze the round for everyone. */}
      {room?.you?.isHost && !room.paused && (status === "briefing" || status === "discuss" || status === "vote") && (
        <button
          type="button"
          onClick={() => void actions.pause().catch(() => {})}
          className="tap label absolute right-4 top-[max(18px,env(safe-area-inset-top))] z-30 rounded-full border-0 px-3 py-2 text-snow"
          style={{ background: "rgba(12,18,34,.9)", boxShadow: "inset 0 0 0 1px rgba(130,180,230,.4)" }}
        >
          Pause
        </button>
      )}
      {room?.paused && (
        <div className="scrim !justify-center px-6" role="alert" style={{ zIndex: 60, background: "rgba(6,10,20,.93)" }}>
          <div className="rise text-center">
            <p className="eyebrow m-0">Paused</p>
            <p className="display m-0 mt-3 text-[clamp(30px,9.5vw,40px)]">The host paused the game</p>
            <p className="mono m-0 mt-4 text-[34px]">
              {String(Math.floor((room.pausedSecondsLeft ?? 0) / 60)).padStart(2, "0")}:{String((room.pausedSecondsLeft ?? 0) % 60).padStart(2, "0")}
            </p>
            <p className="label mt-2">left on the clock</p>
            {room.you?.isHost ? (
              <button type="button" className="btn btn-primary tap mt-6" onClick={() => void actions.pause().catch(() => {})}>
                Resume
              </button>
            ) : (
              <p className="blink mt-6 text-[15px] text-mist">Waiting for the host to resume</p>
            )}
          </div>
        </div>
      )}
      {mine && room && error && (
        <p className="label fixed inset-x-0 top-1 z-40 text-center text-[#ff8098]" role="status">
          Reconnecting
        </p>
      )}
    </div>
  );
}
