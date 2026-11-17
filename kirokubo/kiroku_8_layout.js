/* ============================================================
   🧭 記録簿トップの並び（2026/11/18 店長 OK：見本 https://claude.ai/artifact/HpLvDVBBPJ9G2NQGS1p5r3）
   ・左の縦の列：メニュー・今日の数字・内勤の日払い（社長用の集計も）。たたまずに出す
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
    const box = document.createElement("div"); box.className = "kbside-box kbside-nav";
    box.innerHTML = `<div class="kbside-h">メニュー</div>`;
    nav.classList.remove("navinhead");
    box.appendChild(nav); side.appendChild(box);
  }
  // 左の列：今日の数字・内勤の日払い・社長用（ひらいたまま）
  ["todayBox", "staffPayBox", "ownerBox"].forEach(id => {
    const d = document.getElementById(id); if(!d) return;
    d.open = true; d.classList.add("kbside-box"); side.appendChild(d);
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
  .kbside-h{font-size:12px;font-weight:800;color:var(--sub,#7A6670);padding:2px 4px 6px}
  .kbside-nav .kbnav{display:flex !important;flex-direction:column;align-items:stretch;gap:6px;margin:0 !important}
  .kbside-nav .kbnav > *{width:100%;justify-content:flex-start;text-align:left;box-sizing:border-box}
  .kbside .todaygrid{grid-template-columns:repeat(2,minmax(0,1fr)) !important}
  .kbnews{background:#fff;border:2px solid var(--line,#F3D6E0);border-radius:16px;padding:10px 12px;margin:8px 0}
  .kbnews-h{font-weight:900;font-size:16px;margin-bottom:6px;display:flex;flex-wrap:wrap;align-items:baseline;gap:8px} .kbnews-h small{font-size:11.5px;color:var(--sub,#7A6670);font-weight:700}
  .kbnews-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;align-items:start}
  .kbnews-g .notice{margin:0} .kbnews-g .nevents{margin:0;background:#EEF6FF;border-radius:12px;padding:6px 10px;min-height:40px}
  .kbnews-g .nevents:empty::before{content:"📅 内勤カレンダーの今日の予定はありません";color:var(--sub,#7A6670);font-size:12.5px;font-weight:700}
</style>`);
