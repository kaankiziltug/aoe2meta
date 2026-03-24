import { NextRequest, NextResponse } from "next/server";
import { createDataProvider } from "@/lib/api/provider";
import { GameMode } from "@/lib/api/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const { profileId } = await params;
  const mode = (request.nextUrl.searchParams.get("mode") || "rm-1v1") as GameMode;
  const provider = createDataProvider();
  try {
    const history = await provider.getRatingHistory(parseInt(profileId), mode);
    return NextResponse.json(history);
  } catch {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }
}
