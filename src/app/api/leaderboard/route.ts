import { NextRequest, NextResponse } from "next/server";
import { createDataProvider } from "@/lib/api/provider";
import { GameMode } from "@/lib/api/types";

export async function GET(request: NextRequest) {
  const mode = (request.nextUrl.searchParams.get("mode") || "rm-1v1") as GameMode;
  const start = parseInt(request.nextUrl.searchParams.get("start") || "0");
  const count = parseInt(request.nextUrl.searchParams.get("count") || "25");

  try {
    const provider = createDataProvider();
    const data = await provider.getLeaderboard(mode, start, count);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[leaderboard API]", err);
    return NextResponse.json({ total: 0, start, count: 0, entries: [] }, { status: 200 });
  }
}
