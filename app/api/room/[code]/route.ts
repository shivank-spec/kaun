import { handle } from "@/lib/http";
import { getRoomView } from "@/lib/rooms";


export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await ctx.params;
    return getRoomView(code, new URL(req.url).searchParams.get("playerId"));
  });
}
