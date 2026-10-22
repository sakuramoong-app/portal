/* ============================================================
   session_guard.js … 内勤の退勤時刻で自動ログアウト（2026/10/22〜）
   ------------------------------------------------------------
   ポータルで選んだ担当（currentOperator）の、内勤カレンダーのシフト（naikin_shifts の "20-5" など）を見て、
   退勤時刻＋15分 になったら、このPCのログインを切る（ほかのPC・スマホのログインはそのまま）。
   ・10分前から下に「まもなくログアウト」と出す →「30分のばす」で延長できる（何回でも）
   ・その日にシフトがない（社長・休みの日の作業など）→ 今までどおりログインから20時間（各アプリのしくみ）
   ・シフトが終わってからログインしなおした人は、そのログインでは切らない（20時間のまま）
   全部のアプリ（ポータル・内勤カレンダー・サクラシフト・キャストプロフ・在籍作成ルーム・記録簿）で読みこむ。
   ログインは sakuramoong-app.github.io 全体で1つなので、どのアプリで切っても全部ログアウトになる。
   ============================================================ */
(function(){
  if (window.__sessionGuard) return;
  window.__sessionGuard = true;
  const SUPABASE_URL = "https://tuxqpqokbvkrckgxcfdn.supabase.co";
  const SUPABASE_KEY = "sb_publishable_PyvCZHSzYlaqauYbdZybng_zbftghak";
  const TOKEN_KEY = "sb-tuxqpqokbvkrckgxcfdn-auth-token";
  const STAFF_EMAIL = "naikin@sakuramoong.internal";
  const OPERATOR_KEY = "currentOperator";
  const EXT_KEY = "portalLogoutExt";   // {op, end, until}：「30分のばす」
  const APP_SESSION_KEYS = ["portalStaffSession", "naikinSession", "naikinSessionExp", "profPortalSession", "roomPortalSession"];
  const STAFF_IDS = { "きゃ": "kya", "すや": "suya", "らん": "ran", "かみ": "kami", "わか": "waka" };
  const AFTER_MIN = 15, WARN_MIN = 10, EXTEND_MIN = 30, BEFORE_START_H = 3;
  const MIN = 60 * 1000;

  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const lsDel = k => { try { localStorage.removeItem(k); } catch (e) {} };
  function session(){
    try { const s = JSON.parse(lsGet(TOKEN_KEY) || "null"); return s && s.access_token ? s : null; } catch (e) { return null; }
  }
  // ログインした時刻（トークンの amr。ポータルと同じ読み方）
  function loginAtMs(token){
    try {
      let p = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      while (p.length % 4) p += "=";
      const amr = JSON.parse(atob(p)).amr || [];
      const pw = amr.filter(a => a.method === "password").map(a => a.timestamp);
      const all = amr.map(a => a.timestamp).filter(Boolean);
      return (pw.length ? Math.max(...pw) : (all.length ? Math.min(...all) : 0)) * 1000;
    } catch (e) { return 0; }
  }
  // 日本時間の日付 "2026-10-22"（n 日ずらす）と、その日の h時m分（日本時間）の時刻
  const jstDate = (ms, n) => new Date(ms + 9 * 3600e3 + (n || 0) * 864e5).toISOString().slice(0, 10);
  const jstAt = (ds, h, m) => Date.parse(ds + "T00:00:00+09:00") + (h * 60 + m) * MIN;
  // "20-5" / "12:30-20" → {start, end}（終わりが始まり以前なら次の日）
  function interval(ds, time){
    const m = String(time || "").match(/^(\d{1,2})(?::(\d{2}))?-(\d{1,2})(?::(\d{2}))?$/);
    if (!m) return null;
    const start = jstAt(ds, +m[1], +(m[2] || 0));
    let end = jstAt(ds, +m[3], +(m[4] || 0));
    if (end <= start) end += 24 * 60 * MIN;
    return { start, end };
  }

  let cache = { key: "", at: 0, list: [] };
  async function shiftsOf(staffId, token){
    const now = Date.now(), d0 = jstDate(now, -1), d1 = jstDate(now, 0), key = staffId + d0 + d1;
    if (cache.key === key && now - cache.at < 10 * MIN) return cache.list;
    const url = `${SUPABASE_URL}/rest/v1/naikin_shifts?select=date,time&staff_id=eq.${staffId}&date=in.(${d0},${d1})`;
    const r = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + token } });
    if (!r.ok) throw new Error("shift " + r.status);
    const rows = await r.json();
    cache = { key, at: now, list: rows.map(x => interval(x.date, x.time)).filter(Boolean) };
    return cache.list;
  }
  function extOf(op, end){
    try { const e = JSON.parse(lsGet(EXT_KEY) || "null"); return e && e.op === op && e.end === end ? e.until : 0; } catch (e) { return 0; }
  }
  const limitOf = (op, it) => Math.max(it.end + AFTER_MIN * MIN, extOf(op, it.end));

  // いまの状態：{ at: ログアウトする時刻, it: そのシフト } / null（このしくみでは切らない）
  async function plan(){
    const s = session();
    if (!s || !s.user || String(s.user.email || "").toLowerCase() !== STAFF_EMAIL) return null;
    const op = lsGet(OPERATOR_KEY) || "", staffId = STAFF_IDS[op];
    if (!staffId) return null;
    const list = await shiftsOf(staffId, s.access_token);
    const now = Date.now(), loginAt = loginAtMs(s.access_token);
    // いま入っているシフト（始まる3時間前〜退勤＋15分・延長ぶん）
    const cur = list.filter(it => now >= it.start - BEFORE_START_H * 3600e3 && now <= limitOf(op, it)).sort((a, b) => a.end - b.end)[0];
    if (cur) return { op, it: cur, at: limitOf(op, cur) };
    // シフト中にログインしていて、そのシフトが終わった → すぐ切る
    const ended = list.find(it => now > limitOf(op, it) && it.end > loginAt);
    if (ended) return { op, it: ended, at: now };
    return null;
  }

  async function logoutNow(){
    const s = session();
    APP_SESSION_KEYS.forEach(lsDel);
    lsDel(OPERATOR_KEY); lsDel(EXT_KEY);
    // このPCのログインだけ切る（scope=local：ほかのPC・スマホは切らない）
    if (s) { try { await fetch(`${SUPABASE_URL}/auth/v1/logout?scope=local`, { method: "POST", headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + s.access_token } }); } catch (e) {} }
    lsDel(TOKEN_KEY);
    location.href = "/portal/index.html?auto=shift";
  }

  const hm = ms => { const d = new Date(ms + 9 * 3600e3); return d.getUTCHours() + ":" + String(d.getUTCMinutes()).padStart(2, "0"); };
  function banner(p){
    let el = document.getElementById("sessionGuardBar");
    if (!p) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement("div");
      el.id = "sessionGuardBar";
      el.style.cssText = "position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483647;background:#FFF1F1;border:2.5px solid #E5484D;border-radius:16px;padding:12px 14px;box-shadow:0 6px 24px rgba(0,0,0,.25);font-family:inherit;font-size:14px;color:#5a2a2a;display:flex;gap:10px;align-items:center;flex-wrap:wrap";
      document.body.appendChild(el);
    }
    el.innerHTML = `<div style="flex:1;min-width:200px"><b style="color:#C62828">⏰ ${p.op}さんの退勤時刻（${hm(p.it.end)}）をすぎたので、${hm(p.at)} に自動でログアウトします</b><br><span style="font-size:12px">まだ作業するときは「30分のばす」を押してください。帰るときは「今ログアウトする」。</span></div>
      <button type="button" data-ext style="border:none;border-radius:12px;padding:10px 14px;background:#E5638C;color:#fff;font-weight:900;cursor:pointer;font-family:inherit">⏱ 30分のばす</button>
      <button type="button" data-out style="border:1.5px solid #ddd;border-radius:12px;padding:10px 14px;background:#fff;font-weight:900;cursor:pointer;font-family:inherit">今ログアウトする</button>`;
    el.querySelector("[data-ext]").onclick = () => {
      lsSet(EXT_KEY, JSON.stringify({ op: p.op, end: p.it.end, until: Math.max(p.at, Date.now()) + EXTEND_MIN * MIN }));
      tick();
    };
    el.querySelector("[data-out]").onclick = logoutNow;
  }

  let busy = false;
  async function tick(){
    if (busy) return; busy = true;
    try {
      const p = await plan();
      if (!p) { banner(null); return; }
      const left = p.at - Date.now();
      if (left <= 0) { await logoutNow(); return; }
      banner(left <= WARN_MIN * MIN ? p : null);
    } catch (e) { /* 読めないときは何もしない（今までどおり20時間） */ }
    finally { busy = false; }
  }
  window.SessionGuard = { tick, plan };
  const start = () => { tick(); setInterval(tick, 30 * 1000); };
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") tick(); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
