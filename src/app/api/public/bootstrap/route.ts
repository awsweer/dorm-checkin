import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSettings, publicSettings } from "@/lib/settings";
import { todayStr } from "@/lib/time";

// 签到页初始化数据：教师名单 + 公开配置 + 今日已签（用于"今日已签到"提示）
export async function GET() {
  const [teachers, settings, todayRecords] = await Promise.all([
    prisma.teacher.findMany({ where: { active: true }, orderBy: { id: "asc" } }),
    getSettings(),
    prisma.checkinRecord.findMany({ where: { date: todayStr() } }),
  ]);
  const signedMap: Record<number, { time: string; note: string | null; status: string }> = {};
  for (const r of todayRecords)
    signedMap[r.teacherId] = { time: r.time, note: r.note, status: r.locationStatus };
  return NextResponse.json({
    teachers: teachers.map((t) => ({
      id: t.id,
      name: t.name,
      needPin: settings.pin_enabled && !!t.pin,
      signed: signedMap[t.id] ?? null,
    })),
    settings: publicSettings(settings),
    today: todayStr(),
  });
}
