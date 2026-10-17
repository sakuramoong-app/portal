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
  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });

  function loginAt(s){
    try{
      const p = JSON.parse(decodeURIComponent(escape(atob(s.access_token.split(".")[1].replace(/-/g,"+").replace(/_/g,"/")))));
      let t = 0; (p.amr || []).forEach(a=>{ if(a && Number(a.timestamp) > t) t = Number(a.timestamp); });
      return t;
    }catch(e){ return 0; }
  }
  async function staffSession(){
    const { data } = await sb.auth.getSession();
    const s = data && data.session;
    if(!s || String(s.user.email||"").toLowerCase() !== STAFF_EMAIL) return null;
    return Date.now() < (loginAt(s) + 20*3600) * 1000 ? s : null;
  }
  function operatorName(){ try{ return localStorage.getItem("currentOperator") || ""; }catch(e){ return ""; } }
  // 作成中は、店長（きゃ）のときだけ直せる。ほかの内勤は見るだけ（画面の上での分け方）
  const CAN_EDIT = operatorName() === MANAGER_NAME;

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
  // ページの上の切りかえ
  function nav(active){
    const items = [["kiroku.html","🆕 新しい記録簿（ためし中）"],["reception.html","🧾 受付"],["settle.html","💴 精算"],["index.html","📒 キャスト台帳"]];
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

  window.KB = { sb, staffSession, operatorName, CAN_EDIT, MANAGER_NAME, q, esc, yen, toast, bizDateOf, nav, wipBanner, closeOnBackdrop };
})();
