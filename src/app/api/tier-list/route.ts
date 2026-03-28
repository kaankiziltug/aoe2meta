import { NextRequest, NextResponse } from "next/server";
import { createDataProvider } from "@/lib/api/provider";
import { GameMode } from "@/lib/api/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const mode = (request.nextUrl.searchParams.get("mode") || "rm-1v1") as GameMode;
  const provider = createDataProvider();
  const stats = await provider.getCivStats(mode);
  return NextResponse.json(stats);
}
