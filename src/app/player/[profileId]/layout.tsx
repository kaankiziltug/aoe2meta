import { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ profileId: string }>;
}): Promise<Metadata> {
  const { profileId } = await params;
  return {
    title: `Player #${profileId} Profile`,
    description: `Age of Empires II player profile. View ELO ratings, match history, civilization stats, and leaderboard rankings.`,
    robots: { index: false },
  };
}

export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
