import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkAdmin } from "@/lib/auth";

// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD&teacherId=&format=csv
export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "未授权" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from") || "1970-01-01";
  const to = sp.get("to") || "2999-12-31";
  const teacherId = sp.get("teacherId") ? Number(sp.get("teacherId")) : undefined;

  const records = await prisma.checkinRecord.findMany({
    where: { date: { gte: from, lte: to }, ...(teacherId ? { teacherId } : {}) },
    include: { teacher: { select: { name: true } } },
    orderBy: [{ date: "desc" }, { time: "asc" }],
  });

  const statusText: Record<string, string> = {
    normal: "正常",
    out_of_range: "位置异常",
    unavailable: "未获取定位",
  };
  const shaped = records.map((r) => ({
    id: r.id,
    date: r.date,
    time: r.time,
    name: r.teacher.name,
    locationStatus: r.locationStatus,
    statusText: statusText[r.locationStatus] ?? r.locationStatus,
    distanceM: r.distanceM,
    outOfWindow: r.outOfWindow,
    note: r.note ?? "",
    lat: r.lat,
    lng: r.lng,
  }));

  if (sp.get("format") === "csv") {
    const header = "日期,时间,姓名,定位状态,距离(米),时段外,备注,纬度,经度";
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = shaped.map((r) =>
      [r.date, r.time, r.name, r.statusText, r.distanceM ?? "", r.outOfWindow ? "是" : "否", r.note, r.lat ?? "", r.lng ?? ""]
        .map(esc)
        .join(",")
    );
    const csv = "﻿" + [header, ...lines].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="checkins_${from}_${to}.csv"`,
      },
    });
  }

  return NextResponse.json({ records: shaped });
}
