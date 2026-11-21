"use client";

import React, { useEffect, useRef, useState } from "react";

export interface VoteEntry {
  voterName: string;
  targetName: string;
}

export interface ShareCardProps {
  headline: string;
  caseTitle: string;
  roast: string;
  caught: boolean;
  votes: VoteEntry[];
  siteUrl?: string;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const { width } = ctx.measureText(testLine);
    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

export default function ShareCard({
  headline,
  caseTitle,
  roast,
  caught,
  votes,
  siteUrl = "playkaun.vercel.app",
}: ShareCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dataUrl, setDataUrl] = useState<string>("");
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function renderNewspaper() {
      if (typeof document !== "undefined" && "fonts" in document) {
        try {
          await document.fonts.ready;
        } catch {
          // Proceed even if font readiness rejects
        }
      }

      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const W = 1080;
      const H = 1920;
      canvas.width = W;
      canvas.height = H;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // 1. Aged newspaper background (#EFE6D3)
      ctx.fillStyle = "#EFE6D3";
      ctx.fillRect(0, 0, W, H);

      // Subtle paper grain / noise
      const imgData = ctx.getImageData(0, 0, W, H);
      const pixels = imgData.data;
      let seed = 42;
      const nextRand = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };
      for (let i = 0; i < pixels.length; i += 4) {
        const delta = (nextRand() - 0.5) * 16;
        pixels[i] = Math.min(255, Math.max(0, pixels[i] + delta));
        pixels[i + 1] = Math.min(255, Math.max(0, pixels[i + 1] + delta));
        pixels[i + 2] = Math.min(255, Math.max(0, pixels[i + 2] + delta));
      }
      ctx.putImageData(imgData, 0, 0);

      // Subtle vignette border
      const grad = ctx.createRadialGradient(
        W / 2,
        H / 2,
        W * 0.35,
        W / 2,
        H / 2,
        H * 0.72
      );
      grad.addColorStop(0, "rgba(139, 115, 85, 0)");
      grad.addColorStop(1, "rgba(110, 86, 56, 0.16)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      const marginX = 76;
      const contentW = W - marginX * 2;
      const ink = "#1A1612";
      const mutedInk = "#4A4137";

      // Outer double frame
      ctx.strokeStyle = ink;
      ctx.lineWidth = 4;
      ctx.strokeRect(44, 44, W - 88, H - 88);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(54, 54, W - 108, H - 108);

      // 2. Masthead: THE KAUN? TIMES
      ctx.fillStyle = ink;
      ctx.textAlign = "center";
      ctx.font = '900 84px Georgia, "Times New Roman", serif';
      ctx.fillText("THE KAUN? TIMES", W / 2, 165);

      // Double horizontal rule under masthead
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(marginX, 195);
      ctx.lineTo(W - marginX, 195);
      ctx.stroke();

      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(marginX, 204);
      ctx.lineTo(W - marginX, 204);
      ctx.stroke();

      // 3. Date line
      ctx.font = '600 26px Georgia, "Times New Roman", serif';
      ctx.fillStyle = mutedInk;
      ctx.textAlign = "left";
      ctx.fillText("Kolkata · Late City Edition", marginX, 244);

      ctx.textAlign = "right";
      ctx.fillText("PRICE: 1 ROSOGOLLA", W - marginX, 244);

      ctx.lineWidth = 2;
      ctx.strokeStyle = ink;
      ctx.beginPath();
      ctx.moveTo(marginX, 264);
      ctx.lineTo(W - marginX, 264);
      ctx.stroke();

      // Case kicker pill / subhead
      let y = 324;
      ctx.textAlign = "center";
      ctx.fillStyle = mutedInk;
      ctx.font = '700 28px Georgia, "Times New Roman", serif';
      ctx.fillText(`CASE FILE: ${caseTitle.toUpperCase()}`, W / 2, y);
      y += 78;

      // 4. Huge Headline
      ctx.fillStyle = ink;
      ctx.textAlign = "center";
      const headlineFontSize = headline.length > 52 ? 64 : 76;
      ctx.font = `900 ${headlineFontSize}px Georgia, "Times New Roman", serif`;
      const headlineLines = wrapText(ctx, headline.toUpperCase(), contentW);
      for (const line of headlineLines.slice(0, 4)) {
        ctx.fillText(line, W / 2, y);
        y += headlineFontSize * 1.14;
      }

      // Divider rule below headline
      y += 16;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(marginX, y);
      ctx.lineTo(W - marginX, y);
      ctx.stroke();

      // 5. Rubber Stamp rotated -8 degrees
      y += 125;
      ctx.save();
      ctx.translate(W / 2, y);
      ctx.rotate((-8 * Math.PI) / 180);

      const stampText = caught ? "CASE CLOSED" : "CULPRIT ESCAPED";
      const stampColor = caught ? "#B81D13" : "#181818";

      ctx.font = '900 54px "Courier New", Courier, monospace';
      const stampMetrics = ctx.measureText(stampText);
      const boxW = stampMetrics.width + 68;
      const boxH = 96;

      // Faint ink fill inside stamp
      ctx.fillStyle = caught
        ? "rgba(184, 29, 19, 0.07)"
        : "rgba(24, 24, 24, 0.07)";
      ctx.fillRect(-boxW / 2, -boxH / 2, boxW, boxH);

      // Thick double stamp border
      ctx.strokeStyle = stampColor;
      ctx.lineWidth = 7;
      ctx.strokeRect(-boxW / 2, -boxH / 2, boxW, boxH);
      ctx.lineWidth = 2.5;
      ctx.strokeRect(-boxW / 2 + 8, -boxH / 2 + 8, boxW - 16, boxH - 16);

      ctx.fillStyle = stampColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(stampText, 0, 3);
      ctx.restore();

      // 6. The Roast in italic quotes
      y += 128;
      ctx.fillStyle = "rgba(26, 22, 18, 0.05)";
      const roastFontSize = 38;
      ctx.font = `italic 600 ${roastFontSize}px Georgia, "Times New Roman", serif`;
      const quotedRoast = `“${roast.replace(/^["“]|["”]$/g, "")}”`;
      const roastLines = wrapText(ctx, quotedRoast, contentW - 64);
      const roastBoxH = roastLines.length * (roastFontSize * 1.35) + 56;

      ctx.fillRect(marginX, y - 36, contentW, roastBoxH);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      ctx.strokeRect(marginX, y - 36, contentW, roastBoxH);

      ctx.fillStyle = ink;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      let roastY = y + 14;
      for (const line of roastLines) {
        ctx.fillText(line, W / 2, roastY);
        roastY += roastFontSize * 1.35;
      }

      y = y - 36 + roastBoxH + 64;

      // 7. "WHO BLAMED WHOM" section
      ctx.fillStyle = ink;
      ctx.textAlign = "left";
      ctx.font = '900 32px Georgia, "Times New Roman", serif';
      ctx.fillText("WHO BLAMED WHOM", marginX, y);

      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(marginX, y + 16);
      ctx.lineTo(W - marginX, y + 16);
      ctx.stroke();

      y += 64;
      const displayVotes =
        votes.length > 0
          ? votes
          : [{ voterName: "Everyone", targetName: "Each Other" }];

      const maxVotes = Math.min(displayVotes.length, 6);
      for (let i = 0; i < maxVotes; i++) {
        const v = displayVotes[i];
        ctx.font = '700 34px Georgia, "Times New Roman", serif';
        ctx.fillStyle = ink;
        ctx.textAlign = "left";
        ctx.fillText(v.voterName, marginX + 12, y);

        ctx.font = 'italic 30px Georgia, "Times New Roman", serif';
        ctx.fillStyle = mutedInk;
        ctx.textAlign = "center";
        ctx.fillText("accused", W / 2, y);

        ctx.font = '900 34px Georgia, "Times New Roman", serif';
        ctx.fillStyle = ink;
        ctx.textAlign = "right";
        ctx.fillText(v.targetName, W - marginX - 12, y);

        // Dotted baseline guide
        ctx.save();
        ctx.setLineDash([4, 8]);
        ctx.strokeStyle = "rgba(26, 22, 18, 0.35)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(marginX + 12, y + 18);
        ctx.lineTo(W - marginX - 12, y + 18);
        ctx.stroke();
        ctx.restore();

        y += 66;
      }

      // 8. Footer: Play at {siteUrl}
      const footerY = H - 118;
      ctx.lineWidth = 3;
      ctx.strokeStyle = ink;
      ctx.beginPath();
      ctx.moveTo(marginX, footerY - 52);
      ctx.lineTo(W - marginX, footerY - 52);
      ctx.stroke();

      ctx.fillStyle = ink;
      ctx.textAlign = "center";
      ctx.font = '700 34px "Courier New", Courier, monospace';
      ctx.fillText(`Play at ${siteUrl}`, W / 2, footerY);

      setDataUrl(canvas.toDataURL("image/png"));
    }

    renderNewspaper();
    return () => {
      cancelled = true;
    };
  }, [headline, caseTitle, roast, caught, votes, siteUrl]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = dataUrl || canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = "the-kaun-times.png";
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setSharing(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/png")
      );

      if (blob && typeof navigator !== "undefined" && navigator.share) {
        const file = new File([blob], "the-kaun-times.png", {
          type: "image/png",
        });
        if (!navigator.canShare || navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: "The Kaun? Times",
            text: `${headline} — Play at ${siteUrl}`,
            files: [file],
          });
          return;
        }
      }
      handleDownload();
    } catch (err) {
      // Ignore user-cancelled share sheets; fallback to download on actual errors
      if ((err as Error)?.name !== "AbortError") {
        handleDownload();
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Hidden full-resolution 1080x1920 render canvas */}
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

      {/* Scaled preview (max-width 320px) */}
      <div className="w-full max-w-[320px] rounded-md overflow-hidden shadow-xl border border-stone-400 bg-[#EFE6D3]">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dataUrl}
            alt="The Kaun? Times front page"
            className="w-full h-auto block"
          />
        ) : (
          <div className="aspect-[9/16] w-full flex items-center justify-center text-stone-700 font-serif text-sm">
            Printing front page...
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3 w-full max-w-[320px]">
        <button
          type="button"
          onClick={handleDownload}
          className="flex-1 py-2.5 px-4 rounded-lg bg-stone-900 text-[#EFE6D3] font-semibold text-sm hover:bg-stone-800 active:scale-[0.99] transition cursor-pointer"
        >
          Download (PNG)
        </button>
        <button
          type="button"
          onClick={handleShare}
          disabled={sharing}
          className="flex-1 py-2.5 px-4 rounded-lg bg-[#B81D13] text-white font-semibold text-sm hover:bg-[#9e1810] active:scale-[0.99] transition disabled:opacity-60 cursor-pointer"
        >
          {sharing ? "Sharing..." : "Share"}
        </button>
      </div>
    </div>
  );
}
