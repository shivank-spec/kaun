// All sounds are synthesised with the Web Audio API. Every function is
// fire-and-forget and never throws: audio must never block the UI.

let ctx: AudioContext | null = null;

/** Call from a user gesture (tap) so mobile browsers allow sound later. */
export function unlockAudio() {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  } catch {}
}

function ready(): AudioContext | null {
  return ctx && ctx.state === "running" ? ctx : null;
}

function blip(c: AudioContext, at: number, freq: number, dur: number, type: OscillatorType, vol: number) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(vol, at + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

/** One clock tick. Called once per displayed second in the last 20 s of discuss. */
export function playTick(urgent = false) {
  try {
    const c = ready();
    if (!c) return;
    const t = c.currentTime;
    blip(c, t, urgent ? 1500 : 1100, 0.05, "square", 0.12);
    blip(c, t + 0.12, urgent ? 1000 : 750, 0.04, "square", 0.06);
  } catch {}
}

/** Dramatic reveal sting: low hit plus a falling minor chord. */
export function playSting() {
  try {
    const c = ready();
    if (!c) return;
    const t = c.currentTime;
    blip(c, t, 55, 1.6, "sawtooth", 0.3);
    blip(c, t, 110, 1.2, "triangle", 0.25);
    [466.16, 369.99, 311.13].forEach((f, i) => blip(c, t + 0.05 + i * 0.16, f, 1.1, "sawtooth", 0.1));
    blip(c, t + 0.6, 233.08, 1.4, "sawtooth", 0.12);
  } catch {}
}
