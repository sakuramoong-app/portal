/* ---------- 🗂 キャストごとの予約カード（2026/11/27 店長 修正2）
   ・キャンセル・トビ・流れた は、そのキャストの枠のいちばん下にまとめて、たたんでおく（押すと開く）
   ・終わった予約（終了）のカードはグレーに
   ・予約カードの並び順を選べる（開始が早い順／遅い順。この端末に覚える） ---------- */
function cardSortGet(){ try{ return localStorage.getItem("kbCardSort") || "early"; }catch(e){ return "early"; } }
function cardSortSet(v){ try{ localStorage.setItem("kbCardSort", v); }catch(e){} renderListTable(); }
function cardsTidy(){
  const sel = $("s_cardsort"); if(sel && sel.value !== cardSortGet()) sel.value = cardSortGet();
  const late = cardSortGet() === "late", rowOf = id => rows.find(r => String(r.id) === String(id));
  document.querySelectorAll("#list > .cblock:not(.cxbox)").forEach(b => {
    const cards = [...b.querySelectorAll(":scope > .rescard")];
    if(!cards.length) return;
    const live = cards.filter(c => !c.classList.contains("cx")), cx = cards.filter(c => c.classList.contains("cx"));
    // 並び順：開始の時刻で
    const at = c => { const r = rowOf(String(c.id).replace(/^rc-/, "")); return String((r && r.start_at) || ""); };
    if(live.length > 1){ const mk = document.createComment("cards"); live[0].before(mk); live.slice().sort((a, z) => late ? at(z).localeCompare(at(a)) : at(a).localeCompare(at(z))).forEach(c => mk.before(c)); mk.remove(); }
    // 終わった予約はグレー
    live.forEach(c => { const r = rowOf(String(c.id).replace(/^rc-/, "")); c.classList.toggle("rcdone", !!(r && r.status === "done")); });
    // キャンセル・トビ・流れた → いちばん下にたたんで
    if(cx.length){
      const n = s => cx.filter(c => { const r = rowOf(String(c.id).replace(/^rc-/, "")); return r && r.status === s; }).length;
      const d = document.createElement("details"); d.className = "cxfold";
      d.innerHTML = `<summary>🚫 キャンセル・トビ・流れた（${[n("cancel") ? "キャンセル " + n("cancel") : "", n("tobi") ? "トビ " + n("tobi") : "", n("flowed") ? "流れた " + n("flowed") : ""].filter(Boolean).join("・")}）</summary>`;
      cx.forEach(c => d.appendChild(c));
      b.appendChild(d);
    }
  });
}
{ const __rlCards = renderListTable; renderListTable = function(){ const r = __rlCards.apply(this, arguments); try{ cardsTidy(); }catch(e){ console.warn("cardsTidy", e); } return r; }; }
document.head.insertAdjacentHTML("beforeend", `<style>
  .rescard.rcdone{opacity:.55;filter:grayscale(.85)} .rescard.rcdone:hover{opacity:.85}
  details.cxfold{margin:6px 0 2px;border:1.5px dashed #E5A0B0;border-radius:10px;background:#FFF8FA}
  details.cxfold > summary{cursor:pointer;font-size:12.5px;font-weight:800;color:#B0506A;padding:4px 10px}
  details.cxfold > .rescard{margin:4px 6px}
</style>`);
/* ---------- 📝 備考を書く：文字数の制限なし・何行でも（前は1行の小窓）2026/11/27 店長 修正2 ---------- */
addLogPrompt = function(id){
  if(!KB.CAN_EDIT) return;
  const old = $("logBg"); if(old) old.remove();
  const bg = document.createElement("div"); bg.id = "logBg";
  bg.style.cssText = "position:fixed;inset:0;z-index:400;background:rgba(0,0,0,.4);display:flex;align-items:flex-start;justify-content:center;padding:40px 14px;overflow:auto";
  bg.innerHTML = `<div style="background:#fff;border-radius:16px;padding:14px 16px;max-width:560px;width:100%">
    <h3 style="margin:0 0 6px">📝 備考を書く</h3>
    <textarea id="logText" rows="6" style="width:100%;font-size:15px;line-height:1.55;border:1.5px solid #E5D9F2;border-radius:10px;padding:8px;box-sizing:border-box" placeholder="例：お客様に折り返し済み／キャストに場所変更を連絡（長くても大丈夫です）"></textarea>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
      <button type="button" class="btn btn-ghost" onclick="$('logBg').remove()">やめる</button>
      <button type="button" class="btn btn-primary" id="logSave">💾 書く</button></div></div>`;
  document.body.appendChild(bg);
  bg.addEventListener("click", e => { if(e.target === bg) bg.remove(); });
  const ta = $("logText"); ta.focus();
  $("logSave").onclick = async () => {
    const t = ta.value.trim(); if(!t) return;
    $("logSave").disabled = true;
    if(await pushLog(id, t)){ bg.remove(); toast("📝 備考に書きました"); renderList(); if(typeof editing !== "undefined" && editing && editing.id === id && typeof renderFormLog === "function") renderFormLog(); }
    else $("logSave").disabled = false;
  };
};
