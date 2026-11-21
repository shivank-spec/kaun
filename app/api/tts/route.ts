import crypto from "crypto";
import { NextResponse } from "next/server";
import { body } from "@/lib/http";
import { database } from "@/lib/store";

export const maxDuration = 40;

// The narrator's voice. Order: cache -> Groq Orpheus -> Gemini TTS.
// Always returns audio/wav, or 503 so the client can fall back to browser speech.

/** Wrap raw 16-bit mono PCM in a WAV header so every browser can play it. */
function pcmToWav(pcm: Buffer, sampleRate = 24000): Buffer {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(sampleRate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

async function groqVoice(text: string): Promise<Buffer> {
  const res = await fetch("https://api.groq.com/openai/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "canopylabs/orpheus-v1-english", voice: "troy", input: text, response_format: "wav" }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`groq ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function geminiVoice(text: string, noir: boolean): Promise<Buffer> {
  const style = noir
    ? "Read this like a dry, world-weary noir detective narrator"
    : "Read this like an over-the-top Indian TV crime show narrator, dramatic pauses, in a natural Indian accent";
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent",
    {
      method: "POST",
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY || "", "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${style}: ${text}` }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Charon" } } },
        },
      }),
      signal: AbortSignal.timeout(25000),
    },
  );
  if (!res.ok) throw new Error(`gemini ${res.status} ${(await res.text()).replace(/\s+/g, " ").slice(0, 160)}`);
  const json = await res.json();
  const part = json?.candidates?.[0]?.content?.parts?.find((p: { inlineData?: unknown }) => p.inlineData);
  const b64 = part?.inlineData?.data as string | undefined;
  if (!b64) throw new Error("gemini returned no audio");
  const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType || "")?.[1]) || 24000;
  return pcmToWav(Buffer.from(b64, "base64"), rate);
}

const wav = (audio: Buffer, source: string) =>
  new NextResponse(new Uint8Array(audio), {
    headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store", "X-Voice": source },
  });

export async function POST(req: Request) {
  const b = await body(req);
  const text = String(b.text ?? "").slice(0, 900).trim();
  if (!text) return NextResponse.json({ error: "No text" }, { status: 400 });
  const noir = b.tone === "noir";
  const hash = crypto.createHash("sha1").update(`${noir ? "n" : "d"}:${text}`).digest("hex");
  const db = database();

  const cached = async () => {
    if (!db) return null;
    const { data } = await db.from("tts_cache").select("audio_b64").eq("hash", hash).maybeSingle();
    return data ?? null;
  };

  const hit = await cached();
  if (hit?.audio_b64) return wav(Buffer.from(hit.audio_b64, "base64"), "cache");

  // Claim the job. If another phone in the room already claimed it, wait for
  // its result instead of paying for the same narration again.
  if (db) {
    const { error } = await db.from("tts_cache").insert({ hash, audio_b64: "" });
    if (error) {
      for (let i = 0; i < 22; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const row = await cached();
        if (!row) break; // the other request failed and released the claim
        if (row.audio_b64) return wav(Buffer.from(row.audio_b64, "base64"), "cache");
      }
    }
  }

  const errors: string[] = [];
  for (const [name, speak] of [
    ["groq", () => groqVoice(text)],
    ["gemini", () => geminiVoice(text, noir)],
  ] as const) {
    try {
      const audio = await speak();
      if (db) await db.from("tts_cache").upsert({ hash, audio_b64: audio.toString("base64") });
      return wav(audio, name);
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
  if (db) await db.from("tts_cache").delete().eq("hash", hash).eq("audio_b64", "");
  console.warn("[tts]", errors.join(" | "));
  return NextResponse.json({ error: "Voice unavailable", detail: errors }, { status: 503 });
}
