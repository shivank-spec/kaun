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
      home: () => router.push("/"),
    };
  }, [code, mine?.playerId, refresh, router]);

  // Sound: a tick for the last ten seconds of talking, a sting on the reveal.
  useEffect(() => {
    if (status === "discuss" && secondsLeft != null && secondsLeft > 0 && secondsLeft <= 10) sfx.tick(secondsLeft <= 5);
  }, [status, secondsLeft]);
  useEffect(() => {
    if (status === "reveal") sfx.sting();
    // Ask the server to get the narrator ready while everyone is still arguing.
    if (status === "discuss" && mine?.playerId) {
      void post(`/api/room/${code}/warm`, { playerId: mine.playerId }).catch(() => {});
    }
    if (status === "briefing" || status === "vote") sfx.clue();
  }, [status, code, mine?.playerId]);

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
    const props = { room, actions, secondsLeft };
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
    <div key={status ?? "none"} onPointerDown={unlockSfx}>
      {body}
      {mine && room && error && (
        <p className="label fixed inset-x-0 top-1 z-40 text-center text-[#ff8098]" role="status">
          Reconnecting
        </p>
      )}
    </div>
  );
}
