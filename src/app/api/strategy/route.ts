import { NextRequest, NextResponse } from "next/server";
import { createDataProvider } from "@/lib/api/provider";
import { GameMode } from "@/lib/api/types";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const mode = (searchParams.get("mode") ?? "rm-1v1") as GameMode;
  const mapSlug = searchParams.get("map") ?? "arabia";
  const elo = searchParams.get("elo") ?? "all";
  const listMaps = searchParams.get("list") === "1";

  const provider = createDataProvider();

  if (listMaps) {
    const maps = await provider.getStrategyMapList(mode);
    return NextResponse.json({ maps });
  }

  const data = await provider.getStrategyStats(mode, mapSlug, elo);
  if (!data) {
    return NextResponse.json({ error: "No strategy data available yet" }, { status: 404 });
  }
  return NextResponse.json(data);
}
