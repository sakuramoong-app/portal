/* 📌 お客さんの「次回案内・確認してほしいこと」（2026/11/26 店長・SQL 971 kb_cust_rules）：受付・顧客台帳で同じ
   ・お客さんごとに何件でも。キャストを選ぶ＝そのキャストのときだけ／選ばない＝店全体
   ・受付の「重要」：電話番号で探したら全部、キャストを選んだら 店全体＋そのキャストのぶん
   ・もういらないものは「✅ 済み」（消さずに残す。だれが・いつ） */
const CR = { cust: null, rows: [], ok: true };
const crEsc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const crCasts = () => (typeof M !== "undefined" && M && M.casts) ? M.casts : [];
const crCastName = id => { const c = crCasts().find(x => x.id === id); return c ? (c.official_name || c.temp_name || id) : id; };
const crBy = () => (typeof KB !== "undefined" && KB.operatorName) ? KB.operatorName() : "";
async function crLoad(custId){
  CR.cust = custId; CR.rows = [];
  if(!custId) return CR.rows;
  const r = await sb.from("kb_cust_rules").select("*").eq("customer_id", custId).order("at", { ascending: true }).limit(200);
  CR.ok = !r.error;   // SQL 971 がまだ → 出さない
  if(CR.cust === custId) CR.rows = r.data || [];
  return CR.rows;
}
// castId：受付で選んでいるキャスト（空なら全部）。all：済みも出す（顧客台帳）
function crListHtml(castId, all){
  const rows = CR.rows.filter(x => (all || !x.done) && (!castId || !x.cast_id || x.cast_id === castId));
  const d = s => s ? String(s).slice(0, 10).replace(/-/g, "/") : "";
  return rows.map(x => `<div class="cr-i ${x.done ? "done" : ""}"><span class="cr-who ${x.cast_id ? "cast" : "all"}">${x.cast_id ? "💃 " + crEsc(crCastName(x.cast_id)) : "🏠 店全体"}</span>
    <span class="cr-t">${crEsc(x.text)}</span><small class="cr-by">${crEsc(x.by_name || "")} ${d(x.at)}${x.done ? `・✅ 済み（${crEsc(x.done_by || "")} ${d(x.done_at)}）` : ""}</small>
    ${!x.done && (typeof KB === "undefined" || KB.CAN_EDIT) ? `<button type="button" class="cr-done" onclick="crDone(${x.id})" title="もういらない（済みにする）">✅ 済み</button>` : ""}</div>`).join("");
}
function crFormHtml(){
  if(typeof KB !== "undefined" && !KB.CAN_EDIT) return "";
  const cs = crCasts().filter(c => c.status !== "left").slice().sort((a, b) => String(a.kana || a.official_name || "").localeCompare(String(b.kana || b.official_name || ""), "ja"));
  const cur = (typeof $ === "function" && $("f_cast")) ? $("f_cast").value : "";
  return `<div class="cr-f"><select id="cr_cast"><option value="">🏠 店全体</option>${cs.map(c => `<option value="${crEsc(c.id)}" ${c.id === cur ? "selected" : ""}>💃 ${crEsc(c.official_name || c.temp_name)}</option>`).join("")}</select>
    <input id="cr_text" maxlength="500" placeholder="例：このキャストは120分まで／前払いをお願いする"><button type="button" class="cr-add" onclick="crAdd()">＋ 足す</button></div>`;
}
async function crAdd(){
  const t = ($("cr_text") && $("cr_text").value || "").trim(); if(!t){ toast("案内・確認してほしいことを入れてください"); return; }
  if(!CR.cust){ toast("先にお客さんを決めてください（電話番号で探す・保存する）"); return; }
  const cast = $("cr_cast") ? $("cr_cast").value : "";
  const r = await sb.from("kb_cust_rules").insert({ customer_id: CR.cust, cast_id: cast || null, text: t.slice(0, 500), by_name: crBy() }).select("*").single();
  if(r.error){ toast("入れられませんでした（SQL 971 は実行ずみ？）：" + r.error.message); return; }
  CR.rows.push(r.data); toast("📌 次回案内を入れました"); crRepaint();
}
async function crDone(id){
  const x = CR.rows.find(y => y.id === id); if(!x) return;
  if(!confirm(`「${x.text}」を済みにしますか？（受付に出なくなります。記録は残ります）`)) return;
  const u = { done: true, done_by: crBy(), done_at: new Date().toISOString() };
  const r = await sb.from("kb_cust_rules").update(u).eq("id", id);
  if(r.error){ toast("できませんでした：" + r.error.message); return; }
  Object.assign(x, u); crRepaint();
}
// 描きなおし：受付（#crBoxRes）・顧客台帳（#crBoxCust）のあるほう
function crRepaint(){
  if(typeof crPaintRes === "function") crPaintRes();
  if(typeof crPaintCust === "function") crPaintCust();
}
(function(){ const s = document.createElement("style"); s.textContent = `
  .crbox{background:#EEF6FF;border:2px solid #5B9BE0;border-radius:12px;padding:8px 10px;margin:6px 0}
  .crbox > b{color:#1f5d99} .crbox > small{color:#5c7a99;font-weight:700}
  .cr-i{display:flex;gap:6px;align-items:center;flex-wrap:wrap;border-top:1px dashed #BFD7F2;padding:4px 0;font-size:14px} .cr-i.done{opacity:.5}
  .cr-who{font-size:11.5px;font-weight:900;border-radius:99px;padding:0 8px;white-space:nowrap} .cr-who.all{background:#1f5d99;color:#fff} .cr-who.cast{background:#E5638C;color:#fff}
  .cr-t{font-weight:900;color:#123;flex:1;min-width:10em;white-space:pre-wrap} .cr-by{color:#7a8aa0;font-weight:700;font-size:11px}
  .cr-done,.cr-add{font-family:inherit;font-weight:900;border:1.5px solid #BFD7F2;background:#fff;border-radius:9px;padding:2px 8px;cursor:pointer;font-size:12px}
  .cr-add{background:#1f5d99;color:#fff;border-color:#1f5d99}
  .cr-f{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px} .cr-f select,.cr-f input{font-family:inherit;font-weight:700;border:1.5px solid #BFD7F2;border-radius:9px;padding:4px 8px;background:#fff} .cr-f input{flex:1;min-width:12em}`;
  document.head.appendChild(s); })();
/* 🧹 取りこんだときの印を、画面の文から外す（2026/11/26 店長：文字が多くて見づらい。データはそのまま）
   ・「📥 エクセルの記録簿からうつしました（…）」・「【台帳 2020-08-29・キャスト欄にNG】」・「[台帳 2025-01-16・キャスト欄にNG]」 */
function kbClean(s){
  return String(s == null ? "" : s)
    .replace(/📥\s*エクセルの記録簿からうつしました(?:[（(][^）)]*[）)])?/g, "")
    .replace(/【台帳[^】]*】/g, "")
    .replace(/[（(]\s*\[台帳[^\]]*\]\s*[）)]/g, "").replace(/\[台帳[^\]]*\]/g, "")
    .replace(/[ \t　]*\n[ \t　]*\n+/g, "\n").replace(/^[\s、,・／]+|[\s、,・／]+$/g, "");
}
