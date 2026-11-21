import { Instrument_Serif, Special_Elite } from "next/font/google";
import "./room.css";

const serif = Instrument_Serif({ weight: "400", subsets: ["latin"], variable: "--font-kaun-serif" });
const typewriter = Special_Elite({ weight: "400", subsets: ["latin"], variable: "--font-kaun-mono" });

export default function RoomLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${serif.variable} ${typewriter.variable} kaun-room`}>{children}</div>;
}
