import { NextRequest, NextResponse } from "next/server";
import { checkAdmin } from "@/lib/auth";

export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "密码错误" }, { status: 401 });
  return NextResponse.json({ ok: true });
}
