import { NextRequest, NextResponse } from "next/server";
import { createDataProvider } from "@/lib/api/provider";
import { GameMode } from "@/lib/api/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const mode = (request.nextUrl.searchParams.get("mode") || "rm-1v1") as GameMode;
  const eloMin = request.nextUrl.searchParams.get("eloMin");
  const eloMax = request.nextUrl.searchParams.get("eloMax");

  const eloRange: [number, number] | undefined =
    eloMin && eloMax ? [parseInt(eloMin), parseInt(eloMax)] : undefined;

  const provider = createDataProvider();
  const stats = await provider.getCivStats(mode, eloRange);
  return NextResponse.json(stats);
}
