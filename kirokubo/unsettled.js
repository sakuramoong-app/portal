/* ============================================================
   unsettled.js — 📒 未精算（精算ページ・記録簿の💴精算 共通）。SQL 165
   ・キャストごとの未精算を A・B・C…（古い順）で出す。今日の精算でいっしょに精算するものにチェック
   ・当日の精算明細（画像・LINE の文）の形は変えない。チェックしたものと合算した「合計で投函する額」は別の枠に出す
   ・精算済にすると：チェックしたものは一覧から消える（記録は残る）。投函した額が合わなければ、新しい未精算（またはお釣り）が自動で入る
   amount ＋＝キャストがお店に払う（未精算）／−＝お店がキャストに払う（お釣り）
   ============================================================ */
let UNS = null;            // 未精算（まだのもの＋この日にいっしょに精算したもの）。null＝表がない（SQL 165 の前）
const unsSel = {};         // cast_id → Set（今日いっしょに精算するもののid）
const UNS_ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
function unsRedraw(id){
  if(typeof refreshCastSettle === "function"){ if(id) refreshCastSettle(id); }
  else if(typeof render === "function") render();
  if(typeof unsListPaint === "function" && document.getElementById("unsList")) unsListPaint();
}
async function unsLoad(){
  if(!day) return;
  try{
    const r = await sb.from("kb_unsettled").select("*").or(`done_on.is.null,done_on.eq.${day}`).order("biz_date").order("id");
    UNS = r.error ? null : (r.data || []);
  }catch(e){ UNS = null; }
  Object.keys(unsSel).forEach(k => delete unsSel[k]);
  unsRedraw(typeof castOpen !== "undefined" && castOpen && castOpen.c ? castOpen.c.id : "");
}
function unsOpen(id){ return (UNS || []).filter(x => x.cast_id === id && !x.done_on).sort((a, b) => String(a.biz_date).localeCompare(String(b.biz_date)) || a.id - b.id); }
const unsMd = d => { const p = String(d || "").split("-"); return p.length === 3 ? Number(p[1]) + "/" + Number(p[2]) : ""; };
const unsAmt = a => a >= 0 ? "未精算 " + yen(a) : "お釣り " + yen(-a);
function unsToggle(id, uid, on){ const s = unsSel[id] = unsSel[id] || new Set(); if(on) s.add(uid); else s.delete(uid); unsRedraw(id); }

// キャストの精算の枠の中の「📒 未精算の処理」
function unsBoxHtml(id, c){
  if(UNS === null) return "";
  const done = !!((typeof castDays !== "undefined" ? castDays : days)[id] || {}).settled;
  const today = (UNS || []).filter(x => x.cast_id === id && x.done_on === day);
  const open = unsOpen(id);
  if(!open.length && !today.length) return "";
  const sel = unsSel[id] || new Set();
  if(done){
    if(!today.length) return `<div class="unsbox"><b>📒 未精算</b>　まだのもの ${open.length}件（${yen(open.reduce((a, x) => a + x.amount, 0))}）は、つぎの精算で</div>`;
    const sum = today.reduce((a, x) => a + x.amount, 0);
    return `<div class="unsbox"><b>📒 この日いっしょに精算した未精算</b>
      ${today.map(x => `<div class="ur">✅ ${unsMd(x.biz_date)}の分　${unsAmt(x.amount)}${x.note ? `<small>${esc(x.note)}</small>` : ""}</div>`).join("")}
      <div class="ut">当日の投函額 ${yen(c.drop)} ＋ 未精算 ${yen(sum)} ＝ <b>${yen(c.drop + sum)}</b></div></div>`;
  }
  const add = open.filter(x => sel.has(x.id)).reduce((a, x) => a + x.amount, 0), due = c.drop + add;
  return `<div class="unsbox"><b>📒 未精算の処理</b><small>（今日いっしょに精算するものにチェック。当日の精算明細はそのまま）</small>
    ${open.map((x, i) => `<label class="ur"><input type="checkbox" ${sel.has(x.id) ? "checked" : ""} ${KB.CAN_EDIT ? "" : "disabled"} onchange="unsToggle('${id}',${x.id},this.checked)">
      <b class="ab">${UNS_ABC[i] || i + 1}</b> ${unsMd(x.biz_date)}の分　<b class="${x.amount >= 0 ? "neg" : "pos"}">${unsAmt(x.amount)}</b>${x.note ? `<small>${esc(x.note)}</small>` : ""}</label>`).join("")}
    ${sel.size ? `<div class="ut">当日の投函額 ${yen(c.drop)}${open.filter(x => sel.has(x.id)).map(x => (x.amount >= 0 ? " ＋ " : " − ") + yen(Math.abs(x.amount))).join("")} ＝
        ${due >= 0 ? `<span class="due">💰 合計で投函 ${yen(due)}</span>` : `<span class="due give">💴 お店から渡す ${yen(-due)}</span>`}</div>
      <div class="hint2" style="font-size:11.5px">「精算済にする」で、チェックしたものは一覧から消えます（のこりは A から繰り上げ）。投函した額は、この合計と比べます。</div>` : `<div class="hint2" style="font-size:11.5px">チェックしないものは、つぎの精算にのこります</div>`}
    ${KB.CAN_EDIT ? `<button type="button" class="btn btn-ghost btn-sm" onclick="unsCopy('${id}')">📋 未精算の処理をコピー（LINE用）</button>` : ""}</div>`;
}
function unsCopy(id){
  const c = calcCast(id), sel = unsSel[id] || new Set(), open = unsOpen(id), items = open.filter(x => sel.has(x.id));
  const lines = [`【未精算の精算】${castName(id)}さん`, ""];
  open.forEach((x, i) => lines.push(`${UNS_ABC[i] || i + 1}　${unsMd(x.biz_date)}の分　${unsAmt(x.amount)}${sel.has(x.id) ? "　→ 今日いっしょに精算" : "　→ 後日"}`));
  const due = c.drop + items.reduce((a, x) => a + x.amount, 0);
  lines.push("", `当日の投函額 ${yen(c.drop)}${items.map(x => (x.amount >= 0 ? " ＋ " : " − ") + yen(Math.abs(x.amount))).join("")}`, due >= 0 ? `合計で投函　${yen(due)}` : `お店から渡す　${yen(-due)}`);
  navigator.clipboard.writeText(lines.join("\n")).then(() => toast("📋 未精算の処理をコピーしました"), () => alert(lines.join("\n")));
}

// 精算済にする：チェックした未精算もいっしょに。投函した額が合わなければ、新しい未精算（お釣り）を入れる
settle = async function(id){
  const c = calcCast(id), sel = unsSel[id] || new Set(), items = unsOpen(id).filter(x => sel.has(x.id));
  const add = items.reduce((a, x) => a + x.amount, 0), due = c.drop + add;
  const diff = c.deposited != null ? c.deposited - due : null;   // −＝足りない（未精算）／＋＝多い（お釣り）
  const msg = castName(id) + " を精算済にしますか？\n手取り " + yen(c.takeHome) + "／当日の投函額 " + yen(c.drop)
    + (items.length ? "\n＋ 未精算 " + items.length + "件（" + yen(add) + "）→ 合計 " + yen(due) : "")
    + (diff ? "\n投函した額 " + yen(c.deposited) + " → " + (diff < 0 ? "未精算 " + yen(-diff) : "お釣り " + yen(diff)) + " を未精算の一覧に入れます" : "");
  if(!confirm(msg)) return;
  const by = KB.operatorName(), at = new Date().toISOString();
  const snap = { reward: c.reward, option: c.option, transportBack: c.transportBack, plus: c.plus, zappi: c.zappi, minus: c.minus,
                 takeHome: c.takeHome, total: c.total, cardPaid: c.cardPaid, drop: c.drop, withholding: c.withholding,
                 shopDrop: c.shopDrop, realDrop: c.realDrop, deposited: c.deposited, diff, by, at,
                 uns: items.map(x => ({ id: x.id, biz_date: x.biz_date, amount: x.amount })), due };
  const pl = document.getElementById("pl-" + id);
  try{
    if(UNS !== null && items.length) q(await sb.from("kb_unsettled").update({ done_on: day, done_by: by, done_at: at }).in("id", items.map(x => x.id)));
    if(UNS !== null && diff) q(await sb.from("kb_unsettled").insert({ cast_id: id, biz_date: day, amount: -diff, source: "auto", created_by: by,
      note: diff < 0 ? "投函が足りなかった（投函 " + yen(c.deposited) + "／" + yen(due) + "）" : "多く投函した（投函 " + yen(c.deposited) + "／" + yen(due) + "）" }));
  }catch(e){ toast("未精算を保存できませんでした：" + (e.message || e)); return; }
  await saveDay(id, { settled: true, settled_at: at, settled_by: by, settle_place: pl ? pl.value : "", settle_snapshot: snap });
  delete unsSel[id]; await unsLoad();
};
// 精算済をもどす：この日にいっしょに精算した未精算はもどす。この日の精算で自動で入れた未精算は消す
unsettle = async function(id){
  if(!confirm(castName(id) + " の精算済をもどしますか？（この日にいっしょに精算した未精算も、まだにもどります）")) return;
  try{
    if(UNS !== null){
      q(await sb.from("kb_unsettled").update({ done_on: null, done_by: "", done_at: null }).eq("cast_id", id).eq("done_on", day));
      q(await sb.from("kb_unsettled").delete().eq("cast_id", id).eq("biz_date", day).eq("source", "auto").is("done_on", null));
    }
  }catch(e){ toast("未精算をもどせませんでした：" + (e.message || e)); return; }
  await saveDay(id, { settled: false, settled_at: null, settle_snapshot: null });
  await unsLoad();
};

// 📒 未精算の一覧（全員）。手で足す（エクセルの頃の分など）・消す
function unsListHtml(){
  if(UNS === null) return `<div class="hint2">未精算の表がまだありません（SQL 165 を実行してください）</div>`;
  const open = (UNS || []).filter(x => !x.done_on), ids = [...new Set(open.map(x => x.cast_id))].sort((a, b) => castName(a).localeCompare(castName(b), "ja"));
  const casts = (M.casts || []).filter(c => c.status !== "left").sort((a, b) => castName(a.id).localeCompare(castName(b.id), "ja"));
  return `${ids.length ? ids.map(cid => { const l = unsOpen(cid), sum = l.reduce((a, x) => a + x.amount, 0);
      return `<div class="unsc"><div class="uh">★ <b>${esc(castName(cid))}</b>　のこり <b class="${sum >= 0 ? "neg" : "pos"}">${sum >= 0 ? "未精算 " + yen(sum) : "お釣り " + yen(-sum)}</b>（${l.length}件）</div>
        ${l.map((x, i) => `<div class="ur"><b class="ab">${UNS_ABC[i] || i + 1}</b> ${unsMd(x.biz_date)}の分　<b class="${x.amount >= 0 ? "neg" : "pos"}">${unsAmt(x.amount)}</b>${x.note ? `<small>${esc(x.note)}</small>` : ""}<small>${x.source === "manual" ? "手で入れた・" : ""}${esc(x.created_by || "")}</small>
          ${KB.CAN_EDIT ? `<button type="button" class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="unsDel(${x.id})">🗑</button>` : ""}</div>`).join("")}</div>`; }).join("")
    : `<div class="hint2">未精算はありません 🎉</div>`}
    ${KB.CAN_EDIT ? `<details style="margin-top:10px"><summary style="cursor:pointer;font-weight:800;font-size:13px">＋ 未精算を手で足す（エクセルの頃の分など）</summary>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px">
        <select id="un_cast"><option value="">キャスト</option>${casts.map(c => `<option value="${c.id}">${esc(castName(c.id))}</option>`).join("")}</select>
        <input type="date" id="un_day" value="${day}">
        <select id="un_kind"><option value="1">未精算（キャストが払う）</option><option value="-1">お釣り（お店が払う）</option></select>
        <input type="number" id="un_amt" min="1" placeholder="金額" style="width:110px">
        <input id="un_note" maxlength="300" placeholder="メモ（なくてもOK）" style="flex:1;min-width:140px">
        <button type="button" class="btn btn-primary btn-sm" onclick="unsAdd()">足す</button></div></details>` : ""}`;
}
async function unsAdd(){
  const cid = $("un_cast").value, amt = Math.abs(Number($("un_amt").value) || 0), d = $("un_day").value;
  if(!cid || !amt || !d){ toast("キャスト・日付・金額を入れてください"); return; }
  try{ q(await sb.from("kb_unsettled").insert({ cast_id: cid, biz_date: d, amount: amt * Number($("un_kind").value), note: $("un_note").value.trim(), source: "manual", created_by: KB.operatorName() }));
    toast("未精算を足しました"); await unsLoad(); }
  catch(e){ toast("足せませんでした：" + (e.message || e)); }
}
async function unsDel(uid){
  if(!confirm("この未精算を消しますか？（まちがいで入れたとき。精算したときは、精算の枠でチェックして精算済にしてください）")) return;
  try{ q(await sb.from("kb_unsettled").delete().eq("id", uid)); await unsLoad(); }catch(e){ toast("消せませんでした：" + (e.message || e)); }
}
// 日付が変わったら読みなおす（どちらのページも day を使う）
let unsDay = "";
setInterval(() => { if(typeof day !== "undefined" && day && day !== unsDay){ unsDay = day; unsLoad(); } }, 800);
function unsListPaint(){ const el = document.getElementById("unsList"); if(el && el.style.display !== "none") el.innerHTML = unsListHtml(); }
function unsListToggle(){ const el = document.getElementById("unsList"); if(!el) return; el.style.display = el.style.display === "none" ? "" : "none"; unsListPaint(); }
document.head.insertAdjacentHTML("beforeend", `<style>
  .unsbox{background:#F6F2FF;border:2px dashed #A98BE6;border-radius:12px;padding:8px 12px;margin:8px 0;font-size:13.5px}
  .unsbox > b{color:#5b3fa6} .unsbox > small{color:#8a7f99;margin-left:4px}
  .ur{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:3px 0} .ur small{color:#8a7f99;font-size:11.5px}
  .ur .ab{display:inline-flex;width:22px;height:22px;border-radius:50%;background:#7b5cd6;color:#fff;align-items:center;justify-content:center;font-size:12px}
  .neg{color:#d9534f} .pos{color:#2f7fd0}
  .ut{margin-top:6px;font-weight:700} .due{display:inline-block;background:#FFF59D;border:2px solid #F2C200;border-radius:10px;padding:2px 10px;color:#E0001B;font-size:18px;font-weight:900}
  .due.give{background:#E3F1FF;border-color:#2f7fd0;color:#2f7fd0}
  .unsc{background:#fff;border:1.5px solid #E4DDF2;border-radius:12px;padding:8px 12px;margin-bottom:8px} .unsc .uh{font-size:14px;margin-bottom:2px}
</style>`);
