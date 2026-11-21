import { NextResponse } from "next/server";
import { body } from "@/lib/http";

export const maxDuration = 30;

// Narrator voice via Groq's Orpheus model. Returns audio, or 503 so the
// client can fall back to the browser's built-in speech.
export async function POST(req: Request) {
  const b = await body(req);
  const text = String(b.text ?? "").slice(0, 900);
  if (!text.trim()) return NextResponse.json({ error: "No text" }, { status: 400 });
  try {
    const res = await fetch("https://api.groq.com/openai/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "canopylabs/orpheus-v1-english",
        voice: "troy",
        input: text,
        response_format: "wav",
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
    return new NextResponse(res.body, {
      headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.warn("[tts]", (e as Error).message);
    return NextResponse.json({ error: "Voice unavailable" }, { status: 503 });
  }
}
