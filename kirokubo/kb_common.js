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
    if(!s || String(s.user.email||"").toLowerCase() !== STAFF_EMAIL) return null;
    if(Date.now() >= (loginAt(s) + 20*3600) * 1000) return null;
    // 作成中は、店長（きゃ）だけが開ける（キャスト台帳は別：ほかの内勤も見られる）。回収明細は社長も。画面の上での分け方
    if(!CAN_EDIT && !(opts && opts.owner && IS_OWNER)){ managerBlock(); return null; }
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
  function operatorName(){ try{ return localStorage.getItem("currentOperator") || ""; }catch(e){ return ""; } }
  // 作成中は、店長（きゃ）のときだけ直せる。ほかの内勤は見るだけ（画面の上での分け方）
  const CAN_EDIT = operatorName() === MANAGER_NAME;
  const OWNER_NAME = "社長", IS_OWNER = operatorName() === OWNER_NAME;

  function q(res){ if(res.error) throw res.error; return res.data; }
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const yen = n => (Number(n)||0).toLocaleString("ja-JP") + "円";
  function toast(m){
    let t = document.getElementById("kbToast");
    if(!t){ t = document.createElement("div"); t.id = "kbToast"; t.className = "toast"; document.body.appendChild(t); }
    t.textContent = m; t.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(()=>t.classList.remove("show"), 2400);
  }
  // 営業日（朝6時で切りかえ）。日本時間で計算
  function bizDateOf(d){
    const j = new Date((d || new Date()).getTime() + 9*3600*1000);   // 日本時間の時刻を UTC の欄に入れて扱う
    if(j.getUTCHours() < 6) j.setUTCDate(j.getUTCDate() - 1);
    return j.toISOString().slice(0,10);
  }
  // 見ている日を、ページを行き来しても同じにする（記録簿・精算・回収明細）。同じタブの中だけ・6時間まで
  function rememberDay(d){ try{ if(/^\d{4}-\d{2}-\d{2}$/.test(d || "")) sessionStorage.setItem("kbDay", JSON.stringify({ d, at: Date.now() })); }catch(e){} }
  function startDay(){
    const u = new URLSearchParams(location.search).get("d");
    if(/^\d{4}-\d{2}-\d{2}$/.test(u || "")) return u;
    try{ const s = JSON.parse(sessionStorage.getItem("kbDay") || "null"); if(s && s.d && Date.now() - s.at < 6 * 3600 * 1000) return s.d; }catch(e){}
    return bizDateOf();
  }
  // ページの上の切りかえ
  function nav(active){
    const all = [["kiroku.html","🆕 新しい記録簿（ためし中）"],["reception.html","🧾 受付"],["settle.html","💴 精算"],["kaishu.html","📦 回収明細"],["index.html","📒 キャスト台帳"],["customers.html","👥 顧客台帳"],["stats.html","📈 集計"]];
    const items = CAN_EDIT ? all : all.filter(([h])=>h === "index.html" || (IS_OWNER && h === "kaishu.html"));   // 店長以外はキャスト台帳だけ（社長は回収明細も）
    return `<nav class="kbnav">${items.map(([h,l])=>`<a href="${h}" class="${h===active?"on":""}">${l}</a>`).join("")}</nav>`;
  }
  function wipBanner(){
    return `<div class="wip">🚧 <b>作成中です。触らないでください。</b><br><span>${CAN_EDIT
      ? "👑 店長として開いています（直せます）。"
      : "店長（きゃ）が準備中のページです。見るだけで、直すことはできません。"}</span></div>`;
  }
  // 外側を押したら閉じる小窓（中で押し始めて外で離したときは閉じない）
  function closeOnBackdrop(bg, close){
    let down = false;
    bg.addEventListener("mousedown", e=>{ down = e.target === bg; });
    bg.addEventListener("click", e=>{ if(e.target === bg && down) close(); });
  }

  window.KB = { sb, staffSession, deviceStatus, operatorName, CAN_EDIT, MANAGER_NAME, IS_OWNER, OWNER_NAME, q, esc, yen, toast, bizDateOf, rememberDay, startDay, nav, wipBanner, closeOnBackdrop };
})();
