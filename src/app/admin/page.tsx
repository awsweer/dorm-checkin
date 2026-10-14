"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Tab = "today" | "history" | "stats" | "teachers" | "settings";

const STATUS_STYLE: Record<string, string> = {
  normal: "bg-green-100 text-green-700",
  out_of_range: "bg-red-100 text-red-700",
  unavailable: "bg-orange-100 text-orange-700",
};
const STATUS_TEXT: Record<string, string> = {
  normal: "正常",
  out_of_range: "位置异常",
  unavailable: "未获取定位",
};

export default function AdminPage() {
  const [pwd, setPwd] = useState("");
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<Tab>("today");
  const [err, setErr] = useState("");

  const api = useCallback(
    async (path: string, init?: RequestInit) => {
      const res = await fetch(path, {
        ...init,
        headers: { "x-admin-password": pwd, "Content-Type": "application/json", ...(init?.headers || {}) },
      });
      if (res.status === 401) {
        setAuthed(false);
        sessionStorage.removeItem("admin_pwd");
        throw new Error("未授权");
      }
      return res;
    },
    [pwd]
  );

  useEffect(() => {
    const saved = sessionStorage.getItem("admin_pwd");
    if (saved) {
      setPwd(saved);
      fetch("/api/admin/login", { method: "POST", headers: { "x-admin-password": saved } }).then((r) => {
        if (r.ok) setAuthed(true);
      });
    }
  }, []);

  async function login() {
    const res = await fetch("/api/admin/login", { method: "POST", headers: { "x-admin-password": pwd } });
    if (res.ok) {
      sessionStorage.setItem("admin_pwd", pwd);
      setAuthed(true);
      setErr("");
    } else setErr("密码错误");
  }

  if (!authed) {
    return (
      <main className="mx-auto max-w-sm p-4 pt-24">
        <h1 className="text-2xl font-bold text-center mb-6">管理后台登录</h1>
        <input
          type="password"
          className="w-full rounded-xl border border-gray-200 bg-white p-4 text-lg"
          placeholder="管理密码"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && login()}
        />
        {err && <p className="mt-2 text-red-600 text-center">{err}</p>}
        <button onClick={login} className="mt-4 w-full rounded-xl bg-brand py-4 text-xl font-bold text-white">
          登录
        </button>
      </main>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "today", label: "今日" },
    { key: "history", label: "历史" },
    { key: "stats", label: "月统计" },
    { key: "teachers", label: "教师" },
    { key: "settings", label: "配置" },
  ];

  return (
    <main className="mx-auto max-w-3xl p-4 pb-20">
      <h1 className="text-xl font-bold my-4">签到管理后台</h1>
      <nav className="flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1 mb-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium ${
              tab === t.key ? "bg-white shadow text-brand" : "text-gray-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {tab === "today" && <TodayTab api={api} />}
      {tab === "history" && <HistoryTab api={api} />}
      {tab === "stats" && <StatsTab api={api} />}
      {tab === "teachers" && <TeachersTab api={api} />}
      {tab === "settings" && <SettingsTab api={api} />}
    </main>
  );
}

type Api = (path: string, init?: RequestInit) => Promise<Response>;

function TodayTab({ api }: { api: Api }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    api("/api/admin/today").then((r) => r.json()).then(setData);
  }, [api]);
  if (!data) return <p className="text-gray-400">加载中…</p>;
  return (
    <div>
      <p className="text-sm text-gray-500 mb-3">
        {data.date} · 已签 {data.signed.length} / 共 {data.signed.length + data.missing.length} 人
      </p>
      {data.missing.length > 0 && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 mb-4">
          <p className="font-bold text-red-700 mb-2">未签到（{data.missing.length} 人）</p>
          <div className="flex flex-wrap gap-2">
            {data.missing.map((n: string) => (
              <span key={n} className="rounded-full bg-red-100 text-red-700 px-3 py-1 text-sm font-medium">{n}</span>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-2">
        {data.signed.map((s: any) => (
          <div key={s.teacher} className="rounded-xl bg-white p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="font-medium">{s.teacher}</p>
              <p className="text-sm text-gray-500">{s.record.time}</p>
            </div>
            <div className="flex items-center gap-2">
              {s.record.outOfWindow && <span className="rounded-full bg-purple-100 text-purple-700 px-3 py-1 text-xs">时段外</span>}
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[s.record.locationStatus]}`}>
                {STATUS_TEXT[s.record.locationStatus]}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HistoryTab({ api }: { api: Api }) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
  const monthAgo = new Date(Date.now() - 29 * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [teacherId, setTeacherId] = useState("");
  const [teachers, setTeachers] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);

  const load = useCallback(() => {
    api(`/api/admin/records?from=${from}&to=${to}${teacherId ? `&teacherId=${teacherId}` : ""}`)
      .then((r) => r.json()).then((d) => setRecords(d.records));
  }, [api, from, to, teacherId]);

  useEffect(() => {
    api("/api/admin/teachers").then((r) => r.json()).then((d) => setTeachers(d.teachers));
  }, [api]);
  useEffect(load, [load]);

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border p-2" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border p-2" />
        <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className="rounded-lg border p-2">
          <option value="">全部教师</option>
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <a
          href={`/api/admin/records?from=${from}&to=${to}${teacherId ? `&teacherId=${teacherId}` : ""}&format=csv`}
          onClick={async (e) => {
            e.preventDefault();
            const res = await api(`/api/admin/records?from=${from}&to=${to}${teacherId ? `&teacherId=${teacherId}` : ""}&format=csv`);
            const blob = await res.blob();
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `checkins_${from}_${to}.csv`;
            a.click();
          }}
          className="rounded-lg bg-brand text-white text-center py-2 text-sm font-medium"
        >
          导出 CSV
        </a>
      </div>
      <div className="space-y-2">
        {records.map((r) => {
          const abnormal = r.locationStatus !== "normal" || r.outOfWindow;
          return (
            <div key={r.id} className={`rounded-xl p-3 shadow-sm bg-white ${abnormal ? "border-l-4 border-red-400" : ""}`}>
              <div className="flex justify-between items-center">
                <p className="font-medium">{r.name} <span className="text-gray-400 text-sm font-normal">{r.date} {r.time}</span></p>
                <div className="flex gap-1">
                  {r.outOfWindow && <span className="rounded-full bg-purple-100 text-purple-700 px-2 py-0.5 text-xs">时段外</span>}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[r.locationStatus]}`}>{r.statusText}</span>
                </div>
              </div>
              {(r.distanceM != null || r.note) && (
                <p className="text-xs text-gray-500 mt-1">
                  {r.distanceM != null && `距宿舍楼 ${r.distanceM} 米`}
                  {r.note && ` · 备注：${r.note}`}
                </p>
              )}
            </div>
          );
        })}
        {records.length === 0 && <p className="text-center text-gray-400 py-6">该范围内暂无记录</p>}
      </div>
    </div>
  );
}

function StatsTab({ api }: { api: Api }) {
  const [month, setMonth] = useState(() =>
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" }).slice(0, 7)
  );
  const [stats, setStats] = useState<any[]>([]);
  useEffect(() => {
    api(`/api/admin/stats?month=${month}`).then((r) => r.json()).then((d) => setStats(d.stats));
  }, [api, month]);
  return (
    <div>
      <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg border p-2 mb-3" />
      <table className="w-full bg-white rounded-xl shadow-sm overflow-hidden text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-3 text-left">教师</th>
            <th className="p-3 text-right">签到次数</th>
            <th className="p-3 text-right">异常次数</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => (
            <tr key={s.id} className="border-t">
              <td className="p-3">{s.name}</td>
              <td className="p-3 text-right">{s.total}</td>
              <td className={`p-3 text-right ${s.abnormal > 0 ? "text-red-600 font-bold" : ""}`}>{s.abnormal}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TeachersTab({ api }: { api: Api }) {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState("");
  const load = useCallback(() => {
    api("/api/admin/teachers").then((r) => r.json()).then((d) => setTeachers(d.teachers));
  }, [api]);
  useEffect(load, [load]);

  async function add() {
    setMsg("");
    const res = await api("/api/admin/teachers", { method: "POST", body: JSON.stringify({ name, pin }) });
    if (res.ok) { setName(""); setPin(""); load(); }
    else setMsg((await res.json()).error);
  }
  async function update(t: any, patch: any) {
    await api("/api/admin/teachers", { method: "PATCH", body: JSON.stringify({ id: t.id, ...patch }) });
    load();
  }
  async function remove(t: any) {
    if (!confirm(`确认删除/停用「${t.name}」？`)) return;
    await api(`/api/admin/teachers?id=${t.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="姓名" className="flex-1 rounded-lg border p-3" />
        <input value={pin} onChange={(e) => setPin(e.target.value)} placeholder="PIN（可选）" className="w-28 rounded-lg border p-3" />
        <button onClick={add} className="rounded-lg bg-brand text-white px-5 font-medium">添加</button>
      </div>
      {msg && <p className="text-red-600 text-sm mb-2">{msg}</p>}
      <div className="space-y-2">
        {teachers.map((t) => (
          <div key={t.id} className={`rounded-xl bg-white p-3 shadow-sm flex items-center gap-2 ${!t.active ? "opacity-50" : ""}`}>
            <span className="flex-1 font-medium">{t.name}{!t.active && "（已停用）"}</span>
            <input
              defaultValue={t.pin ?? ""}
              placeholder="PIN"
              className="w-20 rounded-lg border p-1.5 text-sm"
              onBlur={(e) => e.target.value !== (t.pin ?? "") && update(t, { pin: e.target.value })}
            />
            <button onClick={() => update(t, { active: !t.active })} className="rounded-lg border px-3 py-1.5 text-sm">
              {t.active ? "停用" : "启用"}
            </button>
            <button onClick={() => remove(t)} className="rounded-lg border border-red-200 text-red-600 px-3 py-1.5 text-sm">删除</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsTab({ api }: { api: Api }) {
  const [s, setS] = useState<any>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    api("/api/admin/settings").then((r) => r.json()).then((d) => setS(d.settings));
  }, [api]);
  if (!s) return <p className="text-gray-400">加载中…</p>;

  async function save() {
    await api("/api/admin/settings", { method: "PUT", body: JSON.stringify(s) });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }
  const field = (label: string, key: string, type = "text", step?: string) => (
    <label className="block mb-3">
      <span className="text-sm text-gray-500">{label}</span>
      <input
        type={type}
        step={step}
        value={s[key]}
        onChange={(e) => setS({ ...s, [key]: type === "number" ? e.target.value : e.target.value })}
        className="mt-1 w-full rounded-lg border p-3"
      />
    </label>
  );

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="font-bold mb-3">宿舍楼定位</h2>
      <div className="grid grid-cols-2 gap-3">
        {field("纬度", "dorm_lat", "number", "any")}
        {field("经度", "dorm_lng", "number", "any")}
      </div>
      {field("有效半径（米）", "radius_m", "number")}
      <h2 className="font-bold mt-4 mb-3">值日时段（可选）</h2>
      <label className="flex items-center gap-2 mb-3">
        <input type="checkbox" checked={s.window_enabled} onChange={(e) => setS({ ...s, window_enabled: e.target.checked })} />
        启用时段校验（时段外签到将标记）
      </label>
      {s.window_enabled && (
        <div className="grid grid-cols-2 gap-3">
          {field("开始时间", "window_start", "time")}
          {field("结束时间", "window_end", "time")}
        </div>
      )}
      <h2 className="font-bold mt-4 mb-3">PIN 校验</h2>
      <label className="flex items-center gap-2 mb-4">
        <input type="checkbox" checked={s.pin_enabled} onChange={(e) => setS({ ...s, pin_enabled: e.target.checked })} />
        开启 PIN（教师选姓名后需输入个人 PIN，在“教师”页设置）
      </label>
      <button onClick={save} className="w-full rounded-xl bg-brand py-3.5 text-lg font-bold text-white">
        {saved ? "已保存 ✓" : "保存配置"}
      </button>
      <p className="text-xs text-gray-400 mt-3">
        提示：手机浏览器打开地图 App 定位到宿舍楼，或在地图上长按查看经纬度后填入。
      </p>
    </div>
  );
}
