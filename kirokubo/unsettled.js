/* ============================================================
   unsettled.js — 📒 未精算（精算ページ・記録簿の💴精算 共通）。SQL 165・167
   未精算になるもの：
     ① 精算していない日（その日に予約があって、精算済にしていない）… 投函額（マイナスならお店から渡す額）
     ② 投函した額が合わなかった分（kb_unsettled）… ＋未精算／−お釣り。エクセルの頃の分は手で足す
   ・キャストごとに古い順で A・B・C…。当日の精算の枠でチェックすると、当日の投函額と合算した額を出す
   ・当日の精算明細（画像・LINE の文）の形は変えない
   ・精算済にすると、チェックしたものも精算になる。当日の精算と、もとの日の精算の両方の「📝 備考」に、いつ・だれが処理したかが残る
   ============================================================ */
let UNS = null;            // ② kb_unsettled（まだのもの＋この日にいっしょに精算したもの）。null＝表がない
let UNSD = [];
let HAS_SLOG = false;   // kb_cast_days.settle_log（SQL 167）があるか
Promise.resolve(sb.from("kb_cast_days").select("settle_log").limit(1)).then(r => { HAS_SLOG = !!r && !r.error; }).catch(() => {});             // ① 精算していない日 [{ date, cid, c（その日の精算の計算）, cd }]
const unsSel = {};         // cast_id → Set（今日いっしょに精算するもののキー）
const UNS_ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ", UNS_DAYS = 60;
const unsMd = d => { const p = String(d || "").split("-"); return p.length === 3 ? Number(p[1]) + "/" + Number(p[2]) : ""; };
const unsCD = () => (typeof castDays !== "undefined" ? castDays : days);
function unsRedraw(id){
  if(typeof refreshCastSettle === "function"){ if(id) refreshCastSettle(id); }
  else if(typeof render === "function") render();
  unsListPaint();
}
// その日・その子の精算を計算する（今のページの day・rows・その日のキャストの状態を、いったん入れかえて calcCast）
function unsCalcDay(date, cid, dayRows, cdRow){
  const sv = { day, rows }; let svCD;
  const useCD = typeof castDays !== "undefined";
  day = date; rows = dayRows;
  if(useCD){ svCD = castDays; castDays = { [cid]: cdRow || {} }; } else { svCD = days; days = { [cid]: cdRow || {} }; }
  try{ return calcCast(cid); }
  finally{ day = sv.day; rows = sv.rows; if(useCD) castDays = svCD; else days = svCD; }
}
async function unsLoad(){
  if(!day) return;
  try{
    const r = await sb.from("kb_unsettled").select("*").or(`done_on.is.null,done_on.eq.${day}`).order("biz_date").order("id");
    UNS = r.error ? null : (r.data || []);
  }catch(e){ UNS = null; }
  // ① 精算していない日（この日より前の UNS_DAYS 日）
  UNSD = [];
  try{
    const from = new Date(new Date(day + "T12:00:00Z").getTime() - UNS_DAYS * 864e5).toISOString().slice(0, 10);
    const [rr, cc] = await Promise.all([
      sb.from("kb_reservations").select("*").gte("biz_date", from).lt("biz_date", day).eq("deleted", false).not("cast_id", "is", null),
      sb.from("kb_cast_days").select("*").gte("biz_date", from).lt("biz_date", day),
    ]);
    const resv = rr.data || [], cds = cc.data || [];
    const byDay = {}; resv.forEach(x => { (byDay[x.biz_date] = byDay[x.biz_date] || []).push(x); });
    Object.keys(byDay).sort().forEach(d => {
      const list = byDay[d];
      [...new Set(list.filter(x => !["cancel", "tobi"].includes(x.status)).map(x => x.cast_id))].forEach(cid => {
        const cd = cds.find(x => x.biz_date === d && x.cast_id === cid);
        if(cd && cd.settled) return;
        try{ const c = unsCalcDay(d, cid, list, cd); UNSD.push({ date: d, cid, c, cd: cd || null }); }catch(e){}
      });
    });
  }catch(e){}
  Object.keys(unsSel).forEach(k => delete unsSel[k]);
  unsRedraw(typeof castOpen !== "undefined" && castOpen && castOpen.c ? castOpen.c.id : "");
}
// キャストの未精算（古い順）：{ key, kind:"day"|"entry", date, amount（＋＝キャストがお店に払う）, what（なんの未精算か）, raw }
function unsOpen(id){
  const a = UNSD.filter(x => x.cid === id).map(x => ({ key: "d" + x.date, kind: "day", date: x.date, amount: x.c.drop, raw: x,
    what: x.c.drop >= 0 ? `未精算 ${yen(x.c.drop)}` : `お店から渡す ${yen(-x.c.drop)}` }));
  const b = (UNS || []).filter(x => x.cast_id === id && !x.done_on).map(x => ({ key: "u" + x.id, kind: "entry", date: x.biz_date, amount: x.amount, raw: x,
    what: (x.note || (x.amount >= 0 ? "投函が足りなかった" : "多く投函した")) + (x.amount >= 0 ? `（未精算 ${yen(x.amount)}）` : `（お釣り ${yen(-x.amount)}）`) }));
  return a.concat(b).sort((p, q) => String(p.date).localeCompare(String(q.date)) || (p.kind === "day" ? -1 : 1));
}
const unsLine = (x, i, cid) => `${UNS_ABC[i] || i + 1}　${unsMd(x.date)}（${castName(cid)}）${x.what}`;
function unsToggle(id, key, on){ const s = unsSel[id] = unsSel[id] || new Set(); if(on) s.add(key); else s.delete(key); unsRedraw(id); }

// キャストの精算の枠の中の「📒 未精算」
function unsBoxHtml(id, c){
  const done = !!(unsCD()[id] || {}).settled, open = unsOpen(id);
  const today = (UNS || []).filter(x => x.cast_id === id && x.done_on === day);
  if(done){
    const snapU = ((unsCD()[id] || {}).settle_snapshot || {}).uns || [];
    const rest = open.length ? `<div class="hint2" style="font-size:12px">のこりの未精算 ${open.length}件は、つぎの精算で</div>` : "";
    if(!snapU.length && !today.length) return open.length ? `<div class="unsbox"><b>📒 未精算</b>${rest}</div>` : "";
    return `<div class="unsbox"><b>📒 この日いっしょに精算した未精算</b>
      ${snapU.map(x => `<div class="ur">✅ ${esc(x.label || (unsMd(x.date) + " " + yen(x.amount)))}</div>`).join("")}
      <div class="ut">当日の投函額 ${yen(c.drop)} ＋ 未精算 ${yen(snapU.reduce((a, x) => a + (x.amount || 0), 0))} ＝ <b>${yen(((unsCD()[id] || {}).settle_snapshot || {}).due ?? c.drop)}</b></div>${rest}</div>`;
  }
  if(!open.length) return "";
  const sel = unsSel[id] || new Set(), picked = open.filter(x => sel.has(x.key)), due = c.drop + picked.reduce((a, x) => a + x.amount, 0);
  return `<div class="unsbox"><b>📒 未精算 ${open.length}件</b><small>（今日いっしょに精算するものにチェック。当日の精算明細はそのまま）</small>
    ${open.map((x, i) => `<label class="ur"><input type="checkbox" ${sel.has(x.key) ? "checked" : ""} ${KB.CAN_EDIT ? "" : "disabled"} onchange="unsToggle('${id}','${x.key}',this.checked)">
      <b class="ab">${UNS_ABC[i] || i + 1}</b> <b>${unsMd(x.date)}</b>（${esc(castName(id))}）<span class="${x.amount >= 0 ? "neg" : "pos"}">${esc(x.what)}</span></label>`).join("")}
    ${picked.length ? `<div class="ut">当日の投函額 ${yen(c.drop)}${picked.map(x => (x.amount >= 0 ? " ＋ " : " − ") + yen(Math.abs(x.amount))).join("")} ＝
        ${due >= 0 ? `<span class="due">💰 合計で投函 ${yen(due)}</span>` : `<span class="due give">💴 お店から渡す ${yen(-due)}</span>`}</div>
      <div class="hint2" style="font-size:11.5px">「精算済にする」で、チェックしたものも精算になります（のこりは A から繰り上げ）。投函した額は、この合計と比べます。</div>` : `<div class="hint2" style="font-size:11.5px">チェックしないものは、つぎの精算にのこります</div>`}
    ${KB.CAN_EDIT ? `<button type="button" class="btn btn-ghost btn-sm" onclick="unsCopy('${id}')">📋 未精算の処理をコピー（LINE用）</button>` : ""}</div>`;
}
function unsCopy(id){
  const c = calcCast(id), sel = unsSel[id] || new Set(), open = unsOpen(id), picked = open.filter(x => sel.has(x.key));
  const lines = [`【未精算】${castName(id)}さん`, ""];
  open.forEach((x, i) => lines.push(unsLine(x, i, id) + (sel.has(x.key) ? "　→ 今日いっしょに精算" : "　→ 後日")));
  const due = c.drop + picked.reduce((a, x) => a + x.amount, 0);
  lines.push("", `当日の投函額 ${yen(c.drop)}${picked.map(x => (x.amount >= 0 ? " ＋ " : " − ") + yen(Math.abs(x.amount))).join("")}`, due >= 0 ? `合計で投函　${yen(due)}` : `お店から渡す　${yen(-due)}`);
  navigator.clipboard.writeText(lines.join("\n")).then(() => toast("📋 未精算をコピーしました"), () => alert(lines.join("\n")));
}

// 📝 精算の備考（kb_cast_days.settle_log。SQL 167）
const logWhen = at => { const d = new Date(at); return isNaN(d) ? "" : (d.getMonth() + 1) + "/" + d.getDate() + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
function settleLogHtml(id){
  const cd = unsCD()[id] || {};
  if(!HAS_SLOG) return "";
  const l = Array.isArray(cd.settle_log) ? cd.settle_log : [];
  return `<div class="slog"><b>📝 精算の備考</b>${KB.CAN_EDIT ? `<button type="button" class="btn btn-ghost btn-sm" onclick="settleLogAdd('${id}')">＋ 備考を書く</button>` : ""}
    ${l.length ? l.slice().reverse().map(x => `<div class="sl"><div class="t">${esc(x.text)}</div><div class="s">${esc(x.by || "")} ${logWhen(x.at)}</div></div>`).join("") : `<div class="hint2" style="font-size:12px">まだありません</div>`}</div>`;
}
async function settleLogAdd(id){
  const v = prompt("精算の備考（あとから見てわかるように）"); if(!v || !v.trim()) return;
  const cd = unsCD()[id] || {}, l = (Array.isArray(cd.settle_log) ? cd.settle_log : []).concat([{ at: new Date().toISOString(), by: KB.operatorName(), text: v.trim() }]);
  await saveDay(id, { settle_log: l });
}
// ほかの日の精算に、備考を足す（未精算をいっしょに精算したとき）
async function unsLogOther(date, cid, text, extra){
  if(!HAS_SLOG){ if(extra) q(await sb.from("kb_cast_days").upsert(Object.assign({ biz_date: date, cast_id: cid, updated_at: new Date().toISOString(), updated_by: KB.operatorName() }, extra), { onConflict: "biz_date,cast_id" })); return; }
  const r = await sb.from("kb_cast_days").select("settle_log").eq("biz_date", date).eq("cast_id", cid).maybeSingle();
  const l = ((r.data && Array.isArray(r.data.settle_log)) ? r.data.settle_log : []).concat([{ at: new Date().toISOString(), by: KB.operatorName(), text }]);
  q(await sb.from("kb_cast_days").upsert(Object.assign({ biz_date: date, cast_id: cid, settle_log: l, updated_at: new Date().toISOString(), updated_by: KB.operatorName() }, extra || {}), { onConflict: "biz_date,cast_id" }));
}

// 精算済にする：チェックした未精算もいっしょに。投函した額が合わなければ、新しい未精算（お釣り）を入れる
settle = async function(id){
  const c = calcCast(id), sel = unsSel[id] || new Set(), open = unsOpen(id), picked = open.filter(x => sel.has(x.key));
  const add = picked.reduce((a, x) => a + x.amount, 0), due = c.drop + add;
  const diff = c.deposited != null ? c.deposited - due : null;   // −＝足りない（未精算）／＋＝多い（お釣り）
  const msg = castName(id) + " を精算済にしますか？\n手取り " + yen(c.takeHome) + "／当日の投函額 " + yen(c.drop)
    + (picked.length ? "\n＋ 未精算 " + picked.length + "件（" + yen(add) + "）→ 合計 " + yen(due) : "")
    + (diff ? "\n投函した額 " + yen(c.deposited) + " → " + (diff < 0 ? "未精算 " + yen(-diff) : "お釣り " + yen(diff)) + " を未精算に入れます" : "");
  if(!confirm(msg)) return;
  const by = KB.operatorName(), at = new Date().toISOString(), pl = document.getElementById("pl-" + id), place = pl ? pl.value : "";
  const labels = picked.map(x => unsLine(x, open.indexOf(x), id));
  const snap = { reward: c.reward, option: c.option, transportBack: c.transportBack, plus: c.plus, zappi: c.zappi, minus: c.minus,
                 takeHome: c.takeHome, total: c.total, cardPaid: c.cardPaid, drop: c.drop, withholding: c.withholding,
                 shopDrop: c.shopDrop, realDrop: c.realDrop, deposited: c.deposited, diff, by, at,
                 uns: picked.map((x, i) => ({ kind: x.kind, date: x.date, amount: x.amount, id: x.raw.id || null, label: labels[i] })), due };
  try{
    for(const x of picked){
      const txt = `${unsMd(day)}の精算で、この日の${x.kind === "day" ? "精算" : "未精算（" + x.what + "）"}をいっしょに精算しました（合計 ${yen(due)}・${place}）`;
      if(x.kind === "day"){
        const s2 = Object.assign({}, { reward: x.raw.c.reward, option: x.raw.c.option, takeHome: x.raw.c.takeHome, total: x.raw.c.total, cardPaid: x.raw.c.cardPaid, drop: x.raw.c.drop, zappi: x.raw.c.zappi }, { paidOn: day, by, at });
        await unsLogOther(x.date, id, txt, { settled: true, settled_at: at, settled_by: by, settle_place: place, settle_snapshot: s2 });
      } else {
        q(await sb.from("kb_unsettled").update({ done_on: day, done_by: by, done_at: at }).eq("id", x.raw.id));
        await unsLogOther(x.date, id, txt);
      }
    }
    if(diff && UNS !== null) q(await sb.from("kb_unsettled").insert({ cast_id: id, biz_date: day, amount: -diff, source: "auto", created_by: by,
      note: diff < 0 ? "投函が足りなかった（投函 " + yen(c.deposited) + "／" + yen(due) + "）" : "多く投函した（投函 " + yen(c.deposited) + "／" + yen(due) + "）" }));
  }catch(e){ toast("未精算を保存できませんでした：" + (e.message || e)); return; }
  const cd = unsCD()[id] || {}, logs = (Array.isArray(cd.settle_log) ? cd.settle_log : []).slice();
  logs.push({ at, by, text: `精算済にしました（${place}）手取り ${yen(c.takeHome)}／当日の投函額 ${yen(c.drop)}` + (picked.length ? `\n＋ 未精算をいっしょに精算：${labels.join("／")}\n→ 合計 ${yen(due)}` : "") + (diff ? `\n投函した額 ${yen(c.deposited)}（${diff < 0 ? "足りない " + yen(-diff) + " を未精算に" : "多い " + yen(diff) + " をお釣りに"}）` : "") });
  await saveDay(id, Object.assign({ settled: true, settled_at: at, settled_by: by, settle_place: place, settle_snapshot: snap }, HAS_SLOG ? { settle_log: logs } : {}));
  delete unsSel[id]; await unsLoad();
};
// 精算済をもどす：この日にいっしょに精算した未精算もまだにもどす。この日の精算で自動で入れた未精算は消す
unsettle = async function(id){
  if(!confirm(castName(id) + " の精算済をもどしますか？（この日にいっしょに精算した未精算も、まだにもどります）")) return;
  const by = KB.operatorName(), cd = unsCD()[id] || {}, snapU = ((cd.settle_snapshot || {}).uns) || [];
  try{
    if(UNS !== null){
      q(await sb.from("kb_unsettled").update({ done_on: null, done_by: "", done_at: null }).eq("cast_id", id).eq("done_on", day));
      q(await sb.from("kb_unsettled").delete().eq("cast_id", id).eq("biz_date", day).eq("source", "auto").is("done_on", null));
    }
    for(const x of snapU){
      const txt = `${unsMd(day)}の精算を取り消したので、この日の${x.kind === "day" ? "精算" : "未精算"}もまだにもどしました`;
      await unsLogOther(x.date, id, txt, x.kind === "day" ? { settled: false, settled_at: null, settle_snapshot: null } : null);
    }
  }catch(e){ toast("未精算をもどせませんでした：" + (e.message || e)); return; }
  const logs = (Array.isArray(cd.settle_log) ? cd.settle_log : []).concat([{ at: new Date().toISOString(), by, text: "精算済を取り消しました" + (snapU.length ? `（いっしょに精算した未精算 ${snapU.length}件もまだにもどしました）` : "") }]);
  await saveDay(id, Object.assign({ settled: false, settled_at: null, settle_snapshot: null }, HAS_SLOG ? { settle_log: logs } : {}));
  await unsLoad();
};

// 📒 未精算のキャスト（全員）。精算ページの上にいつも出す。手で足す（エクセルの頃の分など）・消す
function unsListHtml(){
  const ids = [...new Set(UNSD.map(x => x.cid).concat((UNS || []).filter(x => !x.done_on).map(x => x.cast_id)))].sort((a, b) => castName(a).localeCompare(castName(b), "ja"));
  const casts = (M.casts || []).filter(c => c.status !== "left").sort((a, b) => castName(a.id).localeCompare(castName(b.id), "ja"));
  return `<div class="uhd">📒 未精算のキャスト（${ids.length}人）<small>前の${UNS_DAYS}日の、精算していない日と、投函が合わなかった分</small></div>
    ${ids.length ? ids.map(cid => { const l = unsOpen(cid), sum = l.reduce((a, x) => a + x.amount, 0);
      return `<div class="unsc"><div class="uh">★ <b>${esc(castName(cid))}</b>　のこり <b class="${sum >= 0 ? "neg" : "pos"}">${sum >= 0 ? "未精算 " + yen(sum) : "お店から渡す " + yen(-sum)}</b>（${l.length}件）</div>
        ${l.map((x, i) => `<div class="ur">${KB.CAN_EDIT ? `<input type="checkbox" ${(unsOnly[cid] || new Set()).has(x.key) ? "checked" : ""} onchange="unsOnlyToggle('${cid}','${x.key}',this.checked)" title="未精算だけを、今日精算する">` : ""}<b class="ab">${UNS_ABC[i] || i + 1}</b> <b>${unsMd(x.date)}</b>（${esc(castName(cid))}）<span class="${x.amount >= 0 ? "neg" : "pos"}">${esc(x.what)}</span>
          ${x.kind === "entry" && x.raw.source === "manual" ? `<small>手で入れた・${esc(x.raw.created_by || "")}</small>` : ""}
          ${KB.CAN_EDIT && x.kind === "entry" ? `<button type="button" class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="unsDel(${x.raw.id})">🗑</button>` : ""}</div>`).join("")}
        ${unsOnlyFoot(cid, l)}</div>`; }).join("")
    : `<div class="hint2">未精算はありません 🎉</div>`}
    ${KB.CAN_EDIT && UNS !== null ? `<details style="margin-top:8px"><summary style="cursor:pointer;font-weight:800;font-size:13px">＋ 未精算を手で足す（エクセルの頃の分など）</summary>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px">
        <select id="un_cast"><option value="">キャスト</option>${casts.map(c => `<option value="${c.id}">${esc(castName(c.id))}</option>`).join("")}</select>
        <input type="date" id="un_day" value="${day}">
        <select id="un_kind"><option value="1">未精算（キャストが払う）</option><option value="-1">お釣り（お店が払う）</option></select>
        <input type="number" id="un_amt" min="1" placeholder="金額" style="width:110px">
        <input id="un_note" maxlength="300" placeholder="なんの未精算か（例：エクセルの頃の分）" style="flex:1;min-width:160px">
        <button type="button" class="btn btn-primary btn-sm" onclick="unsAdd()">足す</button></div></details>` : ""}`;
}
// 💴 未精算だけを精算（当日お茶・未精算だけ先に精算する子）。一覧でチェック → 精算場所・投函した額 → 精算済
const unsOnly = {};
function unsOnlyToggle(cid, key, on){ const s = unsOnly[cid] = unsOnly[cid] || new Set(); if(on) s.add(key); else s.delete(key); unsListPaint(); }
function unsOnlyFoot(cid, l){
  const s = unsOnly[cid]; if(!KB.CAN_EDIT || !s || !s.size) return KB.CAN_EDIT ? `<div class="hint2" style="font-size:11.5px;margin-top:2px">☑ をつけると、未精算だけを今日精算できます（当日お茶・未精算だけ先に精算する子）</div>` : "";
  const picked = l.filter(x => s.has(x.key)), sum = picked.reduce((a, x) => a + x.amount, 0);
  return `<div class="uonly"><b>💴 未精算だけ精算する</b>（${picked.map(x => UNS_ABC[l.indexOf(x)] || "").join("・")}）　${sum >= 0 ? `<span class="due">💰 投函 ${yen(sum)}</span>` : `<span class="due give">💴 お店から渡す ${yen(-sum)}</span>`}
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px">
      <select id="uo_pl_${cid}">${(typeof PLACES !== "undefined" ? PLACES : ["池袋", "鶯谷", "五反田", "回収"]).map(p => `<option>${p}</option>`).join("")}</select>
      <input type="number" id="uo_dep_${cid}" placeholder="投函した額" style="width:150px">
      <button type="button" class="btn btn-primary btn-sm" onclick="unsOnlySettle('${cid}')">✅ 未精算だけ精算済にする</button></div></div>`;
}
async function unsOnlySettle(cid){
  const l = unsOpen(cid), s = unsOnly[cid] || new Set(), picked = l.filter(x => s.has(x.key)); if(!picked.length) return;
  const sum = picked.reduce((a, x) => a + x.amount, 0), place = $("uo_pl_" + cid).value, dv = $("uo_dep_" + cid).value;
  const dep = dv === "" ? null : Number(dv) || 0, diff = dep != null ? dep - sum : null;
  const labels = picked.map(x => unsLine(x, l.indexOf(x), cid));
  if(!confirm(`${castName(cid)} の未精算だけを精算済にしますか？（${unsMd(day)}・${place}）\n${labels.join("\n")}\n→ 合計 ${sum >= 0 ? "投函 " + yen(sum) : "お店から渡す " + yen(-sum)}` + (diff ? `\n投函した額 ${yen(dep)} → ${diff < 0 ? "足りない " + yen(-diff) + " を未精算に" : "多い " + yen(diff) + " をお釣りに"}` : ""))) return;
  const by = KB.operatorName(), at = new Date().toISOString();
  try{
    for(const x of picked){
      const txt = `${unsMd(day)}に、この日の${x.kind === "day" ? "精算" : "未精算（" + x.what + "）"}を精算しました（未精算だけの精算・合計 ${yen(sum)}・${place}）`;
      if(x.kind === "day"){
        const s2 = { reward: x.raw.c.reward, option: x.raw.c.option, takeHome: x.raw.c.takeHome, total: x.raw.c.total, cardPaid: x.raw.c.cardPaid, drop: x.raw.c.drop, zappi: x.raw.c.zappi, paidOn: day, by, at };
        await unsLogOther(x.date, cid, txt, { settled: true, settled_at: at, settled_by: by, settle_place: place, settle_snapshot: s2 });
      } else {
        q(await sb.from("kb_unsettled").update({ done_on: day, done_by: by, done_at: at }).eq("id", x.raw.id));
        await unsLogOther(x.date, cid, txt);
      }
    }
    if(diff && UNS !== null) q(await sb.from("kb_unsettled").insert({ cast_id: cid, biz_date: day, amount: -diff, source: "auto", created_by: by,
      note: diff < 0 ? "未精算の精算で投函が足りなかった（投函 " + yen(dep) + "／" + yen(sum) + "）" : "未精算の精算で多く投函した（投函 " + yen(dep) + "／" + yen(sum) + "）" }));
    // 今日のこの子の精算の備考にも残す（今日の精算は「精算済」にはしない）
    await unsLogOther(day, cid, `💴 未精算だけ精算しました（${place}）\n${labels.join("／")}\n→ 合計 ${sum >= 0 ? "投函 " + yen(sum) : "お店から渡す " + yen(-sum)}` + (dep != null ? `／投函した額 ${yen(dep)}` : ""));
  }catch(e){ toast("精算できませんでした：" + (e.message || e)); return; }
  delete unsOnly[cid]; toast(`✅ ${castName(cid)} の未精算を精算しました`);
  if(typeof loadDay === "function") await loadDay(); await unsLoad();
}async function unsAdd(){
  const cid = $("un_cast").value, amt = Math.abs(Number($("un_amt").value) || 0), d = $("un_day").value;
  if(!cid || !amt || !d){ toast("キャスト・日付・金額を入れてください"); return; }
  try{ q(await sb.from("kb_unsettled").insert({ cast_id: cid, biz_date: d, amount: amt * Number($("un_kind").value), note: $("un_note").value.trim() || "手で入れた未精算", source: "manual", created_by: KB.operatorName() }));
    toast("未精算を足しました"); await unsLoad(); }
  catch(e){ toast("足せませんでした：" + (e.message || e)); }
}
async function unsDel(uid){
  if(!confirm("この未精算を消しますか？（まちがいで入れたとき。精算したときは、精算の枠でチェックして精算済にしてください）")) return;
  try{ q(await sb.from("kb_unsettled").delete().eq("id", uid)); await unsLoad(); }catch(e){ toast("消せませんでした：" + (e.message || e)); }
}
function unsListPaint(){ const el = document.getElementById("unsList"); if(el) el.innerHTML = unsListHtml(); }
function unsListToggle(){ const el = document.getElementById("unsList"); if(!el) return; el.style.display = el.style.display === "none" ? "" : "none"; unsListPaint(); }
/* ---------- 📜 精算・未精算のログ（月ごと）：処理した日時・内勤（ログイン名）・キャスト・営業日・種類・内容。フィルターつき ---------- */
let SLOG = { ym: "", rows: [], f: { cast: "", day: "", kind: "", by: "", at: "" } };
function slogToggle(){ const el = document.getElementById("slogPanel"); if(!el) return; const on = el.style.display === "none"; el.style.display = on ? "" : "none"; if(on){ if(!SLOG.ym) SLOG.ym = day.slice(0, 7); slogLoad(); } }
async function slogLoad(){
  const el = document.getElementById("slogPanel"); el.innerHTML = `<div class="hint2">読みこみ中…</div>`;
  const ym = SLOG.ym, from = ym + "-01", to = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 1)).toISOString().slice(0, 10);
  const rows = [];
  try{
    const cd = q(await sb.from("kb_cast_days").select("*").gte("biz_date", from).lt("biz_date", to)) || [];
    cd.forEach(d => {
      const l = Array.isArray(d.settle_log) ? d.settle_log : [];
      l.forEach(x => rows.push({ at: x.at, by: x.by || "", cid: d.cast_id, bd: d.biz_date, kind: /取り消/.test(x.text) ? "取消" : /^精算済/.test(x.text) ? "精算" : /未精算/.test(x.text) ? "未精算" : /精算/.test(x.text) ? "精算" : "備考", text: x.text }));
      if(d.settled && !l.some(x => /精算済にしました|精算しました/.test(x.text))) rows.push({ at: d.settled_at, by: d.settled_by || "", cid: d.cast_id, bd: d.biz_date, kind: "精算",
        text: `精算済（${d.settle_place || ""}）` + (d.settle_snapshot ? `　手取り ${yen(d.settle_snapshot.takeHome || 0)}／投函額 ${yen(d.settle_snapshot.drop || 0)}${d.settle_snapshot.paidOn ? "（" + unsMd(d.settle_snapshot.paidOn) + "にまとめて精算）" : ""}` : "") });
    });
    if(UNS !== null){
      const un = q(await sb.from("kb_unsettled").select("*").gte("biz_date", from).lt("biz_date", to)) || [];
      un.forEach(x => rows.push({ at: x.created_at, by: x.created_by || "", cid: x.cast_id, bd: x.biz_date, kind: "未精算",
        text: `未精算が入った：${x.note || ""}（${x.amount >= 0 ? "未精算 " + yen(x.amount) : "お釣り " + yen(-x.amount)}）${x.source === "manual" ? "・手で入れた" : ""}${x.done_on ? `\n→ ${unsMd(x.done_on)} に精算（${x.done_by || ""}）` : ""}` }));
    }
  }catch(e){ el.innerHTML = `<div class="warn">読めませんでした：${esc(e.message || e)}</div>`; return; }
  SLOG.rows = rows.filter(r => r.at).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  slogPaint();
}
function slogPaint(){
  const el = document.getElementById("slogPanel"), f = SLOG.f, R = SLOG.rows;
  const atDay = a => { const d = new Date(a); return isNaN(d) ? "" : new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10); };
  const list = R.filter(r => (!f.cast || r.cid === f.cast) && (!f.day || r.bd === f.day) && (!f.kind || r.kind === f.kind) && (!f.by || r.by === f.by) && (!f.at || atDay(r.at) === f.at));
  const casts = [...new Set(R.map(r => r.cid))].sort((a, b) => castName(a).localeCompare(castName(b), "ja")), bys = [...new Set(R.map(r => r.by).filter(Boolean))];
  const sel = (k, opts, lbl) => `<select onchange="SLOG.f.${k}=this.value;slogPaint()"><option value="">${lbl}</option>${opts.map(([v, l]) => `<option value="${esc(v)}" ${f[k] === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
  el.innerHTML = `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
      <b style="font-size:14px">📜 ログ</b><input type="month" value="${SLOG.ym}" onchange="SLOG.ym=this.value;slogLoad()">
      ${sel("cast", casts.map(c => [c, castName(c)]), "キャスト（全員）")}
      <label style="font-size:12px">営業日 <input type="date" value="${f.day}" onchange="SLOG.f.day=this.value;slogPaint()"></label>
      ${sel("kind", [["精算", "精算"], ["未精算", "未精算"], ["備考", "備考"], ["取消", "取り消し"]], "種類（全部）")}
      ${sel("by", bys.map(b => [b, b]), "内勤（全員）")}
      <label style="font-size:12px">処理した日 <input type="date" value="${f.at}" onchange="SLOG.f.at=this.value;slogPaint()"></label>
      <button type="button" class="btn btn-ghost btn-sm" onclick="SLOG.f={cast:'',day:'',kind:'',by:'',at:''};slogPaint()">クリア</button>
      <small style="color:#9C8B8F">${list.length}件</small></div>
    ${list.length ? `<div style="overflow-x:auto"><table class="slogt"><tr><th>処理した日時</th><th>内勤</th><th>キャスト</th><th>営業日</th><th>種類</th><th>内容</th></tr>
      ${list.map(r => `<tr><td>${logWhen(r.at)}</td><td>${esc(r.by)}</td><td><b>${esc(castName(r.cid))}</b></td><td>${unsMd(r.bd)}</td><td><span class="sk ${r.kind}">${r.kind}</span></td><td style="white-space:pre-wrap">${esc(r.text)}</td></tr>`).join("")}</table></div>`
      : `<div class="hint2">この月のログはありません</div>`}`;
}
document.head.insertAdjacentHTML("beforeend", `<style>
  table.slogt{width:100%;border-collapse:collapse;font-size:13px} table.slogt th{background:#FBF3F6;text-align:left;padding:5px 8px;font-size:12px;color:#9C8B8F;white-space:nowrap}
  table.slogt td{border-top:1px solid #F1E3E7;padding:5px 8px;vertical-align:top} table.slogt td:first-child{white-space:nowrap}
  .sk{display:inline-block;border-radius:99px;padding:1px 8px;font-size:11.5px;font-weight:800;white-space:nowrap} .sk.精算{background:#E6F6EE;color:#1a7f4b} .sk.未精算{background:#F1EAFA;color:#6030aa} .sk.備考{background:#FFF6D6;color:#8a6d00} .sk.取消{background:#FFE8EC;color:#B0213F}
</style>`);// 日付が変わったら読みなおす（どちらのページも day を使う）
let unsDay = "";
setInterval(() => { if(typeof day !== "undefined" && day && day !== unsDay){ unsDay = day; unsLoad(); } }, 800);
document.head.insertAdjacentHTML("beforeend", `<style>
  .unsbox{background:#F6F2FF;border:2px dashed #A98BE6;border-radius:12px;padding:8px 12px;margin:8px 0;font-size:13.5px}
  .unsbox > b{color:#5b3fa6} .unsbox > small{color:#8a7f99;margin-left:4px}
  .ur{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:3px 0} .ur small{color:#8a7f99;font-size:11.5px}
  .ur .ab{display:inline-flex;width:22px;height:22px;border-radius:50%;background:#7b5cd6;color:#fff;align-items:center;justify-content:center;font-size:12px}
  .neg{color:#d9534f} .pos{color:#2f7fd0}
  .ut{margin-top:6px;font-weight:700} .due{display:inline-block;background:#00B0F0;border:2px solid #0A84C6;border-radius:10px;padding:2px 10px;color:#E0001B;font-size:18px;font-weight:900}
  .due.give{background:#E3F1FF;border-color:#2f7fd0;color:#2f7fd0}
  .uhd{font-weight:900;font-size:15px;color:#5b3fa6;margin-bottom:6px} .uhd small{font-weight:600;font-size:11.5px;color:#8a7f99;margin-left:6px}
  .unsc{background:#fff;border:1.5px solid #E4DDF2;border-radius:12px;padding:8px 12px;margin-bottom:8px} .unsc .uh{font-size:14px;margin-bottom:2px}
  .slog{background:#FFFCEB;border:1.5px solid #F2D27A;border-radius:12px;padding:8px 10px;margin:8px 0;font-size:13px}
  .slog > b{color:#8a6d00;margin-right:8px} .slog .sl{background:#fff;border:1px solid #F2D27A;border-radius:8px;padding:5px 8px;margin-top:5px}
  .slog .sl .t{white-space:pre-wrap} .slog .sl .s{font-size:11px;color:#9C8B8F;text-align:right}
  .uonly{background:#FFFBEA;border:2px solid #F2C200;border-radius:10px;padding:8px 10px;margin-top:6px;font-size:13px}
  .pmz{background:#F7FBF4;border:1.5px solid #CFE6C2;border-radius:12px;padding:8px 10px;margin:8px 0} .pmzh{font-weight:800;font-size:13px}
</style>`);

/* ---------- 🧾 精算明細（画像・LINE の文）：精算ページ・記録簿の💴精算 共通（ページの関数を上書き）
   並び：1本目・2本目…（くわしいところ・OP・その仕事の報酬） → 本日の報酬総額・OP総額・雑費・プラマイ
         → 本日の報酬／本日の手取り額 → 本日の投函額
         → 本日＋未精算（合算）A・B・C…（いちばん下が本日精算）→ A＋B＋…＝ → 合計で投函
         → 精算メモ（1営業日に1枚） ---------- */
function settleParts(id){
  const c = calcCast(id), d = new Date(day + "T12:00:00Z");
  const pay = c.reward + c.option - c.zappi;   // 本日の報酬
  const pm = [];
  if(c.transportBack) pm.push(["交通費バック", c.transportBack]);
  c.plusItems.forEach(x => { if(Number(x.amount)) pm.push([x.label || "プラス", Number(x.amount)]); });
  c.minusItems.forEach(x => { if(Number(x.amount)) pm.push([x.label || "マイナス", -Number(x.amount)]); });
  // いっしょに精算する未精算（精算済なら、そのときのもの）
  const cd = unsCD()[id] || {}, snap = cd.settle_snapshot || {};
  let uns = [];
  if(cd.settled && Array.isArray(snap.uns)) uns = snap.uns.map(x => ({ date: x.date, amount: x.amount || 0, label: x.label || "" }));
  else { const sel = unsSel[id] || new Set(), open = unsOpen(id); uns = open.filter(x => sel.has(x.key)).map(x => ({ date: x.date, amount: x.amount, label: unsLine(x, open.indexOf(x), id) })); }
  const due = c.drop + uns.reduce((a, x) => a + x.amount, 0);
  // 合算の行：A・B・C…（未精算・お釣り）、いちばん下が本日精算
  const sum = uns.map(x => ({ date: x.date, kind: x.amount >= 0 ? "未精算" : "お釣り", amount: x.amount }))
    .concat([{ date: day, kind: "本日精算", amount: c.drop }]).map((x, i) => Object.assign(x, { abc: UNS_ABC[i] || String(i + 1) }));
  // 今日はいっしょに精算しない未精算（お知らせとして画像・文に出す）
  const rest = cd.settled ? [] : (() => { const sel = unsSel[id] || new Set(), open = unsOpen(id); return open.filter(x => !sel.has(x.key)).map(x => unsLine(x, open.indexOf(x), id)); })();
  // 精算メモ（1営業日に1枚）
  const memo = [[day, c.drop]]; uns.forEach(x => { const m = memo.find(y => y[0] === x.date); if(m) m[1] += x.amount; else memo.push([x.date, x.amount]); });
  memo.sort((p, q) => String(p[0]).localeCompare(String(q[0])));
  const res = c.all.map((r, i) => {
    const off = r.status === "cancel" || r.status === "tobi";
    const bo = off ? [] : (r.options || []).filter(o => (o.back || 0) > 0);
    const ops = bo.map(o => [`${o.label}${o.qty > 1 ? "×" + o.qty : ""}`, o.back * (o.qty || 1)]);
    const opSum = bo.reduce((a, o) => a + o.back * (o.qty || 1), 0);
    const head = `${hm(r.start_at)} ${storeLabel(r.store_key)} ${r.course}${/^\d+$/.test(r.course) ? "分" : ""}${r.extension_count ? " 延長" + r.extension_count : ""}`;
    const courseBack = off ? 0 : r.back_override != null ? r.back_override : (r.course_back || 0) + (r.extra_back || 0);
    return { no: i + 1, head, off, st: r.status, courseBack, ops, opSum, total: courseBack + opSum };
  });
  return { c, d, pay, pm, uns, sum, due, memo, res, rest };
}
const pmYen = v => (v >= 0 ? "＋" : "−") + yen(Math.abs(v));
// A＋B−C＋D＝ と 15,000＋13,000−2,000＋…＝
const sumFx = P => {
  const sg = (x, i) => i ? (x.amount >= 0 ? "＋" : "−") : x.amount < 0 ? "−" : "";
  return [P.sum.map((x, i) => sg(x, i) + x.abc).join("") + "＝", P.sum.map((x, i) => sg(x, i) + Math.abs(x.amount).toLocaleString("ja-JP")).join("") + "＝"];
};
// 投函額のひっ算：総額 − カード払い − 手取り ＝ 投函額（マイナスならお店から渡す）
const dropCalc = c => {
  const a = [["本日の総額（お客さんが払った額）", yen(c.total)]];
  if(c.cardPaid) a.push(["カード払い（お店に入るので手元にない）", "−" + yen(c.cardPaid)]);
  a.push(["本日の手取り額", "−" + yen(c.takeHome)]);
  return { rows: a, res: c.drop >= 0 ? ["本日の投函額", yen(c.drop)] : ["お店から渡す（足りない分）", yen(-c.drop)],
    why: c.drop < 0 ? `カード払いの分はお店に入るため、手元の現金が手取り額より ${yen(-c.drop)} 足りません。その分をお店から渡します` : "" };
};
copyDetail = function(id){
  const P = settleParts(id), c = P.c, d = P.d;
  const lines = [`【精算】${d.getUTCMonth() + 1}/${d.getUTCDate()}(${DOW[d.getUTCDay()]}) ${castName(id)}さん`];
  P.res.forEach(r => {
    lines.push("", `■ ${r.no}本目　${r.head}`);
    if(r.off){ lines.push(`　${r.st === "cancel" ? "キャンセル" : "トビ"}（報酬なし）`); return; }
    lines.push(`　コース報酬　${yen(r.courseBack)}`);
    r.ops.forEach(o => lines.push(`　OP：${o[0]}　＋${yen(o[1])}`));
    lines.push(`　▶ この仕事の報酬（OP込み）　${yen(r.total)}`);
  });
  lines.push("", "――――――――――", `本日の報酬総額　${yen(c.reward)}`, `本日のOP総額　${yen(c.option)}`, `雑費　−${yen(c.zappi)}`);
  P.pm.forEach(([l, v]) => lines.push(`${l}　${pmYen(v)}`));
  lines.push("――――――――――", `▶ 本日の報酬／本日の手取り額　${yen(P.pay)}／${yen(c.takeHome)}`);
  { const dc = dropCalc(c); lines.push("", "【投函額の計算】"); dc.rows.forEach(x => lines.push(`${x[0]}　${x[1]}`)); lines.push(`＝ ${dc.res[0]}　${dc.res[1]}`); if(dc.why) lines.push(dc.why); }
  lines.push(c.drop >= 0 ? `💰 本日の投函額　${yen(c.drop)}` : `💴 お店からキャストに渡す　${yen(-c.drop)}`);
  if(P.uns.length){
    lines.push("――――――――――", "【本日＋未精算（合算）】");
    P.sum.forEach(x => lines.push(`${x.abc}　${unsMd(x.date)}　${x.kind}　${x.amount < 0 ? "−" : ""}${yen(Math.abs(x.amount))}`));
    const fx = sumFx(P); lines.push(fx[0], fx[1]);
    lines.push(P.due >= 0 ? `💰 合計で投函　${yen(P.due)}` : `💴 お店から渡す　${yen(-P.due)}`);
  }
  if(P.rest.length){ lines.push("", "【のこりの未精算（今日は精算しない）】"); P.rest.forEach(x => lines.push(x)); }
  lines.push("", `📝 精算メモに書くこと（1営業日に1枚・${P.memo.length}枚）`);
  P.memo.forEach(([bd, v]) => lines.push(`　営業日 ${unsMd(bd)}／名前 ${castName(id)}／金額 ${v >= 0 ? yen(v) : "（お店から渡す " + yen(-v) + "）"}`));
  lines.push("📖 投函のしかた：https://sakuramoong-app.github.io/portal/kirokubo/posting.html", "", "お疲れさまでした🌸");
  navigator.clipboard.writeText(lines.join("\n")).then(() => toast("📋 精算明細をコピーしました"), () => alert(lines.join("\n")));
};
settleCanvas = function(id){
  const P = settleParts(id), c = P.c, d = P.d;
  const S = 2, W = 560, PAD = 28, FONT = '"Hiragino Maru Gothic ProN","M PLUS Rounded 1c","Yu Gothic","Meiryo",sans-serif';
  // 描くもの： [種類, ...]。高さを先に数える
  const ops = [];
  P.res.forEach(r => {
    ops.push(["job", `${r.no}本目`, r.head, r.off ? (r.st === "cancel" ? "キャンセル" : "トビ") : "", r.off]);
    if(r.off) return;
    ops.push(["jrow", "コース報酬", yen(r.courseBack)]);
    r.ops.forEach(o => ops.push(["jrow", "OP：" + o[0], "＋" + yen(o[1]), "op"]));
    ops.push(["jsum", "この仕事の報酬（OP込み）", yen(r.total)]);
  });
  ops.push(["line"], ["row", "本日の報酬総額", yen(c.reward)], ["row", "本日のOP総額", yen(c.option)], ["row", "雑費", "−" + yen(c.zappi)]);
  P.pm.forEach(([l, v]) => ops.push(["row", l, pmYen(v)]));
  ops.push(["line"], ["pbox", "本日の報酬 ／ 本日の手取り額", yen(P.pay) + " ／ " + yen(c.takeHome)]);
  { const dc = dropCalc(c); ops.push(["head3", "🧮 投函額の計算"]); dc.rows.forEach(x => ops.push(["jrow", x[0], x[1], x[1][0] === "−" ? "minus" : ""])); ops.push(["jsum", "＝ " + dc.res[0], dc.res[1], c.drop < 0 ? "give" : ""]); if(dc.why) ops.push(["why", dc.why]); }
  ops.push(["box", c.drop, "💰 本日の投函額（封筒に入れて投函）", "💴 お店からキャストに渡す"]);
  if(P.uns.length){
    ops.push(["line"], ["head", "📒 本日＋未精算（合算）"]);
    P.sum.forEach(x => ops.push(["abc", x.abc, unsMd(x.date), x.kind, (x.amount < 0 ? "−" : "") + yen(Math.abs(x.amount))]));
    const fx = sumFx(P); ops.push(["fx", fx[0], fx[1]]);
    ops.push(["box", P.due, "💰 合計で投函", "💴 お店から渡す（合計）"]);
  }
  if(P.rest.length){ ops.push(["head2", "📒 のこりの未精算（今日は精算しない）"]); P.rest.forEach(x => ops.push(["sub2", x])); }
  ops.push(["memo"]);
  const hOf = o => ({ head3: 34, why: 46, job: 40, jrow: 26, jsum: 30, abc: 32, pbox: 92, fx: 58, box: 112, row: 30, sub: 22, sub2: 24, line: 20, head: 40, head2: 40, memo: 46 + (1 + P.memo.length) * 30 })[o[0]] || 30;
  const H = 88 + ops.reduce((a, o) => a + hOf(o), 0) + 56;
  const cv = document.createElement("canvas"); cv.width = W * S; cv.height = H * S;
  const g = cv.getContext("2d"); g.scale(S, S);
  g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
  const grd = g.createLinearGradient(0, 0, W, 0); grd.addColorStop(0, "#ff9fb8"); grd.addColorStop(1, "#e5638c");
  g.fillStyle = grd; g.fillRect(0, 0, W, 72);
  g.fillStyle = "#fff"; g.textAlign = "left"; g.font = `bold 15px ${FONT}`; g.fillText(`精算　${d.getUTCMonth() + 1}/${d.getUTCDate()}(${DOW[d.getUTCDay()]})`, PAD, 28);
  g.font = `bold 24px ${FONT}`; g.fillText(`${castName(id)}さん`, PAD, 58);
  let y = 84;
  const txt = (s, x, yy, font, color, align) => { g.font = `${font} ${FONT}`; g.fillStyle = color; g.textAlign = align || "left"; g.fillText(s, x, yy); };
  const fit = (s, max, font) => { g.font = `${font} ${FONT}`; if(g.measureText(s).width <= max) return s; while(s.length > 1 && g.measureText(s + "…").width > max) s = s.slice(0, -1); return s + "…"; };
  const rbox = (x, yy, w, h, r, fill, stroke, lw) => { g.fillStyle = fill; g.strokeStyle = stroke; g.lineWidth = lw; g.beginPath(); g.roundRect ? g.roundRect(x, yy, w, h, r) : g.rect(x, yy, w, h); g.fill(); g.stroke(); };
  ops.forEach(o => {
    const h = hOf(o), k = o[0];
    if(k === "box"){
      const give = o[1] < 0;
      rbox(PAD, y + 4, W - PAD * 2, h - 12, 14, give ? "#E3F1FF" : "#00B0F0", give ? "#2f7fd0" : "#0A84C6", 3);
      txt(give ? o[3] : o[2], PAD + 16, y + 34, "bold 17px", give ? "#1f4f80" : "#08304d");
      txt(yen(Math.abs(o[1])), W - PAD - 16, y + 92, "900 42px", give ? "#2f7fd0" : "#E0001B", "right");
    } else if(k === "job"){   // 1本目：ラベル＋くわしいところ
      rbox(PAD, y + 8, 64, 26, 8, o[4] ? "#EEE8EA" : "#e5638c", o[4] ? "#EEE8EA" : "#e5638c", 1);
      txt(o[1], PAD + 32, y + 27, "bold 14px", o[4] ? "#9C8B8F" : "#fff", "center");
      txt(fit(o[2], W - PAD * 2 - 170, "bold 15px"), PAD + 74, y + 27, "bold 15px", o[4] ? "#B9A9AD" : "#5C4B4F");
      if(o[3]) txt(o[3], W - PAD, y + 27, "bold 15px", "#B9A9AD", "right");
    } else if(k === "jrow"){   // ひっ算の行：金額は右にそろえる
      const col = o[3] === "op" ? "#8a6d00" : "#5C4B4F";
      txt(fit(o[1], W - PAD * 2 - 150, "14px"), PAD + 18, y + 18, "14px", col); txt(o[2], W - PAD, y + 18, "bold 15px", col, "right");
    } else if(k === "jsum"){   // ひっ算の線と答え
      g.strokeStyle = "#5C4B4F"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(W - PAD - 150, y + 4); g.lineTo(W - PAD, y + 4); g.stroke();
      txt((o[1][0] === "＝" ? "" : "▶ ") + o[1], PAD + 18, y + 22, "bold 14.5px", o[3] === "give" ? "#1f4f80" : "#6b3550"); txt(o[2], W - PAD, y + 22, "bold 16px", o[3] === "give" ? "#2f7fd0" : "#e5638c", "right");
    } else if(k === "head3"){
      txt(o[1], PAD, y + 24, "bold 15px", "#5C4B4F");
    } else if(k === "why"){   // 2行まで折り返し
      g.font = `bold 13px ${FONT}`; const mx = W - PAD * 2 - 24; let s = o[1], l1 = s;
      while(g.measureText(l1).width > mx) l1 = l1.slice(0, -1);
      rbox(PAD + 6, y + 4, W - PAD * 2 - 6, h - 8, 8, "#E3F1FF", "#E3F1FF", 1);
      txt(l1, PAD + 16, y + 21, "bold 13px", "#1f4f80"); txt(fit(s.slice(l1.length), mx, "bold 13px"), PAD + 16, y + 37, "bold 13px", "#1f4f80");
    } else if(k === "row"){
      txt(fit(o[1], W - PAD * 2 - 130, "bold 16px"), PAD, y + 21, "bold 16px", "#5C4B4F");
      txt(o[2], W - PAD, y + 21, "bold 16px", "#5C4B4F", "right");
    } else if(k === "sub" || k === "sub2"){
      txt(fit(o[1], W - PAD * 2 - 20, k === "sub" ? "13px" : "bold 13.5px"), PAD + 18, y + 16, k === "sub" ? "13px" : "bold 13.5px", k === "sub" ? "#8a6d00" : "#5b3fa6");
    } else if(k === "line"){
      g.strokeStyle = "#C9A9B5"; g.lineWidth = 1.5; g.setLineDash([6, 4]); g.beginPath(); g.moveTo(PAD, y + 10); g.lineTo(W - PAD, y + 10); g.stroke(); g.setLineDash([]);
    } else if(k === "pbox"){   // 本日の報酬／手取り：ピンクの枠
      rbox(PAD, y + 6, W - PAD * 2, h - 12, 12, "#FFE3F0", "#F7B6CF", 2.5);
      txt(o[1], PAD + 14, y + 34, "bold 16px", "#6b3550"); txt(o[2], W - PAD - 14, y + 70, "bold 26px", "#e5638c", "right");
    } else if(k === "abc"){   // A　10/27　未精算　¥15,000
      const today = o[3] === "本日精算";
      rbox(PAD, y + 5, 28, 24, 6, today ? "#5b3fa6" : "#F1EAFA", today ? "#5b3fa6" : "#C9B6EA", 1.2);
      txt(o[1], PAD + 14, y + 23, "bold 15px", today ? "#fff" : "#5b3fa6", "center");
      txt(o[2], PAD + 42, y + 23, "bold 15px", "#5C4B4F"); txt(o[3], PAD + 110, y + 23, "bold 15px", today ? "#5b3fa6" : o[3] === "お釣り" ? "#2f7fd0" : "#c0392b");
      txt(o[4], W - PAD, y + 23, "bold 16px", "#5C4B4F", "right");
    } else if(k === "fx"){
      txt(o[1], PAD, y + 22, "bold 16px", "#5b3fa6");
      txt(fit(o[2], W - PAD * 2, "bold 18px"), W - PAD, y + 48, "bold 18px", "#5C4B4F", "right");
    } else if(k === "head2"){
      g.fillStyle = "#F4F1F6"; g.fillRect(PAD - 6, y + 8, W - PAD * 2 + 12, 28); txt(o[1], PAD, y + 28, "bold 15px", "#8a7f99");
    } else if(k === "head"){
      g.fillStyle = "#F1EAFA"; g.fillRect(PAD - 6, y + 8, W - PAD * 2 + 12, 28); txt(o[1], PAD, y + 28, "bold 16px", "#5b3fa6");
    } else if(k === "memo"){
      txt(`📝 精算メモに書くこと（1営業日に1枚・${P.memo.length}枚）`, PAD, y + 22, "bold 15px", "#5C4B4F");
      const tx = PAD, ty = y + 32, cw = [120, 170, W - PAD * 2 - 290], rh = 30, hd = ["営業日", "名前", "金額"];
      g.strokeStyle = "#333"; g.lineWidth = 1.5;
      const rowsM = [hd].concat(P.memo.map(([bd, v]) => [unsMd(bd), castName(id), v >= 0 ? "¥" + v.toLocaleString("ja-JP") : "（渡す " + yen(-v) + "）"]));
      rowsM.forEach((rw, ri) => { let x = tx; cw.forEach((w, i) => { g.strokeRect(x, ty + ri * rh, w, rh); txt(rw[i], x + w / 2, ty + ri * rh + 21, ri ? "bold 16px" : "14px", ri ? "#1a3a8a" : "#333", "center"); x += w; }); });
    }
    y += h;
  });
  txt("お疲れさまでした🌸", W / 2, y + 30, "bold 15px", "#e5638c", "center");
  return cv;
};
