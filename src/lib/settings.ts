import { prisma } from "./db";

export type Settings = {
  dorm_lat: number;
  dorm_lng: number;
  radius_m: number;
  pin_enabled: boolean;
  window_enabled: boolean;
  window_start: string;
  window_end: string;
};

const DEFAULTS: Record<string, string> = {
  dorm_lat: "39.9042",
  dorm_lng: "116.4074",
  radius_m: "300",
  pin_enabled: "false",
  window_enabled: "false",
  window_start: "06:00",
  window_end: "09:00",
};

export async function getSettings(): Promise<Settings> {
  const rows = await prisma.setting.findMany();
  const map: Record<string, string> = { ...DEFAULTS };
  for (const r of rows) map[r.key] = r.value;
  return {
    dorm_lat: parseFloat(map.dorm_lat),
    dorm_lng: parseFloat(map.dorm_lng),
    radius_m: parseInt(map.radius_m, 10) || 300,
    pin_enabled: map.pin_enabled === "true",
    window_enabled: map.window_enabled === "true",
    window_start: map.window_start,
    window_end: map.window_end,
  };
}

export async function setSettings(kv: Record<string, string>) {
  for (const [key, value] of Object.entries(kv)) {
    await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }
}

// 公开给签到页的子集（不含敏感信息）
export function publicSettings(s: Settings) {
  return {
    radius_m: s.radius_m,
    pin_enabled: s.pin_enabled,
    window_enabled: s.window_enabled,
    window_start: s.window_start,
    window_end: s.window_end,
  };
}

// Haversine 距离（米）
export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}
