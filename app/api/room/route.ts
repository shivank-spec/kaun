import { body, handle } from "@/lib/http";
import { createRoom } from "@/lib/rooms";
import type { RoomSettings } from "@/lib/types";

export async function POST(req: Request) {
  return handle(async () => {
    const b = await body(req);
    return createRoom(b.name, b as Partial<RoomSettings>, b.lastPower);
  });
}
