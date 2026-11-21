import type { Metadata } from "next";
import { ResearchView } from "@/features/research/ResearchView";

export const metadata: Metadata = { title: "Research" };

export default function Page() {
  return <ResearchView />;
}
