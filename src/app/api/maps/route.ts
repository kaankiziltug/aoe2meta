import { NextRequest, NextResponse } from "next/server";
import { createDataProvider } from "@/lib/api/provider";
import { GameMode } from "@/lib/api/types";

const ELO_RANGES: Record<string, [number, number]> = {
  low:      [0,    799],
  med_low:  [800,  1099],
  medium:   [1100, 1399],
  med_high: [1400, 1799],
  high:     [1800, 9999],
};

export async function GET(request: NextRequest) {
  const mode = (request.nextUrl.searchParams.get("mode") ?? "rm-1v1") as GameMode;
  const eloParam = request.nextUrl.searchParams.get("elo") ?? "all";
  const eloRange = ELO_RANGES[eloParam] as [number, number] | undefined;
  const provider = createDataProvider();
  const maps = await provider.getMapStats(mode, eloRange);
  return NextResponse.json(maps);
}
