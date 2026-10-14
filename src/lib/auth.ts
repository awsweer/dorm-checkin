import { NextRequest } from "next/server";

export function checkAdmin(req: NextRequest): boolean {
  const pwd = req.headers.get("x-admin-password") ?? "";
  return !!process.env.ADMIN_PASSWORD && pwd === process.env.ADMIN_PASSWORD;
}
