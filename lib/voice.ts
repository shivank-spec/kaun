import crypto from "crypto";
import { database } from "./store";

// The narrator's voice. Order: cache -> Groq Orpheus -> Gemini TTS.
// Audio is cached by text, and concurrent requests for the same text wait for
// the first one, so a whole room costs one generation.

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
    : "Read this in English like an over-the-top TV crime show narrator, with dramatic pauses, in a natural Indian English accent";
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
      signal: AbortSignal.timeout(40000),
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

export interface Narration {
  audio: Buffer;
  source: "cache" | "groq" | "gemini";
}

/** WAV audio for this text, or null if no voice is available right now. */
export async function narrate(rawText: string, noir: boolean): Promise<Narration | null> {
  const text = rawText.slice(0, 900).trim();
  if (!text) return null;
  const hash = crypto.createHash("sha1").update(`${noir ? "n" : "d"}:${text}`).digest("hex");
  const db = database();

  const cached = async () => {
    if (!db) return null;
    const { data } = await db.from("tts_cache").select("audio_b64").eq("hash", hash).maybeSingle();
    return data ?? null;
  };

  const hit = await cached();
  if (hit?.audio_b64) return { audio: Buffer.from(hit.audio_b64, "base64"), source: "cache" };

  // Claim the job. If someone else already claimed it, wait for their result.
  if (db) {
    const { error } = await db.from("tts_cache").insert({ hash, audio_b64: "" });
    if (error) {
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const row = await cached();
        if (!row) break; // the other request failed and released the claim
        if (row.audio_b64) return { audio: Buffer.from(row.audio_b64, "base64"), source: "cache" };
      }
    }
  }

  const errors: string[] = [];
  for (const [source, speak] of [
    ["groq", () => groqVoice(text)],
    ["gemini", () => geminiVoice(text, noir)],
  ] as const) {
    try {
      const audio = await speak();
      if (db) await db.from("tts_cache").upsert({ hash, audio_b64: audio.toString("base64") });
      return { audio, source };
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
  if (db) await db.from("tts_cache").delete().eq("hash", hash).eq("audio_b64", "");
  console.warn("[voice]", errors.join(" | "));
  return null;
}
