/* 🗂 台帳の見た目の整理（2026/11/19 店長：画像のように）。中身（データ・保存）は前と同じ
   ① 移動・コース・系統・メモ：左に見出し・右に欄（HTML側）。ここは見た目だけ
   ② 🏨 ホテル：左に「設定のまとめ・絞りこみ」、まん中にエリアごとの一覧（◎ △ × ○ を押してえらぶ・メモ）、右に「選んだホテル」「一括設定」
      ◎＝適用（行ける）・△＝注意（条件つき）・×＝除外（行けない）・○＝未設定（お店のルールどおり）
      保存は今までどおり「💾 ホテルを保存」（プロフの保存） */
let HT = { q: "", area: "", show: { ok: true, cond: true, ng: true, "": true }, sel: new Set(), pick: "", open: null };
const HT_ST = { ok: ["◎", "適用", "利用可能"], cond: ["△", "注意", "条件あり"], ng: ["×", "除外", "利用不可"], "": ["○", "未設定", "ルール準拠"] };
function htState(hp, id){ return (hp.ok || []).includes(id) ? "ok" : (hp.conditional || []).includes(id) ? "cond" : (hp.ng || []).includes(id) ? "ng" : ""; }
function htSet(id, s, quiet){
  if(!quiet) pfCollect();
  const hp = pfHotelPrefs();
  hp.ok = hp.ok.filter(x => x !== id); hp.conditional = hp.conditional.filter(x => x !== id); hp.ng = hp.ng.filter(x => x !== id);
  if(s === "ok") hp.ok.push(id); else if(s === "cond") hp.conditional.push(id); else if(s === "ng") hp.ng.push(id);
  pf.hotelDirty = true; HT.pick = id;
  if(!quiet) htRepaint();
}
function htBulk(){
  const v = (document.querySelector('input[name="htBulk"]:checked') || {}).value;
  if(v == null || !HT.sel.size){ toast("先に左のチェックでホテルを選んで、どれにするか選んでください"); return; }
  pfCollect(); [...HT.sel].forEach(id => htSet(id, v, true)); HT.sel.clear(); htRepaint(); toast("選んだホテルを「" + HT_ST[v][1] + "」にしました（「💾 ホテルを保存」で保存）");
}
function htRepaint(){ const el = document.getElementById("htEd"); if(el && pf){ el.outerHTML = pfHotelEditor(pfHotelPrefs()); try{ kbGlowApply(); }catch(e){} } }
pfHotelEditor = function(hp){
  const all = pfHotels || []; if(!all.length) return "";
  const areas = [...new Set(all.map(h => h.area || "その他"))];
  if(!HT.open) HT.open = new Set([areas[0]]);
  const cnt = { ok: 0, cond: 0, ng: 0, "": 0 }; all.forEach(h => cnt[htState(hp, h.hotel_id)]++);
  const q = String(HT.q || "").normalize("NFKC").toLowerCase();
  const shown = all.filter(h => (!HT.area || (h.area || "その他") === HT.area) && HT.show[htState(hp, h.hotel_id)] && (!q || String(h.hotel_name || "").normalize("NFKC").toLowerCase().includes(q)));
  const picked = all.find(h => h.hotel_id === HT.pick);
  const seg = (h, s) => `<span class="htSeg">${["ok", "cond", "ng", ""].map(k => `<button type="button" class="htB ${k || "none"} ${s === k ? "on" : ""}" title="${HT_ST[k][1]}" onclick="htSet('${esc(h.hotel_id)}','${k}')">${HT_ST[k][0]}</button>`).join("")}</span>`;
  const row = h => { const s = htState(hp, h.hotel_id);
    return `<div class="htRow ${HT.pick === h.hotel_id ? "pick" : ""}"><input type="checkbox" ${HT.sel.has(h.hotel_id) ? "checked" : ""} onchange="HT.sel[this.checked?'add':'delete']('${esc(h.hotel_id)}')">
      <a href="javascript:void(0)" class="htN" onclick="HT.pick='${esc(h.hotel_id)}';htRepaint()">🏨 ${esc(h.hotel_name)}</a>${seg(h, s)}
      <input class="htMemo" placeholder="メモ（任意）" value="${esc((hp.memo || {})[h.hotel_id] || "")}" onchange="pfHotelMemo('${esc(h.hotel_id)}',this.value)"></div>`; };
  const groups = areas.map(a => { const L = shown.filter(h => (h.area || "その他") === a); if(!L.length) return "";
    const op = HT.open.has(a) || !!q;
    return `<div class="htArea"><button type="button" class="htAh" onclick="HT.open.has('${esc(a)}')?HT.open.delete('${esc(a)}'):HT.open.add('${esc(a)}');htRepaint()">📍 ${esc(a)}エリア（${L.length}件）<span>${op ? "▲" : "▼"}</span></button>
      ${op ? `<div class="htList">${L.map(row).join("")}</div>` : ""}</div>`; }).join("");
  const ps = picked ? htState(hp, picked.hotel_id) : "";
  return `<div id="htEd" class="htEd">
    <aside class="htSide">
      <div class="htSh">📊 設定のまとめ</div>
      ${["ok", "cond", "ng", ""].map(k => `<div class="htCnt ${k || "none"}"><span>${HT_ST[k][0]} ${HT_ST[k][1]}</span><b>${cnt[k]}件</b></div>`).join("")}
      <div class="htSh" style="margin-top:10px">🔽 表示の絞りこみ</div>
      <small>エリア</small><select onchange="HT.area=this.value;htRepaint()"><option value="">すべてのエリア</option>${areas.map(a => `<option ${HT.area === a ? "selected" : ""}>${esc(a)}</option>`).join("")}</select>
      <small style="margin-top:6px;display:block">状態</small>
      ${["ok", "cond", "ng", ""].map(k => `<label class="htChk"><input type="checkbox" ${HT.show[k] ? "checked" : ""} onchange="HT.show['${k}']=this.checked;htRepaint()"> ${HT_ST[k][0]} ${HT_ST[k][1]}</label>`).join("")}
      <button type="button" class="btn btn-ghost btn-sm" style="width:100%;margin-top:6px" onclick="HT={q:'',area:'',show:{ok:true,cond:true,ng:true,'':true},sel:new Set(),pick:'',open:null};htRepaint()">↺ 絞りこみをクリア</button>
    </aside>
    <section class="htMain">
      <input class="htQ" placeholder="🔍 ホテル名で検索（例：クリスタル）" value="${esc(HT.q)}" oninput="HT.q=this.value;clearTimeout(window.__htT);window.__htT=setTimeout(()=>{htRepaint();const i=document.querySelector('#htEd .htQ');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length);}},250)">
      ${groups || `<div class="hint" style="padding:10px">合うホテルがありません</div>`}
    </section>
    <aside class="htSide right">
      <div class="htSh">💬 選んでいるホテル</div>
      ${picked ? `<div class="htPick">🏨 <b>${esc(picked.hotel_name)}</b></div>
        <div class="htBig">${["ok", "cond", "ng", ""].map(k => `<button type="button" class="htBigB ${k || "none"} ${ps === k ? "on" : ""}" onclick="htSet('${esc(picked.hotel_id)}','${k}')"><b>${HT_ST[k][0]}</b>${HT_ST[k][1]}<small>${HT_ST[k][2]}</small></button>`).join("")}</div>
        <small>メモ（任意）</small><textarea maxlength="200" placeholder="例：フェイスタオル用意／時間制限あり" onchange="pfHotelMemo('${esc(picked.hotel_id)}',this.value)">${esc((hp.memo || {})[picked.hotel_id] || "")}</textarea>`
        : `<div class="hint">一覧のホテル名を押すと、ここでくわしく設定できます</div>`}
      <div class="htSh" style="margin-top:12px">🧷 一括設定 <small>（チェックしたホテル ${HT.sel.size}件）</small></div>
      ${["ok", "cond", "ng", ""].map(k => `<label class="htChk"><input type="radio" name="htBulk" value="${k}"> ${HT_ST[k][0]} ${HT_ST[k][1]}${k ? "にする" : "に戻す"}</label>`).join("")}
      <button type="button" class="btn btn-primary btn-sm" style="width:100%;margin-top:6px" onclick="htBulk()">適用</button>
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
  .htEd{display:grid;grid-template-columns:190px minmax(0,1fr) 230px;gap:12px;align-items:start;margin-top:6px}
  @media (max-width:1000px){ .htEd{grid-template-columns:1fr} }
  .htSide{background:#FBF7F9;border:1.5px solid #F1E3E7;border-radius:14px;padding:10px;font-size:13px} .htSide select,.htSide textarea{width:100%;box-sizing:border-box}
  .htSh{font-weight:900;font-size:13.5px;margin-bottom:6px} .htSh small{font-weight:700;color:#9C8B8F}
  .htCnt{display:flex;justify-content:space-between;padding:4px 8px;border-radius:8px;margin-bottom:3px;font-weight:800}
  .htCnt.ok{background:#E6F6EE;color:#1a6640} .htCnt.cond{background:#FFF8E6;color:#8a6300} .htCnt.ng{background:#FFE8EC;color:#c0304a} .htCnt.none{background:#F3F0F2;color:#7A6070}
  .htChk{display:flex !important;align-items:center;gap:6px;font-weight:700;padding:2px 0} .htChk input{width:auto;margin:0}
  .htMain{min-width:0} .htQ{width:100%;box-sizing:border-box;margin-bottom:8px}
  .htArea{border:1.5px solid #F3D6E0;border-radius:12px;margin-bottom:8px;overflow:hidden}
  .htAh{width:100%;display:flex;justify-content:space-between;font-family:inherit;font-weight:900;font-size:14px;border:none;background:#FFF0F5;padding:8px 12px;cursor:pointer;color:#8A2950}
  .htList{padding:4px 8px}
  .htRow{display:grid;grid-template-columns:auto minmax(110px,1fr) auto minmax(90px,1fr);gap:8px;align-items:center;padding:5px 2px;border-bottom:1px dashed #F1E3E7}
  .htRow:last-child{border-bottom:none} .htRow.pick{background:#FFF7FB} .htRow input[type=checkbox]{width:auto;margin:0}
  .htN{font-weight:800;color:#4A3A40;text-decoration:none} .htMemo{min-width:0;font-size:12.5px}
  .htSeg{display:inline-flex;gap:3px}
  .htB{font-family:inherit;font-weight:900;width:32px;height:28px;border-radius:99px;border:1.5px solid #E5D9DE;background:#fff;color:#9C8B8F;cursor:pointer;padding:0}
  .htB.ok.on{background:#2E9E4A;border-color:#2E9E4A;color:#fff} .htB.cond.on{background:#F2C94C;border-color:#E0B020;color:#3a2a00} .htB.ng.on{background:#FFD5DD;border-color:#c0304a;color:#c0304a} .htB.none.on{background:#EDE8EB;border-color:#B8A9AE;color:#5C4B4F}
  .htPick{font-size:15px;margin:2px 0 8px}
  .htBig{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:8px}
  .htBigB{font-family:inherit;border:1.5px solid #E5D9DE;background:#fff;border-radius:10px;padding:6px 4px;cursor:pointer;display:flex;flex-direction:column;align-items:center;font-weight:800;font-size:12.5px;color:#5C4B4F}
  .htBigB b{font-size:18px} .htBigB small{font-size:10.5px;color:#9C8B8F;font-weight:700}
  .htBigB.ok.on{background:#E6F6EE;border-color:#2E9E4A;color:#1a6640} .htBigB.cond.on{background:#FFF8E6;border-color:#E0B020;color:#8a6300} .htBigB.ng.on{background:#FFE8EC;border-color:#c0304a;color:#c0304a} .htBigB.none.on{background:#F3F0F2;border-color:#B8A9AE}
</style>`);
