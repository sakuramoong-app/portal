/* ============================================================
   🧭 記録簿トップの並び（2026/11/18 店長 OK：見本 https://claude.ai/artifact/HpLvDVBBPJ9G2NQGS1p5r3）
   ・左の縦の列：メニュー・今日の数字・内勤の日払い（社長用の集計も）。今日の数字・日払いは、ふだんは閉じておく
   ・日付の行（タブ・日付・並び）は、右の列のいちばん上で固定（下に読み進めても残る）
   ・本日のお知らせと内勤カレンダーの今日の予定を、1つの枠「📢 お知らせ・今日の予定」に（予定はここでは見るだけ）
   ・中身（予約・計算・ボタン）は変えない。置き場所を動かすだけ（同じ id のまま動かすので、ほかのところはそのまま動く）
   ・スマホ（せまい画面）は、左の列が上・その下に右の列
   ============================================================ */
(function kbLayout(){
  const main = document.getElementById("main");
  if(!main || document.getElementById("kbLayout")) return;
  const lay = document.createElement("div"); lay.className = "kblay"; lay.id = "kbLayout";
  const side = document.createElement("aside"); side.className = "kbside"; side.id = "kbSide";
  const col = document.createElement("div"); col.className = "kbcol"; col.id = "kbCol";
  lay.append(side, col);
  // 右の列：今までの中身をそのまま順に
  [...main.children].forEach(k => col.appendChild(k));
  main.appendChild(lay);
  // 日付の行（タブ・日付・並び）を右の列のいちばん上に
  const sticky = col.querySelector(".stickybar");
  if(sticky) col.prepend(sticky);
  // 左の列：メニュー
  const nav = document.getElementById("navArea");
  if(nav){
    const box = document.createElement("div"); box.className = "kbside-box kbside-nav"; box.id = "kbMenu";
    box.innerHTML = `<div class="kbside-h">メニュー</div>`;
    nav.classList.remove("navinhead");
    box.appendChild(nav); side.appendChild(box);
  }
  // 左の列：今日の数字・内勤の日払い・社長用（ふだんは閉じておく。2026/11/18 店長）
  ["todayBox", "staffPayBox", "ownerBox"].forEach(id => {
    const d = document.getElementById(id); if(!d) return;
    d.open = false; d.classList.add("kbside-box"); side.appendChild(d);
  });
  // 📢 お知らせ・今日の予定（本日のお知らせ＋内勤カレンダーの予定）
  const notice = col.querySelector(".notice"), nev = document.getElementById("nEvents");
  if(notice){
    const box = document.createElement("div"); box.className = "kbnews"; box.id = "kbNews";
    box.innerHTML = `<div class="kbnews-h">📢 お知らせ・今日の予定<small>予定を消す・直すのは内勤カレンダーで</small></div><div class="kbnews-g"></div>`;
    notice.parentNode.insertBefore(box, notice);
    const g = box.querySelector(".kbnews-g");
    g.appendChild(notice);
    if(nev) g.appendChild(nev);
  }
})();
document.head.insertAdjacentHTML("beforeend", `<style>
  .kblay{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start}
  .kbside{flex:1 1 230px;max-width:280px;min-width:0;display:flex;flex-direction:column;gap:10px}
  .kbcol{flex:999 1 560px;min-width:0}
  @media (max-width:900px){ .kbside{max-width:none} }
  .kbside-box{background:#fff;border:2px solid var(--line,#F3D6E0);border-radius:16px;padding:8px 10px;margin:0 !important}
  .kbside-h{font-size:12px;font-weight:800;color:var(--sub,#7A6670);padding:2px 4px 6px;cursor:pointer} .kbside-nav:not([open]) .kbside-h{padding-bottom:2px}
  .kbside-nav .kbnav{display:flex !important;flex-direction:column;align-items:stretch;gap:6px;margin:0 !important}
  .kbside-nav .kbnav > *{width:100%;justify-content:flex-start;text-align:left;box-sizing:border-box}
  .kbside .todaygrid{grid-template-columns:repeat(2,minmax(0,1fr)) !important}
  .kbnews{background:#fff;border:2px solid var(--line,#F3D6E0);border-radius:16px;padding:10px 12px;margin:8px 0}
  .kbnews-h{font-weight:900;font-size:16px;margin-bottom:6px;display:flex;flex-wrap:wrap;align-items:baseline;gap:8px} .kbnews-h small{font-size:11.5px;color:var(--sub,#7A6670);font-weight:700}
  .kbnews-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;align-items:start}
  .kbnews-g .notice{margin:0} .kbnews-g .nevents{margin:0;background:#EEF6FF;border-radius:12px;padding:6px 10px;min-height:40px}
  .kbnews-g .nevents:empty::before{content:"📅 内勤カレンダーの今日の予定はありません";color:var(--sub,#7A6670);font-size:12.5px;font-weight:700}
</style>`);
/* 💴 内勤の日払い：左の列でも横にスクロールしないで見えるように、1人ずつカードの形に（2026/11/18 店長「すごく見づらい」）
   表の中身・入力・保存ボタンはそのまま（見た目だけ） */
document.head.insertAdjacentHTML("beforeend", `<style>
  .kbside #staffPayGrid .wrapx{overflow:visible}
  .kbside #staffPayGrid table.list,.kbside #staffPayGrid table.list tbody{display:block;width:100%}
  .kbside #staffPayGrid table.list tr:has(th){display:none}
  .kbside #staffPayGrid table.list tr{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 8px;border:1.5px solid var(--line,#F3D6E0);border-radius:12px;padding:8px;margin:0 0 8px}
  .kbside #staffPayGrid table.list td{display:block;padding:0;border:none;min-width:0;text-align:left}
  .kbside #staffPayGrid table.list td:nth-child(1),.kbside #staffPayGrid table.list td:nth-child(7),.kbside #staffPayGrid table.list td:nth-child(8),.kbside #staffPayGrid table.list td:nth-child(9){grid-column:1 / -1}
  .kbside #staffPayGrid table.list td:nth-child(1) b{font-size:15px}
  .kbside #staffPayGrid table.list td::before{display:block;font-size:11px;font-weight:800;color:var(--sub,#7A6670)}
  .kbside #staffPayGrid table.list td:nth-child(2)::before{content:"出勤"} .kbside #staffPayGrid table.list td:nth-child(3)::before{content:"退勤"}
  .kbside #staffPayGrid table.list td:nth-child(4)::before{content:"時間"} .kbside #staffPayGrid table.list td:nth-child(5)::before{content:"時給"}
  .kbside #staffPayGrid table.list td:nth-child(6)::before{content:"日払い"} .kbside #staffPayGrid table.list td:nth-child(7)::before{content:"どこから"}
  .kbside #staffPayGrid table.list td:nth-child(8)::before{content:"メモ"}
  .kbside #staffPayGrid table.list td select,.kbside #staffPayGrid table.list td input{width:100% !important;box-sizing:border-box;max-width:100%}
  .kbside #staffPayGrid table.list td:nth-child(7) div{white-space:normal !important}
  .kbside #staffPayGrid table.list td:nth-child(9) .btn{width:100%}
</style>`);
/* ◀ 左の列（メニュー・今日の数字・内勤の日払い）ごと横にしまう → 右の列が広がる（2026/11/18 店長）
   しまう・出すは、この端末で覚えておく（localStorage kbSideOpen） */
(function kbSideToggle(){
  const lay = document.getElementById("kbLayout"), side = document.getElementById("kbSide"); if(!lay || !side) return;
  const btn = document.createElement("button"); btn.type = "button"; btn.id = "kbSideBtn"; btn.className = "kbsidebtn";
  side.prepend(btn);
  const set = open => {
    lay.classList.toggle("kbside-off", !open);
    btn.textContent = open ? "◀ しまう" : "▶";
    btn.title = open ? "メニュー・今日の数字・日払いを横にしまう（右が広がります）" : "メニュー・今日の数字・日払いを出す";
    try{ localStorage.setItem("kbSideOpen", open ? "1" : "0"); }catch(e){}
  };
  let o = "1"; try{ o = localStorage.getItem("kbSideOpen") ?? "1"; }catch(e){}
  set(o !== "0");
  btn.addEventListener("click", () => set(lay.classList.contains("kbside-off")));
})();
document.head.insertAdjacentHTML("beforeend", `<style>
  .kbsidebtn{align-self:flex-end;font-family:inherit;font-weight:800;font-size:12px;border:2px solid var(--line,#F3D6E0);background:#fff;border-radius:99px;padding:4px 12px;cursor:pointer;color:var(--ink,#4A3A40)}
  .kblay.kbside-off .kbside{flex:0 0 auto;max-width:none;width:auto}
  .kblay.kbside-off .kbside > :not(.kbsidebtn){display:none !important}
  .kblay.kbside-off .kbsidebtn{align-self:flex-start;padding:8px 10px;font-size:14px}
</style>`);
/* 📅 今日以外の日を開いているときは、ひと目でわかるように（2026/11/18 店長：先の日の画面に予約を書いてしまうことがある）
   ・背景を水色に＋日付の行の上に「⚠️ 今日ではありません：○/○(○) の画面です」と「今日にもどる」 */
function kbDayTint(){
  try{
    const today = KB.bizDateOf(), other = !!day && day !== today;
    document.body.classList.toggle("kb-notToday", other);
    const bar = document.querySelector("#kbCol .stickybar") || document.querySelector(".stickybar"); if(!bar) return;
    let el = document.getElementById("kbDayWarn");
    if(!el){ el = document.createElement("div"); el.id = "kbDayWarn"; el.className = "kbdaywarn"; bar.prepend(el); }
    if(!other){ el.style.display = "none"; return; }
    const d = new Date(day + "T12:00:00Z"), past = day < today;
    el.style.display = "";
    el.innerHTML = `⚠️ 今日ではありません：<b>${d.getUTCMonth() + 1}/${d.getUTCDate()}(${DOW[d.getUTCDay()]})</b> の画面です（${past ? "過去の日" : "先の日"}）<button type="button" class="btn btn-ghost btn-sm" onclick="goToday()">今日にもどる</button>`;
  }catch(e){}
}
{ const __ldTint = loadDay; loadDay = async function(){ const r = await __ldTint.apply(this, arguments); kbDayTint(); return r; }; }
document.head.insertAdjacentHTML("beforeend", `<style>
  body.kb-notToday{--bg:#E6EEFF;background:#E6EEFF !important}
  body.kb-notToday .stickybar{background:#E6EEFF}
  .kbdaywarn{background:#2F6FD0;color:#fff;font-weight:900;font-size:14px;border-radius:12px;padding:6px 12px;margin:0 0 6px;display:flex;flex-wrap:wrap;align-items:center;gap:10px}
  .kbdaywarn .btn{background:#fff;color:#2F6FD0;border-color:#fff}
</style>`);
/* 🗺 今どこに誰が：手で動かした札を いちばんに（2026/11/18 店長：予約の終了時刻の前でも、動かした場所のまま）
   前は、予約を「仕事中」にしていると、その予約に備考などを書いただけ（updated_at が新しくなる）で、札が仕事中にもどっていた
   → 「仕事中」にした時刻（備考の「状態 →「仕事中」」の時刻。なければ予約の開始時刻）と、札を動かした時刻をくらべて、新しいほう */
function workSince(r){
  const l = Array.isArray(r && r.memo_log) ? r.memo_log : [];
  let t = 0;
  l.forEach(m => { if(/仕事中/.test(String(m && m.text || "")) && m.at){ const v = Date.parse(m.at) || 0; if(v > t) t = v; } });
  return t || Date.parse(r && r.start_at || 0) || 0;
}
{ const __autoWorkM = autoWork; autoWork = function(x){
  const a = __autoWorkM.apply(this, arguments);
  if(a && a.r && a.r.status === "working") return Object.assign({}, a, { t: workSince(a.r) });
  return a;
}; }
/* 🌸 背景にうすく文字をならべる（2026/11/18 店長：今日か今日以外かが、もっとわかるように。気持ち悪くない程度に）
   今日：「本日のページ」（ピンク）／今日以外：「11/21(土) の画面」（青） */
function kbDayMark(text, color){
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='420' height='220'><text x='30' y='120' transform='rotate(-18 210 110)' font-family='sans-serif' font-size='30' font-weight='900' fill='${color}' fill-opacity='0.17'>${text}</text></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
{ const __tintMark = kbDayTint; kbDayTint = function(){
  __tintMark.apply(this, arguments);
  try{
    const today = KB.bizDateOf(), other = !!day && day !== today, d = new Date((day || today) + "T12:00:00Z");
    const img = other ? kbDayMark(`${d.getUTCMonth() + 1}/${d.getUTCDate()}(${DOW[d.getUTCDay()]}) の画面`, "#2F6FD0") : kbDayMark("本日のページ", "#E5638C");
    document.body.style.backgroundImage = img;
    document.body.style.backgroundAttachment = "fixed";
  }catch(e){}
}; }
