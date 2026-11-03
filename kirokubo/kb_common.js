/* ============================================================
   kb_common.js — 記録簿（全ページ共通）
   ・Supabase につなぐ／ポータルのログイン（内勤・20時間）を確かめる
   ・担当者（ポータルで選んだ人）・作成中の「店長だけ直せる」
   ・ページの上の切りかえ（受付／キャスト台帳）
   ============================================================ */
(function(){
  const SUPABASE_URL = "https://tuxqpqokbvkrckgxcfdn.supabase.co";
  const SUPABASE_KEY = "sb_publishable_PyvCZHSzYlaqauYbdZybng_zbftghak";
  const STAFF_EMAIL = "naikin@sakuramoong.internal";
  const MANAGER_NAME = "きゃ";
  // 端末の合い鍵（このブラウザで1回だけ作って覚えておく）。見るたびにサーバーへ送り、登録した端末か確かめてもらう（SQL 125）
  function deviceKey(){
    let k = "";
    try{ k = localStorage.getItem("kbDeviceKey") || ""; }catch(e){}
    if(k.length < 40){
      const a = new Uint8Array(32); crypto.getRandomValues(a);
      k = Array.from(a, b=>b.toString(16).padStart(2, "0")).join("");
      try{ localStorage.setItem("kbDeviceKey", k); }catch(e){}
    }
    return k;
  }
  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }, global: { headers: { "x-device-key": deviceKey() } } });

  // 🧪 練習モード（?practice=1）：「練習の日」（2000-01-01）に入れる。本物の画面と同じ。1時間で自動で消える（SQL 204）
  //   ・お客さんの情報・NG・場所・未精算・キャストの設定などは変えない（書いたふりだけ）。新しいお客さんは src='practice'
  //   ・練習の日以外の予約などは書きかえない（update・delete は練習の日だけ）
  //   ・練習でないときは、練習の日の予約・練習のお客さんを読まない（本番の画面・集計に出ない）
  const PRACTICE_DAY = "2000-01-01";
  const PRACTICE = new URLSearchParams(location.search).has("practice");
  const DAY_TABLES = ["kb_reservations", "kb_cast_days", "kb_staff_work", "kb_day_notes", "kb_seat_logs"];
  const PRACTICE_BLOCK = ["kb_cust_cast_ng", "kb_customer_places", "kb_unsettled", "kb_cust_history", "kb_envelope_checks", "kb_collections", "kb_handovers",
    "master_casts", "kb_cast_rules", "kb_settings", "prof_settings", "kb_media_fees", "kb_hotels", "kb_secrets", "staff_accounts", "kb_prices", "kb_back", "kb_options", "prof_hotels"];
  function fakeQ(){
    const p = Promise.resolve({ data: { id: 0 }, error: null });
    const px = new Proxy(function(){}, { get(_, k){ if(k === "then") return p.then.bind(p); if(k === "catch") return p.catch.bind(p); if(k === "finally") return p.finally.bind(p); return () => px; } });
    return px;
  }
  const toPractice = v => Array.isArray(v) ? v.map(toPractice) : (v && typeof v === "object" && "biz_date" in v ? Object.assign({}, v, { biz_date: PRACTICE_DAY }) : v);
  const _from = sb.from.bind(sb);
  sb.from = function(t){
    const b = _from(t);
    if(!PRACTICE){
      if(DAY_TABLES.includes(t) || t === "kb_customers"){
        const sel = b.select.bind(b);
        b.select = (...a) => t === "kb_customers" ? sel(...a).neq("src", "practice") : sel(...a).neq("biz_date", PRACTICE_DAY);
      }
      return b;
    }
    if(PRACTICE_BLOCK.includes(t)){ ["insert", "update", "upsert", "delete"].forEach(k => { b[k] = () => fakeQ(); }); return b; }
    if(t === "kb_customers"){
      const ins = b.insert.bind(b);
      b.insert = (v, o) => ins(Array.isArray(v) ? v.map(x => Object.assign({}, x, { src: "practice" })) : Object.assign({}, v, { src: "practice" }), o);
      ["update", "upsert", "delete"].forEach(k => { b[k] = () => fakeQ(); });
      return b;
    }
    if(DAY_TABLES.includes(t)){
      const ins = b.insert.bind(b), ups = b.upsert.bind(b), upd = b.update.bind(b), del = b.delete.bind(b);
      b.insert = (v, o) => ins(toPractice(v), o);
      b.upsert = (v, o) => ups(toPractice(v), o);
      b.update = (v, o) => upd(toPractice(v), o).eq("biz_date", PRACTICE_DAY);
      b.delete = o => del(o).eq("biz_date", PRACTICE_DAY);
    }
    return b;
  };
  if(PRACTICE){
    const _rpc = sb.rpc.bind(sb);
    sb.rpc = (fn, args, o) => ["kb_set_cast_hotel", "kb_daicho_import", "kb_daicho_clear", "kb_xl_day_import", "kb_xl_uns_import"].includes(fn) ? fakeQ() : _rpc(fn, args, o);
    document.addEventListener("DOMContentLoaded", () => {
      const bar = document.createElement("div");
      bar.style.cssText = "position:sticky;top:0;z-index:9000;background:#FFF1B8;border-bottom:2px solid #F2C94C;color:#6B5200;font-weight:800;font-size:14px;padding:8px 14px;text-align:center;line-height:1.6";
      const off = location.pathname.split("/").pop() || "kiroku.html";
      bar.innerHTML = `🧪 練習モード：ここで入れたものは本番には入りません。1時間で自動で消えます（お客さんの情報・NG・未精算は変わりません）　<a href="${off}" style="color:#B0213F">練習をやめる</a>`;
      document.body.prepend(bar);
    });
  }

  function loginAt(s){
    try{
      const p = JSON.parse(decodeURIComponent(escape(atob(s.access_token.split(".")[1].replace(/-/g,"+").replace(/_/g,"/")))));
      let t = 0; (p.amr || []).forEach(a=>{ if(a && Number(a.timestamp) > t) t = Number(a.timestamp); });
      return t;
    }catch(e){ return 0; }
  }
  async function staffSession(opts){
    const { data } = await sb.auth.getSession();
    const s = data && data.session;
    if(!s || !isStaffSession(s)) return null;   // 共通アカウント、または内勤の一覧のGoogleアカウント（SQL 192）
    if(Date.now() >= (loginAt(s) + 20*3600) * 1000) return null;
    // 作成中は、店長（きゃ）だけが開ける（キャスト台帳は別：ほかの内勤も見られる）。回収明細は社長も。画面の上での分け方
    if(!IS_BOSS && !(STAFF_OPEN && STAFF_PAGES.includes(PAGE))){ managerBlock(); return null; }   // 店長・社長は全部見られて直せる
    // 「登録した端末だけ」が ON で、この端末が登録されていない → 見せない（端末の登録ページは別）
    if(!(opts && opts.skipDevice)){
      const st = await deviceStatus();
      if(st && st.lock_on && !st.registered){ deviceBlock(); return null; }
    }
    return s;
  }
  let _devSt;
  async function deviceStatus(){
    if(_devSt !== undefined) return _devSt;
    try{ const r = await sb.rpc("device_status"); _devSt = r.error ? null : ((r.data && r.data[0]) || null); }catch(e){ _devSt = null; }
    return _devSt;
  }
  function deviceBlock(){
    const d = document.createElement("div");
    d.style.cssText = "position:fixed;inset:0;z-index:99999;background:#FBF7F8;display:flex;align-items:center;justify-content:center;padding:24px;font-family:inherit";
    d.innerHTML = `<div style="max-width:440px;background:#fff;border:2px solid #FFC2D1;border-radius:18px;padding:22px;text-align:center;line-height:1.8">
      <div style="font-size:40px">🔒</div><div style="font-size:17px;font-weight:800;color:#e5638c;margin:6px 0">この端末は登録されていません</div>
      <div style="font-size:13.5px;color:#5C4B4F">お客さんの情報があるページは、お店で登録した端末だけで見られます。<br>この端末を使う場合は、店長に登録してもらってください。</div>
      <div style="margin-top:14px"><a href="device.html" style="font-weight:800;color:#e5638c">🔑 端末の登録ページへ（店長用）</a></div></div>`;
    document.body.appendChild(d);
  }
  function managerBlock(){
    const d = document.createElement("div");
    d.style.cssText = "position:fixed;inset:0;z-index:99999;background:#FBF7F8;display:flex;align-items:center;justify-content:center;padding:24px;font-family:inherit";
    d.innerHTML = `<div style="max-width:440px;background:#fff;border:2px solid #FFC2D1;border-radius:18px;padding:22px;text-align:center;line-height:1.8">
      <div style="font-size:40px">🚧</div><div style="font-size:17px;font-weight:800;color:#e5638c;margin:6px 0">店長が準備中のページです</div>
      <div style="font-size:13.5px;color:#5C4B4F">できあがるまでは、店長（きゃ）だけが開けます。</div>
      <div style="margin-top:14px"><a href="index.html" style="font-weight:800;color:#e5638c">📒 キャスト台帳へ</a></div></div>`;
    document.body.appendChild(d);
  }
  // 👤 だれか：Googleで入った人は、通行証の印（staff_name・staff_role。SQL 192）でわかる。共通アカウントのときは、ポータルで選んだ担当者
  function claimOf(token){
    try{ let p = String(token || "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/"); while(p.length % 4) p += "="; return JSON.parse(decodeURIComponent(escape(atob(p)))) || {}; }catch(e){ return {}; }
  }
  function isStaffSession(s){ return !!s && !!s.user && (String(s.user.email || "").toLowerCase() === STAFF_EMAIL || ["staff", "manager", "owner"].includes(claimOf(s.access_token).staff_role)); }
  function myClaim(){ try{ const t = JSON.parse(localStorage.getItem("sb-tuxqpqokbvkrckgxcfdn-auth-token") || "null"); return t && t.access_token ? claimOf(t.access_token) : {}; }catch(e){ return {}; } }
  const CLAIM = myClaim(), GOOGLE = ["staff", "manager", "owner"].includes(CLAIM.staff_role);
  function operatorName(){ if(GOOGLE) return CLAIM.staff_name || ""; try{ return localStorage.getItem("currentOperator") || ""; }catch(e){ return ""; } }
  // 店長（きゃ）と社長のときだけ直せる。Googleで入った人は、内勤の一覧の役わり（店長・社長）で決まる
  const OWNER_NAME = "社長", IS_OWNER = GOOGLE && CLAIM.staff_role === "owner";   // 共通アカウントでは、社長にはなれない（Googleだけ）
  // 🔑 切りかえ（本番）のスイッチ：true にすると、内勤（Googleの内勤・共通アカウントの すや など）も 受付・精算・顧客台帳 を開けて直せる
  //    回収明細・集計・バックアップ・台帳の取りこみ・端末の登録は、ずっと店長・社長だけ
  const STAFF_OPEN = true;
  const STAFF_PAGES = ["kiroku.html", "settle.html", "customers.html"];
  const PAGE = location.pathname.split("/").pop() || "index.html";
  const IS_BOSS = GOOGLE && ["manager", "owner"].includes(CLAIM.staff_role);
  // 社長（owner）は見るだけ（直せない）2026/11/4 社長の希望。回収明細の「社長が受け取った」は IS_OWNER で別に動く
  const CAN_EDIT = !IS_OWNER && (IS_BOSS || (STAFF_OPEN && STAFF_PAGES.includes(PAGE)));   // 店長・社長はGoogleで入ったときだけ（共通アカウントでは、きゃ・社長は選べない）

  function q(res){ if(res.error) throw res.error; return res.data; }
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const yen = n => (Number(n)||0).toLocaleString("ja-JP") + "円";
  function toast(m){
    let t = document.getElementById("kbToast");
    if(!t){ t = document.createElement("div"); t.id = "kbToast"; t.className = "toast"; document.body.appendChild(t); }
    t.textContent = m; t.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(()=>t.classList.remove("show"), 2400);
  }
  // 営業日（朝6時で切りかえ）。日本時間で計算
  function bizDateOf(d){ return PRACTICE ? PRACTICE_DAY : realBizDateOf(d); }   // 練習モードはいつも「練習の日」
  function realBizDateOf(d){
    const j = new Date((d || new Date()).getTime() + 9*3600*1000);   // 日本時間の時刻を UTC の欄に入れて扱う
    if(j.getUTCHours() < 6) j.setUTCDate(j.getUTCDate() - 1);
    return j.toISOString().slice(0,10);
  }
  // 見ている日を、ページを行き来しても同じにする（記録簿・精算・回収明細）。同じタブの中だけ・6時間まで
  function rememberDay(d){ if(PRACTICE) return; try{ if(/^\d{4}-\d{2}-\d{2}$/.test(d || "")) sessionStorage.setItem("kbDay", JSON.stringify({ d, at: Date.now() })); }catch(e){} }
  function startDay(){
    if(PRACTICE) return PRACTICE_DAY;
    const u = new URLSearchParams(location.search).get("d");
    if(/^\d{4}-\d{2}-\d{2}$/.test(u || "")) return u;
    try{ const s = JSON.parse(sessionStorage.getItem("kbDay") || "null"); if(s && s.d && Date.now() - s.at < 6 * 3600 * 1000) return s.d; }catch(e){}
    return bizDateOf();
  }
  // ページの上の切りかえ
  function nav(active){
    // 練習モードは、記録簿と精算だけ（練習のまま行き来する）
    if(PRACTICE) return `<nav class="kbnav">${[["kiroku.html","📒 記録簿（練習）"],["settle.html","💴 精算（練習）"]].map(([h,l])=>`<a href="${h}?practice=1" class="${h===active?"on":""}">${l}</a>`).join("")}</nav>`;
    const all = [["kiroku.html","📒 記録簿"],["settle.html","💴 精算"],["kaishu.html","📦 回収明細"],["index.html","📒 キャスト台帳"],["customers.html","👥 顧客台帳"],["stats.html","📈 集計"],["backup.html","💾 バックアップ"]];
    const items = IS_BOSS ? all : all.filter(([h])=>h === "index.html" || (STAFF_OPEN && STAFF_PAGES.includes(h)));   // 店長・社長は全部、ほかの内勤はキャスト台帳だけ
    // スマホでは、スマホで開けるページだけ（session_guard.js と同じ：受付・精算・キャスト台帳。回収明細は店長・社長）
    const phone = /iPhone|iPod|Android.+Mobile/i.test(navigator.userAgent) || matchMedia("(max-width:640px)").matches;
    const shown = phone ? items.filter(([h]) => ["kiroku.html", "settle.html", "index.html"].includes(h) || (h === "kaishu.html" && IS_BOSS)) : items;
    return `<nav class="kbnav">${shown.map(([h,l])=>`<a href="${h}" target="_blank" rel="opener" class="${h===active?"on":""}">${l}</a>`).join("")}<a href="kiroku.html?practice=1" target="_blank" rel="opener">🧪 練習</a><a href="../guide.html" target="_blank" rel="opener">📖 使い方</a></nav>`;
  }
  function wipBanner(){
    return `<div class="wip">🚧 <b>作成中です。触らないでください。</b><br><span>${CAN_EDIT
      ? (IS_OWNER ? "👑 社長として開いています（直せます）。" : "👑 店長として開いています（直せます）。")
      : "店長（きゃ）が準備中のページです。見るだけで、直すことはできません。"}</span></div>`;
  }
  // 外側を押したら閉じる小窓（押すのも離すのも外のときだけ。中で押し始めた・文字を選んでいる間は閉じない）
  function closeOnBackdrop(bg, close){
    let down = false, up = false;
    bg.addEventListener("pointerdown", e=>{ down = e.target === bg; up = false; }, true);
    bg.addEventListener("pointerup", e=>{ up = e.target === bg; }, true);
    bg.addEventListener("click", e=>{
      const sel = window.getSelection ? String(window.getSelection()) : "";
      const ok = e.target === bg && down && up && !sel;
      down = up = false;
      if(ok) close();
    });
  }

  // 🔒 店長・社長だけのページ（回収明細・集計・バックアップ）は、開くときに端末の登録の合言葉。同じタブで一度入れたら、そのタブを閉じるまで聞かない
  function passGate(label){
    try{ if(sessionStorage.getItem("kbPassOK") === "1") return Promise.resolve(true); }catch(e){}
    return new Promise(resolve => {
      const d = document.createElement("div");
      d.style.cssText = "position:fixed;inset:0;z-index:99998;background:#FBF7F8;display:flex;align-items:center;justify-content:center;padding:20px;font-family:inherit";
      d.innerHTML = `<div style="width:100%;max-width:380px;background:#fff;border:2px solid #FFC2D1;border-radius:18px;padding:22px;text-align:center;line-height:1.8">
        <div style="font-size:36px">🔒</div><div style="font-size:17px;font-weight:800;color:#e5638c">${esc(label)}は合言葉で開きます</div>
        <div style="font-size:12.5px;color:#9C8B8F;margin-bottom:10px">端末の登録の合言葉です（店長・社長だけ）</div>
        <input type="password" id="kbPass" autocomplete="off" style="width:100%;box-sizing:border-box;font-size:17px;padding:11px;border:2px solid #FFC2D1;border-radius:12px;text-align:center;font-family:inherit">
        <div id="kbPassMsg" style="color:#c0392b;font-weight:800;font-size:13px;min-height:20px;margin-top:6px"></div>
        <button type="button" id="kbPassOk" style="width:100%;border:none;border-radius:99px;padding:11px;background:#e5638c;color:#fff;font-weight:900;font-size:16px;font-family:inherit;cursor:pointer">開く</button></div>`;
      document.body.appendChild(d);
      const inp = d.querySelector("#kbPass"), msg = d.querySelector("#kbPassMsg");
      const go = async () => {
        if(!inp.value){ msg.textContent = "合言葉を入れてください"; return; }
        msg.textContent = "たしかめています…";
        try{
          const r = await sb.rpc("device_pass_ok", { p_pass: inp.value });
          if(r.error) throw r.error;
          if(r.data !== true){ msg.textContent = "合言葉がちがいます"; return; }
          try{ sessionStorage.setItem("kbPassOK", "1"); }catch(e){}
          d.remove(); resolve(true);
        }catch(e){ msg.textContent = "たしかめられませんでした：" + (e.message || e); }
      };
      d.querySelector("#kbPassOk").onclick = go;
      inp.onkeydown = e => { if(e.key === "Enter") go(); };
      setTimeout(() => inp.focus(), 50);
    });
  }

  window.KB = { sb, staffSession, deviceStatus, operatorName, CAN_EDIT, MANAGER_NAME, IS_OWNER, OWNER_NAME, q, esc, yen, toast, bizDateOf, realBizDateOf, rememberDay, startDay, nav, wipBanner, closeOnBackdrop, passGate, PRACTICE, PRACTICE_DAY };
})();

/* ---------- ⬆ 上に戻るボタン（記録簿のページ共通）：ある程度下までスクロールしたら右下に出る。
   受付の窓（#formBg）を開いているときは、窓の中を上に戻す ---------- */
(function(){
  function setup(){
    const css = document.createElement("style");
    css.textContent = `#toTopBtn{position:fixed;right:16px;bottom:64px;z-index:1100;width:52px;height:52px;border-radius:50%;border:2px solid #FFC2D1;background:#fff;color:#e5638c;font-size:22px;font-weight:900;cursor:pointer;box-shadow:0 6px 16px rgba(229,99,140,.3);display:none;align-items:center;justify-content:center;font-family:inherit;line-height:1}
    #toTopBtn:hover{background:#FFE4EC} #toTopBtn.show{display:flex}`;
    document.head.appendChild(css);
    const b = document.createElement("button");
    b.id = "toTopBtn"; b.type = "button"; b.title = "いちばん上に戻る"; b.textContent = "⬆";
    document.body.appendChild(b);
    const form = () => { const f = document.getElementById("formBg"); return f && f.classList.contains("show") ? f : null; };
    const paint = () => { const f = form(); b.classList.toggle("show", (f ? f.scrollTop : window.scrollY) > 600); };
    b.addEventListener("click", () => { const f = form(); (f || window).scrollTo({ top: 0, behavior: "smooth" }); });
    window.addEventListener("scroll", paint, { passive: true });
    document.addEventListener("scroll", e => { if(e.target && e.target.id === "formBg") paint(); }, { passive: true, capture: true });
    const f = document.getElementById("formBg");
    if(f) new MutationObserver(paint).observe(f, { attributes: true, attributeFilter: ["class"] });
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup); else setup();
})();

/* ---------- 数字の欄（記録簿のページ共通）：スクロールしても数字を変えない・クリックで中身をぜんぶ選ぶ ---------- */
document.addEventListener("wheel", e => { const t = e.target; if(t && t.matches && t.matches("input[type=number]") && document.activeElement === t) t.blur(); }, { passive: true, capture: true });
document.addEventListener("focusin", e => { const t = e.target; if(t && t.matches && t.matches("input[type=number]")) setTimeout(() => { try{ t.select(); }catch(err){} }, 0); });

/* ---------- 📱 スマホでは出さないもの（記録簿のページ共通）：あかさたな・今日の数字・内勤の日払い ---------- */
(function(){
  const phone = /iPhone|iPod|Android.+Mobile/i.test(navigator.userAgent) || matchMedia("(max-width:640px)").matches;
  if(!phone) return;
  document.documentElement.classList.add("is-phone");
  const css = document.createElement("style");
  css.textContent = `.is-phone .kanabar, .is-phone #kanaBar, .is-phone #todayBox, .is-phone #staffPayBox{display:none !important}`;
  (document.head || document.documentElement).appendChild(css);
})();
