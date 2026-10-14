"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Teacher = {
  id: number;
  name: string;
  needPin: boolean;
  signed: { time: string; note: string | null; status: string } | null;
};
type PublicSettings = {
  radius_m: number;
  pin_enabled: boolean;
  window_enabled: boolean;
  window_start: string;
  window_end: string;
};
type GeoState =
  | { status: "pending" }
  | { status: "ok"; lat: number; lng: number }
  | { status: "failed" };

const STATUS_TEXT: Record<string, string> = {
  normal: "定位正常",
  out_of_range: "位置异常",
  unavailable: "未获取定位",
};

export default function CheckinPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [now, setNow] = useState(new Date());
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Teacher | null>(null);
  const [pin, setPin] = useState("");
  const [geo, setGeo] = useState<GeoState>({ status: "pending" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ name: string; time: string; status: string; already: boolean } | null>(null);
  const [note, setNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const confirmRef = useRef(false);

  // 实时时钟
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // 初始化数据
  useEffect(() => {
    fetch("/api/public/bootstrap")
      .then((r) => r.json())
      .then((d) => {
        setTeachers(d.teachers);
        setSettings(d.settings);
      })
      .catch(() => setError("加载失败，请刷新重试"));
  }, []);

  // 请求定位（进入即请求）
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeo({ status: "failed" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeo({ status: "ok", lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeo({ status: "failed" }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  const filtered = useMemo(
    () => teachers.filter((t) => t.name.includes(search.trim())),
    [teachers, search]
  );

  const dateText = now.toLocaleDateString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  const timeText = now.toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });

  async function submit() {
    if (!selected || submitting) return;
    setError("");
    // 超范围二次确认（前端粗判，服务端再终判）
    if (geo.status === "ok" && !confirmRef.current) {
      // 前端不知宿舍楼坐标，交给服务端判定后如返回 out_of_range 由成功卡片展示；
      // 这里仅在定位失败时直接提示，超范围由提交后服务端标记
    }
    if (geo.status === "failed" && !confirmRef.current) {
      if (!window.confirm("未获取到定位，仍要签到吗？（将标记为“未获取定位”）")) return;
      confirmRef.current = true;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: selected.id,
          lat: geo.status === "ok" ? geo.lat : null,
          lng: geo.status === "ok" ? geo.lng : null,
          pin: pin || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429 && data.record) {
          setDone({ name: selected.name, time: data.record.time, status: data.record.locationStatus, already: true });
          return;
        }
        if (data.error === "PIN 不正确") {
          setError("PIN 不正确，请重试");
          return;
        }
        setError(data.error || "签到失败，请重试");
        return;
      }
      const r = data.record;
      if (r.locationStatus === "out_of_range" && !data.already && !confirmRef.current) {
        // 位置异常：提示并确认后保留记录（服务端已记录并标记）
        window.alert("您当前不在宿舍区域，本次签到已标记为“位置异常”。");
      }
      setDone({ name: selected.name, time: r.time, status: r.locationStatus, already: data.already });
    } catch {
      setError("网络异常，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  async function saveNote() {
    if (!selected && !done) return;
    // 找到已签到教师 id
    const t = teachers.find((x) => x.name === (done?.name ?? selected?.name));
    if (!t) return;
    const res = await fetch("/api/public/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacherId: t.id, note }),
    });
    if (res.ok) setNoteSaved(true);
  }

  const geoBadge =
    geo.status === "pending" ? (
      <span className="text-gray-500">正在获取定位…</span>
    ) : geo.status === "ok" ? (
      <span className="text-brand">定位已获取（半径 {settings?.radius_m ?? 300} 米内有效）</span>
    ) : (
      <span className="text-orange-600">未获取定位，仍可签到</span>
    );

  // 成功卡片 / 已签到视图
  if (done) {
    return (
      <main className="mx-auto max-w-md p-4 pt-10">
        <div className="rounded-2xl bg-white p-6 shadow-sm text-center">
          <div className="text-5xl mb-3">✅</div>
          <h1 className="text-2xl font-bold mb-1">
            {done.already ? "今日已签到" : "签到成功"}
          </h1>
          <p className="text-lg mt-3">{done.name}</p>
          <p className="text-3xl font-mono font-bold text-brand my-2">{done.time.slice(0, 5)}</p>
          <p
            className={`inline-block rounded-full px-4 py-1 text-sm font-medium ${
              done.status === "normal"
                ? "bg-green-100 text-green-700"
                : done.status === "out_of_range"
                ? "bg-red-100 text-red-700"
                : "bg-orange-100 text-orange-700"
            }`}
          >
            {STATUS_TEXT[done.status] ?? done.status}
          </p>
          <div className="mt-6 text-left">
            <label className="block text-sm text-gray-500 mb-1">补充备注（可选）</label>
            <textarea
              className="w-full rounded-xl border border-gray-200 p-3 text-base"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="如：代值日、外出教研等"
            />
            <button
              onClick={saveNote}
              className="mt-2 w-full rounded-xl border border-brand text-brand py-3 text-lg font-medium active:bg-brand-light"
            >
              {noteSaved ? "备注已保存" : "保存备注"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md p-4 pt-6">
      {/* 日期时间 */}
      <div className="rounded-2xl bg-brand p-5 text-white shadow-sm">
        <p className="text-sm opacity-90">{dateText}</p>
        <p className="text-4xl font-mono font-bold mt-1">{timeText}</p>
        <p className="text-xs mt-2 opacity-90">教师宿舍值日签到 · {geoBadge && <span className="text-white/90">{geoBadge}</span>}</p>
      </div>

      {/* 搜索 */}
      <input
        className="mt-4 w-full rounded-xl border border-gray-200 bg-white p-4 text-lg"
        placeholder="搜索姓名…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* 教师列表 */}
      <div className="mt-3 space-y-2">
        {filtered.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setSelected(t);
              setError("");
              if (t.signed) {
                setDone({ name: t.name, time: t.signed.time, status: t.signed.status, already: true });
                if (t.signed.note) setNote(t.signed.note);
              }
            }}
            className={`w-full rounded-xl p-4 text-left text-lg font-medium shadow-sm flex items-center justify-between ${
              selected?.id === t.id ? "bg-brand text-white" : "bg-white"
            }`}
          >
            <span>{t.name}</span>
            {t.signed && (
              <span className={`text-sm ${selected?.id === t.id ? "text-white/90" : "text-green-600"}`}>
                已签到 {t.signed.time.slice(0, 5)}
              </span>
            )}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 py-6">未找到匹配的教师</p>
        )}
      </div>

      {/* PIN 输入 */}
      {selected?.needPin && !selected.signed && (
        <input
          type="password"
          inputMode="numeric"
          className="mt-4 w-full rounded-xl border border-gray-200 bg-white p-4 text-lg tracking-widest"
          placeholder="请输入个人 PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
        />
      )}

      {error && <p className="mt-3 text-center text-red-600">{error}</p>}

      {/* 提交按钮 */}
      {selected && !selected.signed && (
        <button
          onClick={submit}
          disabled={submitting || (selected.needPin && !pin)}
          className="mt-4 w-full rounded-2xl bg-brand py-5 text-2xl font-bold text-white shadow-md active:bg-brand-dark disabled:opacity-40"
        >
          {submitting ? "提交中…" : geo.status === "pending" ? "签到（定位中）" : "确认签到"}
        </button>
      )}
      {!selected && (
        <p className="mt-6 text-center text-gray-400 text-sm">请选择您的姓名完成签到</p>
      )}
    </main>
  );
}
