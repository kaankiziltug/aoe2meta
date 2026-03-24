import { NextRequest, NextResponse } from "next/server";
import { createDataProvider } from "@/lib/api/provider";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") || "";
  if (q.length < 2) {
    return NextResponse.json([]);
  }
  const provider = createDataProvider();
  const players = await provider.searchPlayers(q);
  return NextResponse.json(players);
}
