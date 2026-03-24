import { NextRequest, NextResponse } from "next/server";
import { createDataProvider } from "@/lib/api/provider";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const { profileId } = await params;
  const provider = createDataProvider();
  try {
    const profile = await provider.getPlayerProfile(parseInt(profileId));
    return NextResponse.json(profile);
  } catch {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }
}
