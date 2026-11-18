/* 🗂 台帳の見た目の整理（2026/11/19 店長）。中身（データ・保存）は前と同じ
   ① 移動・コース・系統・メモ：左に見出し・右に欄（HTML側）。ここは見た目だけ
   ② 🏨 ホテル（2026/11/19 作りなおし その2）：
      ・◎ 好き／○ 普通／△ 微妙／× NG。ふつうはOKなので、何もしていないホテルは ○ 普通（ヒアリングのときに ◎△× を個別に）
        データは今までと同じ入れ物：◎＝hotelPrefs.ok・△＝conditional・×＝ng・○＝どれにも入れない（受付の「◎ △ ×」の表示もそのまま）
      ・上に検索（ホテル名・エリア）と ◎○△× の絞りこみ。待機場のエリアはそれぞれ、ほかは「🚕 出張」にまとめて中でエリアごと
      ・右に選んでいるホテル（大きいボタン・メモ）
      保存は今までどおり「💾 ホテルを保存」（プロフの保存） */
let HT = { q: "", show: { ok: true, "": true, cond: true, ng: true }, pick: "", open: null };
const HT_ST = { ok: ["◎", "好き"], "": ["○", "普通"], cond: ["△", "微妙"], ng: ["×", "NG"] };
const HT_ORDER = ["ok", "", "cond", "ng"];
const HT_MAIN = ["池袋", "鶯谷", "五反田", "錦糸町", "渋谷"];   // 待機場・お店のエリア。ほかは「🚕 出張」
const HT_STORE = { ok: ["🏪◎ 店おすすめ", "sok"], far: ["🏪△ 遠い", "sfar"], ng: ["🚫 店NG", "sng"] };
function htState(hp, id){ return (hp.ok || []).includes(id) ? "ok" : (hp.conditional || []).includes(id) ? "cond" : (hp.ng || []).includes(id) ? "ng" : ""; }
function htSet(id, s){
  pfCollect();
  const hp = pfHotelPrefs();
  hp.ok = hp.ok.filter(x => x !== id); hp.conditional = hp.conditional.filter(x => x !== id); hp.ng = hp.ng.filter(x => x !== id);
  if(s === "ok") hp.ok.push(id); else if(s === "cond") hp.conditional.push(id); else if(s === "ng") hp.ng.push(id);
  pf.hotelDirty = true; HT.pick = id;
  htRepaint();
}
function htRepaint(){ const el = document.getElementById("htEd"); if(el && pf){ el.outerHTML = pfHotelEditor(pfHotelPrefs()); try{ kbGlowApply(); }catch(e){} } }
function htToggle(k){ HT.open.has(k) ? HT.open.delete(k) : HT.open.add(k); htRepaint(); }
function htSearch(v){
  HT.q = v; clearTimeout(window.__htT);
  window.__htT = setTimeout(() => { htRepaint(); const i = document.querySelector("#htEd .htQ"); if(i){ i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250);
}
const htMainOf = a => HT_MAIN.find(m => String(a || "").includes(m)) || "";
pfHotelEditor = function(hp){
  const all = pfHotels || []; if(!all.length) return "";
  if(!HT.open) HT.open = new Set();
  const q = String(HT.q || "").normalize("NFKC").toLowerCase().trim();
  const shown = all.filter(h => HT.show[htState(hp, h.hotel_id)] && (!q || [h.hotel_name, h.area].some(x => String(x || "").normalize("NFKC").toLowerCase().includes(q))));
  const picked = all.find(h => h.hotel_id === HT.pick);
  const seg = (h, s) => `<span class="htSeg">${HT_ORDER.map(k => `<button type="button" class="htB ${k || "none"} ${s === k ? "on" : ""}" title="${HT_ST[k][1]}" onclick="htSet('${esc(h.hotel_id)}','${k}')">${HT_ST[k][0]}<small>${HT_ST[k][1]}</small></button>`).join("")}</span>`;
  const row = h => { const s = htState(hp, h.hotel_id), sb = HT_STORE[h.store_status];
    return `<div class="htRow ${HT.pick === h.hotel_id ? "pick" : ""}">
      <a href="javascript:void(0)" class="htN" onclick="HT.pick='${esc(h.hotel_id)}';htRepaint()">🏨 ${esc(h.hotel_name)}${sb ? ` <i class="htSt ${sb[1]}">${sb[0]}</i>` : ""}</a>${seg(h, s)}
      <input class="htMemo" placeholder="メモ（任意）" value="${esc((hp.memo || {})[h.hotel_id] || "")}" onchange="pfHotelMemo('${esc(h.hotel_id)}',this.value)"></div>`; };
  const cntOf = L => { const c = { ok: 0, "": 0, cond: 0, ng: 0 }; L.forEach(h => c[htState(hp, h.hotel_id)]++); return HT_ORDER.filter(k => k !== "" && c[k]).map(k => `${HT_ST[k][0]}${c[k]}`).join(" "); };
  const acc = (key, title, L, inner) => { const op = HT.open.has(key) || !!q;
    return `<div class="htArea"><button type="button" class="htAh" onclick="htToggle('${esc(key)}')">${title}（${L.length}件）<small>${cntOf(L)}</small><span>${op ? "▲" : "▼"}</span></button>${op ? `<div class="htList">${inner}</div>` : ""}</div>`; };
  const mains = HT_MAIN.map(m => { const L = shown.filter(h => htMainOf(h.area) === m); return L.length ? acc(m, `📍 ${esc(m)}エリア`, L, L.map(row).join("")) : ""; }).join("");
  const trips = shown.filter(h => !htMainOf(h.area));
  const tripAreas = [...new Set(trips.map(h => h.area || "そのほか"))];
  const tripHtml = trips.length ? acc("__trip", "🚕 出張", trips, tripAreas.map(a => `<div class="htSub">📍 ${esc(a)}</div>` + trips.filter(h => (h.area || "そのほか") === a).map(row).join("")).join("")) : "";
  const ps = picked ? htState(hp, picked.hotel_id) : "";
  return `<div id="htEd" class="htEd">
    <section class="htMain">
      <div class="htTop"><input class="htQ" placeholder="🔍 ホテル名・エリアで検索（例：クリスタル・新宿）" value="${esc(HT.q)}" oninput="htSearch(this.value)">
        <span class="htF">${HT_ORDER.map(k => `<button type="button" class="htFb ${k || "none"} ${HT.show[k] ? "on" : ""}" onclick="HT.show['${k}']=!HT.show['${k}'];htRepaint()">${HT_ST[k][0]} ${HT_ST[k][1]}</button>`).join("")}</span></div>
      <div class="hint" style="margin:0 0 8px">ふつうは ○ 普通のまま。ヒアリングで聞いたときに ◎ 好き・△ 微妙・× NG をえらびます。</div>
      ${mains + tripHtml || `<div class="hint" style="padding:10px">合うホテルがありません</div>`}
    </section>
    <aside class="htSide right">
      <div class="htSh">💬 選んでいるホテル</div>
      ${picked ? `<div class="htPick">🏨 <b>${esc(picked.hotel_name)}</b><small>${esc(picked.area || "")}${HT_STORE[picked.store_status] ? "・" + HT_STORE[picked.store_status][0] : ""}</small></div>
        <div class="htBig">${HT_ORDER.map(k => `<button type="button" class="htBigB ${k || "none"} ${ps === k ? "on" : ""}" onclick="htSet('${esc(picked.hotel_id)}','${k}')"><b>${HT_ST[k][0]}</b>${HT_ST[k][1]}</button>`).join("")}</div>
        <small>メモ（任意）</small><textarea maxlength="200" placeholder="例：フェイスタオル用意／時間制限あり" onchange="pfHotelMemo('${esc(picked.hotel_id)}',this.value)">${esc((hp.memo || {})[picked.hotel_id] || "")}</textarea>`
        : `<div class="hint">一覧のホテル名を押すと、ここでくわしく設定できます</div>`}
    </aside>
  </div>`;
};
document.head.insertAdjacentHTML("beforeend", `<style>
  /* 欄の見た目（.f の中と同じ） */
  .etPanel input:not([type=checkbox]):not([type=radio]),.etPanel select,.etPanel textarea,.htEd input:not([type=checkbox]):not([type=radio]),.htEd select,.htEd textarea{width:100%;box-sizing:border-box;font-family:inherit;font-size:14px;color:var(--ink);padding:8px 11px;border:1.5px solid var(--line,#F3D6E0);border-radius:11px;background:#FFF5F8}
  .etPanel textarea{min-height:64px;resize:vertical} .htEd textarea{min-height:56px;resize:vertical} .htEd .htMemo{padding:5px 9px;font-size:12.5px}
  .etPanel input:focus,.etPanel select:focus,.etPanel textarea:focus,.htEd input:focus,.htEd select:focus,.htEd textarea:focus{outline:none;border-color:var(--pink,#E5638C);background:#fff}
  /* ① 移動・コース・系統・メモ */
  .etPanel .etRow{display:grid;grid-template-columns:200px minmax(0,1fr);gap:14px;align-items:start;padding:12px 0;border-bottom:1px solid #F3E4EA}
  .etPanel .etRow:last-child{border-bottom:none}
  .etPanel .etLab{background:#FFF0F5;border-radius:14px;padding:10px 12px;display:flex;flex-direction:column;gap:2px;box-shadow:0 2px 6px rgba(194,24,91,.06)}
  .etPanel .etLab b{font-size:15px;color:#8A2950} .etPanel .etLab small{color:#9C8B8F;font-size:12px;line-height:1.5} .etPanel .etIc{font-size:20px}
  .etPanel .etGrid4{grid-template-columns:2fr 1fr 1fr 1fr}
  .etPanel .etMin{display:flex;align-items:center;gap:4px} .etPanel .etMin input{flex:1;min-width:0} .etPanel .etMin span{font-weight:800;color:#7A6670}
  .etPanel .etNote{display:flex;align-items:flex-end} .etPanel .etNote small{color:#9C8B8F}
  .etPanel .etWarn{background:#FFF6D6;border-radius:10px;padding:6px 10px;font-size:12.5px;margin-bottom:6px}
  @media (max-width:760px){ .etPanel .etRow{grid-template-columns:1fr} .etPanel .etGrid4{grid-template-columns:1fr 1fr} }
  /* ② ホテル */
  #e_hotel:has(.htEd) > .pfChips{display:none}
  .htEd{display:grid;grid-template-columns:minmax(0,1fr) 230px;gap:12px;align-items:start;margin-top:6px}
  @media (max-width:900px){ .htEd{grid-template-columns:1fr} }
  .htSide{background:#FBF7F9;border:1.5px solid #F1E3E7;border-radius:14px;padding:10px;font-size:13px}
  .htSh{font-weight:900;font-size:13.5px;margin-bottom:6px}
  .htMain{min-width:0}
  .htTop{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px} .htTop .htQ{flex:1;min-width:220px;width:auto}
  .htF{display:flex;gap:4px;flex-wrap:wrap}
  .htFb{font-family:inherit;font-weight:900;font-size:12.5px;border:1.5px solid #E5D9DE;background:#fff;color:#B8A9AE;border-radius:99px;padding:5px 10px;cursor:pointer}
  .htFb.on.ok{background:#FFE3EE;border-color:#E5638C;color:#C2185B} .htFb.on.none{background:#E6F6EE;border-color:#2E9E4A;color:#1a6640} .htFb.on.cond{background:#FFF8E6;border-color:#E0B020;color:#8a6300} .htFb.on.ng{background:#FFE8EC;border-color:#c0304a;color:#c0304a}
  .htArea{border:1.5px solid #F3D6E0;border-radius:12px;margin-bottom:8px;overflow:hidden}
  .htAh{width:100%;display:flex;align-items:center;gap:8px;font-family:inherit;font-weight:900;font-size:14px;border:none;background:#FFF0F5;padding:8px 12px;cursor:pointer;color:#8A2950;text-align:left}
  .htAh small{font-weight:800;color:#9C8B8F;font-size:12px} .htAh span{margin-left:auto}
  .htSub{font-weight:900;font-size:13px;color:#8A2950;border-bottom:2px solid #F3D6E0;padding:8px 2px 3px;margin-top:4px}
  .htList{padding:4px 8px}
  .htRow{display:grid;grid-template-columns:minmax(150px,1.2fr) auto minmax(120px,1fr);gap:10px;align-items:center;padding:5px 2px;border-bottom:1px dashed #F1E3E7}
  .htRow:last-child{border-bottom:none} .htRow.pick{background:#FFF7FB}
  .htN{font-weight:800;color:#4A3A40;text-decoration:none} .htMemo{min-width:0}
  .htSt{font-style:normal;font-size:10.5px;font-weight:900;border-radius:99px;padding:0 6px;margin-left:4px;white-space:nowrap} .htSt.sng{background:#FFE8EC;color:#c0304a} .htSt.sfar{background:#FFF8E6;color:#8a6300} .htSt.sok{background:#E6F6EE;color:#1a6640}
  .htSeg{display:inline-flex;gap:3px}
  .htB{font-family:inherit;font-weight:900;font-size:14px;min-width:40px;height:36px;border-radius:10px;border:1.5px solid #E5D9DE;background:#fff;color:#B8A9AE;cursor:pointer;padding:0 6px;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.1}
  .htB small{font-size:9.5px;font-weight:800}
  .htB.ok.on{background:#E5638C;border-color:#E5638C;color:#fff} .htB.none.on{background:#E6F6EE;border-color:#2E9E4A;color:#1a6640} .htB.cond.on{background:#F2C94C;border-color:#E0B020;color:#3a2a00} .htB.ng.on{background:#FFD5DD;border-color:#c0304a;color:#c0304a}
  .htPick{font-size:15px;margin:2px 0 8px;display:flex;flex-direction:column} .htPick small{font-size:12px;color:#9C8B8F}
  .htBig{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:8px}
  .htBigB{font-family:inherit;border:1.5px solid #E5D9DE;background:#fff;border-radius:10px;padding:6px 4px;cursor:pointer;display:flex;flex-direction:column;align-items:center;font-weight:800;font-size:12.5px;color:#5C4B4F}
  .htBigB b{font-size:18px}
  .htBigB.ok.on{background:#FFE3EE;border-color:#E5638C;color:#C2185B} .htBigB.none.on{background:#E6F6EE;border-color:#2E9E4A;color:#1a6640} .htBigB.cond.on{background:#FFF8E6;border-color:#E0B020;color:#8a6300} .htBigB.ng.on{background:#FFE8EC;border-color:#c0304a;color:#c0304a}
  @media (max-width:640px){ .htRow{grid-template-columns:1fr} }
</style>`);
