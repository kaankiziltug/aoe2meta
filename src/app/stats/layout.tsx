import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Civilization Statistics",
  description:
    "Complete Age of Empires II civilization statistics including win rates, pick rates, and meta analysis. Updated with the latest patch data.",
  alternates: { canonical: "https://aoe2meta.com/stats" },
  openGraph: {
    title: "AoE2 Civilization Statistics — AoE2Meta",
    description: "Win rates, pick rates, and tier analysis for all 45+ AoE2 civilizations.",
    url: "https://aoe2meta.com/stats",
  },
};

export default function StatsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
