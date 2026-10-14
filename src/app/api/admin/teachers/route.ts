import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "未授权" }, { status: 401 });
  const teachers = await prisma.teacher.findMany({ orderBy: { id: "asc" } });
  return NextResponse.json({ teachers });
}

export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "未授权" }, { status: 401 });
  const { name, pin } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "姓名不能为空" }, { status: 400 });
  try {
    const t = await prisma.teacher.create({
      data: { name: name.trim(), pin: pin?.trim() || null },
    });
    return NextResponse.json({ ok: true, teacher: t });
  } catch {
    return NextResponse.json({ error: "姓名已存在" }, { status: 409 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "未授权" }, { status: 401 });
  const { id, name, pin, active } = await req.json();
  const t = await prisma.teacher.update({
    where: { id: Number(id) },
    data: {
      ...(name !== undefined ? { name: String(name).trim() } : {}),
      ...(pin !== undefined ? { pin: pin ? String(pin).trim() : null } : {}),
      ...(active !== undefined ? { active: !!active } : {}),
    },
  });
  return NextResponse.json({ ok: true, teacher: t });
}

export async function DELETE(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "未授权" }, { status: 401 });
  const id = Number(req.nextUrl.searchParams.get("id"));
  // 有签到记录的教师做停用，无记录可物理删除
  const count = await prisma.checkinRecord.count({ where: { teacherId: id } });
  if (count > 0) {
    await prisma.teacher.update({ where: { id }, data: { active: false } });
    return NextResponse.json({ ok: true, softDeleted: true });
  }
  await prisma.teacher.delete({ where: { id } });
  return NextResponse.json({ ok: true, softDeleted: false });
}
