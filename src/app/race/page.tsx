import type { Metadata } from "next";
import { RaceView } from "@/features/race/RaceView";

export const metadata: Metadata = { title: "Race" };

export default function Page() {
  return <RaceView />;
}
