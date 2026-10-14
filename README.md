# 教师宿舍值日签到系统

老师每天扫**一张固定二维码** → 打开 H5 → 选姓名 → 自动记录时间 + GPS 校验 → 完成签到。管理后台留存记录并统计。

## 功能一览

**签到页 `/checkin`（移动优先，微信内置浏览器）**
- 实时显示今天日期与时间
- 教师名单选择，支持搜索，无需注册登录
- 进入即请求定位，与宿舍楼坐标计算距离（默认半径 300 米，后台可调）：
  - 范围内 → 正常；超范围 → 标记「位置异常」；未授权/失败 → 仍可签到，标记「未获取定位」（软限制不阻断）
- 同人同天重复进入显示「今日已签到 HH:mm」，可补充备注，不重复记录
- 60 秒防连点；可选 PIN 校验（后台开关，默认关闭）

**管理后台 `/admin`（密码登录，密码走环境变量 `ADMIN_PASSWORD`）**
- 今日面板：已签名单（时间/定位状态）+ 未签到红色高亮
- 历史查询：日期范围 + 教师筛选，异常记录醒目红色左边条标记
- 月度统计：每人签到次数 / 异常次数
- 签到明细导出 CSV（带 BOM，Excel 直接打开不乱码）
- 配置：教师增删改/停用、宿舍楼经纬度 + 半径、值日时段（可选，时段外标记）、PIN 开关

## 本地运行

```bash
npm install
cp .env.example .env        # 修改 ADMIN_PASSWORD
npx prisma db push          # 初始化 SQLite（单文件 prisma/dev.db）
npm run seed                # 种子数据：5 名教师 + 默认配置
npm run dev                 # http://localhost:3000
```

生产模式：`npm run build && npm start`

## 部署

> **必须 HTTPS**：Geolocation 定位 API 仅在安全上下文（HTTPS 或 localhost）可用，HTTP 部署会导致永远「未获取定位」。

### 方案一：海外免费托管（推荐，零成本，自带 HTTPS）

以 Vercel 为例（Render / Railway 类似）。注意 SQLite 是单文件数据库，**Serverless 平台文件系统重启即清空**，生产环境请任选其一：

- **简单做法**：改用 Vercel Postgres / Neon（免费档），把 `prisma/schema.prisma` 的 `provider` 改为 `postgresql`，`DATABASE_URL` 换成平台给的连接串即可，代码零改动。
- **或**部署到支持持久磁盘的 Render / Railway / Fly.io，SQLite 原样可用。

步骤：代码推到 GitHub → Vercel 导入仓库 → 环境变量加 `ADMIN_PASSWORD` 和 `DATABASE_URL` → Deploy，得到 `https://xxx.vercel.app`。

### 方案二：国内轻量云服务器 + 备案域名（长期最稳定）

```bash
# 服务器（Ubuntu）上：
git clone <repo> && cd dorm-checkin
npm install && cp .env.example .env   # 改密码
npm run build && npm run seed
npm i -g pm2 && pm2 start "npm start" --name checkin
# Nginx 反代 3000 端口 + 备案域名 + certbot 申请免费 HTTPS 证书
```

域名备案约 1–2 周，期间可先用方案一或三过渡。

### 方案三：香港节点（免备案，国内可访问）

同方案二步骤，服务器选腾讯云/阿里云香港轻量（约 ¥30/月），域名免备案，直接 certbot 上 HTTPS。

## 二维码生成指引

1. 部署后确认固定 URL：`https://你的域名/checkin`（此 URL 永不变更，数据按「日期+教师」自动归档，无需每天换码）
2. 用任意二维码生成器生成：
   - 草料二维码 https://cli.im （输入 URL → 生成 → 下载 PNG）
   - 或命令行：`npx qrcode "https://你的域名/checkin" -o qrcode.png`
3. 打印 A5/A4 张贴于宿舍楼值班处。建议同时打印短链接文字版备用。

## 环境变量

| 变量 | 说明 | 默认 |
|---|---|---|
| `ADMIN_PASSWORD` | 管理后台密码（必填，务必修改） | admin123 |
| `DATABASE_URL` | 数据库连接 | file:./dev.db |

## 技术栈与数据模型

Next.js 14 (App Router) + TypeScript + Tailwind CSS + Prisma + SQLite，时区固定 Asia/Shanghai。

- `Teacher`：id, name(唯一), pin?, active, createdAt
- `CheckinRecord`：teacherId, date, time, lat?, lng?, distanceM?, locationStatus(normal/out_of_range/unavailable), outOfWindow, note? —— 唯一约束 (teacherId, date)，一人一天一条
- `Setting`：key/value（坐标、半径、时段、PIN 开关）

## 种子数据

`npm run seed` 创建 5 名教师：王建国、李秀英、张伟、陈丽华、刘志强，以及默认配置（坐标为北京示例值，**上线前务必在后台「配置」页改为宿舍楼实际经纬度**）。

获取宿舍楼经纬度：手机站在宿舍楼门口打开地图 App 定位查看，或电脑在腾讯地图/高德地图上右键/长按取坐标，填入后台即可。
