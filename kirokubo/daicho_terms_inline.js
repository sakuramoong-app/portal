/* ⭐ バック（ランク）・条件：小窓ではなく、アコーディオンを開いたらそのまま「変える画面」（2026/11/19 店長）
   ・前の小窓（#termsBg）の中身を、アコーディオンの中に引っ越す。写真・名前の見出しと ✕ は出さない（①②③ の進みぐあいだけ）
   ・左＝今の設定（変える前）、右＝変える内容。ランクか条件を変えたら、ヒアリングの欄が出る
   ・「キャンセル」＝ 変えたところを元にもどす。「確認して保存」のあとも、新しい今の設定で出しなおす
   ・直せない人（見るだけ）は、今までどおり今の設定だけ */
let TM_INLINE = false, TM_SAVING = false;
function tmInlineMount(){
  const panel = document.querySelector('details[data-p="terms"] .pfBody'), modal = document.querySelector("#termsBg .tmodal");
  if(!panel || !modal || !CAN_EDIT) return false;
  if(!document.getElementById("t_inline")){
    panel.insertAdjacentHTML("beforeend", `<div id="t_inline"></div>`);
    document.getElementById("t_inline").appendChild(modal);
    modal.classList.add("tminline");
    // 台帳の下の「キャンセル・保存する」とまちがえないように、名前を変える
    const acts = modal.querySelectorAll(".actions .btn"); if(acts[0]) acts[0].textContent = "↩ 変えたところを元にもどす"; if(acts[1]) acts[1].textContent = "💾 バック・条件を保存（ヒアリングとセット）";
  }
  TM_INLINE = true;
  return true;
}
function tmInlineShow(){
  if(!tmInlineMount()) return;
  const panel = document.querySelector('details[data-p="terms"] .pfBody');
  [panel.querySelector(".hint"), document.getElementById("e_terms"), document.getElementById("termsBtn")].forEach(el => { if(el) el.style.display = "none"; });
  openTerms();
}
// 小窓は出さない（暗い幕も出さない）
{ const __ot = openTerms; openTerms = async function(){ const r = await __ot.apply(this, arguments); if(TM_INLINE){ const bg = document.getElementById("termsBg"); if(bg) bg.classList.remove("show"); } return r; }; }
// キャンセル ＝ 元にもどす（保存のとちゅうで呼ばれたときは、保存が終わってから）
{ const __ct = closeTerms; closeTerms = function(){ const r = __ct.apply(this, arguments); if(TM_INLINE && !TM_SAVING && termsCast) setTimeout(() => openTerms(), 0); return r; }; }
{ const __st = saveTerms; saveTerms = async function(){ TM_SAVING = true; let r; try{ r = await __st.apply(this, arguments); } finally { TM_SAVING = false; } if(TM_INLINE && termsCast) await openTerms(); return r; }; }
// アコーディオンを開いたとき・キャストを開いたとき（もう開いていたら）
document.addEventListener("toggle", e => { const d = e.target; if(d && d.matches && d.matches('details[data-p="terms"]') && d.open) tmInlineShow(); }, true);
{ const __oe = openEdit; openEdit = function(){ const r = __oe.apply(this, arguments); setTimeout(() => { const d = document.querySelector('details[data-p="terms"]'); if(d && d.open && editingId) tmInlineShow(); }, 300); return r; }; }
document.head.insertAdjacentHTML("beforeend", `<style>
  #t_inline .tmodal.tminline{max-width:none;width:auto;box-shadow:none;padding:0;margin:0;background:transparent;border:none;max-height:none;overflow:visible}
  #t_inline .tminline .tmwho,#t_inline .tminline .tmx,#t_inline .tminline .tmtitle{display:none}
  #t_inline .tminline .tmhead{justify-content:flex-end;padding-right:0;margin-bottom:8px}
  #t_inline .tminline .actions{position:static}
</style>`);
