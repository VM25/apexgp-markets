import type { Metadata } from "next";
import { MarketsView } from "@/features/markets/MarketsView";

export const metadata: Metadata = { title: "Markets" };

export default function Page() {
  return <MarketsView />;
}
