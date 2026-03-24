import { NextRequest, NextResponse } from "next/server";
import { createDataProvider } from "@/lib/api/provider";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const { profileId } = await params;
  const start = parseInt(request.nextUrl.searchParams.get("start") || "0");
  const count = parseInt(request.nextUrl.searchParams.get("count") || "20");
  const provider = createDataProvider();
  try {
    const matches = await provider.getMatchHistory(parseInt(profileId), start, count);
    return NextResponse.json(matches);
  } catch {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }
}
