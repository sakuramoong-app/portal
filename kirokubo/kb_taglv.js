/* 🏷 タグの大事さ（2026/11/26 店長）：顧客台帳・受付で同じ
   ・kb_settings 'cust_tag_levels' = { タグ: "red" | "orange" | "yellow" | "none" }
   ・大事な順（🔴 → 🟠 → 🟡 → そのほか）に左上から並べる。色もその順
   ・まだ決めていないタグは、名前で決める（要注意・トビ・出禁・危険 → 🔴、要確認 → 🟠）＝前と同じ色 */
const TAG_LV_RANK = { red: 0, orange: 1, yellow: 2 };
const TAG_LV_MARK = { red: "🔴", orange: "🟠", yellow: "🟡" };
const TAG_LV_NAME = { red: "🔴 いちばん大事", orange: "🟠 大事", yellow: "🟡 気をつける", none: "なし" };
function tagLevels(){ return window.TAG_LEVELS || (typeof M !== "undefined" && M && M.set && M.set.cust_tag_levels) || {}; }   // M は let（window.M ではない）
function tagLvOf(t){
  const lv = tagLevels();
  if(lv && Object.prototype.hasOwnProperty.call(lv, t)) return lv[t] === "none" ? "" : lv[t];
  return /要注意|トビ|出禁|危険/.test(t) ? "red" : /要確認/.test(t) ? "orange" : "";
}
// 大事な順（同じ大事さの中は、もとの並び）
function tagSort(list){
  const r = t => { const l = tagLvOf(t); return l in TAG_LV_RANK ? TAG_LV_RANK[l] : 9; };
  return list.map((t, i) => [t, i]).sort((a, b) => (r(a[0]) - r(b[0])) || (a[1] - b[1])).map(x => x[0]);
}
function tagCls(t){ const l = tagLvOf(t); return l ? "lv-" + l : ""; }
(function(){ const s = document.createElement("style"); s.textContent = `
  .ctag.lv-red{border-color:#E0001B;color:#C0001B}.ctag.on.lv-red{background:#E0001B;border-color:#B0001B;color:#fff}
  .ctag.lv-orange{border-color:#FF8A1F;color:#C25E00}.ctag.on.lv-orange{background:#FF8A1F;border-color:#E06E00;color:#fff}
  .ctag.lv-yellow{border-color:#E8B800;color:#8A6A00}.ctag.on.lv-yellow{background:#FFD43B;border-color:#E8B800;color:#4A3800}
  .ctag-b.lv-red{background:#E0001B;border-color:#B0001B;color:#fff}.ctag-b.lv-orange{background:#FF8A1F;border-color:#E06E00;color:#fff}.ctag-b.lv-yellow{background:#FFD43B;border-color:#E8B800;color:#4A3800}
  .ctag-b.off.lv-red{background:#fff;color:#C0001B;border-color:#E0001B}.ctag-b.off.lv-orange{background:#fff;color:#C25E00;border-color:#FF8A1F}.ctag-b.off.lv-yellow{background:#fff;color:#8A6A00;border-color:#E8B800}`;
  document.head.appendChild(s); })();
