/* 💴 バック表（ランク × コース → キャストのバック。kb_back）を直す。キャスト台帳（index.html）と記録簿の受付（kiroku.html）の両方で使う（2026/11/20 店長：受付からも直したい）
   このファイルの外にあるもの：$ esc q sb toast（どちらのページにもある）。CAN_EDIT はページにあればそれ、なければ KB.CAN_EDIT */
const BT_EDIT = () => typeof CAN_EDIT !== "undefined" ? CAN_EDIT : KB.CAN_EDIT;
/* ---------- 💴 バック表（ランク × コース → キャストのバック。kb_back）を直す（2026/11/10 店長：まちがいを現場ですぐ直せるように）----------
   ・ランクを選ぶと、コースごとに「ふつう・本指・フリー・特別フリー・イベフリー」のバックが出る。直して「💾 保存」
   ・保存の前に「何円 → 何円」を確かめる。変えた記録（いつ・だれが・何円から何円に）は kb_settings の back_edit_log に残す
   ・入っている予約の報酬は変わらない（記録簿は開きなおすと新しいバック。まだ精算していない予約は、開いて保存しなおすと新しいバックになる） */
const BT_SUF = [["", "ふつう"], ["本指", "本指名"], ["フリー", "フリー"], ["特別フリー", "特別フリー"], ["イベフリー", "イベフリー"]];
let btRows = [], btRank = "", btEdit = {}, btLog = [], btPrices = [], btNewRanks = [];
// お店のグループ（コース名 → どのお店のコースか。kb_prices の store_key から）
const BT_GRP = [["", "ぜんぶ"], ["gokumon", "極門"], ["cutie", "キューティ（CC）"], ["sakurana", "サクラ系"]];
const btGrpOf = base => { const ks = btPrices.filter(p => p.course === base).map(p => p.store_key); return ks.includes("gokumon") ? "gokumon" : ks.includes("cutie") ? "cutie" : ks.length ? "sakurana" : ""; };
function btSplit(course){   // "60本指" → ["60","本指"]（長い言葉から先に見る）
  for(const s of ["特別フリー", "イベフリー", "本指", "フリー"]) if(course.endsWith(s) && course.length > s.length) return [course.slice(0, -s.length), s];
  return [course, ""];
}
const btNum = s => { const m = String(s).match(/\d+/); return m ? Number(m[0]) : 99999; };
async function openBackTable(rank){
  try{
    btRows = q(await sb.from("kb_back").select("rank,course,amount")) || [];
    try{ btPrices = q(await sb.from("kb_prices").select("store_key,course")) || []; }catch(e){ btPrices = []; }
    const lg = q(await sb.from("kb_settings").select("value").eq("key", "back_edit_log").maybeSingle());
    btLog = lg && Array.isArray(lg.value) ? lg.value : [];
  }catch(e){ toast("バック表が読めませんでした：" + (e.message || e)); return; }
  const ranks = [...new Set(btRows.map(r => r.rank).concat(btNewRanks))].sort((a, b) => a.localeCompare(b, "ja"));
  btRank = rank && ranks.includes(rank) ? rank : (btRank && ranks.includes(btRank) ? btRank : ranks[0] || "");
  btEdit = {};
  let bg = document.getElementById("btBg");
  if(!bg){ bg = document.createElement("div"); bg.id = "btBg"; bg.style.cssText = "position:fixed;inset:0;z-index:330;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:14px"; document.body.appendChild(bg);
    bg.addEventListener("click", e => { if(e.target === bg) btClose(); }); }
  bg.innerHTML = `<div style="background:#fff;border-radius:16px;padding:16px;max-width:900px;width:100%;max-height:92vh;overflow:auto;font-size:14px">
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b style="font-size:17px">💴 バック表（ランク × コース）</b>
      <span style="margin-left:auto"></span><button class="btn btn-ghost btn-sm" onclick="btClose()">閉じる</button></div>
    <div class="hint" style="margin:4px 0 8px">受付で予約を入れると、この表からキャストのバックが入ります。まちがいに気づいたら、ここで直して「💾 保存」。<b>もう入っている予約の報酬は変わりません</b>（まだ精算していない予約は、記録簿を開きなおして（F5）、予約を開いて保存しなおすと新しいバックになります）。</div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">ランク <select id="bt_rank" onchange="btSwitch(this.value)">${ranks.map(r => `<option ${r === btRank ? "selected" : ""}>${esc(r)}</option>`).join("")}${BT_EDIT() ? `<option value="__new">＋ 新しいランクを作る…</option>` : ""}</select>
      コースで探す <input id="bt_q" placeholder="例：60" oninput="btPaint()" style="width:120px"></div>
    <div id="bt_tbl" style="margin-top:8px"></div>
    ${BT_EDIT() ? `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:8px;border:2px dashed #F2C94C;background:#FFFDF2;border-radius:12px;padding:8px">
      <b style="font-size:13px">＋ このランクにコースを足す</b> コース <input id="bt_newc" placeholder="例：75" style="width:100px"> <select id="bt_news">${BT_SUF.map(([s, l]) => `<option value="${s}">${l}</option>`).join("")}</select>
      バック <input id="bt_newa" type="number" min="0" step="500" placeholder="円" style="width:110px"> <button class="btn btn-ghost btn-sm" onclick="btAdd()">足す</button></div>` : ""}
    ${BT_EDIT() ? `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:8px;border:2px dashed #8FB8E8;background:#F3F8FF;border-radius:12px;padding:8px">
      <b style="font-size:13px">📋 ほかのランクからまとめて作る</b>
      <select id="bt_cpfrom">${ranks.map(r => `<option ${r === "S" ? "selected" : ""}>${esc(r)}</option>`).join("")}</select> の
      <select id="bt_cpgrp">${BT_GRP.map(([k, l]) => `<option value="${k}" ${k === "gokumon" ? "selected" : ""}>${l}</option>`).join("")}</select> のコースを、
      ＋<input id="bt_cpadd" type="number" step="500" value="1000" style="width:90px">円 で <button class="btn btn-ghost btn-sm" onclick="btCopy()">このランクに入れる</button>
      <small class="hint" style="flex-basis:100%">例：極門の SS ＝ S の極門のコース ＋1,000円。入れたあと表で直せます。「💾 保存」を押すまで入りません</small></div>` : ""}
    <div style="display:flex;gap:8px;justify-content:flex-end;align-items:center;margin-top:12px;flex-wrap:wrap;position:sticky;bottom:-16px;background:#fff;padding:8px 0">
      <span id="bt_sum" class="hint" style="margin-right:auto"></span>
      ${BT_EDIT() ? `<button class="btn btn-primary" id="bt_save" onclick="btSave()">💾 保存</button>` : `<span class="hint">見るだけです</span>`}</div>
    <details style="margin-top:8px"><summary class="hint" style="cursor:pointer">🕘 バック表を変えた記録（新しい順）</summary><div id="bt_log"></div></details></div>`;
  btPaint();
}
function btClose(){ if(btChanges().length && !confirm("直したバックが保存されていません。閉じますか？")) return; const bg = document.getElementById("btBg"); if(bg) bg.remove(); }
function btSwitch(r){
  if(btChanges().length && !confirm("直したバックが保存されていません。ほかのランクにしますか？（直した分は消えます）")){ $("bt_rank").value = btRank; return; }
  btRank = r; btEdit = {}; btPaint();
}
const btCur = course => { const r = btRows.find(x => x.rank === btRank && x.course === course); return r ? r.amount : null; };
function btOnInput(inp){
  const c = inp.dataset.c; btEdit[c] = inp.value;
  inp.parentElement.style.background = String(inp.value) !== String(btCur(c) == null ? "" : btCur(c)) ? "#FFF3C4" : "";
  btSumPaint();
}
function btPaint(){
  const el = $("bt_tbl"); if(!el) return;
  const qv = ($("bt_q") && $("bt_q").value || "").trim();
  const mine = btRows.filter(r => r.rank === btRank).map(r => r.course).concat(Object.keys(btEdit).filter(c => btCur(c) == null));
  const bases = [...new Set(mine.map(c => btSplit(c)[0]))].filter(b => !qv || b.includes(qv)).sort((a, b) => btNum(a) - btNum(b) || a.localeCompare(b, "ja"));
  const cols = BT_SUF.filter(([s]) => mine.some(c => btSplit(c)[1] === s));
  const cell = (base, s) => {
    const course = base + s, cur = btCur(course), ed = course in btEdit, v = ed ? btEdit[course] : cur;
    if(cur == null && !ed) return `<td style="color:#ccc;text-align:center">—</td>`;
    const changed = ed && String(btEdit[course]) !== String(cur == null ? "" : cur);
    return `<td style="${changed ? "background:#FFF3C4" : ""};padding:3px 6px"><input type="number" min="0" step="500" value="${v == null ? "" : esc(String(v))}" ${BT_EDIT() ? "" : "disabled"} data-c="${esc(course)}" oninput="btOnInput(this)" style="width:96px;text-align:right">${cur != null ? `<div style="font-size:11px;color:#9C8B8F">いま：${Number(cur).toLocaleString()}</div>` : `<div style="font-size:11px;color:#8A6100">🆕 新しく足す</div>`}</td>`;
  };
  el.innerHTML = bases.length ? `<table style="border-collapse:collapse;width:100%"><tr style="background:#FCE4EC"><th style="text-align:left;padding:4px 6px">コース</th>${cols.map(([, l]) => `<th style="padding:4px 6px">${l}</th>`).join("")}</tr>
    ${bases.map(b => `<tr style="border-top:1px solid #f3e3e8"><td style="padding:4px 6px;font-weight:800">${esc(b)}</td>${cols.map(([s]) => cell(b, s)).join("")}</tr>`).join("")}</table>`
    : `<div class="hint">このランクのコースがありません</div>`;
  btSumPaint();
  const lg = $("bt_log");
  if(lg) lg.innerHTML = btLog.length ? btLog.slice(0, 40).map(x => `<div style="font-size:12.5px;border-bottom:1px dashed #eee;padding:3px 0">${esc(String(x.at || "").slice(0, 16).replace("T", " "))} ${esc(x.by || "")}${x.from ? `（${esc(x.from)}で）` : ""}：<b>${esc(x.rank)}・${esc(x.course)}</b> ${x.before == null ? "なし" : Number(x.before).toLocaleString()} → ${x.after == null ? "なし（消した）" : Number(x.after).toLocaleString()}</div>`).join("") : `<div class="hint">まだありません</div>`;
}
function btChanges(){
  return Object.entries(btEdit).map(([course, v]) => ({ course, before: btCur(course), after: String(v).trim() === "" ? null : Math.round(Number(v)) }))
    .filter(x => x.after !== x.before && !(x.after == null && x.before == null));
}
function btSumPaint(){ const n = btChanges().length; if($("bt_sum")) $("bt_sum").textContent = n ? `✏️ 直したところ：${n}か所（まだ保存していません）` : ""; const b = $("bt_save"); if(b) b.classList.toggle("kbGlow", !!n); }
function btAdd(){
  const c = ($("bt_newc").value || "").trim(), s = $("bt_news").value, a = $("bt_newa").value;
  if(!c || a === ""){ toast("コースとバックを入れてください"); return; }
  const course = c + s;
  if(btCur(course) != null){ toast("そのコースはもうあります。表の中で直してください"); return; }
  btEdit[course] = a; $("bt_newc").value = ""; $("bt_newa").value = ""; btPaint();
}
async function btSave(){
  if(!BT_EDIT()) return;
  const ch = btChanges();
  if(!ch.length){ toast("直したところがありません"); return; }
  if(ch.some(x => x.after != null && !(x.after >= 0 && x.after <= 300000))){ toast("バックは0〜300,000円で入れてください"); return; }
  const msg = ch.map(x => `・${btRank}・${x.course}：${x.before == null ? "なし" : x.before.toLocaleString() + "円"} → ${x.after == null ? "消す" : x.after.toLocaleString() + "円"}`).join("\n");
  if(!confirm(`バック表をこう変えます。いいですか？\n\n${msg}\n\nこれから入れる予約から、このバックになります（もう入っている予約は変わりません）。`)) return;
  try{
    const up = ch.filter(x => x.after != null).map(x => ({ rank: btRank, course: x.course, amount: x.after }));
    if(up.length) q(await sb.from("kb_back").upsert(up, { onConflict: "rank,course" }));
    for(const x of ch.filter(x => x.after == null)) q(await sb.from("kb_back").delete().eq("rank", btRank).eq("course", x.course));
    // 変えた記録（新しい順・300件まで）
    const by = typeof operatorName === "function" ? operatorName() : (window.KB ? KB.operatorName() : ""), at = new Date().toISOString();
    try{
      const lg = q(await sb.from("kb_settings").select("value").eq("key", "back_edit_log").maybeSingle());
      const old = lg && Array.isArray(lg.value) ? lg.value : [];
      btLog = ch.map(x => ({ at, by, rank: btRank, course: x.course, before: x.before, after: x.after })).concat(old).slice(0, 300);
      q(await sb.from("kb_settings").upsert({ key: "back_edit_log", value: btLog, note: "バック表を変えた記録（キャスト台帳の 💴 バック表）" }));
    }catch(e){ /* 記録が残せなくても、バックは保存できている */ }
    toast(`💾 バック表を保存しました（${ch.length}か所）。記録簿は開きなおすと新しいバックになります`);
    try{ backRanks = null; }catch(e){} btEdit = {};
    if(typeof btAfterSave === "function") try{ btAfterSave(ch); }catch(e){}
    await openBackTable(btRank);
  }catch(e){ toast("保存できませんでした：" + (e.message || e)); }
}
// ＋ 新しいランク（2026/11/20 店長：極門に SS を作りたい）。名前を入れて、表で足すか「📋 まとめて作る」で入れる
const __btSwitch0 = btSwitch;
btSwitch = function(r){
  if(r !== "__new") return __btSwitch0(r);
  const nm = (prompt("新しいランクの名前（例：SS）\n※サクラ系・極門などで同じ名前のランクは1つの表です（コースで分かれます）") || "").trim();
  if(!nm){ $("bt_rank").value = btRank; return; }
  if(!btRows.some(x => x.rank === nm) && !btNewRanks.includes(nm)) btNewRanks.push(nm);
  if(btChanges().length && !confirm("直したバックが保存されていません。ほかのランクにしますか？（直した分は消えます）")){ $("bt_rank").value = btRank; return; }
  btRank = nm; btEdit = {}; openBackTable(nm);
};
// 📋 ほかのランクの（そのお店の）コースを、＋何円 で今のランクに入れる（保存の前に表で見られる）
function btCopy(){
  const from = $("bt_cpfrom").value, grp = $("bt_cpgrp").value, add = Math.round(Number($("bt_cpadd").value) || 0);
  if(from === btRank){ toast("同じランクです。上の「ランク」で作りたいランク（例：SS）を選んでから押してください"); return; }
  const src = btRows.filter(x => x.rank === from && (!grp || btGrpOf(btSplit(x.course)[0]) === grp));
  if(!src.length){ toast(`${from} に${grp ? (BT_GRP.find(g => g[0] === grp) || [])[1] + "の" : ""}コースがありません`); return; }
  src.forEach(x => { btEdit[x.course] = String(Math.max(0, Number(x.amount) + add)); });
  btPaint(); toast(`📋 ${from} から ${src.length}コースを ＋${add.toLocaleString()}円 で入れました。表を見て「💾 保存」を押してください`);
}
