"use client";

import { QRCodeSVG } from "qrcode.react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * On laptops and desktops the game sits in a phone-sized stage in the middle.
 * These two side panels fill the rest of the window: what the game is on the
 * left, and a QR code to carry on from your phone on the right.
 * Hidden below 1100px, so phones and tablets never see them.
 */
export function DesktopFrame() {
  const path = usePathname();
  const [url, setUrl] = useState("");
  useEffect(() => setUrl(window.location.origin + path), [path]);
  const room = /^\/room\/([A-Za-z]{4})/.exec(path)?.[1]?.toUpperCase();

  return (
    <>
      <aside className="side side-left" aria-hidden="true">
        <p className="eyebrow">A new mystery every 3 minutes</p>
        <p className="display mt-3 text-[clamp(56px,6vw,92px)] leading-[0.95]">
          <span className="metal">Alibi</span>
          <span style={{ color: "#5FDDF7", WebkitTextFillColor: "#5FDDF7" }}>?</span>
        </p>
        <p className="mt-4 max-w-[22rem] text-[17px] leading-snug text-[#E3E8F2]">
          Someone here did it. Question the suspects on your own, or get a secret role and accuse your friends out
          loud.
        </p>
        <ol className="mt-8 flex max-w-[22rem] list-none flex-col gap-4 p-0">
          {[
            ["01", "Search the scene", "Tap the glowing spots. Not all evidence tells the truth."],
            ["02", "Ask, press, confront", "Six moves. Break the liar's story with real evidence."],
            ["03", "Accuse", "One accusation. The narrator tells you if you got it right."],
          ].map(([n, t, d]) => (
            <li key={n} className="flex gap-4">
              <span className="mono pt-0.5 text-[13px] text-cyan">{n}</span>
              <span>
                <span className="block text-[16px] font-semibold">{t}</span>
                <span className="block text-[14px] leading-snug text-mist">{d}</span>
              </span>
            </li>
          ))}
        </ol>
      </aside>

      <aside className="side side-right">
        <div className="panel flex w-[250px] flex-col items-center gap-3 p-5 text-center">
          <p className="eyebrow m-0">{room ? `Room ${room}` : "Better on a phone"}</p>
          <span className="rounded-[12px] bg-white p-3">{url && <QRCodeSVG value={url} size={170} />}</span>
          <p className="m-0 text-[14px] leading-snug text-mist">
            {room ? "Friends scan this to join the room." : "Scan to open this on your phone."}
          </p>
        </div>
        <p className="label mt-5 max-w-[250px] text-center">No sign-up · works on any phone, tablet or laptop</p>
      </aside>
    </>
  );
}
