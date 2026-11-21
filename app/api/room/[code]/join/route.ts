import { body, handle } from "@/lib/http";
import { joinRoom } from "@/lib/rooms";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await ctx.params;
    const b = await body(req);
    return joinRoom(code, b.name, b.lastPower);
  });
}
