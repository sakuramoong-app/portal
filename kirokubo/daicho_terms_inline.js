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
/* 🧮 条件が消えないように（2026/11/20 店長：りぃの条件を入れて「保存する」を押したのに消えていた）
   ① 「＋ この条件を足す」を押さずに 💾 を押しても、書いた条件を足してから保存する
   ② バック・条件を変えたまま、下の「保存する」を押したら止める（バック・条件は 💾 バック・条件を保存 でしか保存されない） */
{ const __st2 = saveTerms; saveTerms = async function(){
    const n = $("t_note"), box = $("t_addBox");
    if(n && n.value.trim() && box && box.style.display !== "none"){ termsAddRule(); if(n.value.trim()) return; toast("書いた条件を足しました。ヒアリング（または 📒 既存ルール）を選んで、もう一度 💾 を押してください"); const hb = $("t_hearBox"); if(hb) hb.scrollIntoView({ block: "center", behavior: "smooth" }); return; }
    return __st2.apply(this, arguments);
  }; }
function tmPending(){ try{ return !!termsCast && (termsDirty() || !!(($("t_note") || {}).value || "").trim()); }catch(e){ return false; } }
{ const __sc = saveCast; saveCast = async function(){
    if(TM_INLINE && tmPending()){
      alert("⭐ バック・条件の変更が、まだ保存されていません。\n\n「バック（ランク）・条件」の中の\n① 「＋ この条件を足す」\n② ヒアリング（または 📒 既存ルール）を選ぶ\n③ 「💾 バック・条件を保存（ヒアリングとセット）」\nの順に押してください。");
      const s = $("t_save") || document.getElementById("t_inline"); if(s) s.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    return __sc.apply(this, arguments);
  }; }
/* 📅 適用開始日は「営業日」（朝6時まで前の日）。夜中に入れると次の日からになって、今夜の予約に効かなかった（2026/11/20 りぃの指名料） */
const tmBizYmd = () => new Date(Date.now() + 9 * 3600 * 1000 - 6 * 3600 * 1000).toISOString().slice(0, 10);
{ const __ot3 = openTerms; openTerms = async function(){ const r = await __ot3.apply(this, arguments); try{ const e = $("t_eff"); if(e && e.value === todayYmd()) e.value = tmBizYmd(); }catch(x){} return r; }; }
/* ✨ バック・条件をさわったら、下の「保存する」ではなく「💾 バック・条件を保存」を光らせる */
{ const __ka = kbAreaOf; kbAreaOf = function(el){ if(el && el.closest && el.closest("#t_inline")) return ""; return __ka.apply(this, arguments); }; }
function tmGlow(){ const b = $("t_save"); if(b) b.classList.toggle("kbGlow", TM_INLINE && tmPending()); }
{ const __ts = termsSync; termsSync = function(){ const r = __ts.apply(this, arguments); try{ tmGlow(); }catch(e){} return r; }; }
["input", "change"].forEach(ev => document.addEventListener(ev, e => { if(e.target && e.target.closest && e.target.closest("#t_inline")) setTimeout(tmGlow, 0); }, true));
