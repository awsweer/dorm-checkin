import { NextRequest, NextResponse } from "next/server";
import { checkAdmin } from "@/lib/auth";
import { getSettings, setSettings } from "@/lib/settings";

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "未授权" }, { status: 401 });
  return NextResponse.json({ settings: await getSettings() });
}

export async function PUT(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "未授权" }, { status: 401 });
  const body = await req.json();
  const kv: Record<string, string> = {};
  for (const k of ["dorm_lat", "dorm_lng", "radius_m", "window_start", "window_end"]) {
    if (body[k] !== undefined) kv[k] = String(body[k]);
  }
  for (const k of ["pin_enabled", "window_enabled"]) {
    if (body[k] !== undefined) kv[k] = body[k] ? "true" : "false";
  }
  await setSettings(kv);
  return NextResponse.json({ ok: true, settings: await getSettings() });
}
