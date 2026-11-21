import { body, handle } from "@/lib/http";
import { startRoom } from "@/lib/rooms";
import type { RoomSettings } from "@/lib/types";

export const maxDuration = 40;

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await ctx.params;
    const b = await body(req);
    return startRoom(code, String(b.playerId ?? ""), b as Partial<RoomSettings>);
  });
}
