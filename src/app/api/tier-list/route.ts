import { NextRequest, NextResponse } from "next/server";
import { createDataProvider } from "@/lib/api/provider";
import { GameMode } from "@/lib/api/types";

export const dynamic = "force-dynamic";

const ELO_RANGE_MAP: Record<string, [number, number] | undefined> = {
  "0-1000":    [0,    999],
  "1000-1400": [1000, 1400],
  "1400-1800": [1400, 1800],
  "1800+":     [1800, 9999],
  "2000+":     [2000, 9999],
};

export async function GET(request: NextRequest) {
  const mode = (request.nextUrl.searchParams.get("mode") || "rm-1v1") as GameMode;
  const eloParam = request.nextUrl.searchParams.get("elo") ?? "";
  const eloRange = ELO_RANGE_MAP[eloParam];
  const provider = createDataProvider();
  const stats = await provider.getCivStats(mode, eloRange);
  return NextResponse.json(stats);
}
