import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSettings, distanceM } from "@/lib/settings";
import { todayStr, timeStr, nowHM } from "@/lib/time";

// 提交签到（幂等：同人同天只保留首次；60 秒防连点；重复进入仅更新备注）
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const teacherId = Number(body.teacherId);
  const lat = typeof body.lat === "number" ? body.lat : null;
  const lng = typeof body.lng === "number" ? body.lng : null;
  const note = typeof body.note === "string" ? body.note.slice(0, 200) : null;
  const pin = typeof body.pin === "string" ? body.pin : null;

  if (!teacherId) return NextResponse.json({ error: "缺少教师信息" }, { status: 400 });

  const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } });
  if (!teacher || !teacher.active)
    return NextResponse.json({ error: "教师不存在或已停用" }, { status: 404 });

  const settings = await getSettings();
  if (settings.pin_enabled && teacher.pin && teacher.pin !== pin)
    return NextResponse.json({ error: "PIN 不正确" }, { status: 403 });

  const date = todayStr();
  const existing = await prisma.checkinRecord.findUnique({
    where: { teacherId_date: { teacherId, date } },
  });

  if (existing) {
    // 60 秒防连点（仅针对重复"提交签到"，更新备注不受限——下面单独处理）
    if (note !== null) {
      const updated = await prisma.checkinRecord.update({
        where: { id: existing.id },
        data: { note },
      });
      return NextResponse.json({ ok: true, already: true, record: updated });
    }
    const elapsed = Date.now() - existing.createdAt.getTime();
    if (elapsed < 60_000) {
      return NextResponse.json(
        { error: "操作太频繁，请稍后再试", already: true, record: existing },
        { status: 429 }
      );
    }
    return NextResponse.json({ ok: true, already: true, record: existing });
  }

  // 定位状态判定
  let locationStatus: "normal" | "out_of_range" | "unavailable" = "unavailable";
  let dist: number | null = null;
  if (lat !== null && lng !== null) {
    dist = distanceM(lat, lng, settings.dorm_lat, settings.dorm_lng);
    locationStatus = dist <= settings.radius_m ? "normal" : "out_of_range";
  }

  // 时段外标记
  let outOfWindow = false;
  if (settings.window_enabled) {
    const hm = nowHM();
    outOfWindow = hm < settings.window_start || hm > settings.window_end;
  }

  try {
    const record = await prisma.checkinRecord.create({
      data: {
        teacherId,
        date,
        time: timeStr(),
        lat,
        lng,
        distanceM: dist,
        locationStatus,
        outOfWindow,
        note,
      },
    });
    return NextResponse.json({ ok: true, already: false, record });
  } catch {
    // 并发唯一约束冲突：返回已存在记录
    const again = await prisma.checkinRecord.findUnique({
      where: { teacherId_date: { teacherId, date } },
    });
    return NextResponse.json({ ok: true, already: true, record: again });
  }
}
