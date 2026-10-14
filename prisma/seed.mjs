import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const teachers = ["王建国", "李秀英", "张伟", "陈丽华", "刘志强"];

const defaults = {
  dorm_lat: "39.904200", // 宿舍楼纬度（示例：请后台改为实际坐标）
  dorm_lng: "116.407400",
  radius_m: "300",
  pin_enabled: "false",
  window_enabled: "false",
  window_start: "06:00",
  window_end: "09:00",
};

async function main() {
  for (const name of teachers) {
    await prisma.teacher.upsert({ where: { name }, update: {}, create: { name } });
  }
  for (const [key, value] of Object.entries(defaults)) {
    await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }
  console.log("种子数据完成：5 名教师 + 默认配置");
}

main().finally(() => prisma.$disconnect());
