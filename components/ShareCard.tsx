"use client";

import { useEffect, useRef, useState } from "react";

export interface VoteEntry {
  voterName: string;
  targetName: string;
}

export interface ShareCardProps {
  headline: string; // e.g. "Riya Sen caught red-handed"
  caseTitle: string;
  roast: string;
  caught: boolean;
  votes: VoteEntry[];
  siteUrl?: string;
}

const W = 1080;
const H = 1920;
const DISPLAY = '"Space Grotesk", "Inter", system-ui, sans-serif';
const BODY = '"Inter", system-ui, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.trim().split(/\s+/)) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A 1080x1920 story card in the game's own look, ready for Instagram or Snapchat. */
export default function ShareCard({
  headline,
  caseTitle,
  roast,
  caught,
  votes,
  siteUrl = "playalibi.vercel.app",
}: ShareCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dataUrl, setDataUrl] = useState("");
  const [sharing, setSharing] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await document.fonts.ready;
      } catch {}
      const [scene, cube] = await Promise.all([loadImage("/art/scene.jpg"), loadImage("/art/cube.png")]);
      const canvas = canvasRef.current;
      if (cancelled || !canvas) return;
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const accent = caught ? "#F0385A" : "#A78BFA";
      const M = 84;

      // Background: the scene photo, darkened, with two colour washes.
      ctx.fillStyle = "#060A14";
      ctx.fillRect(0, 0, W, H);
      if (scene) {
        const s = Math.max(W / scene.width, H / scene.height);
        ctx.globalAlpha = 0.55;
        ctx.drawImage(scene, (W - scene.width * s) / 2, (H - scene.height * s) / 2, scene.width * s, scene.height * s);
        ctx.globalAlpha = 1;
      }
      const shade = ctx.createLinearGradient(0, 0, 0, H);
      shade.addColorStop(0, "rgba(6,10,20,0.55)");
      shade.addColorStop(0.5, "rgba(6,10,20,0.86)");
      shade.addColorStop(1, "rgba(6,10,20,0.6)");
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, W, H);
      for (const [x, y, c] of [
        [W * 0.15, H * 0.12, "rgba(95,221,247,0.22)"],
        [W * 0.9, H * 0.78, caught ? "rgba(240,56,90,0.28)" : "rgba(167,139,250,0.28)"],
      ] as const) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, 760);
        g.addColorStop(0, c);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      // Wordmark and cube.
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
      ctx.fillStyle = "#F4F6FA";
      ctx.font = `700 54px ${DISPLAY}`;
      ctx.fillText("ALIBI", M, 150);
      ctx.textAlign = "right";
      ctx.font = `500 26px ${MONO}`;
      ctx.fillStyle = "#AEB6C8";
      ctx.fillText("CASE FILE", W - M, 146);
      if (cube) ctx.drawImage(cube, W / 2 - 210, 200, 420, 404);

      // Case title.
      let y = 700;
      ctx.textAlign = "left";
      ctx.fillStyle = "#5FDDF7";
      ctx.font = `600 30px ${BODY}`;
      ctx.fillText(caseTitle.toUpperCase().split("").join(" "), M, y);

      // Verdict tag.
      y += 44;
      const tag = caught ? "CULPRIT CAUGHT" : "CULPRIT ESCAPED";
      ctx.font = `700 40px ${BODY}`;
      const tagW = ctx.measureText(tag).width + 64;
      ctx.save();
      ctx.translate(M, y + 44);
      ctx.fillStyle = accent;
      roundRect(ctx, 0, -46, tagW, 82, 16);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(tag, 32, 12);
      ctx.restore();

      // Headline, big.
      y += 190;
      let size = 118;
      ctx.font = `700 ${size}px ${DISPLAY}`;
      let lines = wrap(ctx, headline, W - M * 2);
      while (lines.length > 3 && size > 70) {
        size -= 10;
        ctx.font = `700 ${size}px ${DISPLAY}`;
        lines = wrap(ctx, headline, W - M * 2);
      }
      const metal = ctx.createLinearGradient(0, y - size, 0, y + lines.length * size);
      metal.addColorStop(0, "#FFFFFF");
      metal.addColorStop(1, "#B9C2D4");
      ctx.fillStyle = metal;
      for (const line of lines.slice(0, 3)) {
        ctx.fillText(line, M, y);
        y += size * 1.04;
      }

      // The detective's closing line.
      y += 36;
      ctx.font = `italic 500 42px ${BODY}`;
      const quote = wrap(ctx, `“${roast.replace(/^["“]|["”]$/g, "")}”`, W - M * 2 - 60).slice(0, 4);
      const quoteH = quote.length * 58 + 64;
      ctx.fillStyle = "rgba(20,30,52,0.82)";
      roundRect(ctx, M, y - 20, W - M * 2, quoteH, 28);
      ctx.fill();
      ctx.strokeStyle = "rgba(130,180,230,0.3)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#E3E8F2";
      let qy = y + 46;
      for (const line of quote) {
        ctx.fillText(line, M + 32, qy);
        qy += 58;
      }
      y += quoteH + 44;

      // Who accused whom.
      if (votes.length && y < H - 360) {
        ctx.font = `500 26px ${MONO}`;
        ctx.fillStyle = "#AEB6C8";
        ctx.fillText("WHO ACCUSED WHOM", M, y);
        y += 54;
        for (const v of votes.slice(0, Math.max(1, Math.floor((H - 290 - y) / 64)))) {
          ctx.font = `600 38px ${BODY}`;
          ctx.fillStyle = "#F4F6FA";
          ctx.textAlign = "left";
          ctx.fillText(v.voterName, M, y);
          ctx.textAlign = "right";
          ctx.fillStyle = accent;
          ctx.fillText(`→ ${v.targetName}`, W - M, y);
          ctx.textAlign = "left";
          y += 64;
        }
      }

      // Footer.
      ctx.strokeStyle = "rgba(255,255,255,0.14)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(M, H - 220);
      ctx.lineTo(W - M, H - 220);
      ctx.stroke();
      ctx.fillStyle = "#F4F6FA";
      ctx.font = `700 46px ${DISPLAY}`;
      ctx.fillText("Think you can crack it?", M, H - 142);
      ctx.fillStyle = "#5FDDF7";
      ctx.font = `500 34px ${MONO}`;
      ctx.fillText(siteUrl, M, H - 84);

      setDataUrl(canvas.toDataURL("image/png"));
    })();
    return () => {
      cancelled = true;
    };
  }, [headline, caseTitle, roast, caught, votes, siteUrl]);

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "alibi-case.png";
    link.href = dataUrl || canvas.toDataURL("image/png");
    document.body.appendChild(link);
    link.click();
    link.remove();
    setNote("Image saved to your downloads.");
  }

  async function share() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSharing(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (blob && navigator.share) {
        const file = new File([blob], "alibi-case.png", { type: "image/png" });
        if (!navigator.canShare || navigator.canShare({ files: [file] })) {
          await navigator.share({ title: "Alibi", text: `${headline}. Play at ${siteUrl}`, files: [file] });
          setNote("Shared.");
          return;
        }
      }
      // This device cannot hand an image to other apps (most laptops): save it instead.
      download();
      setNote("This device can't share directly, so the image was saved. Upload it to your story from there.");
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      download();
      setNote("Sharing was blocked, so the image was saved instead.");
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
      <div className="w-full max-w-[250px] overflow-hidden rounded-[18px]" style={{ boxShadow: "0 0 0 1px rgba(130,180,230,.3), 0 18px 50px rgba(0,0,0,.6)" }}>
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt="Your case result" className="block h-auto w-full" />
        ) : (
          <div className="flex aspect-[9/16] w-full items-center justify-center bg-night">
            <span className="label blink">Printing your case file</span>
          </div>
        )}
      </div>
      {note && (
        <p role="status" className="m-0 text-center text-[13.5px] leading-snug text-cyan">
          {note}
        </p>
      )}
      <div className="grid w-full grid-cols-2 gap-2.5">
        <button type="button" className="btn btn-primary tap !min-h-[52px] !text-[15px]" disabled={sharing || !dataUrl} onClick={share}>
          {sharing ? "Opening" : "Share to story"}
        </button>
        <button type="button" className="btn btn-glass tap !min-h-[52px] !text-[15px]" disabled={!dataUrl} onClick={download}>
          Save image
        </button>
      </div>
    </div>
  );
}
