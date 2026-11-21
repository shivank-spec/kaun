import { handle } from "@/lib/http";
import { getRoomView } from "@/lib/rooms";


// Long enough for the narrator warm-up that runs after the response.
export const maxDuration = 60;

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await ctx.params;
    return getRoomView(code, new URL(req.url).searchParams.get("playerId"));
  });
}
