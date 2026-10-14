// 时区固定 Asia/Shanghai
const fmtDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const fmtTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Shanghai",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export function todayStr(d = new Date()): string {
  return fmtDate.format(d); // YYYY-MM-DD
}
export function timeStr(d = new Date()): string {
  return fmtTime.format(d); // HH:mm:ss
}
export function nowHM(d = new Date()): string {
  return timeStr(d).slice(0, 5); // HH:mm
}
