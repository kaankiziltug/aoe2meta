import { Metadata } from "next";

const MODE_LABELS: Record<string, string> = {
  "rm-1v1": "Random Map 1v1",
  "rm-team": "Random Map Team",
  "ew-1v1": "Empire Wars 1v1",
  "ew-team": "Empire Wars Team",
  "dm-1v1": "Death Match 1v1",
  "dm-team": "Death Match Team",
  "ror-1v1": "Return of Rome 1v1",
  "ror-team": "Return of Rome Team",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ mode: string }>;
}): Promise<Metadata> {
  const { mode } = await params;
  const label = MODE_LABELS[mode] ?? mode.toUpperCase();
  return {
    title: `${label} Leaderboard`,
    description: `Top Age of Empires II players in ${label} ranked by ELO. View rankings, win rates, and match history.`,
    alternates: { canonical: `https://aoe2meta.com/leaderboard/${mode}` },
    openGraph: {
      title: `AoE2 ${label} Leaderboard — AoE2Meta`,
      description: `Top AoE2 players ranked in ${label}.`,
      url: `https://aoe2meta.com/leaderboard/${mode}`,
    },
  };
}

export default function LeaderboardModeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
