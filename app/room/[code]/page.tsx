"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useRoom } from "@/hooks/useRoom";
import { useSession } from "@/hooks/useSession";
import { post, type RoomActions } from "@/components/room/api";
import { playSting, playTick, unlockAudio } from "@/components/room/sounds";
import { Join } from "@/components/room/Join";
import { Lobby } from "@/components/room/Lobby";
import { Generating } from "@/components/room/Generating";
import { Briefing } from "@/components/room/Briefing";
import { Discuss } from "@/components/room/Discuss";
import { Vote } from "@/components/room/Vote";
import { Reveal } from "@/components/room/Reveal";
import type { RoomStatus } from "@/lib/types";
import { MOCK_STATUSES, buildMock, isMockStatus } from "./mock";

export default function RoomPage() {
  return (
    <Suspense fallback={null}>
      <RoomRoute />
    </Suspense>
  );
}

function RoomRoute() {
  const params = useParams<{ code: string }>();
  const search = useSearchParams();
  const code = String(params.code ?? "").toUpperCase();
  const mock = search.get("mock");
  const { ready } = useSession();
  if (!ready) return null; // wait for hydration so we never flash the Join form
  // Remount when the mock status changes so mock timers restart.
  return <Room key={`${code}:${mock ?? ""}`} code={code} mockStatus={isMockStatus(mock) ? mock : null} />;
}

function Room({ code, mockStatus }: { code: string; mockStatus: RoomStatus | null }) {
  const router = useRouter();
  const search = useSearchParams();
  const { session, save, clear } = useSession();
  const mine = session && session.code.toUpperCase() === code ? session : null;

  const [mountedAt] = useState(() => Date.now());
  const [mockVoted, setMockVoted] = useState(false);
  const mockRoom = useMemo(() => {
    if (!mockStatus) return null;
    const t = Number(search.get("t"));
    const n = Number(search.get("players"));
    return buildMock(
      mockStatus,
      {
        role: search.get("role") === "culprit" ? "culprit" : "innocent",
        host: search.get("host") !== "0",
        caught: search.get("caught") !== "0",
        secondsLeft: search.get("t") && Number.isFinite(t) ? t : undefined,
        players: Number.isFinite(n) && n > 0 ? n : undefined,
        youVoted: mockVoted,
      },
      mountedAt,
    );
  }, [mockStatus, search, mountedAt, mockVoted]);

  const { room, error, errorStatus, secondsLeft, refresh } = useRoom(code, mine?.playerId ?? null, { mock: mockRoom });
  const status = room?.status ?? null;

  const actions = useMemo<RoomActions>(() => {
    if (mockStatus) {
      const go = (s: RoomStatus) => {
        const q = new URLSearchParams(search.toString());
        q.set("mock", s);
        q.delete("t");
        router.replace(`?${q}`);
      };
      return {
        start: async () => go("generating"),
        vote: async () => setMockVoted(true),
        again: async () => go("lobby"),
      };
    }
    const base = `/api/room/${code}`;
    const playerId = mine?.playerId;
    const run = async (path: string, body: object) => {
      await post(`${base}/${path}`, { playerId, ...body });
      refresh();
    };
    return {
      start: (setting, tone) => run("start", { setting, tone }),
      vote: (targetId) => run("vote", { targetId }),
      again: () => run("again", {}),
    };
  }, [mockStatus, code, mine?.playerId, refresh, router, search]);

  // Sounds follow the server's clock: one tick per displayed second, never our own timer.
  useEffect(() => {
    if (status === "discuss" && secondsLeft != null && secondsLeft > 0 && secondsLeft <= 20) playTick(secondsLeft <= 5);
  }, [status, secondsLeft]);
  useEffect(() => {
    if (status === "reveal") playSting();
  }, [status]);

  // Keep the phone awake during a round.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
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
  if (!mockStatus && !mine) {
    body = <Join code={code} defaultName={session?.name} onJoined={(playerId, name) => save({ code, playerId, name })} />;
  } else if (!room) {
    body = (
      <div className="k-screen items-center justify-center text-center">
        {error ? (
          <>
            <h1 className="k-serif text-[40px]">{errorStatus === 404 ? "No such room" : "Can't reach the room"}</h1>
            <p className="text-[var(--k-muted)]">
              {error}. {errorStatus === 404 ? `Check the code ${code}.` : "Still trying..."}
            </p>
            <button type="button" className="k-btn k-btn-ghost" onClick={clear}>
              Join again with a new name
            </button>
            <button type="button" className="k-btn" onClick={() => router.push("/")}>
              Back to home
            </button>
          </>
        ) : (
          <p className="k-mono k-pulse text-[var(--k-yellow)]">Finding room {code}...</p>
        )}
      </div>
    );
  } else if (!room.you && room.status === "lobby") {
    // Our saved player is no longer in this room (server restarted, or kicked).
    body = (
      <Join
        code={code}
        defaultName={mine?.name}
        note="Your seat was lost. Join again."
        onJoined={(playerId, name) => save({ code, playerId, name })}
      />
    );
  } else {
    switch (room.status) {
      case "lobby":
        body = <Lobby room={room} actions={actions} />;
        break;
      case "generating":
        body = <Generating room={room} />;
        break;
      case "briefing":
        body = <Briefing room={room} secondsLeft={secondsLeft} />;
        break;
      case "discuss":
        body = <Discuss room={room} secondsLeft={secondsLeft} />;
        break;
      case "vote":
        body = <Vote room={room} secondsLeft={secondsLeft} actions={actions} />;
        break;
      case "reveal":
        body = <Reveal room={room} actions={actions} mock={!!mockStatus} />;
        break;
      default:
        body = <div className="k-screen items-center justify-center">Loading...</div>;
    }
  }

  return (
    <main className="h-full" onPointerDown={unlockAudio}>
      {error && room && (
        <div role="status" className="fixed top-0 inset-x-0 z-50 bg-[var(--k-yellow)] text-[var(--k-ink)] text-center text-[12px] font-bold py-1">
          Reconnecting...
        </div>
      )}
      {mockStatus && (
        <button
          type="button"
          className="fixed bottom-1 right-1 z-50 rounded bg-black/70 px-2 py-1 text-[10px] text-[var(--k-yellow)]"
          onClick={() => {
            const q = new URLSearchParams(search.toString());
            q.set("mock", MOCK_STATUSES[(MOCK_STATUSES.indexOf(mockStatus) + 1) % MOCK_STATUSES.length]);
            q.delete("t");
            router.replace(`?${q}`);
          }}
        >
          MOCK: {mockStatus} →
        </button>
      )}
      {body}
    </main>
  );
}
