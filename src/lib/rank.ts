export interface RankTier {
  name: string;
  minElo: number;
  color: string;        // Tailwind color class
  bgColor: string;      // Badge background
  emoji: string;
}

export const RANK_TIERS: RankTier[] = [
  { name: "Conqueror",  minElo: 2200, color: "text-[#FF4500]", bgColor: "bg-[#FF4500]/10", emoji: "👑" },
  { name: "Diamond",    minElo: 1900, color: "text-[#00BFFF]", bgColor: "bg-[#00BFFF]/10", emoji: "💎" },
  { name: "Platinum",   minElo: 1600, color: "text-[#E5E4E2]", bgColor: "bg-[#E5E4E2]/10", emoji: "🏅" },
  { name: "Gold",       minElo: 1300, color: "text-[#FFD700]", bgColor: "bg-[#FFD700]/10", emoji: "🥇" },
  { name: "Silver",     minElo: 1000, color: "text-[#C0C0C0]", bgColor: "bg-[#C0C0C0]/10", emoji: "🥈" },
  { name: "Bronze",     minElo: 0,    color: "text-[#CD7F32]", bgColor: "bg-[#CD7F32]/10", emoji: "🥉" },
];

export function getRankTier(elo: number): RankTier {
  for (const tier of RANK_TIERS) {
    if (elo >= tier.minElo) return tier;
  }
  return RANK_TIERS[RANK_TIERS.length - 1];
}
