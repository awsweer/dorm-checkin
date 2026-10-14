import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkAdmin } from "@/lib/auth";
import { todayStr } from "@/lib/time";

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "未授权" }, { status: 401 });
  const date = todayStr();
  const [teachers, records] = await Promise.all([
    prisma.teacher.findMany({ where: { active: true }, orderBy: { id: "asc" } }),
    prisma.checkinRecord.findMany({ where: { date } }),
  ]);
  const map = new Map(records.map((r) => [r.teacherId, r]));
  const signed = teachers.filter((t) => map.has(t.id)).map((t) => ({ teacher: t.name, record: map.get(t.id) }));
  const missing = teachers.filter((t) => !map.has(t.id)).map((t) => t.name);
  return NextResponse.json({ date, signed, missing });
}
