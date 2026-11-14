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
let HAS_SLOG = false, SLOG_ERR = "";   // kb_cast_days.settle_log（SQL 167）があるか
Promise.resolve(sb.from("kb_cast_days").select("settle_log").limit(1)).then(r => { HAS_SLOG = HAS_SLOG || (!!r && !r.error); }).catch(() => {});             // ① 精算していない日 [{ date, cid, c（その日の精算の計算）, cd }]
let HAS_170 = false;  // kb_cast_days.direct_home・camera_check と kb_envelope_checks（SQL 170）があるか
const P170 = Promise.resolve(sb.from("kb_cast_days").select("direct_home,camera_check").limit(1)).then(r => { HAS_170 = HAS_170 || (!!r && !r.error); }).catch(() => {});
const unsSel = {};         // cast_id → Set（今日いっしょに精算するもののキー）
const UNS_ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ", UNS_DAYS = 60;
const unsMd = d => { const p = String(d || "").split("-"); return p.length === 3 ? Number(p[1]) + "/" + Number(p[2]) : ""; };
const unsCD = () => (typeof castDays !== "undefined" ? castDays : days);

/* ---------- ② 先精算のあとの追加の精算（2026/11/4）
   ・精算済にしたとき、その精算に入れた予約（resIds）を覚えておく。いくつか精算したら settle_snapshot.parts に①②…が並び、上の数字は合計
   ・精算済のあとで予約がふえたら「②の精算をはじめる」→ ふえた予約だけで計算して、もう一度精算済に（回収明細・集計は ①＋② の合計）
   ・前の版の精算（resIds がない）は、精算した時刻より前に作った予約を ① とみなす ---------- */
const PART_SUM_KEYS = ["reward", "option", "transportBack", "plus", "zappi", "minus", "takeHome", "total", "cardPaid", "drop", "withholding", "shopDrop", "realDrop", "deposited", "transferPaid", "due"];
const PART_MARK = "①②③④⑤⑥";
// エクセルから取りこんだ日（settled_by＝エクセル）は精算済だが、精算のときの記録（settle_snapshot）がない → その日の予約はぜんぶ精算したものとする（2026/11/6 10月の取りこみで未精算に出ていた）
function kbSnapParts(cd){ const s = cd && cd.settle_snapshot; if(!s) return cd && cd.settled ? [{}] : []; if(Array.isArray(s.parts)) return s.parts; return cd.settled ? [s] : []; }
function kbPartIds(cd, all, parts){
  const ids = new Set();
  (parts || kbSnapParts(cd)).forEach(p => {
    if(Array.isArray(p.resIds)) p.resIds.forEach(i => ids.add(i));
    // ② ができる前（11/4より前）の精算は、どの予約を精算したか残っていない → その日の予約はぜんぶ精算したものとする
    //   （あとから手で入れた予約は、作った時刻が精算より後になるので、時刻では分けられない。11/1 ムム：雑費が 0円になっていた）
    else all.forEach(r => ids.add(r.id));
  });
  return ids;
}
function kbSumParts(parts){
  const s = { parts };
  PART_SUM_KEYS.forEach(k => { const vals = parts.map(p => p[k]).filter(v => v != null); s[k] = vals.length ? vals.reduce((a, v) => a + (Number(v) || 0), 0) : null; });
  const last = parts[parts.length - 1] || {};
  ["by", "at", "paidOn"].forEach(k => { if(last[k] != null) s[k] = last[k]; });
  s.uns = parts.flatMap(p => p.uns || []); s.trIds = parts.flatMap(p => p.trIds || []); s.resIds = parts.flatMap(p => p.resIds || []);
  return s;
}
// 精算済なのに、そのあとでふえた予約（キャンセル・トビは数えない）
function kbPendingAfterSettle(cd, all){
  if(!cd || !cd.settled) return [];
  const ids = kbPartIds(cd, all);
  return all.filter(r => r.status !== "cancel" && r.status !== "tobi" && r.status !== "flowed" && !ids.has(r.id));
}
async function startNextPart(id){
  const cd = unsCD()[id] || {}, all = (typeof rows !== "undefined" ? rows : []).filter(r => r.cast_id === id);
  const pend = kbPendingAfterSettle(cd, all); if(!pend.length){ toast("ふえた予約はありません"); return; }
  const parts = kbSnapParts(cd).map(p => Array.isArray(p.resIds) ? p : Object.assign({}, p, { resIds: [...kbPartIds(cd, all, [p])] }));
  const mk = PART_MARK[parts.length] || "次";
  if(!confirm(`${castName(id)}：精算済のあとでふえた予約 ${pend.length}件を「${mk}」として精算します。よろしいですか？\n（前の精算はそのまま残ります）`)) return;
  const logs = (Array.isArray(cd.settle_log) ? cd.settle_log : []).concat([{ at: new Date().toISOString(), by: KB.operatorName(), text: `「${mk}」の精算をはじめました（ふえた予約 ${pend.length}件）` }]);
  await saveDay(id, Object.assign({ settled: false, settled_at: null, deposited: null, settle_snapshot: { parts } }, HAS_SLOG ? { settle_log: logs } : {}));
  await unsLoad();
}
/* ---------- ✅ 精算する予約を選ぶ（予約①〜⑥にチェック。2026/11/4）
   ・チェックはさいしょから入っている。チェックを外した予約は、今日は精算しない（あとで未精算として精算できる）
   ・精算済にした予約はグレー。そのあとでふえた予約には、またチェックが入る ---------- */
const settleSkip = {};   // "営業日|キャストID" → 今日は精算しない予約の id の Set
function settlePick(id, rid, on){
  const k = day + "|" + id, s = settleSkip[k] = settleSkip[k] || new Set();
  if(on) s.delete(rid); else s.add(rid);
  unsRedraw(id);
}
function resPickHtml(id, c){
  const cd = c.cd || {}, all = (c.all || []).filter(r => r.status !== "cancel" && r.status !== "tobi" && r.status !== "flowed").sort((a, b) => String(a.start_at).localeCompare(String(b.start_at)));
  if(!all.length) return "";
  const parts = kbSnapParts(cd), ids = parts.length ? kbPartIds(cd, c.all, parts) : new Set();
  const partOf = rid => { for(let i = 0; i < parts.length; i++){ const p = parts[i]; if(Array.isArray(p.resIds) ? p.resIds.includes(rid) : ids.has(rid)) return i; } return -1; };
  const skip = settleSkip[day + "|" + id] || new Set(), ed = KB.CAN_EDIT;
  const t = r => typeof hm === "function" ? hm(r.start_at) : "";
  const rowsH = all.map((r, i) => {
    const no = "予約" + ("①②③④⑤⑥⑦⑧⑨⑩"[i] || "(" + (i + 1) + ")"), pi = partOf(r.id);
    const txt = `<b>${no}</b> ${esc(t(r))} ${esc(r.course || "")}${/^\d+$/.test(r.course || "") ? "分" : ""} ${yen(r.total || 0)}${r.payment !== "cash" ? "（カード）" : Number(r.card_total) > 0 ? "（現金＋カード）" : ""}`;
    if(pi >= 0) return `<label class="rp done"><input type="checkbox" checked disabled> ${txt}<span class="rpst">✅ ${PART_MARK[pi] || ""}で精算済</span></label>`;
    return `<label class="rp ${skip.has(r.id) ? "skip" : ""}"><input type="checkbox" ${skip.has(r.id) ? "" : "checked"} ${ed ? "" : "disabled"} onchange="settlePick('${id}',${r.id},this.checked)"> ${txt}${skip.has(r.id) ? `<span class="rpst">今日は精算しない（あとで未精算に）</span>` : ""}</label>`;
  }).join("");
  const pend = all.filter(r => partOf(r.id) < 0);
  const head = parts.length && pend.length ? `「${PART_MARK[parts.length] || "次"}」の精算：チェックした予約だけ精算します` : pend.length ? "チェックした予約だけ精算します（外した予約は、今日は精算しない＝あとで未精算に）" : "全部の予約を精算済にしました";
  return `<div class="rpick"><div class="rph">✅ 精算する予約　<small>${head}</small></div>${rowsH}</div>`;
}
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
  // 読みこんだ直後（ログインの確認の前）に調べると失敗することがあるので、ここでもう一度（履歴・直帰・カメラの欄）
  if(!HAS_SLOG){ try{ const r = await sb.from("kb_cast_days").select("settle_log").limit(1); HAS_SLOG = !r.error; SLOG_ERR = r.error ? (r.error.message || String(r.error)) : ""; }catch(e){ SLOG_ERR = String(e && e.message || e); } }
  if(!HAS_170){ try{ const r = await sb.from("kb_cast_days").select("direct_home,camera_check").limit(1); HAS_170 = !r.error; }catch(e){} }
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
      [...new Set(list.filter(x => !["cancel", "tobi", "flowed"].includes(x.status)).map(x => x.cast_id))].forEach(cid => {
        const cd = cds.find(x => x.biz_date === d && x.cast_id === cid);
        if(cd && cd.settled && !kbPendingAfterSettle(cd, list.filter(x => x.cast_id === cid)).length) return;   // 精算済でも、のこした予約（今日は精算しない）があれば未精算
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
    what: (x.note || (x.amount >= 0 ? "投函が足りなかった" : "多く投函した")) + (x.amount > 0 ? `（未精算 ${yen(x.amount)}）` : x.amount < 0 ? `（お釣り ${yen(-x.amount)}）` : "（金額なし）") }));
  return a.concat(b).sort((p, q) => String(p.date).localeCompare(String(q.date)) || (p.kind === "day" ? -1 : 1));
}
// その日の、そのキャストの精算の枠へ（新しいタブ）
const unsJump = (d, cid) => `<a class="ujump" href="settle.html?d=${d}&c=${encodeURIComponent(cid)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">↗ ${unsMd(d)}の枠へ</a>`;
const unsLine = (x, i, cid) => `${UNS_ABC[i] || i + 1}　${unsMd(x.date)}（${castName(cid)}）${x.what}`;
function unsToggle(id, key, on){ const s = unsSel[id] = unsSel[id] || new Set(); if(on) s.add(key); else s.delete(key); unsRedraw(id); }

// キャストの精算の枠の中の「📒 未精算」
function unsBoxHtml(id, c){
  const done = !!(unsCD()[id] || {}).settled, open = unsOpen(id);
  const today = (UNS || []).filter(x => x.cast_id === id && x.done_on === day);
  if(done){
    const snapU = ((unsCD()[id] || {}).settle_snapshot || {}).uns || [];
    const rest = open.length ? `<div class="hint2" style="font-size:12px">⚠️ のこりの未精算 ${open.length}件は、つぎの精算で：</div>${open.map(x => `<div class="ur">・<b>${unsMd(x.date)}</b> <span class="${x.amount >= 0 ? "neg" : "pos"}">${esc(x.what)}</span>${x.date !== day ? unsJump(x.date, id) : ""}</div>`).join("")}` : "";
    if(!snapU.length && !today.length) return open.length ? `<div class="unsbox"><b>📒 未精算</b>${rest}</div>` : "";
    return `<div class="unsbox"><b>📒 この日いっしょに精算した未精算</b>
      ${snapU.map(x => `<div class="ur">✅ ${esc(x.label || (unsMd(x.date) + " " + yen(x.amount)))}${x.date && x.date !== day ? unsJump(x.date, id) : ""}</div>`).join("")}
      <div class="ut">当日の投函額 ${yen(c.drop)} ＋ 未精算 ${yen(snapU.reduce((a, x) => a + (x.amount || 0), 0))} ＝ <b>${yen(((unsCD()[id] || {}).settle_snapshot || {}).due ?? c.drop)}</b></div>${rest}</div>`;
  }
  if(!open.length) return "";
  const sel = unsSel[id] || new Set(), picked = open.filter(x => sel.has(x.key)), due = c.drop + picked.reduce((a, x) => a + x.amount, 0);
  return `<div class="unsbox"><b>📒 未精算 ${open.length}件</b><small>（今日いっしょに精算するものにチェック。当日の精算明細はそのまま）</small>
    ${open.map((x, i) => `<label class="ur"><input type="checkbox" ${sel.has(x.key) ? "checked" : ""} ${KB.CAN_EDIT ? "" : "disabled"} onchange="unsToggle('${id}','${x.key}',this.checked)">
      <b class="ab">${UNS_ABC[i] || i + 1}</b> <b>${unsMd(x.date)}</b>（${esc(castName(id))}）<span class="${x.amount >= 0 ? "neg" : "pos"}">${esc(x.what)}</span>${unsJump(x.date, id)}</label>`).join("")}
    ${picked.length ? `<div class="ut">当日の投函額 ${yen(c.drop)}${picked.map(x => (x.amount >= 0 ? " ＋ " : " − ") + yen(Math.abs(x.amount))).join("")} ＝
        ${due >= 0 ? `<span class="due">💰 合計で投函 ${yen(due)}</span>` : `<span class="due give">💴 お店から渡す ${yen(-due)}</span>`}</div>
      <div class="unsexact">⚠️ 未精算を合算します。お釣りが発生しないように、<b>ちょうど ${yen(Math.abs(due))}</b> で${due >= 0 ? "投函" : "お渡し"}してください<br><small>投函した額をちょうどで入れないと、精算済にできません</small></div>
      <div class="hint2" style="font-size:11.5px">「精算済にする」で、チェックしたものも精算になります（のこりは A から繰り上げ）。投函した額は、この合計と比べます。</div>` : `<div class="hint2" style="font-size:11.5px">チェックしないものは、つぎの精算にのこります</div>`}
    </div>`;
}
function unsCopy(id){
  const c = calcCast(id), sel = unsSel[id] || new Set(), open = unsOpen(id), picked = open.filter(x => sel.has(x.key));
  const lines = [`【未精算】${castName(id)}さん`, ""];
  open.forEach((x, i) => lines.push(unsLine(x, i, id) + (sel.has(x.key) ? "　→ 今日いっしょに精算" : "　→ 後日")));
  const due = c.drop + picked.reduce((a, x) => a + x.amount, 0);
  lines.push("", `当日の投函額 ${yen(c.drop)}${picked.map(x => (x.amount >= 0 ? " ＋ " : " − ") + yen(Math.abs(x.amount))).join("")}`, due >= 0 ? `合計で投函　${yen(due)}` : `お店から渡す　${yen(-due)}`);
  // キャストにも：合算するときは、ちょうどで（2026/11/14 店長）
  if(picked.length) lines.push("", "※未精算を合算します。お釣りが発生しないように、ちょうどの額で投函をお願いします");
  navigator.clipboard.writeText(lines.join("\n")).then(() => toast("📋 未精算をコピーしました"), () => alert(lines.join("\n")));
}

// 📜 精算の履歴（kb_cast_days.settle_log。SQL 167）。上書きしないで足していく
//   { at（実際の時刻）, by（対応した内勤）, kind, place, amount, cam（'ok'|'ng'|''）, cam_at（カメラを見た時刻）, text }
//   精算済にする・未精算をいっしょに精算・回収明細の回収サイン でも自動で1行入る
const logWhen = at => { const d = new Date(at); return isNaN(d) ? "" : (d.getMonth() + 1) + "/" + d.getDate() + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
const SLOG_KINDS = { post: "📮 当日ポスティング", late: "💴 未精算を精算", receipt: "🧾 領収書だけ投函", collect: "👛 回収", change: "💴 お釣りを渡した", settle: "✅ 精算済", uns: "⚠️ 未精算にした", memo: "📝 メモ" };
// ⚠️ あとで対応が必要（精算済のあとに起きたこと）→ 未精算（kb_unsettled）にする。あとは未精算と同じ流れで精算する
// 🔔 次の出勤日に知らせる（SQL 210）：知らせない／出勤時刻／退勤時刻
const ALERT_AT = { "": "🔔 知らせない", in: "🔔 次の出勤日の出勤時刻に知らせる", out: "🔔 次の出勤日の退勤時刻に知らせる" };
const alertBox = idAttr => `<select class="unalert" id="${idAttr}">${Object.entries(ALERT_AT).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select>`;
// 時刻（HH:MM）→ その営業日の日時（朝6時より前は次の日）
function bizTimeAt(v){
  if(!/^\d{2}:\d{2}$/.test(v || "")) return "";
  const d = new Date(day + "T" + v + ":00+09:00"); if(Number(v.slice(0, 2)) < 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}
function slogLine(x){
  const head = x.kind ? `<b>${esc(SLOG_KINDS[x.kind] || x.kind)}</b>${x.place ? `（${esc(x.place)}）` : ""}${x.amount ? ` ${yen(x.amount)}` : ""}` : "";
  const cam = x.cam === "ok" ? `📹◎${x.cam_at ? " " + logWhen(x.cam_at) + "確認" : ""}` : x.cam === "ng" ? "📹×" : "";
  return `<div class="sl"><div class="t"><span class="sw">${logWhen(x.at)}</span> ${head}${head && x.text ? "<br>" : ""}${esc(x.text || "")}</div><div class="s">${KBF.staffTag(x.by)}${cam ? "　" + cam : ""}</div></div>`;
}
function settleLogHtml(id){
  const cd = unsCD()[id] || {};
  if(!HAS_SLOG) return `<div class="slog"><b>📜 精算の履歴</b><div class="hint2" style="font-size:12px">履歴の欄を読めませんでした（${esc(SLOG_ERR || "確認中…")}）。SQL 167 が実行されているか確認してください</div></div>`;
  const l = (Array.isArray(cd.settle_log) ? cd.settle_log : []).slice().sort((a, b) => String(a.at).localeCompare(String(b.at)));
  return `<div class="slog"><b>📜 精算の履歴</b><small style="color:#9C8B8F">（自動で残ります。上書きしません）</small>
    ${KB.CAN_EDIT ? `<button type="button" class="btn btn-ghost btn-sm" style="margin-left:6px" onclick="settleLogAdd('${id}')">📝 メモを書く</button>` : ""}
    ${l.length ? l.map(slogLine).join("") : `<div class="hint2" style="font-size:12px">まだありません</div>`}
  </div>`;   // 「⚠️ あとで対応が必要」は 11/5 にやめた（📒 未精算のキャストの「＋ 未精算を手で足す」で入れる）
}
async function settleLogAdd(id){
  const v = prompt("メモ（あとから見てわかるように）"); if(!v || !v.trim()) return;
  const cd = unsCD()[id] || {}, l = (Array.isArray(cd.settle_log) ? cd.settle_log : []).concat([{ at: new Date().toISOString(), by: KB.operatorName(), kind: "memo", text: v.trim() }]);
  await saveDay(id, { settle_log: l });
}
// ほかの日の精算に、備考を足す（未精算をいっしょに精算したとき）
async function unsLogOther(date, cid, text, extra, meta){
  if(!HAS_SLOG){ if(extra) q(await sb.from("kb_cast_days").upsert(Object.assign({ biz_date: date, cast_id: cid, updated_at: new Date().toISOString(), updated_by: KB.operatorName() }, extra), { onConflict: "biz_date,cast_id" })); return; }
  const r = await sb.from("kb_cast_days").select("settle_log").eq("biz_date", date).eq("cast_id", cid).maybeSingle();
  const l = ((r.data && Array.isArray(r.data.settle_log)) ? r.data.settle_log : []).concat([Object.assign({ at: new Date().toISOString(), by: KB.operatorName(), text }, meta || {})]);
  q(await sb.from("kb_cast_days").upsert(Object.assign({ biz_date: date, cast_id: cid, settle_log: l, updated_at: new Date().toISOString(), updated_by: KB.operatorName() }, extra || {}), { onConflict: "biz_date,cast_id" }));
}

// 🕒 実際に投函した時刻（カメラのアーカイブで見た時刻）。入れてあれば、精算の時刻はこちらで残す。朝6時より前は営業日の次の日
const ptVal = {}, ptDay = {}, ptBy = {};   // 精算した時刻・日付・人（あとから入れるとき。2026/11/5）
function ptAt(id){
  const v = ptVal[id], d = ptDay[id] || day;
  if(d === day || !/^\d{2}:\d{2}$/.test(v || "")) return bizTimeAt(v);   // 営業日の日なら、朝6時より前は次の日
  return new Date(d + "T" + v + ":00+09:00").toISOString();
}
// 精算した人のえらぶ一覧（内勤）。今ログインしている人がいちばん上
function ptStaff(){ const me = KB.operatorName(); return [...new Set([me].concat(["きゃ", "すや", "らん", "かみ", "わか"]).filter(Boolean))]; }
// 精算済にする：チェックした未精算もいっしょに。投函した額が合わなければ、新しい未精算（お釣り）を入れる
settle = async function(id, stay){   // stay：精算して、そのあとも待機中のまま（1本だけ先に精算。2026/11/6）
  // 📷 ポスティング（池袋・鶯谷・五反田）は、写真を入れるか「写真なし（キャストがくれなかった）」を選ばないと精算済にできない（2026/11/4 店長の希望）
  const pl0 = document.getElementById("pl-" + id), place0 = pl0 ? pl0.value : "", phList = phCache[phKey(id)];
  if(place0 && !noPhoto[id] && !(phList && phList.length)){   // 写真は回収も必須（2026/11/6）
    toast(phList === null ? "📷 写真を読みこみ中です。少し待ってから、もう一度押してください"
      : "📷 お金・領収書の写真を入れるか、「写真なし（キャストがくれなかった）」にチェックしてから精算済にしてください");
    const w = document.getElementById("ph-" + id); if(w) w.scrollIntoView({ block: "center", behavior: "smooth" });
    return;
  }
  // 📹 ポスティングは、監視カメラで投函を確認するのも必須
  if(place0 && place0 !== "回収" && ((unsCD()[id] || {}).camera_check || "") !== "ok"){
    toast("📹 ポスティングは、監視カメラで投函を確認して「◎ 確認した」を押してから精算済にしてください");
    const w = document.getElementById("camw-" + id); if(w) w.scrollIntoView({ block: "center", behavior: "smooth" });
    return;
  }
  const noPh = !!noPhoto[id] && !(phList && phList.length);
  const c = calcCast(id), sel = unsSel[id] || new Set(), open = unsOpen(id), picked = open.filter(x => sel.has(x.key));
  const add = picked.reduce((a, x) => a + x.amount, 0), due = c.drop + add;
  const diff = c.deposited != null ? c.deposited - due : null;   // −＝足りない（未精算）／＋＝多い（お釣り）
  // 🚫 未精算を合算するときは、投函した額がちょうどでないと精算済にできない（2026/11/14 店長：複数日の精算でお釣り・足りないが出ると追えなくなる）
  //   未精算だけを精算するとき（その日の精算なし・別の流れ）は、今までどおりお釣りOK
  if(picked.length && (c.deposited == null || Number(c.deposited) !== due)){
    toast(`🚫 未精算を合算しています。投函した額を、ちょうど ${yen(due)} で入れてから精算済にしてください` + (c.deposited != null ? `（いま ${yen(c.deposited)}）` : "（まだ入っていません）"));
    return;
  }
  const msg = castName(id) + (c.partNo > 1 ? "（" + (PART_MARK[c.partNo - 1] || c.partNo) + " の精算）" : "") + " を精算済にしますか？\n手取り " + yen(c.takeHome) + "／当日の投函額 " + yen(c.drop)
    + (picked.length ? "\n＋ 未精算 " + picked.length + "件（" + yen(add) + "）→ 合計 " + yen(due) : "")
    + (diff ? "\n投函した額 " + yen(c.deposited) + " → " + (diff < 0 ? "未精算 " + yen(-diff) : "お釣り " + yen(diff)) + " を未精算に入れます" : "");
  if(!confirm(msg)) return;
  if(ptDay[id] && ptDay[id] !== day && !ptVal[id]){ toast("🕒 ちがう日に精算したときは、時刻も入れてください"); return; }
  const by = ptBy[id] || KB.operatorName(), at = ptAt(id) || new Date().toISOString(), pl = document.getElementById("pl-" + id), place = pl ? pl.value : "";
  const camNow = (unsCD()[id] || {}).camera_check || "";
  const labels = picked.map(x => unsLine(x, open.indexOf(x), id));
  const snap = { reward: c.reward, option: c.option, transportBack: c.transportBack, plus: c.plus, zappi: c.zappi, minus: c.minus,
                 takeHome: c.takeHome, total: c.total, cardPaid: c.cardPaid, drop: c.drop, withholding: c.withholding,
                 shopDrop: c.shopDrop, realDrop: c.realDrop, deposited: c.deposited, diff, by, at, transferPaid: c.transferPaid || 0, trIds: c.trIds || [],
                 uns: picked.map((x, i) => ({ kind: x.kind, date: x.date, amount: x.amount, id: x.raw.id || null, label: labels[i] })), due };
  // ② この精算に入れた予約を覚える。前の精算（①…）があれば、合計した数字にして parts に並べる
  snap.resIds = c.live.map(r => r.id); snap.part = (c.partNo || 1); snap.place = place;   // どこで精算したか（②のときに①を出す）
  const finalSnap = c.prevParts && c.prevParts.length ? kbSumParts(c.prevParts.concat([snap])) : snap;
  try{
    for(const x of picked){
      const txt = `${unsMd(day)}の精算で、この日の${x.kind === "day" ? "精算" : "未精算（" + x.what + "）"}をいっしょに精算しました（合計 ${yen(due)}・${place}）`;
      if(x.kind === "day"){
        const s2 = Object.assign({}, { reward: x.raw.c.reward, option: x.raw.c.option, takeHome: x.raw.c.takeHome, total: x.raw.c.total, cardPaid: x.raw.c.cardPaid, drop: x.raw.c.drop, zappi: x.raw.c.zappi, transportBack: x.raw.c.transportBack, plus: x.raw.c.plus, minus: x.raw.c.minus, withholding: x.raw.c.withholding, realDrop: x.raw.c.realDrop }, { paidOn: day, by, at });
        // ② その日の前の精算（①…）があれば合わせる（のこした予約だけを、あとで精算したとき）
        s2.resIds = (x.raw.c.live || []).map(r => r.id); s2.shopDrop = x.raw.c.shopDrop; s2.transferPaid = x.raw.c.transferPaid || 0;
        const s2all = (x.raw.c.prevParts || []).length ? kbSumParts(x.raw.c.prevParts.concat([s2])) : s2;
        await unsLogOther(x.date, id, txt, { settled: true, settled_at: at, settled_by: by, settle_place: place, settle_snapshot: s2all }, { at, kind: "late", place, amount: x.amount, cam: camNow });
      } else {
        q(await sb.from("kb_unsettled").update({ done_on: day, done_by: by, done_at: at }).eq("id", x.raw.id));
        await unsLogOther(x.date, id, txt, null, { at, kind: "late", place, amount: x.amount, cam: camNow });
      }
    }
    if(diff && UNS !== null) q(await sb.from("kb_unsettled").insert({ cast_id: id, biz_date: day, amount: -diff, source: "auto", created_by: by,
      note: diff < 0 ? "投函が足りなかった（投函 " + yen(c.deposited) + "／" + yen(due) + "）" : "多く投函した（投函 " + yen(c.deposited) + "／" + yen(due) + "）" }));
  }catch(e){ toast("未精算を保存できませんでした：" + (e.message || e)); return; }
  const cd = unsCD()[id] || {}, logs = (Array.isArray(cd.settle_log) ? cd.settle_log : []).slice();
  logs.push({ at, by, kind: "settle", place, amount: c.deposited != null ? c.deposited : null, cam: cd.camera_check || "", text: `精算済にしました（${place}）手取り ${yen(c.takeHome)}／当日の投函額 ${yen(c.drop)}` + (picked.length ? `\n＋ 未精算をいっしょに精算：${labels.join("／")}\n→ 合計 ${yen(due)}` : "") + (diff ? `\n投函した額 ${yen(c.deposited)}（${diff < 0 ? "足りない " + yen(-diff) + " を未精算に" : "多い " + yen(diff) + " をお釣りに"}）` : "") + (noPh ? "\n📷 写真なし（キャストがくれなかった）" : "") + (by !== KB.operatorName() ? "\n（入力：" + KB.operatorName() + "）" : "") + (stay ? "\n🟡 このあとも待機中" : "") });
  if(noPh) finalSnap.noPhoto = true;
  await saveDay(id, Object.assign({ settled: true, settled_at: at, settled_by: by, settle_place: place, settle_snapshot: finalSnap, deposited: null }, HAS_SLOG ? { settle_log: logs } : {}, HAS_170 ? { direct_home: false } : {}, stay ? { status: "待機中" } : {}));
  delete unsSel[id]; delete ptVal[id]; delete settleSkip[day + "|" + id]; delete noPhoto[id]; delete plSel[id]; delete ptDay[id]; delete ptBy[id]; await unsLoad();   // チェックを外した予約は、のこり（未精算）として次に出る
};
// ② 最後の精算（②など）だけ取り消す：その精算でいっしょに精算した未精算をまだにもどし、その精算で自動で入れた未精算は消す
async function unsettleLastPart(id, cd, s){
  const parts = s.parts.slice(), last = parts.pop(), mk = PART_MARK[parts.length] || "最後";
  if(!confirm(`${castName(id)} の「${mk}」の精算を取り消しますか？\n（前の精算はそのまま残ります）`)) return;
  const by = KB.operatorName();
  try{
    for(const x of (last.uns || [])){
      if(x.kind === "day") await unsLogOther(x.date, id, `${unsMd(day)}の「${mk}」の精算を取り消したので、この日の精算もまだにもどしました`, { settled: false, settled_at: null, settle_snapshot: null });
      else if(x.id && UNS !== null) q(await sb.from("kb_unsettled").update({ done_on: null, done_by: "", done_at: null }).eq("id", x.id));
    }
    if(UNS !== null && last.at) q(await sb.from("kb_unsettled").delete().eq("cast_id", id).eq("biz_date", day).eq("source", "auto").is("done_on", null).gte("created_at", last.at));
  }catch(e){ toast("未精算をもどせませんでした：" + (e.message || e)); return; }
  const logs = (Array.isArray(cd.settle_log) ? cd.settle_log : []).concat([{ at: new Date().toISOString(), by, text: `「${mk}」の精算を取り消しました（前の精算はそのまま）` }]);
  const prev = parts[parts.length - 1] || {};
  await saveDay(id, Object.assign({ settled: true, settled_at: prev.at || cd.settled_at, settle_snapshot: kbSumParts(parts), deposited: last.deposited != null ? last.deposited : null }, HAS_SLOG ? { settle_log: logs } : {}));
  await unsLoad();
}
// 精算済をもどす：この日にいっしょに精算した未精算もまだにもどす。この日の精算で自動で入れた未精算は消す
unsettle = async function(id){
  // ② ①②…と何回か精算していたら、最後の精算だけ取り消す（前の精算はそのまま）2026/11/4
  { const cd0 = unsCD()[id] || {}, s0 = cd0.settle_snapshot || {};
    if(Array.isArray(s0.parts) && s0.parts.length > 1) return unsettleLastPart(id, cd0, s0); }
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
  await saveDay(id, Object.assign({ settled: false, settled_at: null, settle_snapshot: null, deposited: cd.deposited != null ? cd.deposited : ((cd.settle_snapshot || {}).deposited ?? null) }, HAS_SLOG ? { settle_log: logs } : {}));
  await unsLoad();
};

// 📒 未精算のキャスト（全員）。精算ページの上にいつも出す。手で足す（エクセルの頃の分など）・消す
// 今見ている日が今日より前なら、その日の「精算していない子」もリストに出す（精算済をもどした日など）。見るだけ（精算はその日の枠で）
//   今日の画面では「🏠 直帰」の子だけ出す（直帰でも、未精算リストから個別に精算できるように。2026/11/5）
function unsSelfDay(){
  if(!day || typeof KB === "undefined" || typeof rows === "undefined") return [];
  const isToday = day >= KB.bizDateOf(), cds = unsCD() || {};
  return [...new Set(rows.filter(r => r.cast_id && !["cancel", "tobi", "flowed"].includes(r.status)).map(r => r.cast_id))]
    // 精算済でも、のこした予約（②がまだ）があれば出す（11/2 夏目あん：①だけ精算したら消えていた。2026/11/5）
    .filter(cid => { const cd = cds[cid] || {}, pend = cd.settled && kbPendingAfterSettle(cd, rows.filter(r => r.cast_id === cid)).length;
      return isToday ? (!cd.settled || pend) && !!cd.direct_home : !cd.settled || pend; })
    .map(cid => { let c = null; try{ c = calcCast(cid); }catch(e){} return c ? { cid, date: day, amount: c.drop, c, home: !!(cds[cid] || {}).direct_home } : null; }).filter(Boolean);
}
// 未精算リストに出すもの（キャストごと）：ほかの日の未精算 ＋ 今見ている日のまだの分（直帰など）。☑ で個別に精算できる
function unsListItems(cid){
  const me = unsSelfDay().filter(x => x.cid === cid).map(x => ({ key: "d" + x.date, kind: "day", date: x.date, amount: x.amount, raw: { c: x.c }, self: true,
    what: (x.home ? "🏠 直帰・" : "今見ている日・") + (x.amount >= 0 ? `未精算 ${yen(x.amount)}` : `お店から渡す ${yen(-x.amount)}`) }));
  return unsOpen(cid).filter(x => !me.some(m => m.key === x.key)).concat(me).sort((p, q) => String(p.date).localeCompare(String(q.date)));
}
const unsOpenSet = new Set();   // 未精算のキャスト：開いているキャスト
function unsListHtml(){
  const self = unsSelfDay();
  const ids = [...new Set(UNSD.map(x => x.cid).concat((UNS || []).filter(x => !x.done_on).map(x => x.cast_id), self.map(x => x.cid)))].sort((a, b) => castName(a).localeCompare(castName(b), "ja"));
  const casts = (M.casts || []).filter(c => c.status !== "left").sort((a, b) => castName(a.id).localeCompare(castName(b.id), "ja"));
  return `<div class="uhd">📒 未精算のキャスト（${ids.length}人）<small>前の${UNS_DAYS}日の、精算していない日と、投函が合わなかった分</small></div>
    ${ids.length ? '<div class="unsgrid">' + ids.map(cid => { const l = unsListItems(cid), sum = l.reduce((a, x) => a + x.amount, 0);
      // キャストごとに1行にまとめる（押すと中身が開く）。チェック中のものがあれば開いたまま 2026/11/4
      return `<details class="unsc" ${(unsOnly[cid] || new Set()).size || unsOpenSet.has(cid) ? "open" : ""} ontoggle="this.open ? unsOpenSet.add('${cid}') : unsOpenSet.delete('${cid}')"><summary class="uh"><b>${esc(castName(cid))}</b><span class="${sum >= 0 ? "neg" : "pos"}">${sum >= 0 ? "未精算 " + yen(sum) : "渡す " + yen(-sum)}</span><small>${l.length}件</small></summary>
        ${l.map((x, i) => `<div class="ur">${KB.CAN_EDIT ? `<input type="checkbox" ${(unsOnly[cid] || new Set()).has(x.key) ? "checked" : ""} onchange="unsOnlyToggle('${cid}','${x.key}',this.checked)" title="未精算だけを、今日精算する">` : ""}<b class="ab">${UNS_ABC[i] || i + 1}</b> <b>${unsMd(x.date)}</b>（${esc(castName(cid))}）<span class="${x.amount >= 0 ? "neg" : "pos"}">${esc(x.what)}</span>${unsJump(x.date, cid)}
          ${x.kind === "entry" && x.raw.source === "manual" ? `<small>手で入れた・${esc(x.raw.created_by || "")}</small>` : ""}
          ${x.kind === "entry" && "alert_at" in x.raw ? (KB.CAN_EDIT ? `<select class="unalert sm" title="次の出勤日に知らせる" onchange="unsSetAlert(${x.raw.id},this.value)">${Object.entries(ALERT_AT).map(([k, lb]) => `<option value="${k}" ${(x.raw.alert_at || "") === k ? "selected" : ""}>${lb.replace("次の出勤日の", "").replace("に知らせる", "")}</option>`).join("")}</select>` : x.raw.alert_at ? `<small>${ALERT_AT[x.raw.alert_at]}</small>` : "") : ""}
          ${KB.CAN_EDIT && x.kind === "entry" ? `<button type="button" class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="unsDel(${x.raw.id})">🗑</button>` : ""}</div>`).join("")}
        ${unsOnlyFoot(cid, l)}</details>`; }).join("") + '</div>'
    : `<div class="hint2">未精算はありません 🎉</div>`}
    ${KB.CAN_EDIT && UNS !== null ? `<details style="margin-top:8px"><summary style="cursor:pointer;font-weight:800;font-size:13px">＋ 未精算を手で足す（エクセルの頃の分など）</summary>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px">
        <select id="un_cast"><option value="">キャスト</option>${casts.map(c => `<option value="${c.id}">${esc(castName(c.id))}</option>`).join("")}</select>
        <input type="date" id="un_day" value="${day}">
        <select id="un_kind"><option value="1">未精算（キャストが払う）</option><option value="-1">お釣り（お店が払う）</option><option value="r0">🧾 領収書のみ未回収（お金は精算ずみ・金額なし）</option><option value="r1">🧾 領収書未精算（お金も未精算・金額を入れる）</option></select>
        <input type="number" id="un_amt" min="1" placeholder="金額（領収書のみは空）" style="width:150px">
        <input id="un_note" maxlength="300" placeholder="なんの未精算か（例：エクセルの頃の分）" style="flex:1;min-width:160px">
        ${alertBox("un_alert")}
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
      <select id="uo_cam_${cid}"><option value="">📹 カメラ</option><option value="ok">◎ 確認した</option><option value="ng">× 確認していない</option></select>
      <label style="font-size:12.5px;font-weight:700">🕒 実際の時刻 <input type="time" id="uo_t_${cid}"></label>
      <button type="button" class="btn btn-primary btn-sm" onclick="unsOnlySettle('${cid}')">✅ 未精算だけ精算済にする</button></div></div>`;
}
async function unsOnlySettle(cid){
  const l = unsListItems(cid), s = unsOnly[cid] || new Set(), picked = l.filter(x => s.has(x.key)); if(!picked.length) return;
  const sum = picked.reduce((a, x) => a + x.amount, 0), place = $("uo_pl_" + cid).value, dv = $("uo_dep_" + cid).value;
  const dep = dv === "" ? null : Number(dv) || 0, diff = dep != null ? dep - sum : null;
  const labels = picked.map(x => unsLine(x, l.indexOf(x), cid));
  if(!confirm(`${castName(cid)} の未精算だけを精算済にしますか？（${unsMd(day)}・${place}）\n${labels.join("\n")}\n→ 合計 ${sum >= 0 ? "投函 " + yen(sum) : "お店から渡す " + yen(-sum)}` + (diff ? `\n投函した額 ${yen(dep)} → ${diff < 0 ? "足りない " + yen(-diff) + " を未精算に" : "多い " + yen(diff) + " をお釣りに"}` : ""))) return;
  const by = KB.operatorName(), at = bizTimeAt($("uo_t_" + cid).value) || new Date().toISOString(), cam = $("uo_cam_" + cid).value;
  try{
    for(const x of picked){
      const txt = `${unsMd(day)}に、この日の${x.kind === "day" ? "精算" : "未精算（" + x.what + "）"}を精算しました（未精算だけの精算・合計 ${yen(sum)}・${place}）`;
      if(x.kind === "day"){
        const s2 = { reward: x.raw.c.reward, option: x.raw.c.option, takeHome: x.raw.c.takeHome, total: x.raw.c.total, cardPaid: x.raw.c.cardPaid, drop: x.raw.c.drop, zappi: x.raw.c.zappi, transportBack: x.raw.c.transportBack, plus: x.raw.c.plus, minus: x.raw.c.minus, withholding: x.raw.c.withholding, realDrop: x.raw.c.realDrop, paidOn: day, by, at, only: true };   // only＝未精算だけの個別精算
        s2.resIds = (x.raw.c.live || []).map(r => r.id); s2.shopDrop = x.raw.c.shopDrop; s2.transferPaid = x.raw.c.transferPaid || 0;   // ② 前の精算と合わせる
        const s2all = (x.raw.c.prevParts || []).length ? kbSumParts(x.raw.c.prevParts.concat([s2])) : s2;
        await unsLogOther(x.date, cid, txt, { settled: true, settled_at: at, settled_by: by, settle_place: place, settle_snapshot: s2all }, { at, kind: "late", place, amount: x.amount, cam });
      } else {
        q(await sb.from("kb_unsettled").update({ done_on: day, done_by: by, done_at: at }).eq("id", x.raw.id));
        await unsLogOther(x.date, cid, txt, null, { at, kind: "late", place, amount: x.amount, cam });
      }
    }
    if(diff && UNS !== null) q(await sb.from("kb_unsettled").insert({ cast_id: cid, biz_date: day, amount: -diff, source: "auto", created_by: by,
      note: diff < 0 ? "未精算の精算で投函が足りなかった（投函 " + yen(dep) + "／" + yen(sum) + "）" : "未精算の精算で多く投函した（投函 " + yen(dep) + "／" + yen(sum) + "）" }));
    // 今日のこの子の精算の備考にも残す（今日の精算は「精算済」にはしない）
    await unsLogOther(day, cid, `💴 未精算だけ精算しました（${place}）\n${labels.join("／")}\n→ 合計 ${sum >= 0 ? "投函 " + yen(sum) : "お店から渡す " + yen(-sum)}` + (dep != null ? `／投函した額 ${yen(dep)}` : ""), null, { at, kind: "late", place, amount: dep, cam });
  }catch(e){ toast("精算できませんでした：" + (e.message || e)); return; }
  delete unsOnly[cid]; toast(`✅ ${castName(cid)} の未精算を精算しました`);
  if(typeof loadDay === "function") await loadDay(); await unsLoad();
}async function unsAdd(){
  const cid = $("un_cast").value, amt = Math.abs(Number($("un_amt").value) || 0), d = $("un_day").value, kind = $("un_kind").value, alert = ($("un_alert") || {}).value || "";
  const rOnly = kind === "r0", rUns = kind === "r1";
  if(!cid || !d || (!rOnly && !amt)){ toast(rOnly ? "キャスト・日付を入れてください" : "キャスト・日付・金額を入れてください"); return; }
  const memo = $("un_note").value.trim();
  const note = rOnly ? "🧾 領収書のみ未回収（お金は精算ずみ）" + (memo ? "：" + memo : "") : rUns ? "🧾 領収書未精算（お金も未精算）" + (memo ? "：" + memo : "") : memo || "手で入れた未精算";
  const amount = rOnly ? 0 : rUns ? amt : amt * Number(kind);
  try{ q(await sb.from("kb_unsettled").insert(Object.assign({ cast_id: cid, biz_date: d, amount, note, source: "manual", created_by: KB.operatorName() }, alert ? { alert_at: alert } : {})));
    toast("未精算を足しました"); await unsLoad(); }
  catch(e){ toast("足せませんでした：" + (e.message || e) + (alert ? "（🔔 を使うには SQL 210 の実行が必要です）" : "")); }
}
async function unsSetAlert(uid, v){
  try{ q(await sb.from("kb_unsettled").update({ alert_at: v }).eq("id", uid)); toast(v ? ALERT_AT[v] + "ようにしました" : "知らせないようにしました"); await unsLoad(); }
  catch(e){ toast("保存できませんでした：" + (e.message || e) + "（SQL 210 は実行ずみ？）"); }
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
      ${list.map(r => `<tr><td>${logWhen(r.at)}</td><td>${KBF.staffTag(r.by)}</td><td><b>${esc(castName(r.cid))}</b></td><td>${unsMd(r.bd)}</td><td><span class="sk ${r.kind}">${r.kind}</span></td><td style="white-space:pre-wrap">${esc(r.text)}</td></tr>`).join("")}</table></div>`
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
  .unsexact{background:#FFF0F1;border:2px solid #E5484D;color:#8A1C2B;border-radius:10px;padding:6px 10px;margin:6px 0;font-weight:800;font-size:13.5px} .unsexact small{font-weight:700}
  .ujump{margin-left:8px;font-size:11.5px;font-weight:800;color:#2f7fd0;text-decoration:none;border:1.5px solid #BFD8F2;background:#fff;border-radius:99px;padding:1px 8px;white-space:nowrap}
  .unsbox > b{color:#5b3fa6} .unsbox > small{color:#8a7f99;margin-left:4px}
  .ur{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:3px 0} .ur small{color:#8a7f99;font-size:11.5px}
  .ur .ab{display:inline-flex;width:22px;height:22px;border-radius:50%;background:#7b5cd6;color:#fff;align-items:center;justify-content:center;font-size:12px}
  .neg{color:#d9534f} .pos{color:#2f7fd0}
  .ut{margin-top:6px;font-weight:700} .due{display:inline-block;background:#00B0F0;border:2px solid #0A84C6;border-radius:10px;padding:2px 10px;color:#E0001B;font-size:18px;font-weight:900}
  .due.give{background:#E3F1FF;border-color:#2f7fd0;color:#2f7fd0}
  .uhd{font-weight:900;font-size:15px;color:#5b3fa6;margin-bottom:6px} .uhd small{font-weight:600;font-size:11.5px;color:#8a7f99;margin-left:6px}
  .unsgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:6px;align-items:start}
  .unsc{background:#fff;border:1.5px solid #E4DDF2;border-radius:10px;padding:4px 10px}
  .unsc .uh{font-size:13.5px;cursor:pointer;display:flex;gap:8px;align-items:center;list-style:none;padding:2px 0} .unsc .uh::-webkit-details-marker{display:none}
  .unsc .uh::before{content:"▸";color:#B9A8EC} .unsc[open] .uh::before{content:"▾"} .unsc .uh small{margin-left:auto;color:#8a7b82} .unsc[open]{grid-column:1/-1}
  .slog{background:#FFFCEB;border:1.5px solid #F2D27A;border-radius:12px;padding:8px 10px;margin:8px 0;font-size:13px}
  .slog > b{color:#8a6d00;margin-right:8px} .slog .sl{background:#fff;border:1px solid #F2D27A;border-radius:8px;padding:5px 8px;margin-top:5px}
  .slog .sw{font-weight:900;color:#5C4B4F;margin-right:4px} .sladd{margin-top:8px} .sladd summary{cursor:pointer;font-weight:800;font-size:12.5px;color:#8a6d00}
  .slf{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px;font-size:12.5px;font-weight:700} .slf select,.slf input{font-family:inherit;font-size:12.5px;padding:3px 6px;border:1.5px solid #ddd;border-radius:6px}
  .slog .sl .t{white-space:pre-wrap} .slog .sl .s{font-size:11px;color:#9C8B8F;text-align:right}
  .uonly{background:#FFFBEA;border:2px solid #F2C200;border-radius:10px;padding:8px 10px;margin-top:6px;font-size:13px}
  .pmz{background:#F7FBF4;border:1.5px solid #CFE6C2;border-radius:12px;padding:8px 10px;margin:8px 0} .pmzh{font-weight:800;font-size:13px}
</style>`);

/* ---------- 🧾 精算明細（画像・LINE の文）：精算ページ・記録簿の💴精算 共通（ページの関数を上書き）
   並び：1本目・2本目…（くわしいところ・OP・その仕事の報酬） → 本日の報酬総額・OP総額・雑費・プラマイ
         → 本日の報酬／本日の手取り額 → 本日の投函額
         → 本日＋未精算（合算）A・B・C…（いちばん下が本日精算）→ A＋B＋…＝ → 合計で投函
         → 精算メモ（1営業日に1枚） ---------- */
// 精算メモの書きかた（画像・LINE の文・精算画面 共通）
const MEMO_NOTE = ["※金額は、実際に投函する額をご記入ください", "※精算メモを一番上にして、表向きでお入れください", "※領収書がある場合は必ず同封してください"];
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
  const res = c.all.filter(r => r.status !== "cancel" && r.status !== "tobi" && r.status !== "flowed").map((r, i) => {   // キャンセル・トビは出さない
    const off = r.status === "cancel" || r.status === "tobi" || r.status === "flowed";
    const bo = off ? [] : (r.options || []).filter(o => (o.back || 0) > 0);
    // オプションは、お客さんの料金もいっしょに（右の「＋」はキャストのバック）2026/11/12 店長
    const ops = bo.map(o => [`${o.label}${o.qty > 1 ? "×" + o.qty : ""}${Number(o.price) ? "（料金 " + yen(Number(o.price) * (o.qty || 1)) + "）" : ""}`, o.back * (o.qty || 1)]);
    const opSum = bo.reduce((a, o) => a + o.back * (o.qty || 1), 0);
    const head = `${hm(r.start_at)} ${storeLabel(r.store_key)} ${r.course}${/^\d+$/.test(r.course) ? "分" : ""}${r.extension_count ? " 延長" + r.extension_count : ""}`;
    const courseBack = off ? 0 : r.back_override != null ? r.back_override : (r.course_back || 0) + (r.extra_back || 0);
    // お客さんの総額と、新規・店リピ・本指名（精算明細に出す。2026/11/4）
    const vk = ({ new: "新規", repeat: "店リピ", honshi: "本指名" })[r.visit_kind] || "";
    // 本指名バック：コースのバックのうち本指名の分を別の行に（nomi_back。報酬を手で直した予約は分けない）2026/11/7
    const nomi = !off && r.back_override == null && Number(r.nomi_back) > 0 && Number(r.nomi_back) <= courseBack ? Number(r.nomi_back) : 0;
    return { no: i + 1, head, off, st: r.status, courseBack, nomi, ops, opSum, total: courseBack + opSum, guest: Number(r.total) || 0, vk };
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
  if(c.transferPaid) a.push(["振込（あとでお店の口座に振り込まれるので手元にない）", "−" + yen(c.transferPaid)]);
  a.push(["本日の手取り額", "−" + yen(c.takeHome)]);
  return { rows: a, res: c.drop >= 0 ? ["本日の投函額", yen(c.drop)] : ["お店から渡す（足りない分）", yen(-c.drop)],
    why: c.drop < 0 ? `カード払いの分はお店に入るため、手元の現金が手取り額より ${yen(-c.drop)} 足りません。その分をお店から渡します` : "" };
};
copyDetail = function(id){
  const P = settleParts(id), c = P.c, d = P.d;
  const lines = [`【精算】${d.getUTCMonth() + 1}/${d.getUTCDate()}(${DOW[d.getUTCDay()]}) ${castName(id)}さん`];
  P.res.forEach(r => {
    lines.push("", `■ ${r.no}本目　${r.head}`);
    if(r.off){ lines.push(`　${r.st === "cancel" ? "キャンセル" : r.st === "flowed" ? "流れた" : "トビ"}（報酬なし）`); return; }
    lines.push(`　お客さんの総額${r.vk ? "（" + r.vk + "）" : ""}　${yen(r.guest)}`);
    lines.push(`　コース報酬　${yen(r.courseBack - r.nomi)}`);
    if(r.nomi) lines.push(`　本指名バック　＋${yen(r.nomi)}`);
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
  P.memo.forEach(([bd, v]) => lines.push(`　営業日 ${unsMd(bd)}／名前 ${castName(id)}／金額 ${v < 0 ? "¥-" : "¥"}${Math.abs(v).toLocaleString("ja-JP")}`));
  MEMO_NOTE.forEach(t => lines.push("　" + t));
  lines.push("📖 投函のしかた：https://sakuramoong-app.github.io/portal/kirokubo/posting.html", "", "お疲れさまでした🌸");
  navigator.clipboard.writeText(lines.join("\n")).then(() => toast("📋 精算明細をコピーしました"), () => alert(lines.join("\n")));
};
settleCanvas = function(id){
  const P = settleParts(id), c = P.c, d = P.d;
  const S = 2, W = 560, PAD = 28, FONT = '"Hiragino Maru Gothic ProN","M PLUS Rounded 1c","Yu Gothic","Meiryo",sans-serif';
  // 描くもの： [種類, ...]。高さを先に数える
  const ops = [];
  P.res.forEach(r => {
    ops.push(["job", `${r.no}本目`, r.head, r.off ? (r.st === "cancel" ? "キャンセル" : r.st === "flowed" ? "流れた" : "トビ") : "", r.off]);
    if(r.off) return;
    ops.push(["jrow", "お客さんの総額" + (r.vk ? "（" + r.vk + "）" : ""), yen(r.guest)]);
    ops.push(["jrow", "コース報酬", yen(r.courseBack - r.nomi)]);
    if(r.nomi) ops.push(["jrow", "本指名バック", "＋" + yen(r.nomi), "op"]);
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
  const hOf = o => ({ head3: 34, why: 46, job: 40, jrow: 26, jsum: 30, abc: 32, pbox: 92, fx: 58, box: 112, row: 30, sub: 22, sub2: 24, line: 20, head: 40, head2: 40, memo: 46 + (1 + P.memo.length) * 30 + 50 })[o[0]] || 30;
  const H = 88 + ops.reduce((a, o) => a + hOf(o), 0) + 56;
  const cv = document.createElement("canvas"); cv.width = W * S; cv.height = H * S;
  const g = cv.getContext("2d"); g.scale(S, S);
  g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
  const grd = g.createLinearGradient(0, 0, W, 0); grd.addColorStop(0, "#ff9fb8"); grd.addColorStop(1, "#e5638c");
  g.fillStyle = grd; g.fillRect(0, 0, W, 72);
  g.fillStyle = "#fff"; g.textAlign = "left"; g.font = `bold 15px ${FONT}`; g.fillText(`精算${d.getUTCMonth() + 1}/${d.getUTCDate()}(${DOW[d.getUTCDay()]})`, PAD, 28);
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
      const rowsM = [hd].concat(P.memo.map(([bd, v]) => [unsMd(bd), castName(id), (v < 0 ? "¥-" : "¥") + Math.abs(v).toLocaleString("ja-JP")]));
      rowsM.forEach((rw, ri) => { let x = tx; cw.forEach((w, i) => { g.strokeRect(x, ty + ri * rh, w, rh); txt(rw[i], x + w / 2, ty + ri * rh + 21, ri ? "bold 16px" : "14px", ri ? "#1a3a8a" : "#333", "center"); x += w; }); });
      const ny = ty + rowsM.length * rh;
      MEMO_NOTE.forEach((t, i) => txt(t, tx, ny + 20 + i * 20, "bold 13px", "#c0392b"));
    }
    y += h;
  });
  txt("お疲れさまでした🌸", W / 2, y + 30, "bold 15px", "#e5638c", "center");
  return cv;
};

/* ---------- 🧾 精算の画面（精算ページ・記録簿の💴精算 共通。ページの cardHtml を上書き）
   キャストに送る画像と同じ並び ＋ 下に「お店用」（投函した額・未精算/お釣り・過去の未精算・店落ち） ---------- */
document.head.insertAdjacentHTML("beforeend", `<style>
  .sv{max-width:620px;margin:8px 0;color:#5C4B4F}
  .sv .job{display:flex;align-items:center;gap:8px;margin-top:10px;font-weight:800;font-size:14px}
  .sv .job .no{background:#e5638c;color:#fff;border-radius:8px;padding:2px 10px;font-size:12.5px}
  .sv .job.off{color:#B9A9AD} .sv .job.off .no{background:#EEE8EA;color:#9C8B8F}
  .sv .r{display:flex;justify-content:space-between;gap:10px;padding:2px 0 2px 18px;font-size:13.5px} .sv .r b{font-variant-numeric:tabular-nums}
  .sv .r.op{color:#8a6d00} .sv .r.big{padding-left:0;font-size:15px;font-weight:800}
  .sv .r.ans{font-weight:800;color:#6b3550;position:relative;padding-top:5px} .sv .r.ans b{color:#e5638c}
  .sv .r.ans::before{content:"";position:absolute;right:0;top:1px;width:140px;border-top:1.5px solid #5C4B4F}
  .sv .r.ans.give{color:#1f4f80} .sv .r.ans.give b{color:#2f7fd0}
  .sv .dl{border-top:1.5px dashed #C9A9B5;margin:10px 0}
  .sv .pb{background:#FFE3F0;border:2px solid #F7B6CF;border-radius:12px;padding:8px 14px;margin:8px 0}
  .sv .pb .k{font-weight:800;font-size:13.5px;color:#6b3550} .sv .pb .v{text-align:right;font-weight:900;font-size:22px;color:#e5638c}
  .sv .h3{font-weight:800;font-size:13.5px;margin-top:8px}
  .sv .why{background:#E3F1FF;color:#1f4f80;border-radius:8px;padding:6px 10px;font-size:12.5px;font-weight:700;margin:6px 0}
  .sv .bb{background:#00B0F0;border:3px solid #0A84C6;border-radius:14px;padding:8px 14px;margin:8px 0}
  .sv .bb .k{font-weight:800;color:#08304d} .sv .bb .v{text-align:right;font-weight:900;font-size:32px;color:#E0001B}
  .sv .bb.give{background:#E3F1FF;border-color:#2f7fd0} .sv .bb.give .k{color:#1f4f80} .sv .bb.give .v{color:#2f7fd0}
  .sv .hd{background:#F1EAFA;color:#5b3fa6;font-weight:800;padding:4px 8px;margin-top:8px;border-radius:4px}
  .sv .hd.gray{background:#F4F1F6;color:#8a7f99}
  .sv .abc{display:flex;align-items:center;gap:10px;padding:3px 0;font-weight:800;font-size:13.5px}
  .sv .abc .l{display:inline-block;width:24px;text-align:center;border:1.2px solid #C9B6EA;background:#F1EAFA;color:#5b3fa6;border-radius:6px}
  .sv .abc.today .l{background:#5b3fa6;border-color:#5b3fa6;color:#fff} .sv .abc .a{margin-left:auto}
  .sv .fx{font-weight:800} .sv .fx .n{text-align:right;font-size:16px}
  .sv .sub2{color:#5b3fa6;font-weight:700;font-size:12.5px;padding-left:18px}
  .sv table.mm{border-collapse:collapse;width:100%;margin-top:4px} .sv table.mm td,.sv table.mm th{border:1.5px solid #333;text-align:center;padding:4px;font-size:13.5px}
  .sv table.mm td{color:#1a3a8a;font-weight:800}
  .sv .shop{margin-top:12px;border-top:2px solid #ddd;padding-top:8px}
  .sv .dep{display:flex;justify-content:space-between;align-items:center;border:2.5px solid #333;background:#fff;padding:10px 14px;margin:6px 0;font-weight:800}
  .sv .dep input{width:150px;text-align:right;font-family:inherit;font-size:20px;font-weight:900;color:#1a3a8a;padding:4px 8px;border:1.5px solid var(--line);border-radius:8px}
  .sv .stt{font-weight:800;font-size:13px;margin:4px 0}
  .sv .gb{background:#EDEDED;border:2.5px solid #8E8E8E;padding:10px 14px;margin-top:10px;color:#333}
  .svf{border:1.5px solid #F1D9E0;border-radius:12px;padding:6px 10px;margin:8px 0}
  .svg2{display:grid;grid-template-columns:minmax(0,640px) minmax(300px,440px);gap:16px}
  .svg2 > .svl{align-self:start;min-width:0} .svg2 > .svr{align-self:end;min-width:0}
  .svr .sv{margin:0} .svr .acts{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:8px}
  .plsel{font-family:inherit;font-size:16px;font-weight:900;color:#5C4B4F;padding:8px 36px 8px 18px;border:2px solid rgba(0,0,0,.15);border-radius:99px;cursor:pointer;
    appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%235C4B4F' stroke-width='2'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center}
  .plsel:disabled{opacity:.85;cursor:default}
  .svc{container-type:inline-size}   /* 精算の窓（せまい）でも読めるように：カードの幅で1列にする */
  @container (max-width:900px){ .svg2{grid-template-columns:1fr} .svg2 > .svr{align-self:start} }
  .sv .mmn{color:#c0392b;font-weight:800;font-size:12.5px;margin-top:6px;line-height:1.6}
  .svf > summary{cursor:pointer;font-weight:800;font-size:14px;padding:4px 0} .svf > summary small{font-weight:700;color:#9C8B8F;margin-left:8px}
  .sv .gbd > summary{cursor:pointer;list-style:none} .sv .gbd > summary::before{content:"▶ ";font-size:11px} .sv .gbd[open] > summary::before{content:"▼ "} .sv .gbd > summary small{font-weight:700;color:#888;font-size:11px;margin-left:6px} .sv .gbd[open] > summary small{display:none}
  .sv .gb .k{font-weight:800}.sv .gb .v{text-align:right;font-weight:900;font-size:26px} .sv .gb .r{padding-left:0;color:#555;font-size:12.5px}
</style>`);
function settleViewHtml(id, c){
  const P = settleParts(id), cd = c.cd, done = !!cd.settled;
  const R = (k, v, cls) => `<div class="r ${cls || ""}"><span>${esc(k)}</span><b>${esc(v)}</b></div>`;
  let h = "";
  // ② 精算済のあとでふえた予約 → 「②の精算をはじめる」。②の精算中は、前の精算を上に出す（2026/11/4）
  { const pend = done ? kbPendingAfterSettle(cd, c.all || []) : [], nParts = kbSnapParts(cd).length;
    if(pend.length) h += `<div class="part2warn">⚠️ 精算済のあとで予約が <b>${pend.length}件</b>ふえました（${pend.map(r => typeof hm === "function" ? hm(r.start_at) : "").join("・")}）　→ 上の「✅ 精算する予約」でチェックして、「${PART_MARK[nParts] || "次"}」として精算済にしてください</div>`;
    if(!done && c.partNo > 1) h += `<div class="part2info">${PART_MARK[c.partNo - 1]} の精算（ふえた予約だけで計算しています）　前の精算：${(c.prevParts || []).map((p, i) => PART_MARK[i] + " 投函 " + yen(p.drop || 0)).join("・")}</div>`; }
  P.res.forEach(r => {
    h += `<div class="job ${r.off ? "off" : ""}"><span class="no">${r.no}本目</span><span>${esc(r.head)}</span>${r.off ? `<span style="margin-left:auto">${r.st === "cancel" ? "キャンセル" : r.st === "flowed" ? "流れた" : "トビ"}</span>` : ""}</div>`;
    if(r.off) return;
    h += R("お客さんの総額" + (r.vk ? "（" + r.vk + "）" : ""), yen(r.guest), "gst") + R("コース報酬", yen(r.courseBack)) + r.ops.map(o => R("OP：" + o[0], "＋" + yen(o[1]), "op")).join("") + R("▶ この仕事の報酬（OP込み）", yen(r.total), "ans");
  });
  h += `<div class="dl"></div>` + R("本日の報酬総額", yen(c.reward), "big") + R("本日のOP総額", yen(c.option), "big") + R("雑費" + (c.cd && c.cd.zappi_override != null ? "（手で直した" + (c.cd.zappi_note ? "：" + esc(c.cd.zappi_note) : "") + "）" : ""), "−" + yen(c.zappi), "big zp")
    + P.pm.map(([l, v]) => R(l, pmYen(v), "big")).join("") + `<div class="dl"></div>`;
  h += `<div class="pb"><div class="k">本日の報酬 ／ 本日の手取り額</div><div class="v">${yen(P.pay)} ／ ${yen(c.takeHome)}</div></div>`;
  const dc = dropCalc(c);
  h += `<div class="h3">🧮 投函額の計算</div>` + dc.rows.map(x => R(x[0], x[1])).join("") + R("＝ " + dc.res[0], dc.res[1], "ans" + (c.drop < 0 ? " give" : "")) + (dc.why ? `<div class="why">${esc(dc.why)}</div>` : "");
  h += `<div class="bb ${c.drop < 0 ? "give" : ""}"><div class="k">${c.drop < 0 ? "💴 お店からキャストに渡す" : "💰 本日の投函額（封筒に入れて投函）"}</div><div class="v">${yen(Math.abs(c.drop))}</div></div>`;
  if(P.uns.length){
    h += `<div class="dl"></div><div class="hd">📒 本日＋未精算（合算）</div>` + P.sum.map(x => `<div class="abc ${x.kind === "本日精算" ? "today" : ""}"><span class="l">${x.abc}</span><span>${unsMd(x.date)}</span>
      <span style="color:${x.kind === "本日精算" ? "#5b3fa6" : x.kind === "お釣り" ? "#2f7fd0" : "#c0392b"}">${x.kind}</span><span class="a">${x.amount < 0 ? "−" : ""}${yen(Math.abs(x.amount))}</span></div>`).join("");
    const fx = sumFx(P); h += `<div class="fx"><div style="color:#5b3fa6">${fx[0]}</div><div class="n">${fx[1]}</div></div>`;
    h += `<div class="bb ${P.due < 0 ? "give" : ""}"><div class="k">${P.due < 0 ? "💴 お店から渡す（合計）" : "💰 合計で投函"}</div><div class="v">${yen(Math.abs(P.due))}</div></div>`;
  }
  if(P.rest.length) h += `<div class="hd gray">📒 のこりの未精算（今日は精算しない）</div>` + P.rest.map(x => `<div class="sub2">${esc(x)}</div>`).join("");
  h += `<div class="h3">📝 精算メモに書くこと（1営業日に1枚・${P.memo.length}枚）</div><table class="mm"><tr><th>営業日</th><th>名前</th><th>金額</th></tr>`
    + P.memo.map(([bd, v]) => `<tr><td>${unsMd(bd)}</td><td>${esc(castName(id))}</td><td>${v < 0 ? "¥-" : "¥"}${Math.abs(v).toLocaleString("ja-JP")}</td></tr>`).join("") + `</table>`
    + `<div class="mmn">${MEMO_NOTE.map(esc).join("<br>")}</div>`;
  // 🏪 お店用（投函した額まではアコーディオンの中・過去の未精算と店落ちは外）
  const diff = c.deposited != null ? c.deposited - P.due : null, sel = unsSel[id] || new Set();
  // お店用の中身（並びは cardHtml で：未精算 → 回収場所・コピー・精算済 → カメラ → 投函額 → 実際に投函した額 → 写真）2026/11/4
  const dep = `<div class="dep depdue"><span>${P.due < 0 ? "お店から渡す額" : "投函額"}</span><b style="font-size:22px;color:${P.due < 0 ? "#2f7fd0" : "#d0121b"}">${yen(Math.abs(P.due))}</b></div>
    <div class="dep"><span>実際に投函（回収）した額</span><input type="number" id="dep-${id}" value="${c.deposited != null ? c.deposited : ""}" placeholder="投函した額" ${KB.CAN_EDIT ? "" : "disabled"} onchange="setDeposit('${id}',this.value)"></div>
    <div class="stt" style="color:${diff == null ? "#9C8B8F" : diff === 0 ? "#2e8b57" : diff < 0 ? "#c0392b" : "#2f7fd0"}">${diff == null ? "投函した額をまだ入れていません（お金を確認してから入れる）"
      : diff === 0 ? "✅ 未精算・お釣りは出ていません" : diff < 0 ? `⚠ 未精算が出ます（足りない ${yen(-diff)}）` : `⚠ お釣りが出ます（多い ${yen(diff)}）`}</div>`;
  const stat = diff == null ? "投函した額 まだ" : diff === 0 ? "✅ ぴったり" : diff < 0 ? `⚠ 未精算 ${yen(-diff)}` : `⚠ お釣り ${yen(diff)}`;
  const shop = `<div class="sv"><details class="gb gbd" ${shopOpen.has(id) ? "open" : ""} ontoggle="this.open ? shopOpen.add('${id}') : shopOpen.delete('${id}')"><summary class="k">🏪 店落ち（暫定的な残額＋雑費）<small>押すと開く</small></summary><div class="v">${yen(c.shopDrop)}</div>
      ${R("総額", yen(c.total))}${R("キャスト報酬（報酬＋OP）", yen(c.reward + c.option))}${R("暫定的な残額（総額−報酬）", yen(c.provisional))}${R("＋ 雑費", yen(c.zappi))}${R("＝ 店落ち（暫定的な残額＋雑費）", yen(c.provisional + c.zappi))}${R("【税務用】源泉徴収（手取りからは引かない）", yen(c.withholding))}${R("実質的な店落ち（暫定的な残額−源泉）", yen(c.realDrop))}</details></div>`;
  return { view: `<div class="sv">${h}</div>`, dep, shop, stat, due: P.due };
}
// 精算場所の色（今どこに誰が のエリアの色と同じ。回収はピンク）
const PLACE_COLOR = { "池袋": "#FFC966", "鶯谷": "#CCCCFF", "五反田": "#C6E0B4", "回収": "#FFC2D1" };
// プラスの名前：「✏️ ほかを書く」なら自由に書く
function plusLabel(id, i, sel){
  let v = sel.value;
  if(v === "__other"){ v = (prompt("プラスの名前（例：追加料金・立て替え分）") || "").trim(); if(!v){ const o = sel.querySelector("option[selected]"); sel.value = o ? o.value : ""; return; } }
  setItem(id, "plus", i, "label", v);
}
// 🏪 店落ちは、ふだん閉じる（開いたものは描きなおしても開いたまま）。精算画面の上のボタンで全員ぶんを開く・閉じる
const shopOpen = new Set();
function shopAllToggle(){
  const ids = Array.from(document.querySelectorAll(".svc[id^='card-']")).map(el => el.id.slice(5));
  const openAll = ids.some(id => !shopOpen.has(id));
  ids.forEach(id => openAll ? shopOpen.add(id) : shopOpen.delete(id));
  document.querySelectorAll("details.gbd").forEach(d => { d.open = openAll; });
  const b = document.getElementById("shopAllBtn"); if(b) b.textContent = openAll ? "🏪 全キャストの店落ちを閉じる" : "🏪 全キャストの店落ちを開く";
}
const svOpen = new Set();   // 開いているアコーディオン（描きなおしても閉じない）
cardHtml = function(id, c){
  // 精算済でも、そのあとでふえた予約があれば「まだ」（ふえた予約だけ精算できる）2026/11/4
  const pendAll = kbPendingAfterSettle(c.cd, c.all || []);
  const cd = c.cd, done = !!cd.settled && !pendAll.length, dis = (!KB.CAN_EDIT || done) ? "disabled" : "";
  // プラスは「交通費／チャージ」から選ぶ（前に手で書いたものは、そのまま選べる）
  const PLUS_KINDS = ["交通費", "チャージ"];
  const items = (list, kind)=> list.map((x, i)=>`<div class="it">${kind === "plus"
      ? `<select class="lbl" ${dis} onchange="plusLabel('${id}',${i},this)">${(PLUS_KINDS.includes(x.label) ? PLUS_KINDS : PLUS_KINDS.concat([x.label || ""])).map(l=>`<option value="${esc(l)}" ${l === x.label ? "selected" : ""}>${esc(l || "（選ぶ）")}</option>`).join("")}<option value="__other">✏️ ほかを書く</option></select>`
      : `<input class="lbl" value="${esc(x.label)}" ${dis} onchange="setItem('${id}','${kind}',${i},'label',this.value)">`}
      <input class="amt" type="number" value="${Number(x.amount) || 0}" ${dis} onchange="setItem('${id}','${kind}',${i},'amount',this.value)">
      ${dis ? "" : `<button class="btn btn-ghost btn-sm" onclick="delItem('${id}','${kind}',${i})">🗑</button>`}</div>`).join("");
  const V = settleViewHtml(id, c), home = !done && !!cd.direct_home;
  // 精算済にする か 🏠 直帰 のどちらも押していない → 右の枠をピカピカ
  const off = cd.status === "お茶" || cd.status === "欠勤";   // お茶・欠勤は、枠ぜんたいを色に（ピカピカはなし）
  // キャンセル・トビだけ（お金も報酬もない）の子は「精算なし」（11/1 ゆい：欠勤でキャンセル2件なのに未精算と出ていた）
  const nothing = !done && !(c.all || []).some(r => r.status !== "cancel" && r.status !== "tobi" && r.status !== "flowed") && !c.total && !c.reward && !c.option && !c.plus && !c.minus;
  const need = KB.CAN_EDIT && !done && !home && !off && !nothing;
  const cam = cd.camera_check || "", plNow = (done ? cd.settle_place : plSel[id]) || cd.settle_place || PLACES[0];   // 選んだ回収場所は、描きなおしても（カメラ・写真を押しても）そのまま
  return `<div class="card svc ${done ? "done" : ""} ${!done && home ? "home" : ""} ${cd.status === "お茶" ? "tea" : cd.status === "欠勤" ? "absent" : ""}" id="card-${id}">
    <h2>${typeof KBF !== "undefined" ? KBF.img(id, 40) : ""}${esc(castName(id))}${cd.status === "お茶" ? `<span class="st tea">🟩 お茶</span>` : cd.status === "欠勤" ? `<span class="st absent">🟥 欠勤</span>` : ""}<span class="st">${done ? "精算済" + (cd.settle_place ? "（" + esc(cd.settle_place) + "）" : "") : home ? "🏠 直帰" : nothing ? "精算なし（キャンセル・トビだけ）" : "未精算"}</span>${done && (UNS || []).some(x => x.cast_id === id && x.biz_date === day && !x.done_on) ? `<span class="st" style="background:#FDE7E7;color:#c0392b;margin-left:4px">⚠️ 未精算あり</span>` : ""}
      ${done && cd.settled_at ? (() => { const s = cd.settle_snapshot || {}, later = s.paidOn && s.paidOn !== day;   // いつ・どこで・だれが（後日の合算・個別の精算も）2026/11/5
        return `<small class="hint2 sdwho">${later ? `<b>${s.only ? "📮 後日に個別精算" : "📮 後日に合算で精算"}</b>：` : ""}${esc(logWhen(cd.settled_at))}${cd.settle_place ? "・" + esc(cd.settle_place) : ""}${cd.settled_by ? "・" + KBF.staffTag(cd.settled_by) : ""}</small>`; })() : ""}</h2>
    ${!done && !off && !nothing ? sgHtml(id, c, cd) : ""}
    ${resPickHtml(id, c)}
    <div class="svg2"><div class="svl">
    <details class="svf" ${svOpen.has(id) ? "open" : ""} ontoggle="this.open ? svOpen.add('${id}') : svOpen.delete('${id}')">
    <summary>🧾 精算の中身（1本目〜精算メモに書くこと）<small>${V.due < 0 ? "お店から渡す" : "投函"} ${yen(Math.abs(V.due))}</small></summary>
    ${c.why.length ? `<div class="note2">🧮 ${c.why.map(esc).join("<br>")}</div>` : ""}
    ${c.cardUnconfirmed ? `<div class="warn" style="margin:6px 0">⚠️ お支払いが「カード」のままの予約が ${c.cardUnconfirmed}件あります。カード決済の完了を確認して、本日のキャスト一覧のカードのプルダウンで「✅ 決済済み」にしてください。</div>` : ""}
    ${V.view}
    </details>
    </div><div class="svr ${need ? "need" : ""}">
    ${need ? `<div class="needmsg">👇「精算済にする」か「🏠 直帰」のどちらかを押してください</div>` : ""}
    ${dis ? "" : `<div class="pmz"><div class="pmzh">✏️ プラス・マイナス・雑費を直す</div>
      <div class="hint2" style="margin-top:6px">② プラス（交通費など）</div><div class="items">${items(c.plusItems, "plus")}</div>
      <button class="btn btn-ghost btn-sm" onclick="addItem('${id}','plus')">＋ プラスを足す</button>
      <div class="hint2" style="margin-top:8px">マイナス（立て替えなど・雑費以外）</div><div class="items">${items(c.minusItems, "minus")}</div>
      <button class="btn btn-ghost btn-sm" onclick="addItem('${id}','minus')">＋ マイナスを足す</button>
      <div class="zpw"><div class="zph">🧾 雑費（自動：${yen(c.zappiAuto)}）　今：<b>−${yen(c.zappi)}</b></div>
      <div class="it" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><input type="number" id="zo-${id}" value="${cd.zappi_override != null ? cd.zappi_override : ""}" placeholder="空なら自動" style="width:120px"><input id="zr-${id}" value="${esc(cd.zappi_note || "")}" maxlength="100" placeholder="理由（例：体調不良で早退のため雑費なし）" style="flex:1;min-width:160px">
        <button class="btn btn-ghost btn-sm" onclick="setZappi('${id}')">雑費を直す</button></div></div>
    </div>`}
    ${V.shop}
    <div class="sv"><div class="shop"><div class="hd">🏪 お店用${!done && c.partNo > 1 ? `（${PART_MARK[c.partNo - 1] || c.partNo}の精算）` : ""}</div>
    ${shopStatusHtml(id, c, done, home)}
    ${!done && c.partNo > 1 ? `<div class="prevparts">${(c.prevParts || []).map((p, i) => `<div>✅ ${PART_MARK[i] || i + 1} 精算済：${p.at ? esc(logWhen(p.at)) : ""}${p.place ? "・" + esc(p.place) : ""}${p.by ? "・" + KBF.staffTag(p.by) : ""}・投函 ${yen(p.deposited != null ? p.deposited : p.drop || 0)}</div>`).join("")}
      <small>ここから下は ${PART_MARK[c.partNo - 1] || c.partNo}（のこした予約）の精算です。投函した額も ${PART_MARK[c.partNo - 1] || c.partNo} の分だけ入れてください</small></div>` : ""}
    ${unsBoxHtml(id, c)}
    <div class="acts">
      ${KB.CAN_EDIT ? `<select id="pl-${id}" class="plsel" style="background-color:${PLACE_COLOR[plNow] || "#fff"}" ${done ? "disabled" : ""}
          onchange="plSel['${id}'] = this.value; this.style.backgroundColor = PLACE_COLOR[this.value] || '#fff'; const w = document.getElementById('camw-${id}'); if(w) w.style.display = this.value === '回収' ? 'none' : ''">${PLACES.map(p=>`<option ${plNow === p ? "selected" : ""} style="background:${PLACE_COLOR[p] || "#fff"}">${p}</option>`).join("")}</select>` : ""}
      <button class="linecopy" onclick="copyDetailImg('${id}')"><span>🖼 明細コピー</span><small>LINEで貼付 📷</small></button>
      ${KB.CAN_EDIT ? (done
        ? `<button class="btn btn-ghost btn-sm" onclick="unsettle('${id}')">↩ 精算済をもどす</button>`
        : home ? `<button class="btn btn-ghost btn-sm" onclick="setDirectHome('${id}',false)">↩ 直帰をもどす</button>`
        : `<button class="btn btn-primary btn-sm" onclick="settle('${id}')">✅ 精算済にする</button>
           <button class="btn btn-ghost btn-sm" onclick="settle('${id}',true)" title="精算して、このあとも待機（あとで予約が入ったら②として精算）">✅ 精算して待機中のまま</button>
           <button class="btn btn-ghost btn-sm homebtn" onclick="setDirectHome('${id}',true)">🏠 直帰</button>`) : ""}
    </div>
    ${KB.CAN_EDIT && !done ? `<div class="ptime">🕒 精算（投函・回収）した日時 <input type="date" value="${ptDay[id] || day}" onchange="ptDay['${id}']=this.value"><input type="time" value="${ptVal[id] || ""}" onchange="ptVal['${id}']=this.value">
      <span class="ptby">👤 精算した人 <select onchange="ptBy['${id}']=this.value">${ptStaff().map(n => `<option ${(ptBy[id] || KB.operatorName()) === n ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></span>
      <small>あとから入れるときに（例：11/2 に らん が回収した）。時刻が空なら「精算済にする」を押した時刻、人は今ログインしている人。ポスティングはカメラのアーカイブで見た時刻</small></div>` : ""}
    <div id="camw-${id}" style="${plNow === "回収" ? "display:none" : ""}">   <!-- 回収場所が待機場（池袋・鶯谷・五反田）のときだけ -->
    <div class="camchk"><span>📹 投函を監視カメラで確認した？<b style="color:#c0392b">（ポスティングは必須）</b></span>
      ${[["ok", "◎ 確認した"], ["ng", "× 確認していない"]].map(([v, l]) => `<button type="button" class="cb ${v} ${cam === v ? "on" : ""}" ${KB.CAN_EDIT ? "" : "disabled"} onclick="setCamera('${id}','${cam === v ? "" : v}')">${l}</button>`).join("")}</div>
    </div>
    ${V.dep}
    ${photoBox(id)}
    </div></div>
    </div></div>
    ${settleLogHtml(id)}
  </div>`;
};

/* ---------- 🏠 直帰・📹 監視カメラの確認（SQL 170） ----------
   ・「精算済にする」か「🏠 直帰」のどちらかを必ず押す（どちらもまだなら右の枠がピカピカ）
   ・直帰＝今日は精算しない。次の精算で、この日の分を未精算としていっしょに精算する */
/* 🏪 お店用のすぐ下：この子の精算が今どうなっているか（精算済／直帰／まだ）・未精算をどうしたか・処理した日時と内勤（2026/11/7 店長） */
function shopStatusHtml(id, c, done, home){
  const cd = c.cd || {}, s = cd.settle_snapshot || {}, logs = Array.isArray(cd.settle_log) ? cd.settle_log : [];
  const who = (at, by, place) => `<span class="ssw">🕒 ${esc(at ? logWhen(at) : "時刻なし")}${place ? "・📍" + esc(place) : ""}・${by ? KBF.staffTag(by) : "👤 名前なし"}</span>`;
  const lines = [];
  let head;
  if(done){
    const later = s.paidOn && s.paidOn !== day;
    head = `<div class="ssh ok">✅ ${later ? (s.only ? "後日に個別で精算済" : "後日に合算で精算済") : "精算済"}　${who(cd.settled_at, cd.settled_by, cd.settle_place === "回収" ? "手渡し（回収）" : cd.settle_place ? cd.settle_place + "に投函" : "")}</div>`;
    const due = s.due != null ? s.due : c.drop;
    if(cd.deposited != null){
      const diff = cd.deposited - due;
      lines.push(diff === 0 ? `💰 投函（回収）した額 ${yen(cd.deposited)}：✅ ぴったり` : diff < 0 ? `💰 投函（回収）した額 ${yen(cd.deposited)}：<b style="color:#c0392b">⚠️ 足りない ${yen(-diff)} → 未精算にした</b>` : `💰 投函（回収）した額 ${yen(cd.deposited)}：<b style="color:#2f7fd0">⚠️ 多い ${yen(diff)} → お釣り（未精算表）にした</b>`);
    }
    (s.uns || []).forEach(x => lines.push(`📒 前の未精算を、いっしょに精算：${esc(x.label || (unsMd(x.date) + " " + yen(x.amount)))}${x.date && x.date !== day ? unsJump(x.date, id) : ""}`));
  }else if(home){
    const hl = logs.slice().reverse().find(x => /直帰にしました/.test(x.text || ""));
    head = `<div class="ssh home">🏠 直帰（今日は精算しない・次の精算でいっしょに）　${hl ? who(hl.at, hl.by) : ""}</div>`;
  }else{
    head = `<div class="ssh yet">⏳ まだ精算していません</div>`;
  }
  // この日の未精算（精算のあとで出た・手で足した）が、今どうなっているか
  (UNS || []).filter(x => x.cast_id === id && x.biz_date === day).forEach(x => {
    const amt = Number(x.amount) || 0;
    lines.push(`${amt >= 0 ? "⚠️ 未精算" : "💴 お釣り"} ${yen(Math.abs(amt))}${x.note ? "（" + esc(x.note) + "）" : ""}：${x.done_on ? `<b style="color:#2e8b57">✅ ${esc(unsMd(x.done_on))}に精算ずみ</b>（${KBF.staffTag(x.done_by)}）` : `<b style="color:#c0392b">まだ（つぎの精算で）</b>`}　<small>${KBF.staffTag(x.created_by)} ${x.created_at ? esc(logWhen(x.created_at)) : ""}</small>`);
  });
  // 最後にしたこと（精算の履歴のいちばん新しいもの）
  const last = logs[logs.length - 1];
  if(last) lines.push(`<small style="color:#888">📜 最後の記録：${esc(logWhen(last.at))} ${esc(last.by || "")} ${esc(last.text || SLOG_KINDS[last.kind] || last.kind || "")}</small>`);
  return `<div class="shopst">${head}${lines.map(l => `<div class="ssl">${l}</div>`).join("")}</div>`;
}
document.head.insertAdjacentHTML("beforeend", `<style>
  .shopst{border:2px solid #E7DDF5;border-radius:12px;padding:8px 10px;margin:6px 0 8px;background:#FCFAFF;font-size:13px;line-height:1.7}
  .shopst .ssh{font-weight:900;font-size:14.5px;border-radius:8px;padding:4px 10px;margin-bottom:4px}
  .shopst .ssh.ok{background:#E6F6EC;color:#1d6b3a} .shopst .ssh.home{background:#FFF1DB;color:#8a4b00} .shopst .ssh.yet{background:#FDE7E7;color:#B0213F}
  .shopst .ssw{font-weight:800;font-size:12.5px;color:#5b3fa6;white-space:nowrap} .shopst .ssl{padding-left:4px}
</style>`);
async function setDirectHome(id, on){
  await P170; if(!HAS_170){ toast("先に SQL 170 を実行してください"); return; }
  if(!confirm(castName(id) + (on ? " を「🏠 直帰」にしますか？\n今日は精算しないで、次の精算でこの日の分をいっしょに精算します" : " の「直帰」をもどしますか？"))) return;
  const cd = unsCD()[id] || {}, logs = (Array.isArray(cd.settle_log) ? cd.settle_log : []).concat([{ at: new Date().toISOString(), by: KB.operatorName(), text: on ? "🏠 直帰にしました（次の精算でいっしょに精算）" : "直帰をもどしました" }]);
  await saveDay(id, Object.assign({ direct_home: on }, HAS_SLOG ? { settle_log: logs } : {}));
  await unsLoad();
}
async function setCamera(id, v){
  await P170; if(!HAS_170){ toast("先に SQL 170 を実行してください"); return; }
  await saveDay(id, { camera_check: v });
}

document.head.insertAdjacentHTML("beforeend", `<style>
  /* お茶＝こい緑・欠勤＝こい赤（文字は白で見やすく）・精算済＝うすい緑＋「精算済」のはんこ（2026/11/11 店長。記録簿の本日のキャストと同じ色） */
  .card.svc.tea{background:#43A047;border-color:#2E7D32} .card.svc.tea > h2{color:#fff} .card.svc.absent{background:#E02424;border-color:#A81414} .card.svc.absent > h2{color:#fff}
  .card.svc.done{background:#D6EFD7 !important;border-color:#7FC583 !important;position:relative}
  .card.svc.home{background:#E8F1FB !important;border-color:#8DB8F2 !important;position:relative}
  .card.svc.home::after{content:"直帰";position:absolute;top:6px;right:16px;transform:rotate(12deg);border:3px solid #1f5fbf;color:#1f5fbf;font-weight:900;font-size:17px;letter-spacing:3px;padding:1px 10px;border-radius:10px;background:rgba(255,255,255,.6);pointer-events:none}   /* 🏠 直帰のはんこ（2026/11/12） */
  .card.svc.done::after, #list > .cblock.sdone::after{content:"精算済";position:absolute;top:6px;right:16px;transform:rotate(12deg);border:3px solid #D32F2F;color:#D32F2F;font-weight:900;font-size:17px;letter-spacing:3px;padding:1px 10px;border-radius:10px;background:rgba(255,255,255,.55);opacity:.9;pointer-events:none;z-index:2}
  .svr.need{border-radius:14px;padding:8px;animation:svrBlink 1.1s ease-in-out infinite;border:3px solid #FFD54A}
  @keyframes svrBlink{0%,100%{box-shadow:0 0 0 0 rgba(255,193,7,.0);background:#FFFDF3}50%{box-shadow:0 0 18px 4px rgba(255,193,7,.75);background:#FFF5C9}}
  .needmsg{font-weight:900;color:#B26A00;font-size:13.5px;margin:0 0 6px}
  .homebtn{background:#EDEDED !important;border-color:#bbb !important;font-weight:800}
  .ptime{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-weight:800;font-size:13px;margin:6px 0} .ptime input, input[id^="uo_t_"]{font-family:inherit;font-size:16px;font-weight:800;padding:10px 12px;border:1.5px solid var(--line,#F1E3E7);border-radius:12px;background:#fff;color:var(--ink,#5C4B4F);min-width:150px}   /* 受付の時刻の欄と同じ形 */ .ptime small{flex-basis:100%;font-weight:700;color:#9C8B8F;font-size:11.5px}
  .dep{border-radius:14px !important} .gb{border-radius:14px !important} .shop{border-top:none !important;background:#FFFDFB;border:2px solid #F1E3E7;border-radius:16px;padding:8px 12px 10px !important}
  .dep.depdue{border:none;background:transparent;padding:4px 4px 0;margin:6px 0 0}
  .zpw{background:#FFF3C4;border:2px solid #F2B705;border-radius:14px;padding:8px 10px;margin-top:10px} .zpw .zph{margin:0 0 6px;font-weight:900;color:#7a5200;font-size:14.5px} .zpw .zph b{color:#c0392b;font-size:16px}
  .pmz input{border:1.5px solid var(--line,#F1E3E7);border-radius:12px;padding:7px 10px;font-family:inherit;font-size:14px;background:#fff;color:inherit}
  .sv .r.zp{background:#FFF3C4;border-radius:10px;padding:4px 8px;margin:2px -8px;font-weight:900} .sv .r.zp b{color:#c0392b}
  .linecopy{display:inline-flex;flex-direction:column;align-items:center;line-height:1.15;font-family:inherit;background:#06C755;color:#fff;border:none;border-radius:14px;padding:6px 14px;cursor:pointer;font-weight:900;font-size:14px;box-shadow:0 3px 8px rgba(6,199,85,.3)} .linecopy small{font-size:11px;font-weight:800;opacity:.95}
  .nophoto{display:inline-flex;align-items:center;gap:6px;font-weight:800;font-size:13px;margin:4px 0;padding:4px 10px;border:1.5px solid #E8D8DC;border-radius:99px;background:#fff;cursor:pointer}
  .ptime input[type=date]{font-family:inherit;font-size:15px;font-weight:800;padding:9px 10px;border:1.5px solid var(--line,#F1E3E7);border-radius:12px;background:#fff;color:inherit} .ptby{display:inline-flex;align-items:center;gap:4px} .ptby select{font-family:inherit;font-size:15px;font-weight:800;padding:8px 10px;border:1.5px solid var(--line,#F1E3E7);border-radius:12px;background:#fff;color:inherit}
  .unalert{font-family:inherit;font-size:13px;font-weight:700;padding:6px 8px;border:1.5px solid var(--line,#F1E3E7);border-radius:10px;background:#fff;color:inherit} .unalert.sm{font-size:11.5px;padding:2px 4px;border-radius:8px}
  .prevparts{background:#EEF9F0;border:1.5px solid #9AD3A8;border-radius:12px;padding:6px 10px;margin:6px 0;font-size:13px;font-weight:800;color:#2e6b3c} .prevparts small{display:block;font-weight:700;color:#557;font-size:11.5px;margin-top:2px}
  .sdwho{font-size:12.5px !important;font-weight:700;margin-left:6px}
  .camchk{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-weight:800;font-size:13px;margin:6px 0} .camchk > span{flex-basis:100%}
  .camchk .cb{font-family:inherit;font-weight:800;font-size:13px;border:2px solid #ddd;background:#fff;border-radius:99px;padding:4px 12px;cursor:pointer;color:#5C4B4F}
  .camchk .cb.ok.on{background:#E5F6EC;border-color:#2e8b57;color:#2e8b57} .camchk .cb.ng.on{background:#FDE7E7;border-color:#c0392b;color:#c0392b}
</style>`);

// 数字の欄の上でスクロールしても、数字は変えない（欄から外して、画面だけスクロールする）。精算ページ・記録簿の💴精算 共通
document.addEventListener("wheel", e => { const t = e.target; if(t && t.matches && t.matches("input[type=number]") && document.activeElement === t) t.blur(); }, { passive: true, capture: true });
// 数字の欄：クリックしたら中身をぜんぶ選ぶ → そのまま打つと入れかわる（「0」が残って 500 が 5000・50 にならない）。精算ページ・記録簿の💴精算 共通
document.addEventListener("focusin", e => { const t = e.target; if(t && t.matches && t.matches("input[type=number]")) setTimeout(() => { try{ t.select(); }catch(err){} }, 0); });
document.addEventListener("mouseup", e => { const t = e.target; if(t && t.matches && t.matches("input[type=number]") && document.activeElement === t && t.dataset.selOnce !== "1"){ t.dataset.selOnce = "1"; e.preventDefault(); } }, true);
document.addEventListener("focusout", e => { const t = e.target; if(t && t.dataset) delete t.dataset.selOnce; });

/* ---------- 📷 精算の写真（投函・回収のときのお金・領収書）。SQL 196：settle-photos／<営業日>/<キャストid>/<時刻>_<ランダム>.jpg
   ・スマホ：「📷 写真をとる」でそのままカメラ（スマホのアルバムには残らない）
   ・PC：枠をクリックして Ctrl＋V（スマホで撮った写真をコピーして貼る）／「🖼 写真を選ぶ」
   ・入れる前に小さくする（長い辺 1600px・JPEG）。2か月より前は、毎朝のロボット（kb-backup）が消す ---------- */
const PH_BUCKET = "settle-photos";
const phCache = {};   // "営業日|キャスト" → [{ name, url }] ／ null＝読みこみ中
const phKey = id => day + "|" + id;
const plSel = {};   // 精算場所のプルダウンで選んだもの（精算済にするまで覚えておく）
const noPhoto = {};   // 📷 写真なし（キャストがくれなかった）にチェックした子（精算済にすると、精算の履歴に残る）
/* ---------- 🎲 精算のすごろく（2026/11/11 店長：ぱっと見でどこまで終わったかわかるように）----------
   ① 予約がぜんぶ終わった → ② 投函の額を入れた → ③ お金の写真（または「写真なし」）→ ④ 📹 監視カメラの確認（ポスティングのときだけ）→ ⑤ 精算済 */
function sgSteps(id, c, cd){
  c = c || calcCast(id); cd = cd || unsCD()[id] || {};
  const live = (c.live || []).filter(r => !["cancel", "tobi", "flowed"].includes(r.status));
  const ph = phCache[phKey(id)], place = plSel[id] || cd.settle_place || PLACES[0];
  const s = [
    { k: "res", l: "予約が終わった", ok: live.length > 0 && live.every(r => r.status === "done") },
    { k: "dep", l: "投函の額", ok: c.deposited != null },
    { k: "ph", l: "お金の写真", ok: !!(ph && ph.length) || !!noPhoto[id] },
  ];
  if(place && place !== "回収") s.push({ k: "cam", l: "📹 カメラ確認", ok: (cd.camera_check || "") === "ok" });
  s.push({ k: "done", l: "精算済", ok: !!cd.settled });
  return s;
}
function sgHtml(id, c, cd){
  const s = sgSteps(id, c, cd), next = s.findIndex(x => !x.ok);
  return `<div class="sg" id="sg-${id}">${s.map((x, i) => `<span class="sgs ${x.ok ? "ok" : i === next ? "now" : ""}"><b>${x.ok ? "✓" : "①②③④⑤"[i]}</b>${esc(x.l)}</span>${i < s.length - 1 ? `<span class="sga ${x.ok ? "ok" : ""}"></span>` : ""}`).join("")}</div>`;
}
function sgRepaint(id){ const el = document.getElementById("sg-" + id); if(el){ try{ el.outerHTML = sgHtml(id); }catch(e){} } }
document.head.insertAdjacentHTML("beforeend", `<style>
  .sg{display:flex;align-items:center;flex-wrap:wrap;gap:2px;margin:4px 0 8px;font-size:12px;font-weight:800}
  .sg .sgs{display:inline-flex;align-items:center;gap:4px;padding:3px 9px 3px 4px;border-radius:99px;background:#F4EEF0;color:#9C8B8F;border:1.5px solid #E6DADE}
  .sg .sgs b{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:#fff;color:#9C8B8F;font-size:12px}
  .sg .sgs.ok{background:#E3F6E8;color:#1E7A3C;border-color:#8FD3A0} .sg .sgs.ok b{background:#2E9E4A;color:#fff}
  .sg .sgs.now{background:#FFF3C4;color:#8A6100;border-color:#F2C94C;animation:svrBlink 1.4s ease-in-out infinite} .sg .sgs.now b{background:#F2A900;color:#fff}
  .sg .sga{display:inline-block;width:14px;height:3px;background:#E6DADE;border-radius:2px} .sg .sga.ok{background:#8FD3A0}
</style>`);
function photoBox(id){
  const k = phKey(id);
  if(!(k in phCache)){ phCache[k] = null; setTimeout(() => phLoad(id), 0); }
  const list = phCache[k] || [], ed = KB.CAN_EDIT, cd = unsCD()[id] || {}, done = !!cd.settled, snapNo = !!(cd.settle_snapshot || {}).noPhoto;
  return `<div class="phbox" id="ph-${id}" ${ed ? `tabindex="0" onpaste="phPaste(event,'${id}')"` : ""}>
    <div class="phh">📷 お金・領収書の写真 <b style="color:#c0392b;font-size:12px">（必須）</b> <small>${phCache[k] === null ? "読みこみ中…" : list.length ? list.length + "枚" : "まだありません"}</small></div>
    ${!list.length && (done ? snapNo : ed) ? `<label class="nophoto"><input type="checkbox" ${noPhoto[id] || snapNo ? "checked" : ""} ${done ? "disabled" : ""} onchange="noPhoto['${id}'] = this.checked; sgRepaint('${id}')"> 📷 写真なし（キャストがくれなかった）</label>` : ""}
    ${list.length ? `<div class="phthumbs">${list.map(p => `<span class="pht"><a href="${p.url}" target="_blank" rel="noopener"><img src="${p.url}" alt="写真" loading="lazy"></a>${ed ? `<button type="button" class="phdel" title="この写真を消す" onclick="phDel('${id}','${p.name}')">×</button>` : ""}</span>`).join("")}</div>` : ""}
    ${ed ? `<div class="phbtns"><label class="btn btn-ghost btn-sm">📷 写真をとる<input type="file" accept="image/*" capture="environment" hidden onchange="phFiles(this,'${id}')"></label>
      <label class="btn btn-ghost btn-sm">🖼 写真を選ぶ<input type="file" accept="image/*" multiple hidden onchange="phFiles(this,'${id}')"></label>
      <small class="phhint">PCは、この枠をクリックしてから Ctrl＋V で貼り付けられます</small></div>` : ""}
  </div>`;
}
function phRepaint(id){ const el = document.getElementById("ph-" + id); if(el) el.outerHTML = photoBox(id); sgRepaint(id); }   // 写真を入れたら、すごろくも
async function phLoad(id){
  const k = phKey(id), dir = day + "/" + id;
  try{
    const r = await sb.storage.from(PH_BUCKET).list(dir, { limit: 100, sortBy: { column: "name", order: "asc" } });
    if(r.error) throw r.error;
    const files = (r.data || []).filter(f => f.name && !f.name.startsWith("."));
    let list = [];
    if(files.length){
      const s = await sb.storage.from(PH_BUCKET).createSignedUrls(files.map(f => dir + "/" + f.name), 3600);
      if(s.error) throw s.error;
      list = files.map((f, i) => ({ name: f.name, url: (s.data[i] || {}).signedUrl })).filter(p => p.url);
    }
    phCache[k] = list;
  }catch(e){ phCache[k] = []; }
  phRepaint(id);
}
// 小さくして JPEG に（長い辺 1600px）
async function phShrink(file){
  const img = await new Promise((ok, ng) => { const im = new Image(); im.onload = () => ok(im); im.onerror = ng; im.src = URL.createObjectURL(file); });
  const s = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(img.src);
  return await new Promise(ok => c.toBlob(ok, "image/jpeg", 0.8));
}
async function phUpload(id, files){
  if(!KB.CAN_EDIT || !files.length) return;
  toast("📷 写真を入れています…");
  let n = 0;
  for(const f of files){
    if(!/^image\//.test(f.type || "")) continue;
    try{
      const blob = await phShrink(f), rnd = Math.random().toString(36).slice(2, 8);
      const r = await sb.storage.from(PH_BUCKET).upload(`${day}/${id}/${Date.now()}_${rnd}.jpg`, blob, { contentType: "image/jpeg", upsert: false });
      if(r.error) throw r.error;
      n++;
    }catch(e){ toast("写真を入れられませんでした：" + (e.message || e) + "（SQL 196 は実行ずみ？）"); }
  }
  if(n) toast(`📷 ${n}枚 入れました`);
  delete phCache[phKey(id)]; phRepaint(id);
}
function phFiles(input, id){ const fs = [...(input.files || [])]; input.value = ""; phUpload(id, fs); }
function phPaste(e, id){
  const fs = [...((e.clipboardData && e.clipboardData.items) || [])].filter(it => it.kind === "file" && /^image\//.test(it.type)).map(it => it.getAsFile()).filter(Boolean);
  if(!fs.length) return;
  e.preventDefault(); phUpload(id, fs);
}
async function phDel(id, name){
  if(!confirm("この写真を消しますか？")) return;
  const r = await sb.storage.from(PH_BUCKET).remove([`${day}/${id}/${name}`]);
  if(r.error){ toast("消せませんでした：" + r.error.message); return; }
  delete phCache[phKey(id)]; phRepaint(id);
}
(function(){
  const css = document.createElement("style");
  css.textContent = `.phbox{border:1.5px dashed #FFC2D1;border-radius:14px;padding:8px 10px;margin:8px 0;background:#FFFBFD;outline:none}
  .phbox:focus{border-style:solid;border-color:#e5638c;box-shadow:0 0 0 3px #FFE4EC}
  .phh{font-weight:800;font-size:13px;color:#5C4B4F} .phh small{color:#9C8B8F;font-weight:700;margin-left:6px}
  .phthumbs{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}
  .pht{position:relative;display:inline-block} .pht img{width:84px;height:84px;object-fit:cover;border-radius:10px;border:1.5px solid #F1E3E7;display:block}
  .phdel{position:absolute;top:-6px;right:-6px;width:22px;height:22px;border-radius:50%;border:none;background:#E5486C;color:#fff;font-weight:900;cursor:pointer;line-height:22px;padding:0}
  .phbtns{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px} .phbtns label{cursor:pointer} .phhint{color:#9C8B8F;font-size:11.5px}
  .is-phone .phhint{display:none}`;
  document.head.appendChild(css);
})();

/* ② の精算の知らせ（2026/11/4） */
document.head.insertAdjacentHTML("beforeend", `<style>
  .part2warn{background:#FFF4E5;border:2px solid #FFB547;color:#8a4b00;border-radius:12px;padding:8px 12px;margin:0 0 10px;font-weight:800;font-size:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
  .part2info{background:#EEF6FF;border:2px solid #A6CDF0;color:#2F6699;border-radius:12px;padding:8px 12px;margin:0 0 10px;font-weight:800;font-size:13.5px}
</style>`);
document.head.insertAdjacentHTML("beforeend", `<style>
  .rpick{border:2px solid #F4A3BE;background:#FFFBFC;border-radius:14px;padding:8px 12px;margin:0 0 10px}
  .rpick .rph{font-weight:900;color:#B2456B;margin-bottom:4px} .rpick .rph small{font-weight:700;color:#8a6b75}
  .rpick .rp{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:4px 2px;font-size:14px;cursor:pointer}
  .rpick .rp input{width:18px;height:18px}
  .rpick .rp.done{opacity:.5;cursor:default} .rpick .rp.skip{opacity:.75}
  .rpick .rpst{font-size:12px;font-weight:800;color:#8a6b75;background:#F3EEF0;border-radius:99px;padding:1px 8px}
</style>`);
