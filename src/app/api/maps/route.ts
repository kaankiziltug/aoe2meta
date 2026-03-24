import { NextRequest, NextResponse } from "next/server";
import { createDataProvider } from "@/lib/api/provider";
import { GameMode } from "@/lib/api/types";

export async function GET(request: NextRequest) {
  const mode = (request.nextUrl.searchParams.get("mode") ?? "rm-1v1") as GameMode;
  const provider = createDataProvider();
  const maps = await provider.getMapStats(mode);
  return NextResponse.json(maps);
}
