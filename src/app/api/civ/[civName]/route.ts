import { NextRequest, NextResponse } from "next/server";
import { createDataProvider } from "@/lib/api/provider";
import { GameMode } from "@/lib/api/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ civName: string }> }
) {
  const { civName } = await params;
  const mode = (request.nextUrl.searchParams.get("mode") ?? "rm-1v1") as GameMode;
  const provider = createDataProvider();
  const detail = await provider.getCivDetail(civName, mode);
  if (!detail) return NextResponse.json({ error: "Civ not found" }, { status: 404 });
  return NextResponse.json(detail);
}
