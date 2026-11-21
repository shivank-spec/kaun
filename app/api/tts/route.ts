import { NextResponse } from "next/server";
import { body } from "@/lib/http";
import { narrate } from "@/lib/voice";

export const maxDuration = 60;

// Returns audio/wav, or 503 so the client can fall back to the phone's own voice.
export async function POST(req: Request) {
  const b = await body(req);
  const text = String(b.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "No text" }, { status: 400 });
  const out = await narrate(text, b.tone === "noir");
  if (!out) return NextResponse.json({ error: "Voice unavailable" }, { status: 503 });
  return new NextResponse(new Uint8Array(out.audio), {
    headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store", "X-Voice": out.source },
  });
}
