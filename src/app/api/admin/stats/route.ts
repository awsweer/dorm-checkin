import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkAdmin } from "@/lib/auth";

// GET ?month=YYYY-MM —— 每位老师签到次数、异常次数
export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "未授权" }, { status: 401 });
  const month = req.nextUrl.searchParams.get("month") || new Date().toISOString().slice(0, 7);
  const [teachers, records] = await Promise.all([
    prisma.teacher.findMany({ orderBy: { id: "asc" } }),
    prisma.checkinRecord.findMany({
      where: { date: { gte: `${month}-01`, lte: `${month}-31` } },
      select: { teacherId: true, locationStatus: true, outOfWindow: true },
    }),
  ]);
  const stats = teachers.map((t) => {
    const mine = records.filter((r) => r.teacherId === t.id);
    return {
      id: t.id,
      name: t.name,
      total: mine.length,
      abnormal: mine.filter((r) => r.locationStatus !== "normal" || r.outOfWindow).length,
    };
  });
  return NextResponse.json({ month, stats });
}
