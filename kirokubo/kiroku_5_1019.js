/* ============================================================
   📒 記録簿（kiroku.html）の 5/7：10
   ※ kiroku.html の <script src> の順番どおりに読む（順番を変えると動かなくなる。2026/11/10 1つのファイルから分けた）
   ============================================================ */
/* ============================================================
   2026/10/19 作りなおし
   ・🗺 今どこに誰が：その日の出勤のキャストは全員、待機中／仕事中／今いない のどれかに必ず入る
       仕事中＝今の時刻に予約がある（自動）／待機中＝待機場所に置いた／それ以外は全部「今いない」
       名前をつまんで移動（待機場所の列・今いない）。長押しでその子の予約を追加
       今いない：押すたびに グレー（不在・退勤）→ 出勤前 → お茶（緑）→ 欠勤（赤）
       鶯谷の待機中は、札で席（1〜5）を選ぶ・退席。動かしたら自動で退席。「📜 ログ」で記録
   ・📋 本日のキャスト一覧：1キャスト1枠（予約一覧のかわり）。並び・絞りは全体を見たいと共通
   ============================================================ */
const GONE_CYCLE = ["", "お茶", "欠勤"];   // 今いない：押すたびに ⬜不在 → 🟩お茶 → 🟥欠勤
function goneKind(cd, x){   // x：tlRows の行（前の日までにシフトを取り下げた子は「シフト取り下げ」2026/11/11）
  const s = (cd && cd.status) || "";
  // 出勤前（出勤前連絡）は、今いないではなく「出勤前連絡」の段に
  if(s === "お茶" || s === "欠勤") return s;
  if(!s && x && x.shift && x.shift.early) return "シフト取り下げ";
  return "";
}
function workNow(x){
  const isToday = day === KB.bizDateOf(), now = nowHour();
  return x.bks.find(b=>b.r.status === "working" || (isToday && b.s <= now && now < b.e && b.r.status !== "done"));
}
// 仕事中：①予約の状態が「仕事中」②今の時刻に予約がある → 自動。ただし、そのあとに札を動かしていたら、動かしたほうが勝ち（新しいほう）
function autoWork(x){
  if(!x.c) return null;
  const isToday = day === KB.bizDateOf(), now = nowHour();
  const w = rows.find(r=>r.cast_id === x.c.id && r.status === "working");
  // 「仕事中」のまま終わりの時刻をすぎた予約は、仕事中にしない（⏹ 仕事終了（振り分け待ち）へ）2026/11/11 店長
  const wb = w && x.bks.find(b => b.r === w);
  if(w && !(isToday && wb && now > wb.e)) return { r: w, t: Date.parse(w.updated_at || w.start_at || 0) || 0 };
  const b = workNow(x);
  if(b && b.r.status === "working" && isToday && now > b.e) return null;
  return b ? { r: b.r, t: Date.parse(b.r.start_at) || 0 } : null;
}
// 手で動かした時刻：札・今どこ・状態を変えた（kb_cast_days.updated_at）か、鶯谷の席に座らせた時刻の、新しいほう
const manualT = x=>{
  const a = (x.cd && x.cd.updated_at) ? Date.parse(x.cd.updated_at) || 0 : 0;
  const s = x.c && typeof seatsOk !== "undefined" && seatsOk && typeof seatOf === "function" ? seatOf(x.c.id) : null;
  return Math.max(a, s ? Date.parse(s.start_at) || 0 : 0);
};
// ⏹ 仕事終了（振り分け待ち）：予約を「終了」にした・「仕事中」のまま終わりの時刻をすぎた → そのあと手で動かしていなければ、この段に（2026/11/11 店長）
//   内勤さんが札を動かす・今どこ・状態を変える・鶯谷の席に座らせると、ふつうの段にもどる
function endedOf(x){
  if(!x.c || day !== KB.bizDateOf()) return null;
  const now = nowHour(), msOf = h => { const d0 = Date.parse(day + "T00:00:00+09:00"); return d0 + h * 3600000; };
  let best = null;
  x.bks.forEach(b => {
    let t = 0;
    if(b.r.status === "done") t = Math.max(Date.parse(b.r.status_at || b.r.updated_at || 0) || 0, Math.min(msOf(b.e), Date.now()));
    else if(b.r.status === "working" && now > b.e) t = msOf(b.e);
    if(t && (!best || t > best.t)) best = { r: b.r, b, t };
  });
  if(!best || best.t <= manualT(x)) return null;
  if(workNow(x) && !(workNow(x).r.status === "working" && now > workNow(x).e)) return null;   // いま別の予約の時間なら、仕事中のほう
  return best;
}
boardState = function(x){
  const cd = x.cd || {};
  const aw = autoWork(x);
  if(aw && aw.t >= manualT(x)) return "work";
  if(cd.settled && !["待機中", "仕事中"].includes(cd.status)) return "gone";   // 先に精算して待機中・仕事中のままの子は、まだいる（2026/11/6）
  if(["不在", "お茶", "欠勤", "中抜け"].includes(cd.status)) return "gone";
  if(cd.direct_home && !["待機中", "仕事中"].includes(cd.status)) return "gone";   // 精算で直帰 → 今いない（直帰）2026/11/7
  if(endedOf(x)) return "ended";   // ⏹ 仕事終了（振り分け待ち）2026/11/11
  if(cd.status === "仕事中") return "work";
  if(cd.status === "予約スタート") return "start";   // 待機しないで、最初の予約から仕事を始める
  if(cd.status === "出勤前連絡") return "precall";   // 出勤前に「何時からどこで待機」と連絡があった
  if(cd.standby && !["お茶", "欠勤", "出勤前"].includes(cd.status)) return "wait";
  return "gone";
};
boardCol = function(x, state){
  const sb = (x.cd && x.cd.standby) || "";
  const inList = s => STANDBY.includes(s) ? s : (s ? "出張・他エリア" : "");
  if(state === "work"){
    const aw = autoWork(x);
    if(aw && aw.t >= manualT(x)){ const a = aw.r.area || ""; return STANDBY.find(s=>a.includes(s)) || inList(sb) || "出張・他エリア"; }
    return inList(sb) || "出張・他エリア";
  }
  if(state === "ended"){ const en = endedOf(x), a = (en && en.r.area) || ""; return STANDBY.find(s => a.includes(s)) || inList(sb) || "出張・他エリア"; }   // 仕事をしたエリアの列に
  return inList(sb);
};
const autoLeft = new Set();
renderBoard = function(){
  const el = $("boardGrid"); if(!el || !M.casts) return;
  if(!shiftCache[day]){ el.innerHTML = `<div class="gate">シフトを読み込み中…</div>`; return; }
  const cols = STANDBY, cell = {}, gone = [];
  tlRows().forEach(x=>{
    const st = boardState(x), col = boardCol(x, st);
    if(st !== "gone" && col) (cell[st + "|" + col] = cell[st + "|" + col] || []).push(x); else gone.push(x);
    // 自動で退席するのは、はっきりしたときだけ：予約を「接客中」にした・お茶・欠勤・不在・精算済（2026/11/5）
    //   前は「鶯谷で待機中でなくなったら」で、次の予約の時刻になっただけ・別のPCの古い画面が描きなおしただけでも席が外れていた（1時間くらいで外れる）
    const s = x.c && seatsOk ? seatOf(x.c.id) : null, cd0 = x.cd || {};
    //   2026/11/10 また外れた → 「その日の予約のどれかが接客中のまま」（終了にし忘れた前の予約）・「精算済」だけでも外れていたので、
    //   ・接客中は「いま、その予約の時間の中」のときだけ（席に座ったあとに始まった予約）　・精算済だけでは外さない（先に精算して待機をつづける子がいる）
    const nh = nowHour(), seatT = s ? new Date(s.start_at).getTime() : 0;
    const workingNow = x.bks.find(b => b.r.status === "working" && b.s <= nh && nh <= b.e && (!seatT || new Date(b.r.status_at || b.r.start_at || 0).getTime() >= seatT - 60000));
    const why = workingNow ? "接客中" : ["お茶", "欠勤", "不在"].find(v => cd0.status === v) || "";
    if(s && KB.CAN_EDIT && why && !autoLeft.has(s.id)){ autoLeft.add(s.id); leaveSeat(s.id, true, "自動：" + why); }
  });
  const used = seatLogs.filter(l=>!l.end_at);
  const chip = (x, st, col)=>{
    const cid = x.c ? x.c.id : "";
    const sh = x.shift ? `${hShort(x.shift.start)}-${hShort(x.shift.end)}${x.shift.kanzen ? "完" : ""}` : "";
    const gk = goneKind(x.cd, x);
    const now = nowHour(), live = x.bks.filter(b=>!["done", "cancel", "tobi", "flowed"].includes(b.r.status));
    const rel = x.bks.find(b=>b.r.status === "working") || live.filter(b=>b.e > now).sort((a, b)=>a.s - b.s)[0];
    // 予約スタート：最初の予約の時刻を大きめに
    const first = live.slice().sort((a, b)=>a.s - b.s)[0];
    const pill = st === "start" ? (first ? `<br><span class="firstbk">🕐 最初の予約 ${esc(hm(first.r.start_at))}</span>` : `<br><small>（予約がまだありません）</small>`)
      : rel && st !== "gone" ? `<br><span class="st ${rel.r.status}">${esc(hm(rel.r.start_at))}${st === "work" && rel.r.end_at ? "〜" + esc(hm(rel.r.end_at)) : ""} ${esc(STATUS[rel.r.status] || "")}</span>` : "";   // 仕事中は終わる時刻も（2026/11/5）
    const cls = st === "gone" ? "gone inl" + (gk === "出勤前" ? " pre" : gk === "お茶" ? " tea" : gk === "欠勤" ? " absent" : "") : st;
    let seat = "";
    if(st === "wait" && col === "鶯谷" && cid && seatsOk && KB.CAN_EDIT){
      const mine = seatOf(cid);
      seat = `<div class="seatbtns">🪑${[1, 2, 3, 4, 5].map(n=>{ const u = used.find(l=>l.seat === n); return `<button type="button" class="${mine && mine.seat === n ? "on" : ""}" ${u && u.cast_id !== cid ? "disabled" : ""} onclick="sitDown(${n},'${cid}')">${n}</button>`; }).join("")}
        ${mine ? `<button type="button" class="out" onclick="leaveSeat(${mine.id})">退席</button><small>${hm(mine.start_at)}〜</small>` : ""}</div>`;
    }
    // その子の今日の予約（何時から・場所・コース・お客さん）を箇条書きで
    const bl = x.bks.filter(b=>!["cancel", "tobi", "flowed"].includes(b.r.status)).sort((a, b)=>a.s - b.s)
      .map(b=>`<li class="${b.r.status === "done" ? "dn" : ""}">${typeof KBF !== "undefined" ? KBF.storeDot(b.r.store_key) : ""}${esc(hm(b.r.start_at))} ${esc(b.r.area || "")} ${esc(b.r.course || "")}${/^\d+$/.test(b.r.course || "") ? "分" : ""} ${esc((b.r.kb_customers || {}).name || "")} <span class="st ${b.r.status}" style="font-size:10.5px;padding:0 6px">${esc(STATUS[b.r.status] || "")}</span></li>`).join("");
    const cd1 = x.cd || {};
    // 中抜け：もどる時間・再開する場所／直帰／🈵 満了／出張・他エリアは行き先（2026/11/7）
    const brk = cd1.status === "中抜け" ? `<small class="brk">（中抜け${cd1.break_back ? " 〜" + esc(cd1.break_back) + "にもどる" : ""}${cd1.break_place ? "・" + esc(cd1.break_place) + "で再開" : ""}）</small>` : "";
    const home = st === "gone" && cd1.direct_home && !["待機中", "仕事中"].includes(cd1.status) ? `<small>（直帰）</small>` : "";
    const full = cd1.full_at ? `<span class="fullbadge">🈵満了</span>` : "";
    let trip = "";
    if(col === "出張・他エリア"){ const aw = st === "work" ? autoWork(x) : null; const p = aw && aw.t >= manualT(x) ? aw.r.area : cd1.standby; if(p && p !== "出張・他エリア") trip = `<br><span class="tripat">📍 ${esc(p)}</span>`; }
    // 🃏 札をカードの形にそろえる（2026/11/7 店長）：1行目＝【名前】出勤時間＋状態のバッジ、2行目から＝予約など。右に ›
    const badge = (t, c) => `<span class="cb ${c || ""}">${t}</span>`;
    const badges = full + (cd1.status === "中抜け" ? badge("中抜け" + (cd1.break_back ? " 〜" + esc(cd1.break_back) : "") + (cd1.break_place ? " " + esc(cd1.break_place) + "で再開" : ""), "brk")
      : st === "gone" ? (gk ? badge(gk === "お茶" ? "☕ お茶" : esc(gk), gk === "お茶" ? "tea" : gk === "欠勤" ? "abs" : "") : home ? "" : cd1.settled ? "" : badge(cd1.status === "不在" || !cd1.status ? "不在" : esc(cd1.status)))
      : cd1.status ? badge(esc(cd1.status)) : "")
      + (home ? badge("直帰", "home") : "") + (cd1.settled ? badge("精算済", "done") : "");
    let sub;
    if(st === "gone"){   // 今いない：いちばん最後の予約を1行で
      const lastB = x.bks.filter(b => !["cancel", "tobi", "flowed"].includes(b.r.status)).sort((a, b) => b.s - a.s)[0];
      sub = lastB ? `<div class="cc-sub">${esc(hm(lastB.r.start_at))} ${esc(lastB.r.area || "")} ${esc(lastB.r.course || "")}${/^\d+$/.test(lastB.r.course || "") ? "分" : ""} ${esc((lastB.r.kb_customers || {}).name || "")}　${esc(STATUS[lastB.r.status] || "")}</div>` : `<div class="cc-sub">予約なし</div>`;
      { const al = ((cd1.attend_log) || []).slice(-1)[0]; if(al && al.reason) sub += `<div class="cc-why">📝 ${esc(al.kind)}：${esc(al.reason)}${al.time ? "（" + esc(al.time) + "）" : ""}</div>`; }   // 📝 勤怠の理由（その他など）を今いないの札に 2026/11/12
    }else sub = `${trip}${pill}${st === "ended" ? (() => { const en = endedOf(x); return en ? `<br><span class="endnote">⏹ ${esc(hm(en.r.end_at))}に終わり${en.r.status === "working" ? "（まだ「仕事中」のまま）" : ""}・札を動かして場所を決めてね</span>` : ""; })() : ""}${bl ? `<ul class="bkl">${bl}</ul>` : ""}`;
    return `<div class="chipc ${cls}${cd1.status === "中抜け" ? " brkc" : ""}" data-cid="${cid}" data-st="${st}"><div class="cc-top">${cid && typeof KBF !== "undefined" ? KBF.img(cid, 34) : ""}<b class="cc-nm">【${esc(castLabel(x))}】${esc(sh)}</b>${badges}</div>${sub}${movingHtml(x)}${seat}<span class="cc-go">›</span></div>`;
  };
  const th = c=>`<th class="${AREA_CLASS[c] || ""}">📍 ${esc(c)}${c === "鶯谷" ? ` <button type="button" class="logbtn" onclick="openSeatLog()">📜 ログ</button>` : ""}</th>`;
  const fulls = tlRows().filter(x => x.c && x.cd && x.cd.full_at);
  const ROWS = [["wait", "⏳ 待機中"], ["work", "💼 仕事中"], ["ended", "⏹ 仕事終了<br><small>振り分け待ち</small>"], ["start", "▶️ 予約スタート"], ["precall", "📞 出勤前連絡"]];
  const cnt = k => cols.reduce((a, c) => a + (cell[k + "|" + c] || []).length, 0), all = ROWS.reduce((a, [k]) => a + cnt(k), 0) + gone.length;
  const bf = boardFilter, hide = k => bf && bf !== k ? " bf-hide" : "";
  const fchip = (k, l, n) => `<button type="button" class="bfc ${k || "all"} ${bf === k ? "on" : ""}" onclick="setBoardFilter('${k}')">${l} <b>${n}</b></button>`;
  el.innerHTML = (fulls.length ? `<div class="fullbar">🈵 満了：${fulls.map(x => `<b>${esc(castLabel(x))}</b>`).join("、")}　<small>（この日の新しい予約は受けません）</small></div>` : "")
    + `<div class="bfbar">${fchip("", "すべて", all)}${ROWS.map(([k, l]) => fchip(k, l.replace(/^\S+\s/, "").replace(/<br>.*$/, ""), cnt(k))).join("")}${fchip("gone", "今いない", gone.length)}</div>`
    + `<table class="board"><tr><th class="corner"></th>${cols.map(th).join("")}</tr>`
    + ROWS.map(([k, l])=>`<tr class="${k}${hide(k)}"><th>${l}</th>${cols.map(c=>`<td class="${AREA_CLASS[c] || ""}" data-drop="${k}|${esc(c)}">${(cell[k + "|" + c] || []).map(x=>chip(x, k, c)).join("")}</td>`).join("")}</tr>`).join("")
    + `<tr class="gone${hide("gone")}"><th>🙈 今いない<div class="gonen">${gone.length}人</div><div class="golegend"><span class="lg tea"></span>お茶 <span class="lg abs"></span>欠勤<br><span class="lg"></span>不在 <span class="lg brk"></span>中抜け<br><small>押すと色：不在→お茶→欠勤</small></div></th><td colspan="${cols.length}" data-drop="gone">${gone.length ? `<div class="gonegrid">${gone.map(x=>chip(x, "gone", "")).join("")}</div>` : `<span class="hist" style="margin:0">なし</span>`}</td></tr>`
    + `</table>`;
};
// 今どこに誰が：上の「すべて・待機中・仕事中…」で、その段だけ出す（もう一度押すと全部）
let boardFilter = "";
function setBoardFilter(k){ boardFilter = boardFilter === k ? "" : k; renderBoard(); }
document.head.insertAdjacentHTML("beforeend", `<style>
  .bfbar{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 8px}
  .bfc{font-family:inherit;font-size:14px;font-weight:800;border:1.5px solid var(--line);background:#fff;border-radius:99px;padding:5px 14px;cursor:pointer;color:#5C4B4F;box-shadow:0 1px 3px rgba(0,0,0,.05)}
  .bfc b{display:inline-block;min-width:22px;margin-left:4px;padding:0 6px;border-radius:99px;background:#F4EEF0;color:#8a7f83;font-size:12.5px}
  .bfc.wait{color:#9a7000} .bfc.work{color:#c9556a} .bfc.ended{color:#B26A00} .bfc.start{color:#1f5d99} .bfc.precall{color:#6c5896} .bfc.gone{color:#666}
  table.board tr.ended > th:first-child{background:#FFF1D6;color:#B26A00} table.board tr.ended td{background-image:repeating-linear-gradient(135deg,rgba(255,193,7,.08) 0 10px,transparent 10px 20px)}
  #boardGrid .chipc.ended{border:2.5px dashed #F2A900;background:#FFFBEF} #boardGrid .endnote{display:inline-block;margin-top:3px;font-size:11.5px;font-weight:800;color:#B26A00;background:#FFF1D6;border-radius:99px;padding:1px 8px}
  .bfc.on{background:#E5638C;border-color:#E5638C;color:#fff} .bfc.on b{background:rgba(255,255,255,.3);color:#fff}
  table.board tr.bf-hide{display:none}
  table.board th.a-ike, table.board th.a-ugu, table.board th.a-goh, table.board th.a-kin, table.board th.a-home, table.board th.a-other{font-size:15px;padding:10px 8px}
  table.board tr > th:first-child{font-size:14.5px}
  #boardGrid .chipc{position:relative;border-radius:12px;padding:7px 26px 7px 10px;box-shadow:0 1px 4px rgba(92,75,79,.08);margin-bottom:6px}
  #boardGrid .cc-top{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
  #boardGrid .cc-nm{font-weight:900;font-size:14px}
  #boardGrid .cb{display:inline-block;font-size:11px;font-weight:800;border-radius:99px;padding:1px 8px;background:#EFEAEC;color:#6b5a5f;line-height:1.6}
  #boardGrid .cb.tea{background:#fff;color:#2E7D32} #boardGrid .cb.abs{background:#fff;color:#C62850} #boardGrid .cb.home{background:#E3EEF9;color:#2f5f8f}
  #boardGrid .cb.done{background:#E6F6EC;color:#1d6b3a} #boardGrid .cb.brk{background:#fff;color:#C0620B}
  #boardGrid .cc-sub{font-size:12px;font-weight:700;color:#8a7f83;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #boardGrid .cc-go{position:absolute;right:8px;top:50%;transform:translateY(-50%);color:#C9B8BE;font-size:20px;font-weight:400;line-height:1}
  #boardGrid .gonegrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px}
  #boardGrid .gonegrid .chipc{display:block;width:auto;margin:0}
  #boardGrid .chipc.gone{background:#fff;border-color:#E3DADD;color:#4a3d41}
  #boardGrid .chipc.gone.tea{background:#43A047;border-color:#2E7D32;color:#fff} #boardGrid .chipc.gone.absent{background:#E5486C;border-color:#C62850;color:#fff}
  #boardGrid .chipc.gone.pre{background:#9B7BE0;border-color:#7E5ED0;color:#fff} #boardGrid .chipc.gone.brkc{background:#FF9F43;border-color:#E67E22;color:#fff}
  #boardGrid .chipc.gone.tea .cc-sub, #boardGrid .chipc.gone.absent .cc-sub, #boardGrid .chipc.gone.pre .cc-sub, #boardGrid .chipc.gone.brkc .cc-sub, #boardGrid .chipc.gone.tea .cc-go, #boardGrid .chipc.gone.absent .cc-go, #boardGrid .chipc.gone.brkc .cc-go{color:rgba(255,255,255,.85)}
  table.board tr.gone td{background:#FCFAFB}
  .gonen{font-size:13px;font-weight:800;color:#666;margin-top:2px}
  .golegend{font-size:11.5px;font-weight:700;color:#888;margin-top:8px;line-height:2;text-align:left}
  .golegend .lg{display:inline-block;width:11px;height:11px;border-radius:3px;border:1.5px solid #CFCFCF;background:#fff;vertical-align:-1px;margin-right:2px}
  .golegend .lg.tea{background:#43A047;border-color:#2E7D32} .golegend .lg.abs{background:#E5486C;border-color:#C62850} .golegend .lg.brk{background:#FF9F43;border-color:#E67E22}
</style>`);
// その日のキャストの状態を保存（待機場所・今いないの色）
async function saveDayPart(cid, patch){
  if(!KB.CAN_EDIT){ toast("作成中のため、動かせるのは店長だけです"); return false; }
  try{
    const r = q(await sb.from("kb_cast_days").upsert(Object.assign({ biz_date: day, cast_id: cid, updated_at: new Date().toISOString(), updated_by: KB.operatorName() }, patch), { onConflict: "biz_date,cast_id" }).select("*").single());
    castDays[cid] = r; renderList(); return true;
  }catch(e){ toast("保存できませんでした：" + (e.message || e)); return false; }
}
async function moveCast(cid, target){
  const x = tlRows().find(r=>r.c && r.c.id === cid); if(!x) return;
  const [kind, area] = target.split("|");
  const seat = seatsOk ? seatOf(cid) : null;
  if(kind === "precall"){   // 出勤前に「何時からどこで待機」と連絡があった
    if(seat) await leaveSeat(seat.id, true, "札を「出勤前連絡」へ");
    if(await saveDayPart(cid, { standby: area, status: "出勤前連絡" })) toast(castLabel(x) + " → " + area + "で出勤前連絡");
    return;
  }
  if(kind === "start"){   // 待機しないで、最初の予約から（予約スタート）
    if(seat) await leaveSeat(seat.id, true, "札を「予約スタート」へ");
    if(await saveDayPart(cid, { standby: area, status: "予約スタート" })) toast(castLabel(x) + " → " + area + "で予約スタート");
    return;
  }
  if(kind === "work"){   // つまんで仕事中へ（新しい情報で上書き）
    if(seat) await leaveSeat(seat.id, true, "札を「仕事中」へ");
    if(await saveDayPart(cid, { standby: area, status: "仕事中" })) toast(castLabel(x) + " → " + area + "で仕事中");
    return;
  }
  if(kind === "gone"){
    if(seat) await leaveSeat(seat.id, true, "札を「今いない」へ");
    if(await saveDayPart(cid, { standby: "", status: "" })) toast(castLabel(x) + " → 今いない");
    return;
  }
  if(seat && area !== "鶯谷") await leaveSeat(seat.id, true, "札を「" + area + "」へ");
  if(await saveDayPart(cid, { standby: area, status: (x.cd && x.cd.settled) ? "待機中" : "" })) toast(castLabel(x) + " → " + area + "で待機");   // 精算済の子も、待機の段に動かしたら待機中（2026/11/6）
}
async function cycleGone(cid){
  const cd = castDays[cid] || {};
  const next = GONE_CYCLE[(GONE_CYCLE.indexOf(goneKind(cd)) + 1) % GONE_CYCLE.length];
  await saveDayPart(cid, { status: next });
}
// つまんで移動・長押し・押す（スマホ・パソコンどちらでも）
(function(){
  let st = null, ghost = null, over = null;
  function clearOver(){ if(over){ over.classList.remove("dropon"); over = null; } }
  document.addEventListener("pointerdown", e=>{
    const chip = e.target.closest && e.target.closest("#boardGrid .chipc[data-cid]");
    if(!chip || e.target.closest("button,input,select") || !chip.dataset.cid) return;
    st = { chip, cid: chip.dataset.cid, gone: chip.dataset.st === "gone", x: e.clientX, y: e.clientY, moved: false, long: false };
    st.timer = setTimeout(()=>{ if(st && !st.moved){ st.long = true; try{ navigator.vibrate && navigator.vibrate(30); }catch(_){} if(KB.CAN_EDIT) newBookingFor(st.cid, ""); } }, 600);
  });
  document.addEventListener("pointermove", e=>{
    if(!st) return;
    if(!st.moved && Math.hypot(e.clientX - st.x, e.clientY - st.y) > 8){
      if(st.long) return;
      st.moved = true; clearTimeout(st.timer);
      if(!KB.CAN_EDIT){ st = null; return; }
      ghost = st.chip.cloneNode(true); ghost.classList.add("ghost"); document.body.appendChild(ghost);
      st.chip.classList.add("dragging");
    }
    if(st && st.moved && ghost){
      e.preventDefault();
      ghost.style.left = (e.clientX + 6) + "px"; ghost.style.top = (e.clientY + 6) + "px";
      ghost.style.display = "none"; const t = document.elementFromPoint(e.clientX, e.clientY); ghost.style.display = "";
      const td = t && t.closest && t.closest("#boardGrid td[data-drop]");
      if(td !== over){ clearOver(); if(td){ over = td; td.classList.add("dropon"); } }
    }
  }, { passive: false });
  function end(){
    if(!st) return;
    clearTimeout(st.timer);
    const s = st; st = null;
    if(ghost){ ghost.remove(); ghost = null; }
    s.chip.classList.remove("dragging");
    const target = over && over.dataset.drop; clearOver();
    if(s.moved){ if(target) moveCast(s.cid, target); return; }
    if(s.long) return;
    // 2回すばやく押す（ダブルクリック）→ 一覧・全体を見たいのその子の枠へ。1回だけ → 今いないなら色を変える
    if(lastTap && lastTap.cid === s.cid && Date.now() - lastTap.at < 350){
      clearTimeout(lastTap.timer); lastTap = null; jumpToCast(s.cid); return;
    }
    if(lastTap) clearTimeout(lastTap.timer);
    lastTap = { cid: s.cid, at: Date.now(), timer: setTimeout(()=>{ lastTap = null; if(s.gone) cycleGone(s.cid); }, 350) };
  }
  let lastTap = null;
  document.addEventListener("pointerup", end);
  document.addEventListener("pointercancel", end);
})();
// 🪑 席：今どこに誰がの札から。ログは「📜 ログ」で
leaveSeat = async function(logId, quiet, why){
  try{
    // why：自動で外したときの理由（「自動：接客中」など）。席の記録の「退席した人」に残す（また外れたとき原因がわかるように）2026/11/10
    const w = why || (quiet ? "" : "退席ボタン");
    q(await sb.from("kb_seat_logs").update({ end_at: new Date().toISOString(), end_by: KB.operatorName() + (w ? "（" + w + "）" : "") }).eq("id", logId));
    await loadSeats(); renderSeats(); renderBoard();
    if(!quiet) toast("退席しました");
  }catch(e){ toast("記録できませんでした：" + (e.message || e)); }
};
renderSeats = function(){
  const el = $("seatBox"); if(!el) return;
  if(!seatsOk){ el.innerHTML = `<div class="gate">SQL 102（鶯谷待機席）を実行すると使えます</div>`; return; }
  const mins = l=>Math.round(((l.end_at ? new Date(l.end_at) : new Date()) - new Date(l.start_at)) / 60000);
  const log = seatLogs.slice().sort((a, b)=>String(a.start_at).localeCompare(String(b.start_at)));
  el.innerHTML = `<div class="hint2" style="margin:0 0 8px">${esc(dayTitle())}　今どこに誰がの「鶯谷・待機中」の札で席を選ぶと記録されます。退席・移動すると退席の時刻が入ります。</div>`
    + (log.length ? `<table class="list"><tr><th>席</th><th>キャスト</th><th>座った</th><th>退席</th><th>時間</th><th>記録</th></tr>${log.map(l=>`<tr>
      <td>${l.seat}番</td><td><b>${esc(castName(l.cast_id))}</b></td><td>${hm(l.start_at)}</td><td>${l.end_at ? hm(l.end_at) : "<b style='color:#6c5ce7'>座っている</b>"}</td>
      <td>${mins(l)}分</td><td><small>${KBF.staffTag(l.start_by)}${l.end_by ? " → " + KBF.staffTag(l.end_by) : ""}</small></td></tr>`).join("")}</table>` : `<div class="hist">まだ記録はありません</div>`);
};
function openSeatLog(){ renderSeats(); $("seatLogBg").classList.add("show"); }
KB.closeOnBackdrop($("seatLogBg"), ()=>$("seatLogBg").classList.remove("show"));

// 何日の画面か
function dayTitle(){
  if(!day) return "";
  const d = new Date(day + "T12:00:00Z"), w = "日月火水木金土"[d.getUTCDay()];
  return `📅 ${d.getUTCMonth() + 1}月${d.getUTCDate()}日（${w}）${day === KB.bizDateOf() ? "・今日" : ""}`;
}
const __loadDayV = loadDay;
loadDay = async function(){ if($("viewDay")) $("viewDay").textContent = dayTitle(); await __loadDayV(); if($("viewDay")) $("viewDay").textContent = dayTitle(); renderList(); };   // シフトを読んだあとに一覧を描きなおす

// 並び・絞り（本日のキャスト一覧・全体を見たい 共通）：予約があるキャストのみ／今すぐ行けるキャスト を追加
function onNowOf(x){
  if(day !== KB.bizDateOf() || !x.shift) return false;
  const now = nowHour(), cd = x.cd || {};
  if(now < x.shift.start || now >= x.shift.end) return false;
  return !((cd.settled && !["待機中", "仕事中"].includes(cd.status)) || ["お茶", "欠勤", "精算済", "不在"].includes(cd.status));
}
function freeNowOf(x){
  if(day !== KB.bizDateOf() || !x.shift) return false;
  const now = nowHour(), g = gapOf(x), cd = x.cd || {};
  if(now < x.shift.start || now >= x.shift.end) return false;
  if((cd.settled && !["待機中", "仕事中"].includes(cd.status)) || ["お茶", "欠勤", "精算済", "不在", "仕事中"].includes(cd.status)) return false;
  return !x.bks.some(b=>b.s - g <= now && now < b.e + g);
}
// 📍 タイムラインの名前の横に「今どこにいるか」（今どこに誰が と同じ判断。今日だけ）2026/11/5
function tlNowLoc(x){
  if(day !== KB.bizDateOf() || !x || !x.c) return "";
  let st = "gone", col = "";
  try{ st = boardState(x); col = boardCol(x, st) || ""; }catch(e){ return ""; }
  const gk = goneKind(x.cd, x);
  const t = st === "work" ? "🔴 仕事中" + (col ? "（" + col + "）" : "") : st === "wait" ? "🟡 " + (col ? col + "で待機" : "待機中") : st === "before" ? "🟪 出勤前" + (col ? "（" + col + "）" : "")
    : st === "ended" ? "🟧 仕事終了（振り分け待ち）" + (col ? "（" + col + "）" : "") : st === "start" ? "🔵 予約スタート" : gk ? (gk === "お茶" ? "🟩 お茶" : "🟥 欠勤") : (x.cd && x.cd.settled) ? "✅ 精算済" : "⬜ 今いない";
  return `<span class="tlloc ${st}">${esc(t)}</span>`;
}
document.head.insertAdjacentHTML("beforeend", `<style>.tlloc{display:inline-block;margin-left:4px;font-size:11px;font-weight:800;border-radius:99px;padding:0 6px;background:#F3F3F3;color:#555;vertical-align:middle} .tlloc.work{background:#EADCFB;color:#6c3fb5} .tlloc.wait{background:#FFF4C9;color:#8a6d00} .tlloc.before{background:#EEE8FB;color:#5b3fa6}</style>`);
// 🙋 受付の中で「今だれ行けますか？」：今すぐ行ける子と、3時間以内にあく子（あく時刻順）。押すとキャストに入る（2026/11/4）
function toggleFreeNow(){
  const el = $("freeNowBox"); if(!el) return;
  if(el.innerHTML){ el.innerHTML = ""; return; }
  if(day !== KB.bizDateOf()){ el.innerHTML = `<div class="hint2">今日の画面でだけ使えます</div>`; return; }
  const now = nowHour(), list = [];
  tlRows().forEach(x => {
    if(!x.c || !x.shift) return;
    const cd = x.cd || {};
    if(goneKind(cd) || ["お茶", "欠勤"].includes(cd.status)) return;
    if(freeNowOf(x)){ list.push({ x, at: now, now: true }); return; }
    const s = freeSlots(x).find(([a, b]) => b > now && a < now + 3);
    if(s) list.push({ x, at: Math.max(s[0], now), now: false });
  });
  list.sort((a, b) => a.at - b.at);
  el.innerHTML = `<div class="fnbox">${list.length ? list.map(({ x, at, now: n }) => `<button type="button" class="fnchip ${n ? "now" : ""}" onclick="$('f_cast').value='${x.c.id}';onCast();$('freeNowBox').innerHTML=''">
      <b>${esc(castLabel(x))}</b><small>${n ? "今すぐ" : lateHM(Math.round(at * 60)) + "〜"}${(x.cd && x.cd.standby) ? "・" + esc(x.cd.standby) : ""}・〜${lateHM(Math.round(x.shift.end * 60))}</small></button>`).join("")
    : `<div class="hint2">今すぐ・3時間以内に行ける子はいません</div>`}</div>`;
}
document.head.insertAdjacentHTML("beforeend", `<style>.fnbox{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px} .fnchip{display:inline-flex;flex-direction:column;align-items:flex-start;font-family:inherit;background:#fff;border:1.5px solid var(--line);border-radius:12px;padding:5px 10px;cursor:pointer;color:#5C4B4F} .fnchip.now{border-color:#2e8b57;background:#EFF9F2} .fnchip b{font-size:14px} .fnchip small{font-size:11.5px;color:var(--sub);font-weight:700}</style>`);
sortRows = function(list){
  const mode = ($("s_sort") && $("s_sort").value) || "kana";
  const kana = x => String((x.c && (x.c.kana || x.c.official_name || x.c.temp_name)) || x.name);
  const st = x => x.shift ? x.shift.start : 99, en = x => x.shift ? x.shift.end : 99;
  if(mode === "booked") list = list.filter(x=>x.bks.length);
  if(mode === "freeNow") list = list.filter(freeNowOf);
  if(mode === "onNow") list = list.filter(onNowOf);   // 今の時刻に、シフトの出勤〜退勤のあいだ（お茶・欠勤・不在・精算済はのぞく）2026/11/6
  return list.sort((a, b)=>
    mode === "kana" ? kana(a).localeCompare(kana(b), "ja")
    : mode === "endEarly" ? en(a) - en(b)
    : mode === "endLate" ? en(b) - en(a)
    : st(a) - st(b));
};
setSort = function(v){ try{ localStorage.setItem("kirokuSort", v); }catch(e){} renderList(); };
// 全体を見たい：名前を押すと、その子の予約を追加（キャストの枠の窓はなくした）
jumpCast = function(castId){ if(castId && KB.CAN_EDIT) newBookingFor(castId, ""); };

// 💴 精算（本日のキャスト一覧の枠から）：前のキャストの枠の精算と同じ中身を、窓で開く
function openSettle(cid){
  const x = tlRows().find(r=>r.c && r.c.id === cid); if(!x) return;
  castOpen = x;
  $("castTitle").textContent = "💴 精算：" + castLabel(x) + "（" + dayTitle().replace(/^📅 /, "") + "）";
  $("castBody").innerHTML = `<div id="settleBox">${cardHtml(cid, calcCast(cid))}</div>`;
  $("castBg").classList.add("show");
}
// 📋 本日のキャスト一覧（1キャスト1枠）
function resCells(r){
  const c = r.kb_customers || {};
  const stSel = KB.CAN_EDIT
    ? `<select class="stsel st ${r.status}" onclick="event.stopPropagation()" onchange="quickStatus(${r.id},this.value)">${stOpts(r)}</select>`
    : `<span class="st ${r.status}">${STATUS[r.status] || r.status}</span>`;
  const told = r.cast_notified_at
    ? `<button class="told on" onclick="event.stopPropagation();toggleNotified(${r.id})" title="押すと取り消し">✅ 伝えた<small>${esc(r.cast_notified_by || "")} ${whenShort(r.cast_notified_at)}</small></button>`
    : `<button class="told" onclick="event.stopPropagation();toggleNotified(${r.id})">⚠️ まだ<small>押すと「伝えた」</small></button>`;
  const logs = logOf(r).slice().reverse();
  const logHtml = `<div class="mlog">${logs.length
      ? logs.slice(0, 2).map(l=>`<div><b>${esc(whenShort(l.at))} ${KBF.staffTag(l.by)}</b> ${esc(l.text)}</div>`).join("") + (logs.length > 2 ? `<div class="more">ほか ${logs.length - 2}件</div>` : "")
      : `<div class="none">受付：${esc(r.created_by || "")} ${whenShort(r.created_at)}</div>`}
    ${KB.CAN_EDIT ? `<button class="addlog" onclick="event.stopPropagation();addLogPrompt(${r.id})">＋ 備考</button>` : ""}</div>`;
  return `<td><b>${hm(r.start_at)}</b>〜${hm(r.end_at)}</td>
    <td>${r.dummy_name ? `<small style="color:#6c5896">🎭${esc(r.dummy_name)}</small><br>` : ""}${esc(String(storeLabel(r.store_key) || "").slice(0, 3))}</td>
    <td>${esc(r.course)}${/^\d+$/.test(r.course) ? "分" : ""}${r.free_kind ? "・" + FREE_SUFFIX[r.free_kind] : ""}${r.extension_count ? " 延長" + r.extension_count : ""}${r.payment !== "cash" ? " 💳" : ""}<br><small style="color:var(--sub)">${esc(r.area || "")}</small>${placeCell(r)}${cardSel(r)}</td>
    <td>${c.ng ? "⚠️" : ""}${esc(c.name || "")}<small style="color:var(--sub)"> ${(VISIT.find(v=>v[0] === r.visit_kind) || [])[1] || ""}</small>${c.phone ? `<br><span class="tel">📞 ${esc(c.phone)}</span>` : ""}${custCell(r)}</td>
    <td>${stSel}${todosHtml(r)}</td><td>${told}</td><td>${logHtml}</td>`;
}
renderListTable = function(){
  const el = $("list"); if(!el || !M.casts) return;
  const byStart = (a, b)=>String(a.start_at).localeCompare(String(b.start_at));
  const casts = sortRows(tlRows());
  const STATE = { wait: "待機中", work: "仕事中", start: "予約スタート", precall: "出勤前連絡", gone: "今いない" };
  const head = `<tr><th>時間</th><th>店舗</th><th>コース・エリア</th><th>お客さん・電話</th><th>状態・やること</th><th>キャストに</th><th>📝 備考</th></tr>`;
  // 今いない（不在・お茶・欠勤）は、枠ぜんたいをグレー・緑・赤に（今どこに誰がとつながっている）
  const block = (title, sub, list, cid, cls)=>`<div class="cblock ${cls || ""}" ${cid ? `id="cb-${cid}"` : ""}>
      <div class="ch">${cid && typeof KBF !== "undefined" ? KBF.img(cid, 40) : ""}<b>${title}</b>${cid && KB.CAN_EDIT ? whereSel(cid) + dayStatusSel(cid) + kanzenBtn(cid) + fullBtn(cid) : ""}<small>${sub}</small><span style="flex:1"></span>${cid ? `<button class="btn btn-ghost btn-sm" onclick="editInfoNote('${cid}')">📌 今日のこと</button><button class="btn btn-ghost btn-sm" onclick="openAttend('${cid}')">📝 勤怠</button>` : ""}${cid ? `<button class="btn btn-ghost btn-sm" onclick="openSettle('${cid}')">💴 精算</button>` : ""}${cid && KB.CAN_EDIT ? `<button class="btn btn-ghost btn-sm" onclick="newBookingFor('${cid}','')">＋ 予約</button>` : ""}</div>
      ${cid ? attendHtml(cid) : ""}
      ${list.length ? `<div class="wrapx"><table class="list">${head}${list.map(r=>`<tr class="r ${["cancel", "tobi", "flowed"].includes(r.status) ? "cx" : ""}" onclick="openForm(${r.id})">${resCells(r)}</tr>`).join("")}</table></div>` : `<div class="none">予約なし</div>`}</div>`;
  const noCast = rows.filter(r=>!r.cast_id).sort(byStart);
  const mode = $("s_sort").value;
  el.innerHTML = (noCast.length ? block("キャスト未定", "", noCast, "") : "")
    + (casts.length ? casts.map(x=>{
        const st = boardState(x), col = boardCol(x, st), gk = goneKind(x.cd, x);
        const sub = `${x.shift ? "出勤 " + tlLabel(x.shift.start) + "〜" + tlLabel(x.shift.end) + (x.shift.kanzen ? "（完）" : "") + (x.shiftOrig ? "（予定 " + tlLabel(x.shiftOrig.start) + "〜" + tlLabel(x.shiftOrig.end) + "）" : "") : "シフトなし"}・${STATE[st]}${st !== "gone" && col ? "（" + col + "）" : gk ? "（" + gk + "）" : ""}`;
        const cls = st === "gone" ? (gk === "お茶" ? "tea" : gk === "欠勤" ? "absent" : "away") : "";
        return block("【" + esc(castLabel(x)) + "】" + (x.c && typeof kbPendingAfterSettle === "function" && kbPendingAfterSettle(x.cd, rows.filter(r=>r.cast_id === x.c.id)).length ? `<span class="part2chip" title="精算済のあとで予約がふえました。💴 精算で②の精算をしてください">⚠️ ②の精算がまだ</span>` : ""), esc(sub), x.c ? rows.filter(r=>r.cast_id === x.c.id).sort(byStart).sort(offLast) : [], x.c ? x.c.id : "", cls);
      }).join("") : `<div class="gate">${mode === "freeNow" ? "今すぐ行けるキャストはいません" : mode === "onNow" ? "今出勤しているキャストはいません" : mode === "booked" ? "予約があるキャストはいません" : "この日のキャストがいません"}</div>`) + cancelSection();
};

/* ---------- 本日のキャスト一覧：今の状態のプルダウン（今どこに誰がとつながっている）
   不在／出勤前／お茶／欠勤。出勤前・お茶・欠勤にすると「今いない」へ（新しい情報で上書き） ---------- */
function dayStatusSel(cid){
  const cd = castDays[cid] || {}, x = tlRows().find(r=>r.c && r.c.id === cid);
  const st = x ? boardState(x) : "gone", col = x ? boardCol(x, st) : "";
  // 状態：待機中・仕事中・出勤前連絡・不在・お茶・欠勤（2026/11/5）。えらんでいなければ「自動」（シフトと予約から）
  const MAN = ["待機中", "仕事中", "出勤前連絡", "中抜け", "不在", "お茶", "欠勤"];
  const cur = MAN.includes(cd.status) ? cd.status : cd.status === "出勤前" ? "出勤前連絡" : "";
  const autoLbl = { wait: "🟡 待機中", work: "🔴 仕事中", before: "🟪 出勤前", start: "🔵 予約スタート", gone: "⬜ 今いない" }[st] || "";
  if(!KB.CAN_EDIT) return `<span class="st">${esc((cur || autoLbl) + (col ? "（" + col + "）" : ""))}</span>`;
  const opts = [["", "🤖 自動：" + autoLbl.replace(/^\S+\s/, "") + (col && !cur ? "（" + col + "）" : "")], ["待機中", "🟡 待機中"], ["仕事中", "🔴 仕事中"], ["出勤前連絡", "🟪 出勤前連絡"], ["中抜け", "🟧 中抜け"], ["不在", "⬜ 不在"], ["お茶", "🟩 お茶"], ["欠勤", "🟥 欠勤"]];
  return `<select class="daysel ${cur === "お茶" ? "tea" : cur === "欠勤" ? "absent" : cur === "出勤前連絡" ? "pre" : cur === "不在" ? "away" : ""}" onclick="event.stopPropagation()" onchange="setDayStatus('${cid}',this.value)">
    ${opts.map(([v, l])=>`<option value="${v}" ${cur === v ? "selected" : ""}>${l}</option>`).join("")}</select>`;
}
// 📍 今どこ（待機場所）のプルダウン：キャストの枠の名前の横。選ぶと「今どこに誰が」の場所が自動で動く（2026/11/4）
//   場所 × 今の状態（待機中・仕事中・今いない…）で、今どこに誰がの置き場所が決まる。仕事中は予約のエリアが優先
function whereSel(cid){
  const cd = castDays[cid] || {}, cur = cd.standby || "";
  const opts = [["", "📍 場所なし"]].concat(STANDBY.map(s => [s, "📍 " + s]));
  if(cur && !STANDBY.includes(cur)) opts.push([cur, "📍 " + cur]);
  return `<select class="daysel wheresel" title="今どこにいるか（今どこに誰がが自動で動きます）" onclick="event.stopPropagation()" onchange="setWhere('${cid}',this.value)">
    ${opts.map(([v, l])=>`<option value="${esc(v)}" ${cur === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
}
async function setWhere(cid, v){
  const cd = castDays[cid] || {};
  const seat = seatsOk && v !== "鶯谷" ? seatOf(cid) : null;   // 鶯谷から動いたら、席は立つ
  if(seat) await leaveSeat(seat.id, true, "今どこを「" + (v || "なし") + "」に");
  // 場所を選んだら、出勤前・不在・予約スタートなどは「来ている」として待機中に（お茶・欠勤・精算済はそのまま）
  const keep = ["お茶", "欠勤", "待機中", "仕事中"].includes(cd.status) || cd.settled;
  await saveDayPart(cid, keep || !v ? { standby: v } : { standby: v, status: "" });
}
// 状態のプルダウン。不在・お茶・欠勤 → 今いない へ（場所も消す）。自動・待機中・仕事中・出勤前連絡 は場所はそのまま
async function setDayStatus(cid, v){
  if(v === "_here") return;
  // 欠勤は、今いないの札と同じく理由を聞く（記録を残して、サクラシフトもお休みにするため）2026/11/6
  if(v === "欠勤" && (castDays[cid] || {}).status !== "欠勤"){ openAttend(cid, "欠勤"); if($("at_skip")) $("at_skip").style.display = ""; renderList(); return; }
  const cd0 = castDays[cid] || {};
  // 🟧 中抜け：もどる時間と、再開する場所を聞く（今どこに誰がの「今いない」に出る）2026/11/7
  if(v === "中抜け"){
    if(!HAS_226){ toast("中抜けには SQL 226 の実行が必要です"); renderList(); return; }
    const t = prompt(castName(cid) + "：中抜け。もどる時間は？（例 21:00。わからなければ空のまま OK）", cd0.break_back || "");
    if(t === null){ renderList(); return; }
    const pl = prompt("再開する場所は？（" + STANDBY.join("・") + "。空のままなら今の場所）", cd0.break_place || cd0.standby || "");
    if(pl === null){ renderList(); return; }
    const seat = seatsOk ? seatOf(cid) : null; if(seat) await leaveSeat(seat.id, true, "状態を「中抜け」に");
    await saveDayPart(cid, { status: "中抜け", standby: "", break_back: t.trim().slice(0, 10), break_place: (pl.trim() || cd0.standby || "").slice(0, 20) });
    return;
  }
  const keepPlace = ["", "待機中", "仕事中", "出勤前連絡"].includes(v);
  const seat = seatsOk && !keepPlace ? seatOf(cid) : null;
  if(seat) await leaveSeat(seat.id, true, "状態を「" + v + "」に");
  const patch = keepPlace ? { status: v } : { status: v, standby: "" };
  if(cd0.status === "中抜け" && keepPlace && !cd0.standby && cd0.break_place) patch.standby = cd0.break_place;   // 中抜けからもどったら、再開する場所へ
  await saveDayPart(cid, patch);
}
// 🈵 満了：押すと内勤みんなの画面に出て、その日の新しい予約は受けない。もう一度押すと外す（2026/11/7）
function fullBtn(cid){
  const cd = castDays[cid] || {}, on = !!cd.full_at;
  return `<button type="button" class="kzbtn fullbtn ${on ? "on" : ""}" title="${on ? "満了：" + esc(cd.full_by || "") + "（押すと外す）" : "押すと満了（この日の新しい予約を受けない）"}" onclick="event.stopPropagation();setFull('${cid}')">🈵 ${on ? "満了" : "満了にする"}</button>`;
}
async function setFull(cid){
  if(!HAS_226){ toast("満了には SQL 226 の実行が必要です"); return; }
  const on = !!(castDays[cid] || {}).full_at;
  if(!confirm(`${castName(cid)}：${on ? "満了を外しますか？（また新しい予約を受けられます）" : "満了にしますか？\n（内勤みんなの画面に出て、この日の新しい予約は受けられなくなります）"}`)) return;
  if(await saveDayPart(cid, on ? { full_at: null, full_by: "" } : { full_at: new Date().toISOString(), full_by: KB.operatorName() })){ toast(on ? "満了を外しました" : "🈵 満了にしました"); renderBoard(); }
}

/* ---------- 🔔 確認電話が来ていない予約（画面のいちばん上に赤く）
   ・予約の1時間前なのに「前日確認電話」「1H前確認電話」のまま
   ・前日20:15をすぎたのに、次の営業日の予約が「前日確認電話」のまま
   メールは SQL 103（5分ごと）。画面は2分ごとに見なおす ---------- */
let callAlertRows = [];
function addDays(ymd, n){ const d = new Date(ymd + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
async function loadCallAlerts(){
  try{
    const today = KB.bizDateOf();
    callAlertRows = q(await sb.from("kb_reservations").select("*")
      .in("biz_date", [addDays(today, -1), today, addDays(today, 1)]).not("status", "in", "(done,cancel,tobi,flowed)").eq("deleted", false)) || [];   // ほかの状態は「⏰ 時刻」をすぎたかを見る（SQL 182）
  }catch(e){ callAlertRows = []; }
  renderCallAlerts();
}
function renderCallAlerts(){
  const el = $("callAlerts"); if(!el || !M.casts) return;
  const now = Date.now();
  const items = [], outs = [];
  callAlertRows.forEach(r=>{
    const st = r.start_at ? Date.parse(r.start_at) : null, en = r.end_at ? Date.parse(r.end_at) : null;
    if(r.status === "working"){ if(en && now >= en) outs.push(r); return; }   // ⏰ 終了時刻になった → アウトコールの確認
    const sa = r.status_at ? Date.parse(r.status_at) : null;   // ⏰ この状態の時刻（SQL 182）
    if(!["pre_call", "hour_call", "pre_mail", "hour_mail"].includes(r.status)){
      if(sa && now >= sa && (!en || now < en)) items.push({ r, k: "status", kind: "⏰ 「" + (STATUS[r.status] || r.status) + "」の時刻（" + hm(r.status_at) + "）" });
      return;
    }
    const how = /_mail$/.test(r.status) ? "メール" : "電話";   // 確認がメールで来るお客さん（SQL 180）
    const isHour = ["hour_call", "hour_mail"].includes(r.status);
    const hourDue = isHour && sa ? sa : (st ? st - 3600000 : null);   // 1H前確認：時刻が入っていればその時刻から
    if(st && now >= hourDue && now < st) items.push({ r, k: "hour", how, kind: (isHour && sa ? hm(r.status_at) + "の" : "1時間前の") + "確認" + how + "がまだ" });
    else if(["pre_call", "pre_mail"].includes(r.status) && (!st || now < st)){
      const due = sa || Date.parse(addDays(r.biz_date, -1) + "T20:15:00+09:00");   // 前日確認：時刻が入っていればその時刻
      if(now >= due) items.push({ r, k: "pre", how, kind: "前日の確認" + how + "がまだ" });
    }
  });
  const md = r => r.biz_date !== day ? esc(r.biz_date.slice(5).replace("-", "/")) + " " : "";
  el.innerHTML = (outs.length ? `<div class="callalert out">⏰ 終了時刻です。キャストからのアウトコールを確認してください${outs.map(r=>`
      <div class="outrow"><span><b>${md(r)}${r.start_at ? hm(r.start_at) : ""}〜${r.end_at ? hm(r.end_at) : ""}</b>　${esc(castName(r.cast_id))}　${esc(r.area || "")}</span>
        ${KB.CAN_EDIT ? `<button type="button" class="okbtn" onclick="outcallDone(${r.id},'${r.biz_date}')">📞 アウトコールきた（終了にする）</button>` : ""}
        <button type="button" onclick="openAlertRes(${r.id},'${r.biz_date}')">開く</button></div>`).join("")}</div>` : "")
    + (items.length ? `<div class="callalert">🔔 確認がまだ・時刻になった予約があります${items.map(({ r, kind })=>`
      <button type="button" onclick="jumpToRes(${r.id},'${r.biz_date}')"><b>${esc(kind)}</b>　${md(r)}${r.start_at ? hm(r.start_at) : "時間未定"}　${esc(castName(r.cast_id))}　<u>📍 予約へとぶ</u>　<u onclick="event.stopPropagation();openAlertRes(${r.id},'${r.biz_date}')">開く</u></button>`).join("")}</div>` : "");
  // 新しく出たら、種類ごとの音・声を鳴らして、🔔 通知の小窓に出す
  outs.filter(r=>!beeped.has("o" + r.id)).forEach(r=>{ beeped.add("o" + r.id);
    notify("outcall", { 名前: castName(r.cast_id), 時間: r.end_at ? hm(r.end_at) : "" }, `jumpToRes(${r.id},'${r.biz_date}')`); });
  items.filter(({ r, kind })=>!beeped.has("c" + r.id + kind)).forEach(({ r, k, how, kind })=>{ beeped.add("c" + r.id + kind);
    notify(k, { 名前: castName(r.cast_id), 時間: r.start_at ? hm(r.start_at) : "", 状態: STATUS[r.status] || r.status, 方法: how || "" }, `jumpToRes(${r.id},'${r.biz_date}')`); });
}
const beeped = new Set();

/* ---------- 🔔 通知の設定：通知ごとに「表示する文」「音」「🗣 声で読む」
   表示する文・読む文は内勤みんな同じ（kb_settings 'ntf_texts' = { 種類: { text, say } }）
   音・声のオン/オフは、この端末だけ（localStorage kbSounds / kbVoice）
   文の中の {名前} {時間} {状態} {方法} を置きかえる ---------- */
const NTF_KINDS = {
  outcall: { label: "⏰ 終了時刻（アウトコールの確認）", def: "pipi",  voice: true,  text: "⏰ {名前}　アウトコールの確認（{時間} 終了）", say: "{名前}さん、アウトコールの確認です" },
  hour:    { label: "🔔 1時間前の確認がまだ",          def: "none",  voice: false, text: "🔔 {名前}　1時間前の確認{方法}がまだ（{時間}〜）", say: "{名前}さん、1時間前の確認です" },
  pre:     { label: "🔔 前日の確認がまだ",             def: "none",  voice: false, text: "🔔 {名前}　前日の確認{方法}がまだ（{時間}〜）", say: "{名前}さん、前日の確認です" },
  status:  { label: "⏰ 状態の時刻になった",           def: "none",  voice: false, text: "⏰ {名前}　「{状態}」の時刻（{時間}〜の予約）", say: "{名前}さん、{状態}の時刻です" },
  in:      { label: "🌅 出勤の時間",                   def: "chime", voice: false, text: "🌅 {名前}　出勤の時間（{時間}）", say: "{名前}さん、出勤の時間です" },
  out:     { label: "🌙 退勤の時間",                   def: "pon",   voice: false, text: "🌙 {名前}　退勤の時間（{時間}）", say: "{名前}さん、退勤の時間です" },
  notice:  { label: "📢 本日のお知らせ（書きかわった・まだ見ていない）", def: "up", voice: true, text: "📢 お知らせ（{名前}）：{内容}", say: "本日のお知らせです。{内容}" },
  uns:     { label: "🧾 未精算・領収書（次の出勤日の出勤／退勤時刻）", def: "triple", voice: true, text: "🧾 {名前}　未精算・領収書の回収（{時間}）：{内容}", say: "{名前}さんの未精算と領収書を回収してください" },
  nevent:  { label: "📅 内勤カレンダーの予定（時刻のあるもの）", def: "chime", voice: true, text: "📅 {時間}　{内容}（{名前}）", say: "{時間}の予定です。{内容}" },
  alarm:   { label: "⏰ 時刻アラート（お知らせの下で足したもの）", def: "triple", voice: true, text: "⏰ {時間}　{内容}（{名前}）", say: "{時間}です。{内容}" },
};
const SOUNDS = {
  pipi:   { label: "ピピッ（高い2回）", notes: [[880, 0], [880, .35]] },
  triple: { label: "ピピピ（3回）",     notes: [[1046, 0], [1046, .22], [1046, .44]] },
  chime:  { label: "ピンポーン",         notes: [[784, 0, .5], [622, .45, .7]] },
  pon:    { label: "ポーン（低い）",     notes: [[440, 0, .8]] },
  up:     { label: "ピロリン（上がる）", notes: [[660, 0], [880, .16], [1175, .32]] },
  none:   { label: "鳴らさない",         notes: [] },
};
function lsGet(key){ try{ return JSON.parse(localStorage.getItem(key) || "{}") || {}; }catch(e){ return {}; } }
function lsSet(key, v){ try{ localStorage.setItem(key, JSON.stringify(v)); }catch(e){} }
// ➕ 自由な通知（毎日この時刻に）：kb_settings 'custom_ntfs' = [{ id, time: "20:15"（深夜は 25:30 など）, days: [0..6]（空ならまいにち）, text, say, sound, voice }]
function customNtfs(){ const v = M.set && M.set.custom_ntfs; return Array.isArray(v) ? v : []; }
function ntfDef(kind){
  if(NTF_KINDS[kind]) return NTF_KINDS[kind];
  const c = customNtfs().find(x=>"c:" + x.id === kind);
  return c ? { label: "➕ " + (c.time || "") + " " + (c.text || ""), def: c.sound || "pipi", voice: !!c.voice, text: c.text || "", say: c.say || c.text || "" } : {};
}
function soundOf(kind){ const p = lsGet("kbSounds")[kind]; return SOUNDS[p] ? p : ntfDef(kind).def || "pipi"; }
function voiceOn(kind){ const p = lsGet("kbVoice")[kind]; return p == null ? !!ntfDef(kind).voice : !!p; }
function ntfTexts(){ const v = M.set && M.set.ntf_texts; return v && typeof v === "object" ? v : {}; }
function ntfFill(t, vars){ return String(t || "").replace(/\{(名前|時間|状態|方法|内容)\}/g, (m, k)=>vars && vars[k] != null ? vars[k] : ""); }
function ntfText(kind, vars){ return ntfFill((ntfTexts()[kind] || {}).text || ntfDef(kind).text || "{名前}", vars); }
function ntfSay(kind, vars){ return ntfFill((ntfTexts()[kind] || {}).say || ntfDef(kind).say || "", vars); }
// 出勤・退勤の通知を、何分前に出すか（マイナスなら後）。内勤みんな同じ（ntf_texts の in / out の before）
function ntfBefore(kind){ const n = Number((ntfTexts()[kind] || {}).before); return isFinite(n) ? n : 0; }
// 自由な通知：時刻になったら1回だけ（この端末で。リロードしても同じ日はもう出さない）
function customDue(c, bd){
  const m = String(c.time || "").match(/^(\d{1,2}):(\d{2})$/); if(!m) return null;
  let h = Number(m[1]); if(h < 6) h += 24;   // 0:00〜5:59 は深夜（24:00〜29:59）
  return Date.parse(bd + "T00:00:00+09:00") + (h * 60 + Number(m[2])) * 60000;
}
function checkCustomNtfs(){
  if(!M.casts || KB.PRACTICE) return;
  const bd = KB.bizDateOf(), now = Date.now(), dow = new Date(bd + "T12:00:00Z").getUTCDay(), fired = lsGet("kbFired");
  customNtfs().forEach(c=>{
    if(c.days && c.days.length && !c.days.includes(dow)) return;
    const due = customDue(c, bd), key = bd + "|" + c.id;
    if(due == null || fired[key] || now < due || now > due + 10 * 60000) return;   // 時刻から10分のあいだに開いていれば出す
    fired[key] = 1; notify("c:" + c.id, { 時間: c.time }, "");
  });
  dayAlarms().filter(a=>a.bd === bd).forEach(a=>{   // ⏰ 時刻アラート（その日だけ・1回）
    const due = customDue(a, bd), key = bd + "|a" + a.id;
    if(due == null || fired[key] || now < due || now > due + 10 * 60000) return;
    fired[key] = 1; notify("alarm", { 時間: a.now ? "お知らせ" : lateHM(Math.round((due - Date.parse(bd + "T00:00:00+09:00")) / 60000)), 内容: a.text, 名前: a.by || "" }, `document.getElementById('dayAlarms').scrollIntoView({block:'center',behavior:'smooth'})`);
    renderDayAlarms();
  });
  nEvents.filter(e => e.time).forEach(e => {   // 📅 内勤カレンダーの予定：その時刻に1回知らせる
    const due = Date.parse(e.date + "T" + e.time.padStart(5, "0") + ":00+09:00"), key = bd + "|e" + e.id;
    if(!isFinite(due) || fired[key] || now < due || now > due + 10 * 60000) return;
    fired[key] = 1; notify("nevent", { 時間: e.time, 内容: e.title + (e.memo ? "（" + e.memo + "）" : ""), 名前: (e.members || []).map(m => NAIKIN_NAME[m] || m).join("・") }, `document.getElementById('nEvents').scrollIntoView({block:'center',behavior:'smooth'})`);
  });
  Object.keys(fired).forEach(k=>{ if(k.slice(0, 10) < bd) delete fired[k]; });   // 前の日の印は消す
  lsSet("kbFired", fired);
}
setInterval(checkCustomNtfs, 20000);
// 📢 本日のお知らせ：中身が変わった・この端末でまだ見ていない → 通知（自分で書いたものは出さない）
function noticeSeenSet(bd, text){ lsSet("kbNoticeSeen", { bd, text: String(text || "") }); }
async function checkNotice(){
  if(!M.casts) return;
  try{
    const bd = KB.bizDateOf(), r = q(await sb.from("kb_day_notes").select("notice,updated_by").eq("biz_date", bd).maybeSingle()) || {};
    const text = String(r.notice || "").trim(), seen = lsGet("kbNoticeSeen");
    if(seen.bd === bd && String(seen.text || "").trim() === text) return;
    noticeSeenSet(bd, text);
    if(!text || (r.updated_by && r.updated_by === KB.operatorName() && seen.bd === bd)) return;   // 消された・自分で書いた
    notify("notice", { 名前: r.updated_by || "", 内容: text.length > 120 ? text.slice(0, 120) + "…" : text }, `document.getElementById('notice').scrollIntoView({block:'center',behavior:'smooth'})`);
  }catch(e){}
  loadDayAlarms();
}
setInterval(checkNotice, 60000);
/* ---------- ⏰ 時刻アラート：お知らせの下で「この時刻に鳴らす」を足す（その日だけ・内勤みんなの画面で1回）
   kb_settings 'day_alarms' = [{ id, bd（営業日）, time: "21:00"（深夜は 25:00 / 1:00）, text, by }]。前の日のものは保存のときに消す ---------- */
function dayAlarms(){ const v = M.set && M.set.day_alarms; return Array.isArray(v) ? v : []; }
async function loadDayAlarms(){
  try{ const r = q(await sb.from("kb_settings").select("value").eq("key", "day_alarms").maybeSingle()); M.set.day_alarms = r && Array.isArray(r.value) ? r.value : []; }catch(e){}
  renderDayAlarms();
}
function renderDayAlarms(){
  const el = $("dayAlarms"); if(!el || !M.casts) return;
  const base = Date.parse(day + "T00:00:00+09:00"), now = Date.now();
  const list = dayAlarms().filter(a=>a.bd === day).map(a=>({ a, due: customDue(a, day) })).sort((x, y)=>x.due - y.due);
  el.innerHTML = list.map(({ a, due })=>`<span class="dachip${due && now > due ? " past" : ""}">⏰ <b>${esc(lateHM(Math.round((due - base) / 60000)))}</b> ${esc(a.text)}${a.by ? `<small>（${KBF.staffTag(a.by)}）</small>` : ""}${a.now ? " <small>（すぐ）</small>" : ""}${due && now > due ? " <small>鳴った</small>" : ""}
      ${KB.CAN_EDIT ? `<button type="button" title="消す" onclick="delDayAlarm('${esc(a.id)}')">×</button>` : ""}</span>`).join("")
    + (KB.CAN_EDIT ? `<span class="daadd"><label><input type="checkbox" id="da_use" checked onchange="$('da_time').disabled = !this.checked"> ⏰ 時刻を指定する</label><input id="da_time" placeholder="21:00" inputmode="numeric"><input id="da_text" placeholder="鳴らす内容（例：〇〇さんに電話）" onkeydown="if(event.key==='Enter')addDayAlarm()"><button type="button" onclick="addDayAlarm()">🔔 アラートを足す</button></span>` : "");
}
async function addDayAlarm(){
  if(!KB.CAN_EDIT) return;
  const use = $("da_use").checked, nowJ = new Date(Date.now() + 9 * 3600000);   // 時刻を指定しない → いま（すぐ鳴る）
  const time = use ? $("da_time").value.trim().normalize("NFKC").replace(/^(\d{1,2})(\d{2})$/, "$1:$2")
                   : String(nowJ.getUTCHours()).padStart(2, "0") + ":" + String(nowJ.getUTCMinutes()).padStart(2, "0");
  const text = $("da_text").value.trim();
  if(!/^\d{1,2}:\d{2}$/.test(time)){ toast("時刻は 21:00 のように入れてください"); return; }
  if(!use && day !== KB.bizDateOf()){ toast("「すぐ鳴らす」は今日の画面でだけ使えます"); return; }
  if(!text){ toast("鳴らす内容を入れてください"); return; }
  await saveDayAlarms(list => list.concat([{ id: "a" + Date.now(), bd: day, time, text, now: !use, by: KB.operatorName() }]));
  if(!use) setTimeout(checkCustomNtfs, 300);
}
async function delDayAlarm(id){
  if(!KB.CAN_EDIT || !confirm("この時刻アラートを消しますか？")) return;
  await saveDayAlarms(list => list.filter(a=>a.id !== id));
}
async function saveDayAlarms(change){
  try{
    const r = q(await sb.from("kb_settings").select("value").eq("key", "day_alarms").maybeSingle());   // ほかの人が足した分も消さないように、最新を読んでから
    const today = KB.realBizDateOf(), list = change((r && Array.isArray(r.value) ? r.value : []).filter(a=>a.bd >= today || a.bd === KB.PRACTICE_DAY));
    q(await sb.from("kb_settings").upsert({ key: "day_alarms", value: list, note: "⏰ 時刻アラート（受付のお知らせの下）" }));
    M.set.day_alarms = list; toast("保存しました"); renderDayAlarms();
  }catch(e){ toast("保存できませんでした：" + (e.message || e)); }
}
setInterval(renderDayAlarms, 60000);
/* ---------- 📅 内勤カレンダーの予定を、記録簿のその日に出す（お知らせの下）。時刻のある予定は、その時刻に 🔔 で知らせる（2026/11/5）
   営業日 day の予定 ＝ カレンダーの day の予定 ＋ 次の日の朝6時より前の予定 ---------- */
let nEvents = [], nEventsDay = "";
async function loadNEvents(){
  const d = day;
  try{
    const r = q(await sb.from("naikin_events").select("id,date,time,title,members,memo").in("date", [d, addDays(d, 1)])) || [];
    nEvents = r.filter(e => e.date === d || (e.time && Number(e.time.split(":")[0]) < 6))
      .sort((a, b) => (a.date + (a.time || "99")).localeCompare(b.date + (b.time || "99")));
  }catch(e){ nEvents = []; }
  nEventsDay = d; renderNEvents();
}
function renderNEvents(){
  const el = $("nEvents"); if(!el) return;
  el.innerHTML = nEvents.length ? `<div class="nevhd">📅 内勤カレンダーの予定</div>` + nEvents.map(e => `<div class="nev"><b>${e.time ? esc(e.date !== day ? lateHM(Number(e.time.split(":")[0]) * 60 + 24 * 60 + Number(e.time.split(":")[1])) : e.time) : "終日"}</b> ${esc(e.title)}${(e.members || []).length ? `<small>（${esc(e.members.map(m => NAIKIN_NAME[m] || m).join("・"))}）</small>` : ""}${e.memo ? `<div class="nevm">${esc(e.memo)}</div>` : ""}</div>`).join("") : "";
}
{ const __ldNE = loadDay; loadDay = async function(){ const r = await __ldNE.apply(this, arguments); loadNEvents(); return r; }; }
setInterval(() => { if(day === KB.bizDateOf()) loadNEvents(); }, 5 * 60000);
function playSound(id){
  const s = SOUNDS[id]; if(!s || !s.notes.length) return;
  try{
    const a = new (window.AudioContext || window.webkitAudioContext)();
    s.notes.forEach(([f, t, len])=>{ len = len || .3; const o = a.createOscillator(), g = a.createGain(); o.frequency.value = f; o.connect(g); g.connect(a.destination);
      g.gain.setValueAtTime(0.2, a.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + t + len); o.start(a.currentTime + t); o.stop(a.currentTime + t + len); });
  }catch(e){}
}
function beep(){ playSound("pipi"); }
// 🗣 声で読む（ブラウザの読み上げ。Edge なら「Nanami」などの自然な声）
function jaVoice(){
  const vs = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
  const ja = vs.filter(v=>/^ja/i.test(v.lang));
  return ja.find(v=>/Nanami|Natural|Online/i.test(v.name)) || ja.find(v=>/Google/i.test(v.name)) || ja[0] || null;
}
function speak(text){
  if(!text || !window.speechSynthesis) return;
  try{ const u = new SpeechSynthesisUtterance(text); u.lang = "ja-JP"; const v = jaVoice(); if(v) u.voice = v; u.rate = 1.05; speechSynthesis.speak(u); }catch(e){}
}
// 通知の履歴：ログインしている人ごとに「未処理／⏸ 保留／✓ 済」（この端末に残す。2日たったら消える）
const ntfKey = () => "kbNtf:" + (KB.operatorName() || "-");
const ntfLog = (()=>{ try{ const l = JSON.parse(localStorage.getItem(ntfKey()) || "[]"); return Array.isArray(l) ? l.filter(n=>Date.now() - Date.parse(n.at) < 2 * 86400000) : []; }catch(e){ return []; } })();
function ntfSave(){ if(ntfLog.length > 60) ntfLog.length = 60; try{ localStorage.setItem(ntfKey(), JSON.stringify(ntfLog)); }catch(e){} }
let ntfTab = "";   // "" 未処理 / "hold" 保留 / "done" 済
function ntfMark(id, st){ const n = ntfLog.find(x=>x.id === id); if(n){ n.st = st; ntfSave(); renderNtfBox(); } }
function ntfAllDone(){ ntfLog.forEach(n=>{ if(!n.st) n.st = "done"; }); ntfSave(); renderNtfBox(); }
function notify(kind, vars, jump){
  const text = ntfText(kind, vars);
  ntfLog.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), kind, text, jump: jump || "", at: new Date().toISOString(), st: "" }); ntfSave();
  (notify.batch = notify.batch || []).push({ kind, vars });
  if(!notify.q){ notify.q = true; setTimeout(()=>{   // 一度にたくさん出ても、音は1回・声は3件まで
    const b = notify.batch; notify.batch = []; notify.q = false;
    playSound(soundOf(b[0].kind));
    const says = b.filter(x=>voiceOn(x.kind));
    says.slice(0, 3).forEach(x=>speak(ntfSay(x.kind, x.vars)));
    if(says.length > 3) speak("ほか" + (says.length - 3) + "件");
  }, 50); }
  ntfTab = ""; renderNtfBox(true);
  clearTimeout(notify.t); notify.t = setTimeout(()=>{ const b = $("ntfBox"); if(b && !b.matches(":hover")){ b.classList.remove("open"); renderNtfBox(); } }, 30000);   // 30秒で小さい 🔔 にもどる（押せばまた見られる）
}
function renderNtfBox(open){
  let el = $("ntfBox");
  if(!el){ el = document.createElement("div"); el.id = "ntfBox"; document.body.appendChild(el); }
  if(open) el.classList.add("open");
  const hhmm = s => { const d = new Date(s); return (d.getMonth() + 1) + "/" + d.getDate() + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
  const cnt = st => ntfLog.filter(n=>(n.st || "") === st).length, nNew = cnt(""), nHold = cnt("hold");
  const shown = ntfLog.filter(n=>(n.st || "") === ntfTab);
  el.style.display = el.classList.contains("open") || nNew || nHold ? "" : "none";   // 未処理・保留がなければ 🔔 は出さない（履歴は上の「🔔 通知の履歴」から）
  el.innerHTML = el.classList.contains("open")
    ? `<div class="ntfhd">🔔 通知${KB.operatorName() ? `<small>（${esc(KB.operatorName())}）</small>` : ""}<span><button type="button" onclick="openSoundSet()">⚙️ 設定</button><button type="button" onclick="$('ntfBox').classList.remove('open');renderNtfBox()">×</button></span></div>
       <div class="ntftabs">${[["", "未処理", nNew], ["hold", "⏸ 保留", nHold], ["done", "✓ 済", cnt("done")]].map(([k, l, c])=>`<button type="button" class="${ntfTab === k ? "on" : ""}" onclick="ntfTab='${k}';renderNtfBox()">${l} ${c}</button>`).join("")}
         ${ntfTab === "" && nNew ? `<button type="button" class="alldone" onclick="ntfAllDone()">ぜんぶ済</button>` : ""}</div>
       <div class="ntflist">${shown.length ? shown.map(n=>`<div class="ntfrow">
         <div class="${n.jump ? "go" : ""}" ${n.jump ? `onclick="${esc(n.jump)}"` : ""}><small>${hhmm(n.at)}・${esc(SOUNDS[soundOf(n.kind)].label)}${voiceOn(n.kind) ? "・🗣" : ""}</small>${esc(n.text)}</div>
         <span class="ntfbtns">${n.st !== "done" ? `<button type="button" class="ok" onclick="ntfMark('${n.id}','done')">✓ 済</button>` : ""}${n.st !== "hold" ? `<button type="button" onclick="ntfMark('${n.id}','hold')">⏸ 保留</button>` : ""}${n.st ? `<button type="button" onclick="ntfMark('${n.id}','')">もどす</button>` : ""}</span></div>`).join("")
         : `<div class="ntfrow">${ntfTab === "hold" ? "保留はありません" : ntfTab === "done" ? "済はまだありません" : "未処理の通知はありません"}</div>`}</div>`
    : `<button type="button" class="ntfopen" onclick="ntfTab=${nNew ? "''" : "'hold'"};renderNtfBox(true)">🔔${nNew ? " " + nNew : ""}${nHold ? " ⏸" + nHold : ""}</button>`;
}
const NTF_SAMPLE = { 名前: "さくら", 時間: "21:00", 状態: "移動中", 方法: "電話", 内容: "雨なので交通費に気をつけてください" };
function openSoundSet(){
  let bg = $("sndBg");
  if(!bg){ bg = document.createElement("div"); bg.id = "sndBg"; bg.className = "modal-bg"; document.body.appendChild(bg); KB.closeOnBackdrop(bg, () => bg.classList.remove("show")); }
  const tx = ntfTexts(), ro = KB.CAN_EDIT ? "" : "disabled";
  bg.innerHTML = `<div class="modal" style="max-width:760px"><button class="x" onclick="$('sndBg').classList.remove('show')">×</button>
    <h2>🔔 通知の設定（表示する文・音・声）</h2>
    <p style="font-size:12.5px;color:var(--sub);line-height:1.6;margin:0 0 8px">鳴ったときは、左下の 🔔 小窓に「表示する文」が出ます。🗣 にチェックすると「読む文」を声で読みます。<br>
      {名前} {時間} {状態} {方法} は、その予約・その子のものになります。文が空なら、はじめの文（うすい字）になります。<br>
      <b>音・声</b>はこの端末（このPC・スマホ）だけ。<b>文</b>は内勤みんな同じです（下の「文を保存」）。</p>
    ${Object.entries(NTF_KINDS).map(([k, v])=>`<div class="ntfset" data-k="${k}">
      <div class="ntfset-hd"><b>${esc(v.label)}</b>
        <select onchange="setSound('${k}',this.value)">${Object.entries(SOUNDS).map(([id, s])=>`<option value="${id}" ${soundOf(k) === id ? "selected" : ""}>${esc(s.label)}</option>`).join("")}</select>
        <label><input type="checkbox" ${voiceOn(k) ? "checked" : ""} onchange="setVoice('${k}',this.checked)"> 🗣 声で読む</label>
        <button type="button" class="btn btn-ghost btn-sm" onclick="testNtf('${k}')">▶ 試す</button></div>
      <div class="ntfset-row"><label>表示する文</label><input class="nt-text" value="${esc((tx[k] || {}).text || "")}" placeholder="${esc(v.text)}" ${ro}></div>
      <div class="ntfset-row"><label>読む文</label><input class="nt-say" value="${esc((tx[k] || {}).say || "")}" placeholder="${esc(v.say)}" ${ro}></div>
      ${k === "in" || k === "out" ? `<div class="ntfset-row"><label>出す時刻</label><span>${k === "in" ? "出勤" : "退勤"}時間の <input class="nt-before" type="number" step="5" value="${ntfBefore(k) || ""}" placeholder="0" style="width:70px" ${ro}> 分前（0＝ちょうど、マイナス＝後）</span></div>` : ""}</div>`).join("")}
    <h3 style="margin:14px 0 6px;font-size:15px">➕ 自由な通知（毎日この時刻に出す）</h3>
    <p style="font-size:12.5px;color:var(--sub);line-height:1.6;margin:0 0 6px">例：20:15「明日の予約の前日確認の時間です」／ 25:00「回収の準備」。深夜は 25:00 のように書けます（1:00 と書いても深夜あつかい）。<br>曜日をえらばなければ、まいにち。時刻から10分のあいだに記録簿を開いていれば出ます。</p>
    <div id="cnRows">${customNtfs().map(c=>cnRowHtml(c)).join("")}</div>
    ${KB.CAN_EDIT ? `<button type="button" class="btn btn-ghost btn-sm" onclick="$('cnRows').insertAdjacentHTML('beforeend', cnRowHtml({}))">＋ 通知を足す</button>` : ""}
    ${KB.CAN_EDIT ? `<button type="button" class="btn btn-primary" style="margin-top:10px;width:100%" onclick="saveNtfTexts()">文・時刻・自由な通知を保存（内勤みんなに）</button>` : ""}
    ${window.speechSynthesis ? "" : `<p class="warn">この端末のブラウザは、声で読むことができません。</p>`}</div>`;
  bg.classList.add("show");
}
function setSound(kind, id){ const p = lsGet("kbSounds"); p[kind] = id; lsSet("kbSounds", p); playSound(id); renderNtfBox(); }
function setVoice(kind, on){ const p = lsGet("kbVoice"); p[kind] = !!on; lsSet("kbVoice", p); if(on) speak(ntfSay(kind, NTF_SAMPLE)); renderNtfBox(); }
// ▶ 試す：いま入れている文で（保存前でも）
function testNtf(kind){
  const box = document.querySelector(`#sndBg .ntfset[data-k="${kind}"]`), v = NTF_KINDS[kind];
  const say = ntfFill((box && box.querySelector(".nt-say").value.trim()) || (ntfTexts()[kind] || {}).say || v.say, NTF_SAMPLE);
  playSound(soundOf(kind));
  if(voiceOn(kind)) setTimeout(()=>speak(say), 600);
  toast(ntfFill((box && box.querySelector(".nt-text").value.trim()) || (ntfTexts()[kind] || {}).text || v.text, NTF_SAMPLE));
}
function cnRowHtml(c){
  const ro = KB.CAN_EDIT ? "" : "disabled", days = c.days || [];
  return `<div class="ntfset cnrow" data-id="${esc(c.id || "")}">
    <div class="ntfset-hd"><input class="cn-time" value="${esc(c.time || "")}" placeholder="20:15" style="width:70px" ${ro}>
      <span class="cndays">${["日", "月", "火", "水", "木", "金", "土"].map((d, i)=>`<label><input type="checkbox" class="cn-d" value="${i}" ${days.includes(i) ? "checked" : ""} ${ro}>${d}</label>`).join("")}</span>
      <select class="cn-sound" ${ro}>${Object.entries(SOUNDS).map(([id, s])=>`<option value="${id}" ${(c.sound || "pipi") === id ? "selected" : ""}>${esc(s.label)}</option>`).join("")}</select>
      <label><input type="checkbox" class="cn-voice" ${c.voice ? "checked" : ""} ${ro}> 🗣 声</label>
      <button type="button" class="btn btn-ghost btn-sm" onclick="testCn(this)">▶ 試す</button>
      ${KB.CAN_EDIT ? `<button type="button" class="btn btn-ghost btn-sm" onclick="if(confirm('この通知を消しますか？（保存で消えます）'))this.closest('.cnrow').remove()">消す</button>` : ""}</div>
    <div class="ntfset-row"><label>表示する文</label><input class="cn-text" value="${esc(c.text || "")}" placeholder="例：前日確認の時間です" ${ro}></div>
    <div class="ntfset-row"><label>読む文</label><input class="cn-say" value="${esc(c.say || "")}" placeholder="（空なら表示する文を読む）" ${ro}></div></div>`;
}
function cnRead(b){
  return { id: b.dataset.id || ("n" + Date.now() + Math.floor(Math.random() * 1000)), time: b.querySelector(".cn-time").value.trim().normalize("NFKC").replace(/^(\d{1,2})(\d{2})$/, "$1:$2"),
           days: [...b.querySelectorAll(".cn-d:checked")].map(x=>Number(x.value)), sound: b.querySelector(".cn-sound").value, voice: b.querySelector(".cn-voice").checked,
           text: b.querySelector(".cn-text").value.trim(), say: b.querySelector(".cn-say").value.trim() };
}
function testCn(btn){
  const c = cnRead(btn.closest(".cnrow"));
  playSound(c.sound); if(c.voice) setTimeout(()=>speak(c.say || c.text), 600);
  toast((c.time || "") + " " + (c.text || "（文がありません）"));
}
async function saveNtfTexts(){
  if(!KB.CAN_EDIT) return;
  const value = {};
  document.querySelectorAll("#sndBg .ntfset[data-k]").forEach(b=>{
    const text = b.querySelector(".nt-text").value.trim(), say = b.querySelector(".nt-say").value.trim(), bf = b.querySelector(".nt-before");
    const before = bf && bf.value !== "" ? Number(bf.value) : 0;
    if(text || say || before) value[b.dataset.k] = { text, say, before };
  });
  const customs = [];
  for(const b of document.querySelectorAll("#sndBg .cnrow")){
    const c = cnRead(b); if(!c.time && !c.text) continue;
    if(!/^\d{1,2}:\d{2}$/.test(c.time)){ toast("時刻は 20:15 のように入れてください：" + (c.text || "")); return; }
    if(!c.text){ toast(c.time + " の通知に、表示する文を入れてください"); return; }
    customs.push(c);
  }
  try{
    q(await sb.from("kb_settings").upsert([{ key: "ntf_texts", value, note: "🔔 通知の表示する文・読む文・出勤退勤の何分前（受付の 通知の設定）" },
                                           { key: "custom_ntfs", value: customs, note: "➕ 自由な通知（毎日この時刻に。受付の 通知の設定）" }]));
    M.set.ntf_texts = value; M.set.custom_ntfs = customs; toast("保存しました"); renderNtfBox(); renderShiftNotices(); openSoundSet();
  }catch(e){ toast("保存できませんでした：" + (e.message || e)); }
}
if(window.speechSynthesis) speechSynthesis.getVoices();   // 声の一覧を先に読みこませておく
// アウトコールがきた → 予約を「終了」に・キャストは仕事していたエリアの「待機中」へ
async function outcallDone(id, bd){
  if(!KB.CAN_EDIT) return;
  if(bd !== day){ $("day").value = bd; await loadDay(); }
  const r = rows.find(x=>x.id === id); if(!r) return;
  if(!(await pushLog(id, "アウトコールあり → 終了", { status: "done" }))) return;
  const cd = castDays[r.cast_id] || {};
  const area = STANDBY.find(s=>(r.area || "").includes(s)) || (STANDBY.includes(cd.standby) ? cd.standby : "出張・他エリア");
  // 先に精算した子（精算済・待機中のまま）は、アウトコールのあとも「待機中」のまま（空にすると今いないになる）2026/11/6
  if(r.cast_id) await saveDayPart(r.cast_id, { standby: area, status: cd.settled ? "待機中" : "" });
  toast(castName(r.cast_id) + "：終了 → " + area + "で待機");
  renderList(); loadCallAlerts();
}
setInterval(renderCallAlerts, 30000);
// 今どこに誰が の札をダブルクリック → 本日のキャスト一覧／全体を見たい のその子の枠へ
function jumpToCast(cid){
  const inTL = $("viewTL") && $("viewTL").style.display !== "none";
  let el = null;
  if(inTL) el = document.querySelector(`#tlGrid .nm[onclick*="'${cid}'"]`);
  if(!el){ if(inTL) showView("list"); el = $("cb-" + cid); }
  if(!el){ toast("この画面の一覧に出ていません（並び・絞りを確かめてください）"); return; }
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
}
async function openAlertRes(id, bd){
  if(bd !== day){ $("day").value = bd; await loadDay(); }
  const r = rows.find(x=>x.id === id); if(r) openForm(id);
}
// 🔔 確認電話などの知らせ → 本日のキャスト一覧の、その予約のカードへとぶ（光らせる）。カードがなければ、その子の枠へ
async function jumpToRes(id, bd){
  if(bd !== day){ $("day").value = bd; await loadDay(); }
  const r = rows.find(x=>x.id === id); if(!r){ toast("予約が見つかりません"); return; }
  if($("viewTL") && $("viewTL").style.display !== "none") showView("list");
  const el = $("rc-" + id);
  if(!el){ if(r.cast_id) jumpToCast(r.cast_id); return; }
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  el.classList.remove("rcflash"); void el.offsetWidth; el.classList.add("rcflash");   // 予約のカードの光り方（.rescard.rcflash）
}
loadCallAlerts(); setInterval(loadCallAlerts, 120000);

/* ---------- 🔔 出勤・退勤の通知（SQL 209）
   今日のシフトの出勤時間・退勤時間になったら、上に出す。「済」で消える（内勤みんな同じ）。
   kb_settings 'shift_notice' = { casts: { cast_id: { off_in, off_out } } }（通知しない子）。送る文は 📝 テンプレ（別） ---------- */
let shiftNoticeDays = {}, shiftNoticeShifts = {};
const SN_SHOW_MS = 60 * 60000;   // 時間になってから60分だけ出す（すぎたら自然に消える）
function shiftNoticeSet(){ const v = M.set && M.set.shift_notice; return Object.assign({ in: "", out: "", casts: {} }, v && typeof v === "object" ? v : {}); }
async function loadShiftNotices(){
  if(!M.casts) return;
  if(KB.PRACTICE){ renderShiftNotices(); return; }   // 練習の日は、テンプレ・音のボタンだけ
  try{
    const today = KB.bizDateOf();
    const [sh, cd] = await Promise.all([loadShifts(today), sb.from("kb_cast_days").select("cast_id,status,shift_start_ov,shift_end_ov,notice_in_at,notice_out_at").eq("biz_date", today)]);
    shiftNoticeShifts = cd.error ? {} : (sh || {});   // SQL 209 がまだなら出さない（済を残せないので）
    shiftNoticeDays = {}; (cd.error ? [] : (cd.data || [])).forEach(x=>{ shiftNoticeDays[x.cast_id] = x; });
  }catch(e){ shiftNoticeShifts = {}; }
  renderShiftNotices();
}
function shiftNoticeItems(){
  const today = KB.bizDateOf(), base = Date.parse(today + "T00:00:00+09:00"), now = Date.now(), set = shiftNoticeSet(), items = [];
  Object.entries(shiftNoticeShifts).forEach(([name, sh])=>{
    const c = M.casts.find(x=>x.shift_name === name || x.official_name === name); if(!c) return;
    const cd = shiftNoticeDays[c.id] || {}, own = (set.casts || {})[c.id] || {};
    if(cd.status === "欠勤") return;
    const hs = cd.shift_start_ov != null ? Number(cd.shift_start_ov) : Number(sh.start), he = cd.shift_end_ov != null ? Number(cd.shift_end_ov) : Number(sh.end);   // 時間の変更（出勤時間を変える）があればそちら
    const dIn = base + hs * 3600000 - ntfBefore("in") * 60000, dOut = base + he * 3600000 - ntfBefore("out") * 60000;   // 「何分前に出す」（通知の設定）
    if(!own.off_in && !cd.notice_in_at && now >= dIn && now < dIn + SN_SHOW_MS) items.push({ c, kind: "in", h: hs });
    if(!own.off_out && !cd.notice_out_at && now >= dOut && now < dOut + SN_SHOW_MS) items.push({ c, kind: "out", h: he });
    // 🧾 未精算（領収書など）の「次の出勤日の出勤時刻／退勤時刻に知らせる」（SQL 210）。回収するまで、出勤のたびに
    const uns = ((typeof UNS !== "undefined" && UNS) || []).filter(u => u.cast_id === c.id && !u.done_on && u.alert_at && u.biz_date < today), udone = lsGet("kbUnsAlertDone");
    ["in", "out"].forEach(at => { const us = uns.filter(u => u.alert_at === at), due = at === "in" ? dIn : dOut;
      if(us.length && !udone[today + "|" + c.id + "|" + at] && now >= due && now < due + SN_SHOW_MS) items.push({ c, kind: "uns", at, h: at === "in" ? hs : he, us }); });
  });
  return items.sort((a, b)=>a.h - b.h);
}
const shiftBeeped = new Set();
function renderShiftNotices(){
  const el = $("shiftAlerts"); if(!el || !M.casts) return;
  const items = shiftNoticeItems();
  el.innerHTML = items.length ? `<div class="callalert shiftn">🔔 出勤・退勤（時間から60分だけ出ます）<button type="button" class="snset" onclick="openShiftNoticeSet()">⚙️ 通知しない子</button>
      <div class="snchips">${items.map(({ c, kind, h, at, us })=> kind === "uns"
        ? `<span class="snchip uns" title="${esc(us.map(u => u.note || "").join(" ／ "))}"><b onclick="jumpToCast('${c.id}')">🧾${esc(lateHM(Math.round(h * 60)))} ${esc(c.official_name || c.temp_name)} 未精算・領収書 ${us.length}件</b><button type="button" class="okbtn" title="済（この端末で今日は出さない）" onclick="unsAlertDone('${c.id}','${at}')">✓済</button></span>`
        : `<span class="snchip ${kind}"><b onclick="jumpToCast('${c.id}')">${kind === "in" ? "🌅" : "🌙"}${esc(lateHM(Math.round(h * 60)))} ${esc(c.official_name || c.temp_name)}</b><button type="button" title="テンプレ" onclick="openTplBox(null,'${c.id}','${kind === "in" ? "出勤" : "退勤"}')">📝</button>${KB.CAN_EDIT ? `<button type="button" class="okbtn" title="済" onclick="shiftNoticeDone('${kind}','${c.id}')">✓済</button>` : ""}</span>`).join("")}</div></div>`
    : "";
  el.insertAdjacentHTML("afterbegin", `<div class="snsetonly"><button type="button" onclick="openTplBox()">📝 テンプレ（送る文）</button>${KB.PRACTICE ? "" : `<button type="button" onclick="openShiftNoticeSet()">🔔 出勤・退勤の通知</button>`}<button type="button" onclick="ntfTab='';renderNtfBox(true)">🔔 通知の履歴</button><button type="button" onclick="openSoundSet()">🔊 通知の設定（文・音・声）</button></div>`);
  items.filter(x=>!shiftBeeped.has(x.kind + (x.at || "") + x.c.id)).forEach(x=>{ shiftBeeped.add(x.kind + (x.at || "") + x.c.id);
    notify(x.kind, { 名前: x.c.official_name || x.c.temp_name, 時間: lateHM(Math.round(x.h * 60)), 内容: x.us ? x.us.map(u => u.note || "").join("／") : "" }, `jumpToCast('${x.c.id}')`); });
}
function unsAlertDone(cid, at){ const d = lsGet("kbUnsAlertDone"), today = KB.bizDateOf(); Object.keys(d).forEach(k => { if(k.slice(0, 10) < today) delete d[k]; }); d[today + "|" + cid + "|" + at] = 1; lsSet("kbUnsAlertDone", d); renderShiftNotices(); }

/* ---------- 📝 テンプレ（いろいろな場面で送る文を、自由に登録してコピー）
   kb_settings 'msg_templates' = [{ id, scene, title, text }]。{名前} {時間} は、えらんだキャスト・今の時刻に ---------- */
function tplList(){ const v = M.set && M.set.msg_templates; return Array.isArray(v) ? v : []; }
function tplFill(t, cid){
  if(cid == null) cid = $("tpl_cast") ? $("tpl_cast").value : ""; const c = M.casts.find(x=>x.id === cid), d = new Date();
  const s = String(t || "");
  if(s.includes("{内勤シフト}") && naikinWeek === null){ naikinWeek = "（読みこみ中…）"; loadNaikinWeek(); }
  return s.replace(/\{名前\}/g, c ? (c.official_name || c.temp_name) : "{名前}").replace(/\{時間\}/g, lateHM(d.getHours() * 60 + d.getMinutes()))
    .replace(/\{内勤シフト\}/g, naikinWeek || "");
}
// {内勤シフト}：今日から7日分の内勤のシフト（内勤カレンダー）。美咲などに送るとき用（2026/11/5）
let naikinWeek = null;
const NAIKIN_NAME = { kya: "きゃ", suya: "すや", ran: "らん", kami: "かみ", waka: "わか" };
async function loadNaikinWeek(){
  try{
    const from = KB.realBizDateOf(), to = addDays(from, 6);
    const rows2 = q(await sb.from("naikin_shifts").select("staff_id,date,time").gte("date", from).lte("date", to).order("date")) || [];
    const lines = [];
    for(let i = 0; i < 7; i++){
      const dd = addDays(from, i), dt = new Date(dd + "T12:00:00Z");
      const who = rows2.filter(r => r.date === dd && r.time).map(r => (NAIKIN_NAME[r.staff_id] || r.staff_id) + " " + r.time);
      lines.push(`${dt.getUTCMonth() + 1}/${dt.getUTCDate()}(${DOW[dt.getUTCDay()]})　${who.length ? who.join("・") : "—"}`);
    }
    naikinWeek = lines.join("\n");
  }catch(e){ naikinWeek = "（内勤のシフトを読めませんでした）"; }
  if($("tplBg") && $("tplBg").classList.contains("show")) openTplBox();
}
let tplScene = "";   // えらんでいる種類（"" = ぜんぶ）
const TPL_BASE_SCENES = ["出勤", "退勤", "前日確電", "1H前確電"];   // 前日確電・1H前確電：予約の状態をその確認電話から次に進めたとき、その種類のテンプレが開く（2026/11/7）
function openTplBox(editId, castId, scene){
  let bg = $("tplBg");
  if(!bg){ bg = document.createElement("div"); bg.id = "tplBg"; bg.className = "modal-bg"; document.body.appendChild(bg); KB.closeOnBackdrop(bg, () => bg.classList.remove("show")); }
  if(scene != null) tplScene = scene;
  const keepCast = castId || ($("tpl_cast") ? $("tpl_cast").value : ""), list = tplList();
  const scenes = [...new Set([...TPL_BASE_SCENES, ...list.map(t=>t.scene || "そのほか")])];
  const ed = editId === "new" ? { id: "", scene: tplScene, title: "", text: "" } : list.find(t=>t.id === editId);
  const shown = list.filter(t=>!tplScene || (t.scene || "そのほか") === tplScene);
  const group = tplScene ? [tplScene] : scenes.filter(s=>shown.some(t=>(t.scene || "そのほか") === s));
  bg.innerHTML = `<div class="modal" style="max-width:680px"><button class="x" onclick="$('tplBg').classList.remove('show')">×</button>
    <h2>📝 テンプレ（送る文）</h2>
    <div class="f" style="margin:6px 0"><label>だれに送る？（{名前} がこの子の名前になります）</label>
      <select id="tpl_cast" onchange="openTplBox()"><option value="">（えらばない）</option>${M.casts.map(c=>`<option value="${c.id}" ${c.id === keepCast ? "selected" : ""}>${esc(c.official_name || c.temp_name)}</option>`).join("")}</select></div>
    <div class="tplkinds"><span>種類：</span><button type="button" class="${tplScene ? "" : "on"}" onclick="openTplBox(null,null,'')">ぜんぶ</button>${scenes.map(s=>`<button type="button" class="${s === tplScene ? "on" : ""}" onclick="openTplBox(null,null,'${esc(s)}')">${esc(s)}</button>`).join("")}</div>
    ${ed ? `<div class="tpled"><div class="f"><label>種類（あたらしい種類も書けます）</label><input id="tpl_scene" list="tplScenes" value="${esc(ed.scene)}" placeholder="例：出勤 / 退勤 / 遅刻 / お客さん"><datalist id="tplScenes">${scenes.map(s=>`<option value="${esc(s)}">`).join("")}</datalist></div>
      <div class="f"><label>名前（ボタンに出る）</label><input id="tpl_title" value="${esc(ed.title)}" placeholder="例：美咲 退勤のお礼"></div>
      <div class="f"><label>文 <small style="font-weight:600;color:var(--sub)">{名前} {時間} {内勤シフト}（今日から7日分の内勤のシフト）が使えます</small></label><textarea id="tpl_text" rows="5" placeholder="{名前}さん、お疲れさまでした！…">${esc(ed.text)}</textarea></div>
      <button type="button" class="btn btn-primary btn-sm" onclick="saveTpl('${esc(ed.id)}')">保存</button>
      <button type="button" class="btn btn-ghost btn-sm" onclick="openTplBox()">やめる</button>
      ${ed.id ? `<button type="button" class="btn btn-ghost btn-sm" style="float:right" onclick="delTpl('${esc(ed.id)}')">消す</button>` : ""}</div>` : ""}
    ${shown.length ? group.map(s=>`<h3 class="tplsc">${esc(s)}</h3>${shown.filter(t=>(t.scene || "そのほか") === s).map(t=>`<div class="tplrow">
        <div><b>${esc(t.title || "（名前なし）")}</b><small>${esc(tplFill(t.text, keepCast))}</small></div>
        <span><button type="button" class="btn btn-primary btn-sm" onclick="copyTpl('${esc(t.id)}')">📋 コピー</button>
        ${KB.CAN_EDIT ? `<button type="button" class="btn btn-ghost btn-sm" onclick="openTplBox('${esc(t.id)}')">直す</button>` : ""}</span></div>`).join("")}`).join("")
      : `<p style="color:var(--sub)">${tplScene ? "「" + esc(tplScene) + "」の" : ""}テンプレはまだありません。「＋ テンプレを足す」から登録してください。</p>`}
    ${KB.CAN_EDIT && !ed ? `<button type="button" class="btn btn-ghost" style="margin-top:10px;width:100%" onclick="openTplBox('new')">＋ テンプレを足す${tplScene ? "（" + esc(tplScene) + "）" : ""}</button>` : ""}</div>`;
  bg.classList.add("show");
}
function copyTpl(id){ const t = tplList().find(x=>x.id === id); if(!t) return; navigator.clipboard.writeText(tplFill(t.text)).then(()=>toast("📋 「" + (t.title || "テンプレ") + "」をコピーしました")); }
async function saveTplList(list){
  try{
    q(await sb.from("kb_settings").upsert({ key: "msg_templates", value: list, note: "📝 テンプレ（受付の 📝 テンプレ）" }));
    M.set.msg_templates = list; return true;
  }catch(e){ toast("保存できませんでした：" + (e.message || e)); return false; }
}
async function saveTpl(id){
  if(!KB.CAN_EDIT) return;
  const t = { id: id || ("t" + Date.now()), scene: $("tpl_scene").value.trim(), title: $("tpl_title").value.trim(), text: $("tpl_text").value };
  if(!t.text.trim()){ toast("文を入れてください"); return; }
  const list = tplList().filter(x=>x.id !== t.id); const i = tplList().findIndex(x=>x.id === t.id);
  if(i >= 0) list.splice(i, 0, t); else list.push(t);
  if(await saveTplList(list)){ toast("保存しました"); openTplBox(null, null, t.scene || "そのほか"); }
}
async function delTpl(id){
  if(!KB.CAN_EDIT || !confirm("このテンプレを消しますか？")) return;
  if(await saveTplList(tplList().filter(x=>x.id !== id))){ toast("消しました"); openTplBox(); }
}
async function shiftNoticeDone(kind, cid){
  if(!KB.CAN_EDIT) return;
  const today = KB.bizDateOf(), patch = { biz_date: today, cast_id: cid, notice_by: KB.operatorName(), updated_at: new Date().toISOString(), updated_by: KB.operatorName() };
  patch[kind === "in" ? "notice_in_at" : "notice_out_at"] = new Date().toISOString();
  try{
    const r = q(await sb.from("kb_cast_days").upsert(patch, { onConflict: "biz_date,cast_id" }).select("*").single());
    shiftNoticeDays[cid] = r; if(today === day) castDays[cid] = r;
    renderShiftNotices();
  }catch(e){ toast("保存できませんでした：" + (e.message || e)); }
}
// 🔔 出勤・退勤の通知：通知しないキャストだけ決める（送る文は 📝 テンプレ）
function snRowHtml(cid, o){
  const ro = KB.CAN_EDIT ? "" : "disabled";
  return `<div class="snrow">
      <select class="sn-c" ${ro}><option value="">（キャストをえらぶ）</option>${M.casts.map(c=>`<option value="${c.id}" ${c.id === cid ? "selected" : ""}>${esc(c.official_name || c.temp_name)}</option>`).join("")}</select>
      <label><input type="checkbox" class="sn-offin" ${o.off_in ? "checked" : ""} ${ro}> 出勤は通知しない</label>
      <label><input type="checkbox" class="sn-offout" ${o.off_out ? "checked" : ""} ${ro}> 退勤は通知しない</label></div>`;
}
function openShiftNoticeSet(){
  let bg = $("snBg");
  if(!bg){ bg = document.createElement("div"); bg.id = "snBg"; bg.className = "modal-bg"; document.body.appendChild(bg); KB.closeOnBackdrop(bg, () => bg.classList.remove("show")); }
  const set = shiftNoticeSet();
  bg.innerHTML = `<div class="modal" style="max-width:620px"><button class="x" onclick="$('snBg').classList.remove('show')">×</button>
    <h2>🔔 出勤・退勤の通知</h2>
    <p style="font-size:12.5px;color:var(--sub);line-height:1.6;margin:0 0 8px">シフトの出勤時間・退勤時間になると、受付の上に出ます（欠勤の子は出ません）。<br>送る文は「📝 テンプレ」に登録してください（通知の「📝 テンプレ」から、その子をえらんだ状態で開けます）。<br>ここでは、通知しないキャストだけ決めます。</p>
    <div id="snRows">${Object.entries(set.casts || {}).filter(([, o])=>o.off_in || o.off_out).map(([cid, o])=>snRowHtml(cid, o)).join("")}${snRowHtml("", {})}</div>
    ${KB.CAN_EDIT ? `<button type="button" class="btn btn-ghost btn-sm" onclick="$('snRows').insertAdjacentHTML('beforeend', snRowHtml('', {}))">＋ キャストを足す</button>
    <button type="button" class="btn btn-primary" style="margin-top:10px;width:100%" onclick="saveShiftNoticeSet()">保存</button>` : ""}</div>`;
  bg.classList.add("show");
}
async function saveShiftNoticeSet(){
  if(!KB.CAN_EDIT) return;
  const casts = {};
  document.querySelectorAll("#snRows .snrow").forEach(r=>{
    const cid = r.querySelector(".sn-c").value; if(!cid) return;
    const o = { off_in: r.querySelector(".sn-offin").checked, off_out: r.querySelector(".sn-offout").checked };
    if(o.off_in || o.off_out) casts[cid] = o;
  });
  const value = { casts };
  try{
    q(await sb.from("kb_settings").upsert({ key: "shift_notice", value, note: "🔔 出勤・退勤の通知（通知しないキャスト）" }));
    M.set.shift_notice = value; $("snBg").classList.remove("show"); toast("保存しました"); renderShiftNotices();
  }catch(e){ toast("保存できませんでした：" + (e.message || e)); }
}
setInterval(loadShiftNotices, 120000); setInterval(renderShiftNotices, 30000);
const __loadDayA = loadDay;
let shiftNoticeFirst = true;
loadDay = async function(){ await __loadDayA(); renderCallAlerts(); if(shiftNoticeFirst){ shiftNoticeFirst = false; loadShiftNotices(); renderNtfBox(); } checkNotice(); };

/* ---------- 💳 カード決済の進み具合（本日のキャスト一覧で、プルダウンで変える） ---------- */
const CARD_STEP = [["unsent", "💳 URL未送信"], ["sent", "📨 URL送信済み"], ["paid", "✅ 決済済み"]];
// 現金＋カード（分けて払う）の予約：支払いは「現金」のまま、カードの分（card_total）がある
const isSplitPay = r => !!r && r.payment === "cash" && Number(r.card_total) > 0;
function cardSel(r){
  if((r.payment === "cash" && !isSplitPay(r)) || !("card_step" in r)) return "";
  const cur = r.card_step || (r.payment === "card_paid" ? "paid" : "unsent");
  const amt = isSplitPay(r) ? `<span class="cardamt">💳 カード決済 ${yen(Number(r.card_total))}</span> ` : "";   // 現金＋カードは、カードで払う額を出す
  if(!KB.CAN_EDIT) return `<br>${amt}<span class="cardst ${cur}">${(CARD_STEP.find(x=>x[0] === cur) || [])[1] || ""}</span>`;
  return `<br>${amt}<select class="cardst ${cur}" onclick="event.stopPropagation()" onchange="setCardStep(${r.id},this.value)">${CARD_STEP.map(([v, l])=>`<option value="${v}" ${cur === v ? "selected" : ""}>${l}</option>`).join("")}</select>`;
}
async function setCardStep(id, v){
  const l = (CARD_STEP.find(x=>x[0] === v) || [])[1] || v;
  const rr = rows.find(x=>x.id === id);
  // 決済済み＝カード精算済（精算で使う）。現金＋カードは、支払いは「現金」のまま（カードの分は card_total）
  const pay = isSplitPay(rr) ? null : v === "paid" ? "card_paid" : (rr && rr.payment === "card_paid" ? "card" : null);
  if(await pushLog(id, "カード：" + l, Object.assign({ card_step: v }, pay ? { payment: pay } : {}))){ toast("カード：" + l); renderList(); }
}

/* ---------- 🚫 キャンセル・トビ（売上には入れない。あったことは見えるように） ---------- */
function cancelSection(){
  const list = rows.filter(r=>r.status === "cancel" || r.status === "tobi" || r.status === "flowed").sort((a, b)=>String(a.start_at).localeCompare(String(b.start_at)));
  if(!list.length) return "";
  const n = s => list.filter(r=>r.status === s).length;
  return `<div class="cblock cxbox"><div class="ch"><b>🚫 キャンセル・トビ</b><small>キャンセル ${n("cancel")}件・トビ ${n("tobi")}件${n("flowed") ? "・流れた " + n("flowed") + "件" : ""}（売上・報酬には入りません）</small></div>
    <div class="wrapx"><table class="list"><tr><th>時間</th><th>キャスト</th><th>状態</th><th>コース</th><th>お客さん</th><th>📝 備考（新しい順）</th></tr>
    ${list.map(r=>{ const c = r.kb_customers || {}, lg = logOf(r).slice().reverse()[0];
      return `<tr class="r" onclick="openForm(${r.id})"><td>${hm(r.start_at)}〜${hm(r.end_at)}</td><td><b>${esc(castName(r.cast_id))}</b></td>
        <td><span class="st ${r.status}">${STATUS[r.status]}</span></td><td>${esc(r.course)}${/^\d+$/.test(r.course) ? "分" : ""}</td>
        <td>${esc(c.name || "")}${c.phone ? `<br><span class="tel">📞 ${esc(c.phone)}</span>` : ""}</td>
        <td><small>${lg ? esc(whenShort(lg.at) + " " + (lg.by || "") + " " + lg.text) : ""}</small></td></tr>`; }).join("")}</table></div></div>`;
}

/* ---------- 📝 勤怠（欠勤・遅刻・早退・シフト時間変更）の理由 ---------- */
const ATTEND_KINDS = ["欠勤", "遅刻", "早退", "時間変更", "その他"];   // その他（理由は「今いない」の札にも出す）2026/11/12
// 📌 今日のこと（SQL 175）：内勤みんなに知らせるメモ（病院に行ってから来る・今日は逆AF不可 など）
function infoNoteHtml(cid){
  const t = String((castDays[cid] || {}).info_note || "").trim();
  return t ? `<div class="infonote">📌 今日のこと：${esc(t)}</div>` : "";
}
// 受付でそのキャストを選んだら、確認のいちばん上に出す
{ const __rccInfo = renderCastChecks; renderCastChecks = function(c){ const r = __rccInfo.apply(this, arguments); if(c && $("castChecks") && (!$("f_day") || !$("f_day").value || $("f_day").value === day)) $("castChecks").insertAdjacentHTML("afterbegin", infoNoteHtml(c.id)); return r; }; }
async function editInfoNote(cid){
  const t = prompt(`📌 ${castName(cid)} の今日のこと（内勤みんなに知らせる）\n例：病院に行ってから来る／今日は逆AF不可／AFのみ受付\n空にすると消えます`, (castDays[cid] || {}).info_note || "");
  if(t == null) return;
  if(await saveDayPart(cid, { info_note: t.trim().slice(0, 300) })) toast(t.trim() ? "📌 今日のことを入れました" : "📌 今日のことを消しました");
}
function attendHtml(cid){
  const log = ((castDays[cid] || {}).attend_log) || [];
  if(!log.length) return "";
  return `<div class="attend">${log.map(a=>`<span class="ak ${a.kind === "欠勤" ? "absent" : ""}">📝 <b>${esc(a.kind)}</b>${a.time ? "（" + esc(a.time) + "）" : ""}：${esc(a.reason || "理由なし")}<small> ${KBF.staffTag(a.by)} ${whenShort(a.at)}</small></span>`).join("")}</div>`;
}
let attendCid = null;
function openAttend(cid, kind){
  if(!KB.CAN_EDIT){ toast("作成中のため、書けるのは店長だけです"); return; }
  attendCid = cid;
  $("attendTitle").textContent = "📝 勤怠の記録：" + castName(cid);
  $("at_kind").value = kind || "遅刻"; $("at_time").value = ""; $("at_reason").value = "";
  $("attendBg").classList.add("show");
  setTimeout(()=>$("at_reason").focus(), 50);
}
async function saveAttend(){
  const cid = attendCid; if(!cid) return;
  const kind = $("at_kind").value, reason = $("at_reason").value.trim(), time = $("at_time").value.trim();
  if(!reason){ toast("理由を書いてください（わからなければ「不明」）"); return; }
  const log = (((castDays[cid] || {}).attend_log) || []).concat([{ kind, reason, time, at: new Date().toISOString(), by: KB.operatorName() }]);
  const patch = { attend_log: log };
  if(kind === "欠勤") Object.assign(patch, { status: "欠勤", standby: "" });   // 欠勤は今どこに誰がの「今いない（欠勤）」へ
  if(await saveDayPart(cid, patch)){ $("attendBg").classList.remove("show"); toast("記録しました"); }
}
// 今いないの札で「欠勤」にしたときは、理由を聞く
const __cycleGone = cycleGone;
cycleGone = async function(cid){
  const cd = castDays[cid] || {};
  const next = GONE_CYCLE[(GONE_CYCLE.indexOf(goneKind(cd)) + 1) % GONE_CYCLE.length];
  // 欠勤は理由を聞く。やめたいときは「欠勤にしない（不在にもどす）」で ⬜不在 にもどせる
  if(next === "欠勤"){ openAttend(cid, "欠勤"); $("at_skip").style.display = ""; return; }
  await saveDayPart(cid, { status: next });
};

/* ---------- キャストを変えたら、本指名・店リピを決めなおす（電話番号で調べたお客さんのとき） ---------- */
const __onCastV = onCast;
onCast = function(){
  __onCastV.apply(this, arguments);
  if(!custPast) return;
  const cid = $("f_cast").value;
  setVisit(visitFrom(custSeen || custPast, cid));
};

/* ============================================================
   2026/10/20 のつづき
   ============================================================ */
// 状態のプルダウン：予約一覧と同じ色。まだ選んでいないときは「選択してください」が点滅
function stColor(){ const el = $("f_status"); if(el) el.className = "stsel st " + (el.value || "pick"); }

// 本指名・店リピ：その予約より前に「終了」した予約だけで決める（今の予約・キャンセル・トビは数えない）
function visitFrom(past, cid){
  if(past && past === custSeen) past = seenNorm();
  const fd = ($("f_day") && $("f_day").value) || day;   // 予約の日より前だけ（台帳エクセルには、この日の利用そのものが入っていることがある）
  const prev = (past || []).filter(p=>p.status === "done" && !(editing && p.id === editing.id) && p.biz_date && p.biz_date < fd);
  if(!prev.length) return "new";
  // 今回フリー（フリー・特別フリー・イベフリー）なら、前にその子を指名していても本指名ではない → 店リピ（2026/11/9 内勤さん）
  if($("f_free") && $("f_free").value) return "repeat";
  return cid && prev.some(p=>p.cast_id === cid) ? "honshi" : "repeat";
}
// その回がフリーだったか（記録簿の予約：free_kind／台帳エクセル：フリーの欄に「フリー」「イベ」など）
function isFreeVisit(p){ return !!(p && p.free_kind && String(p.free_kind).trim()); }
// 3Pの案内のホテルは、エリア・ホテルを変えたら出しなおす（2026/11/9）
["change", "input"].forEach(ev => document.addEventListener(ev, e => { const id = e.target && e.target.id; if(!["f_areaSel", "f_area", "f_address"].includes(id) || typeof party === "undefined" || !party.kind) return; clearTimeout(window.__p3t); window.__p3t = setTimeout(() => { try{ renderCastChecks(M.casts.find(c => c.id === $("f_cast").value)); }catch(_){} }, 300); }, true));
// キャストの枠の予約：流れた・キャンセル・トビは、いちばん下に（ほかは時間の順のまま）2026/11/9 内勤さん
const offLast = (a, b) => (["cancel", "tobi", "flowed"].includes(a.status) ? 1 : 0) - (["cancel", "tobi", "flowed"].includes(b.status) ? 1 : 0);
// 予約を開いたとき、そのお客さんのこれまでを読んでおく（キャストを変えたら決めなおせるように。開いただけでは変えない）
const __openFormP = openForm;
openForm = function(id){
  __openFormP(id);
  const r = id ? rows.find(x=>x.id === id) : null;
  if(r && r.customer_id){
    sb.from("kb_reservations").select("id,cast_id,status").eq("customer_id", r.customer_id).eq("deleted", false)
      .then(res=>{ if(editing && editing.id === id && !res.error) custPast = res.data || []; });
  }
};

// 受付ルールの「いつ出す？」：店リピ・本指名のとき
const __ruleApplies = ruleApplies;
ruleApplies = function(x){
  if(x.cond === "repeat") return visit === "repeat";
  if(x.cond === "honshi") return visit === "honshi";
  return __ruleApplies(x);
};

/* ---------- 有料オプションの一覧：足すのは内勤みんな・直す/消すのは店長だけ ---------- */
function curOptSel(){ try{ return calc().opts.map(o=>({ code: o.code, group: o.group, qty: o.qty, price: o.price, back: o.back, label: o.label, ...(o.memo ? { memo: o.memo } : {}) })); }catch(e){ return []; } }
function rerenderOpts(){ const keep = curOptSel(); onStore({ options: keep, dummy_name: $("f_dummy") ? $("f_dummy").value : "" }); recalc(); }
const UNIT = [["once", "1回"], ["per_item", "枚数で"], ["per_cast", "キャストの人数で"]];
function openOptAdd(){
  const g = storeGroup($("f_store").value);
  $("optTitle").textContent = "＋ 有料オプションを一覧に足す（" + ({ sakurana: "サクラナ系", cutie: "キューティ", gokumon: "極門" }[g] || g) + "）";
  $("optBody").innerHTML = `<div class="row2"><div class="f"><label>名前</label><input id="na_label" maxlength="40" placeholder="例：ローション追加"></div>
      <div class="f"><label>数え方</label><select id="na_unit">${UNIT.map(([v, l])=>`<option value="${v}">${l}</option>`).join("")}</select></div></div>
    <div class="row2" style="margin-top:8px"><div class="f"><label>料金（1回あたり）</label><input type="number" id="na_price" min="0" value="0"></div>
      <div class="f"><label>バック（1回あたり）</label><input type="number" id="na_back" min="0" value="0"></div></div>
    <div class="f" style="margin-top:8px"><label>メモ（あれば）</label><input id="na_note" maxlength="100"></div>
    <label style="display:block;margin-top:6px;font-size:13px"><input type="checkbox" id="na_manual"> 内容で料金が変わる（受付のたびに金額を直せるようにする）</label>
    <div class="hint2" style="font-size:12px;color:var(--sub);margin-top:6px">足したものを直したり消したりできるのは店長だけです。</div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px"><button class="btn btn-ghost" onclick="$('optBg').classList.remove('show')">やめる</button>
      <button class="btn btn-primary" onclick="saveOptAdd('${g}')">＋ 足す</button></div>`;
  $("optBg").classList.add("show");
}
async function saveOptAdd(g){
  const label = $("na_label").value.trim();
  if(!label){ toast("名前を入れてください"); return; }
  if(M.options.some(o=>o.store_group === g && o.label === label)){ toast("同じ名前のオプションがもうあります"); return; }
  const row = { store_group: g, code: "x" + Date.now().toString(36), label, unit: $("na_unit").value, price: Math.max(0, +$("na_price").value || 0),
    back: Math.max(0, +$("na_back").value || 0), note: $("na_note").value.trim(), manual: $("na_manual").checked,
    sort: Math.max(0, ...M.options.filter(o=>o.store_group === g).map(o=>o.sort || 0)) + 1 };
  try{
    const r = q(await sb.from("kb_options").insert(row).select().single());
    M.options.push(r); $("optBg").classList.remove("show"); rerenderOpts(); $("optDetails").open = true;
    toast("「" + label + "」を一覧に足しました");
  }catch(e){ toast("足せませんでした：" + (e.message || e)); }
}
function openOptEdit(){
  if(!KB.CAN_EDIT){ toast("直せるのは店長だけです"); return; }
  const g = storeGroup($("f_store").value), list = M.options.filter(o=>o.store_group === g && !["af", "gyakuaf"].includes(o.code));
  $("optTitle").textContent = "⚙️ 有料オプションの一覧を直す・消す（店長）";
  $("optBody").innerHTML = `<div class="hint2" style="font-size:12px;color:var(--sub);margin-bottom:6px">直したら「保存」。消しても、今までの予約の記録はそのまま残ります。</div>`
    + list.map(o=>`<div class="optadm" data-code="${esc(o.code)}">
      <input class="l" value="${esc(o.label)}" maxlength="40"><input class="p" type="number" value="${o.price}" title="料金"><input class="b" type="number" value="${o.back}" title="バック">
      <button class="btn btn-ghost btn-sm" onclick="saveOptEdit('${g}','${esc(o.code)}',this)">保存</button><button class="btn btn-ghost btn-sm" onclick="delOpt('${g}','${esc(o.code)}')">🗑</button></div>`).join("");
  $("optBg").classList.add("show");
}
async function saveOptEdit(g, code, btn){
  const box = btn.closest(".optadm"), label = box.querySelector(".l").value.trim();
  if(!label) return;
  const patch = { label, price: Math.max(0, +box.querySelector(".p").value || 0), back: Math.max(0, +box.querySelector(".b").value || 0) };
  try{ q(await sb.from("kb_options").update(patch).eq("store_group", g).eq("code", code)); Object.assign(M.options.find(o=>o.store_group === g && o.code === code), patch); rerenderOpts(); toast("保存しました"); }
  catch(e){ toast("保存できませんでした：" + (e.message || e)); }
}
async function delOpt(g, code){
  const o = M.options.find(x=>x.store_group === g && x.code === code); if(!o) return;
  if(!confirm("「" + o.label + "」を一覧から消しますか？（今までの予約の記録はそのまま）")) return;
  try{ q(await sb.from("kb_options").delete().eq("store_group", g).eq("code", code)); M.options = M.options.filter(x=>x !== o); rerenderOpts(); openOptEdit(); toast("消しました"); }
  catch(e){ toast("消せませんでした：" + (e.message || e)); }
}
KB.closeOnBackdrop($("optBg"), ()=>$("optBg").classList.remove("show"));

/* ---------- 遅刻・早退・時間変更：その日の出勤・退勤の時刻を変える（サクラシフトの元の時間は残す） ---------- */
const toHour = s=>{ if(!s) return null; const [h, m] = s.split(":").map(Number); let v = h + m / 60; if(v < 8) v += 24; return Math.round(v * 100) / 100; };
const fromHour = v=>{ if(v == null || v === "") return ""; v = Number(v); const h = Math.floor(v) % 24, m = Math.round((v - Math.floor(v)) * 60); return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0"); };
const __tlRowsS = tlRows;
tlRows = function(){
  return __tlRowsS().map(x=>{
    const cd = x.cd || {};
    if(x.shift && (cd.shift_start_ov != null || cd.shift_end_ov != null) && !x.shiftOrig){
      x.shiftOrig = x.shift;
      x.shift = Object.assign({}, x.shift, { start: cd.shift_start_ov != null ? Number(cd.shift_start_ov) : x.shift.start, end: cd.shift_end_ov != null ? Number(cd.shift_end_ov) : x.shift.end });
    }
    return x;
  });
};
// 🏁 完（完全終了）：その日だけ記録簿でつける・外す（SQL 212：kb_cast_days.kanzen。null＝サクラシフトのとおり）2026/11/5
const __tlRowsK = tlRows;
tlRows = function(){
  return __tlRowsK().map(x => {
    const cd = x.cd || {};
    if(x.shift && cd.kanzen != null && x.shift.kanzen !== cd.kanzen){ x.shiftKanzen = x.shiftKanzen ?? !!x.shift.kanzen; x.shift = Object.assign({}, x.shift, { kanzen: !!cd.kanzen }); }
    return x;
  });
};
function kanzenBtn(cid){
  const x = tlRows().find(r => r.c && r.c.id === cid); if(!x || !x.shift) return "";
  const on = !!x.shift.kanzen, cd = castDays[cid] || {};
  return `<button type="button" class="kzbtn ${on ? "on" : ""}" title="${cd.kanzen != null ? "記録簿で" + (on ? "つけた" : "外した") : "サクラシフトのとおり"}（押すと${on ? "外す" : "つける"}）" onclick="event.stopPropagation();setKanzen('${cid}')">🏁 完${on ? "" : "なし"}</button>`;
}
async function setKanzen(cid){
  const x = tlRows().find(r => r.c && r.c.id === cid); if(!x || !x.shift) return;
  const now = !!x.shift.kanzen, next = !now, fromShift = x.shiftKanzen ?? now;
  if(!confirm(`${castName(cid)}：この日を「${next ? "完（完全終了）にする" : "完ではない"}」にしますか？`)) return;
  try{
    if(await saveDayPart(cid, { kanzen: next === fromShift && (castDays[cid] || {}).kanzen != null ? null : next })) toast(`🏁 ${castName(cid)}：${next ? "完にしました" : "完を外しました"}`);
  }catch(e){ toast("保存できませんでした（SQL 212 は実行ずみ？）：" + (e.message || e)); }
}
document.head.insertAdjacentHTML("beforeend", `<style>.kzbtn{font-family:inherit;font-size:12px;font-weight:800;border:1.5px solid var(--line);background:#fff;color:#999;border-radius:99px;padding:3px 9px;cursor:pointer;margin-left:4px} .kzbtn.on{background:#2B4C8C;border-color:#2B4C8C;color:#fff} .kzbtn.fullbtn{color:#c0392b} .kzbtn.fullbtn.on{background:#E0001B;border-color:#E0001B;color:#fff} .fullbar{background:#FFE4E4;border:2px solid #E0001B;color:#B0001B;border-radius:10px;padding:6px 12px;margin:0 0 8px;font-weight:900} .fullbadge{display:inline-block;background:#E0001B;color:#fff;border-radius:6px;padding:0 5px;margin-left:4px;font-size:11px;font-weight:900} .chipc.gone.brkc{background:#FF9F43;border-color:#E67E22;color:#fff} .tripat{display:inline-block;background:#FFF3C4;color:#7A5A00;border-radius:6px;padding:0 6px;font-size:11.5px;font-weight:900;margin-top:2px}</style>`);
const __openAttend = openAttend;
openAttend = function(cid, kind){
  __openAttend(cid, kind);
  const cd = castDays[cid] || {};
  $("at_start").value = fromHour(cd.shift_start_ov); $("at_end").value = fromHour(cd.shift_end_ov);
  const sync = ()=>{ $("at_shiftBox").style.display = $("at_kind").value === "欠勤" ? "none" : ""; };
  $("at_kind").onchange = sync; sync();
  $("at_skip").style.display = "none";   // 今いないの札から「欠勤」にしたときだけ出す（下の cycleGone）
};
saveAttend = async function(){
  const cid = attendCid; if(!cid) return;
  const kind = $("at_kind").value, reason = $("at_reason").value.trim(), time = $("at_time").value.trim();
  if(!reason){ toast("理由を書いてください（わからなければ「不明」）"); return; }
  const st = kind === "欠勤" ? null : toHour($("at_start").value), en = kind === "欠勤" ? null : toHour($("at_end").value);
  const shiftTxt = [st != null ? "出勤→" + fromHour(st) : "", en != null ? "退勤→" + fromHour(en) : ""].filter(Boolean).join("・");
  const log = (((castDays[cid] || {}).attend_log) || []).concat([{ kind, reason, time: [time, shiftTxt].filter(Boolean).join("／"), st, en, at: new Date().toISOString(), by: KB.operatorName() }]);
  const patch = { attend_log: log };
  if(kind === "欠勤") Object.assign(patch, { status: "欠勤", standby: "" });
  if(st != null) patch.shift_start_ov = st;
  if(en != null) patch.shift_end_ov = en;
  if(await saveDayPart(cid, patch)){
    $("attendBg").classList.remove("show"); toast("記録しました");
    // サクラシフトにも（欠勤→お休み・時間を変えた→その時間）。理由は入れない
    if(kind === "欠勤") pushShiftChange(cid, "absent");
    else if(st != null || en != null) pushShiftChange(cid, "time", st, en);
  }
};

/* ---------- 🚶 移動中：予約の状態を「移動中」にしたら、今どこに誰がの札に「移動前のエリア → ※移動中※」と今いる場所の欄 ---------- */
function movingRes(cid){ return rows.find(r=>r.cast_id === cid && r.status === "moving"); }
function movingHtml(x){
  if(!x.c || !movingRes(x.c.id)) return "";
  const cd = x.cd || {};
  return `<div class="movebox">${esc(cd.move_from || "？")} → <b>※移動中※</b>
    ${KB.CAN_EDIT ? `<input class="movenow" value="${esc(cd.move_now || "")}" placeholder="今いる場所（例：池袋駅）" onchange="saveDayPart('${x.c.id}',{ move_now: this.value.trim() })">` : (cd.move_now ? `<br>📍${esc(cd.move_now)}` : "")}</div>`;
}
// 移動中にしたとき、移動前のエリアを覚えておく
async function markMoving(cid){
  const x = tlRows().find(r=>r.c && r.c.id === cid); if(!x) return;
  const st = boardState(x), from = boardCol(x, st) || (x.cd && x.cd.standby) || "";
  await saveDayPart(cid, { move_from: from, move_now: "" });
}
const __quickStatusM = quickStatus;
quickStatus = async function(id, st){
  const r = rows.find(x=>x.id === id), was = r && r.status;
  await __quickStatusM(id, st);
  if(r && r.cast_id && st === "moving" && was !== "moving") markMoving(r.cast_id);
};
const __quickStatusT = quickStatus;
quickStatus = async function(id, st){   // 状態のプルダウンの「🏦 振込」は、状態を変えずに振込だけ変える
  if(!String(st).startsWith("tr:")) return __quickStatusT(id, st);
  if(!KB.CAN_EDIT) return;
  const r = rows.find(x=>x.id === id), v = st.slice(3);
  if(r && v === (r.transfer_status || "")){ renderList(); return; }
  return trStatus(id, v);
};
const __saveResM = saveRes;
saveRes = async function(){
  const st = $("f_status").value, cid = $("f_cast").value, was = editing ? editing.status : "";
  await __saveResM();
  if(cid && st === "moving" && was !== "moving") markMoving(cid);
  if(!$("formBg").classList.contains("show")) draftDone();   // 登録できたら、その一時保存だけ消す（ほかのストックは残す）2026/11/11
};

/* ---------- 🏨 ホテルの部屋番号を入れたら、新規のお客さんは「在室確認をする？」を窓で聞く ---------- */
var roomCheck = null;   // null＝まだ聞いていない／true＝する／false＝しない
$("f_address").addEventListener("change", () => {
  if(!KB.CAN_EDIT || visit !== "new" || roomCheck !== null) return;
  const a = $("f_address").value.trim(), kind = $("f_place").value;
  if(kind === "home" || !/\d{2,4}\s*(号室)?\s*$/.test(a)) return;
  roomCheck = confirm("🏨 新規のお客さんです。ホテルの在室確認をしますか？\n\nOK＝する（予約のあとにやることに入ります）\nキャンセル＝しない");
  if(typeof renderCastChecks === "function") renderCastChecks(M.casts.find(x => x.id === $("f_cast").value));
  toast(roomCheck ? "🏨 在室確認を「予約のあとにやること」に入れます" : "在室確認はしません");
});
{ const __ofRoom = openForm; openForm = function(id){ const r = __ofRoom.apply(this, arguments); roomCheck = editing && (editing.todos || []).some(x => /在室確認/.test(x.text)) ? true : null; return r; }; }
/* ---------- 📱 スマホの「全体を見たい」：マスをタップ＝「○○:○○から」を出す／長押し＝その時間で新しい受付 ---------- */
(function(){
  let tm = null, fired = false, sx = 0, sy = 0;
  const cellOf = e => e.target.closest && e.target.closest(".tlg .c[onclick]");
  const fire = c => { fired = true; const m = (c.getAttribute("onclick") || "").match(/tlCell\('([^']*)',([\d.]+)\)/); if(m){ if(navigator.vibrate) navigator.vibrate(30); tlCell(m[1], Number(m[2])); } };
  document.addEventListener("pointerdown", e => {
    if(!IS_PHONE()) return; const c = cellOf(e); if(!c) return;
    fired = false; sx = e.clientX; sy = e.clientY; clearTimeout(tm);
    tm = setTimeout(() => fire(c), 500);
  }, true);
  // 指が少し動いただけでは、長押しをやめない（10px 以上動いたら＝スクロール）
  document.addEventListener("pointermove", e => { if(tm && Math.hypot(e.clientX - sx, e.clientY - sy) > 10){ clearTimeout(tm); tm = null; } }, true);
  ["pointerup", "pointercancel"].forEach(ev => document.addEventListener(ev, () => { clearTimeout(tm); tm = null; }, true));
  document.addEventListener("contextmenu", e => { if(IS_PHONE() && cellOf(e)) e.preventDefault(); }, true);   // 長押しのメニューを出さない
  document.addEventListener("click", e => {
    if(!IS_PHONE()) return; const c = cellOf(e); if(!c) return;
    e.stopPropagation(); e.preventDefault();
    if(fired){ fired = false; return; }
    document.querySelectorAll(".tlg .c.tap").forEach(x => x !== c && x.classList.remove("tap"));
    c.classList.toggle("tap");   // タップは時刻を見るだけ
  }, true);
})();
/* ---------- ⌨ パソコンの時刻：数字だけで入れられる（1240 → 12:40、930 → 09:30） ---------- */
(function(){
  if(/iPhone|iPad|Android/i.test(navigator.userAgent)) return;
  const norm = v => { const d = String(v || "").normalize("NFKC").replace(/[^\d]/g, ""); if(!d) return ""; let h, m;   // 全角の数字・コロンも（１００ → 25:00）
    if(d.length <= 2){ h = +d; m = 0; } else if(d.length === 3){ h = +d.slice(0, 1); m = +d.slice(1); } else { h = +d.slice(0, 2); m = +d.slice(2, 4); }
    if(m > 59) m = 59; if(h > 29) return String(v); return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0"); };
  const conv = root => (root || document).querySelectorAll('input[type="time"]').forEach(el => {
    const v = el.getAttribute("value") || el.value; el.type = "text"; el.value = v;   /* 27:00 は時刻の欄では消えるので、書いた値（value）から読む */ el.dataset.tm = "1"; el.placeholder = "--:--"; el.title = "数字だけで入れられます（1240 → 12:40）"; el.style.textAlign = "center"; el.inputMode = "numeric"; el.autocomplete = "off";
    if(!el.style.width) el.style.width = "84px"; });
  conv();
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if(n.nodeType === 1){ if(n.matches && n.matches('input[type="time"]')) conv(n.parentNode); else if(n.querySelector && n.querySelector('input[type="time"]')) conv(n); } }))).observe(document.body, { childList: true, subtree: true });
  // 決めたとき（Enter・外に出たとき）に「12:40」の形にしてから、もとの処理へ
  // 予約の開始時刻・状態の時刻は、朝6時より前を 24時より後の書き方に（000 → 24:00、300 → 27:00）2026/11/4
  const lateOk = el => el.id === "f_start" || el.classList.contains("rc-time") || !!(el.closest && el.closest(".statchip"));
  const toLate = s => { const m = /^(\d{2}):(\d{2})$/.exec(s); if(!m) return s; const h = Number(m[1]); return h < 6 ? String(h + 24) + ":" + m[2] : s; };
  document.addEventListener("change", e => { const el = e.target; if(el && el.dataset && el.dataset.tm){ let n = norm(el.value); if(lateOk(el)) n = toLate(n); if(n !== el.value){ el.value = n; el.dispatchEvent(new Event("input", { bubbles: true })); } } }, true);
  document.addEventListener("keydown", e => { const el = e.target; if(e.key === "Enter" && el && el.dataset && el.dataset.tm){ e.preventDefault(); el.blur(); } }, true);
})();
document.head.insertAdjacentHTML("beforeend", `<style>
  @media (max-width:700px){ .tlg .c{-webkit-touch-callout:none;user-select:none;-webkit-user-select:none} }
  .tlg .c.tap::after{content:attr(data-t) " から";position:absolute;top:3px;left:3px;font-size:11.5px;font-weight:800;color:#fff;background:#e5638c;border-radius:6px;padding:2px 6px;z-index:8;white-space:nowrap}
  @media (max-width:700px){ .stickybar .tabs#tabs{display:none !important} .tlg .c:hover::after{display:none} .tlg .c.tap::after{display:block} }
</style>`);
/* ---------- 📅 受付の日付が変わったら（どの方法で変えても）、キャストの一覧・18極門の一覧をその日のシフトで出しなおす ---------- */
let lastFDay = "";
{ const __recalcDay = recalc; recalc = function(){ const r = __recalcDay.apply(this, arguments);
    const v = ($("f_day") && $("f_day").value) || "";
    if($("formBg").classList.contains("show") && v !== lastFDay){ lastFDay = v; fillCastSel(); if(isDummyStore($("f_store").value)) renderDummy(); }
    if(typeof dmAutoPick === "function" && $("formBg").classList.contains("show")) try{ dmAutoPick(); }catch(e){}
    return r; }; }
{ const __ofDay = openForm; openForm = function(){ lastFDay = ""; return __ofDay.apply(this, arguments); }; }
// ↓ 2026/11/10 ファイルを分けたとき、下で包みなおすので、ここに動かした（もとは 10/25 の所）
function loadOtherDay(bd){
  if(otherDayLoading[bd]) return;
  otherDayLoading[bd] = true;
  Promise.all([sb.from("kb_reservations").select("*").eq("biz_date", bd).eq("deleted", false).order("start_at"), loadShifts(bd)])
    .then(([res, sh])=>{ otherDay[bd] = { rows: q(res) || [], sh: sh || {} }; })
    .catch(()=>{ otherDay[bd] = { rows: [], sh: {}, err: true }; })
    .finally(()=>{ otherDayLoading[bd] = false; renderNeighbors(); drawTimeline(); if($("f_day") && $("f_day").value === bd) fillCastSel(); });
}
function setDmMode(m){
  dmMode = m;
  document.querySelectorAll("#dmModeChips .chip").forEach(b => b.classList.toggle("on", b.dataset.m === m));
  $("namedBox").style.display = m === "named" ? "" : "none";
  $("timeBox").style.display = m === "time" || m === "cast" ? "" : "none";
  $("dummyRow").style.display = m === "dummy" ? "" : "none";
  if(m === "dummy" && $("f_dummy").value && ownersOf($("f_store").value, $("f_dummy").value).length){ $("f_dummy").value = ""; }   // 専用の名前はダミー在籍指名では使わない
  if(m === "time" || m === "cast"){ $("f_tStart").value = $("f_start").value; $("f_cast").disabled = false; recalc(); tmPaint(); if(m === "time") return; }
  if(m === "named"){
    const store = $("f_store").value, list = namedCasts(store), cur = $("f_cast").value;
    $("f_named").innerHTML = `<option value="">（本物を選ぶ）</option>` + list.map(c => `<option value="${c.id}">⭐ ${esc(c.stores[store].name)}　／　サクラムーン：${esc((c.stores.sakuramoon && c.stores.sakuramoon.name) || c.official_name || c.temp_name)}</option>`).join("");
    if(list.some(c => c.id === cur)) $("f_named").value = cur;
    else if(cur && editing && editing.cast_id === cur) $("f_namedEx").checked = true;   // 前に特例でほかの子にした予約
    if($("f_dummy").value){ $("f_dummy").value = ""; }
    onNamedPick(true);
  } else { $("f_cast").disabled = false; }
  recalc(); renderDummyMatch();
}
{ const __lodDay = loadOtherDay; loadOtherDay = function(bd){ const r = __lodDay.apply(this, arguments); return r; }; }

/* ---------- 🚫 18・極門：台帳の履歴と合わない「ダミー名×キャスト」は、選んだ時点で止める（窓で知らせて、もとにもどす） ---------- */
function dmConflict(cid, name, store){
  if(!cid || !name || !isDummyStore(store) || (!Array.isArray(custSeen) && !Array.isArray(custPast))) return "";
  if(ownersOf(store, name).some(o => o.id === cid)) return "";   // 専用の名前は、その子なら OK
  const seen = seenNorm().filter(p => p.cast_id && p.dummy_name && isDummyStore(p.store_key) && !["cancel", "tobi", "flowed"].includes(p.status) && !(editing && p.id === editing.id));
  const fmt = d => String(d || "").replace(/^\d\d(\d\d)-(\d\d)-(\d\d)$/, "$1/$2/$3") || "日付なし";
  const byName = seen.filter(p => p.store_key === store && p.dummy_name === name), ids = [...new Set(byName.map(p => p.cast_id))];
  if(ids.length && !ids.includes(cid)) return `このお客さんは前に「${name}」で ${ids.map(castName).join("・")} が行っています（${fmt(byName[0].biz_date)}）。\n${castName(cid)} を「${name}」で行かせることはできません。`;
  const mine = seen.filter(p => p.cast_id === cid && !(p.store_key === store && p.dummy_name === name));
  if(mine.length) return `${castName(cid)} は、このお客さんに前に「${mine[0].dummy_name}」（${storeLabel(mine[0].store_key)}・${fmt(mine[0].biz_date)}）で行っています。\n「${name}」では行けません（お客さんにばれます）。`;
  return "";
}
let dmPrev = { cast: "", dummy: "" };
document.addEventListener("focusin", e => { if(e.target && (e.target.id === "f_cast" || e.target.id === "f_dummy")) dmPrev = { cast: $("f_cast").value, dummy: $("f_dummy").value }; }, true);
document.addEventListener("change", e => {
  const id = e.target && e.target.id; if(id !== "f_cast" && id !== "f_dummy") return;
  const store = $("f_store").value; if(!isDummyStore(store) || dmMode === "named") return;
  // ダミー名を選んで、前にその名前で行った子がいるときは、キャストは自動でその子になる（下の一覧で）。ここではキャストを手で変えたときと、ダミー名×今のキャストを見る
  const name = $("f_dummy").value, cid = $("f_cast").value;
  if(id === "f_dummy"){
    const hist = seenNorm().filter(p => p.store_key === store && p.dummy_name === name && p.cast_id && !["cancel", "tobi", "flowed"].includes(p.status));
    if(hist.length) return;   // 前にこの名前で行った子がいる → その子に自動で切りかわる
  }
  const msg = dmConflict(cid, name, store);
  if(!msg) return;
  e.stopImmediatePropagation();
  alert("🚫 この組み合わせはダメです\n\n" + msg);
  if(id === "f_cast") $("f_cast").value = dmPrev.cast; else $("f_dummy").value = dmPrev.dummy;
  try{ onCast(); recalc(); renderDummyMatch(); }catch(err){}
}, true);
/* ---------- 🎭 ダミー在籍指名のときは、キャスト専用の名前（美沙など）をダミー名の一覧に出さない（どこから入っても消す） ---------- */
function dmCleanSelect(){
  const store = $("f_store").value; if(!isDummyStore(store) || dmMode === "named") return;
  const sel = $("f_dummy"), own = new Set(namedCasts(store).map(c => c.stores[store].name));
  if(editing && editing.dummy_name && editing.store_key === store) own.delete(editing.dummy_name);   // 保存してある予約の名前はそのまま
  [...sel.options].forEach(o => { if(o.value && own.has(o.value)){ if(sel.value === o.value) sel.value = ""; o.remove(); } });
}
{ const __rdClean = renderDummy; renderDummy = function(){ const r = __rdClean.apply(this, arguments); dmCleanSelect(); return r; }; }
{ const __smClean = setDmMode; setDmMode = function(m){ const r = __smClean.apply(this, arguments); if(m !== "named") dmCleanSelect(); return r; }; }
document.addEventListener("focusin", e => { if(e.target && e.target.id === "f_dummy") dmCleanSelect(); }, true);
document.addEventListener("pointerdown", e => { if(e.target && e.target.id === "f_dummy") dmCleanSelect(); }, true);

/* ---------- 💗 本指名：前回その子を指名したのはいつか（記録簿＋台帳エクセル）。種別のボタンの横と、予約連絡の【名前】の行に ---------- */
function lastNomiOf(cid){
  if(!cid || (!Array.isArray(custSeen) && !Array.isArray(custPast))) return "";
  const l = seenNorm().filter(p => p.cast_id === cid && !["cancel", "tobi", "flowed"].includes(p.status) && !(editing && p.id === editing.id) && p.biz_date && p.biz_date < (($("f_day") && $("f_day").value) || day))
    .map(p => p.biz_date).sort();
  const d = l.pop(); return d ? d.replace(/^(\d{4})-(\d\d)-(\d\d)$/, (m, y, mo, da) => `${y}/${Number(mo)}/${Number(da)}`) : "";
}
function lastNomiPaint(){
  let el = $("lastNomi");
  if(!el){ el = document.createElement("span"); el.id = "lastNomi"; el.style.cssText = "font-size:13px;font-weight:800;color:#b0306a;margin-left:8px;align-self:center"; $("f_visit").appendChild(el); }
  const d = visit === "honshi" ? lastNomiOf($("f_cast").value) : "";
  el.textContent = d ? `💗 前回 ${d}` : "";
}
{ const __rcNomi = recalc; recalc = function(){ const r = __rcNomi.apply(this, arguments);
    try{ lastNomiPaint(); const d = visit === "honshi" ? lastNomiOf($("f_cast").value) : "";
      if(d) $("msg").value = $("msg").value.replace(/^(【名前】[^\n]*本指名)(?!（前回)/m, `$1（前回 ${d}）`); }catch(e){}
    return r; }; }
/* ---------- ⏸ 一時保存（編集中）：受付の外を押す・「⏸ 一時保存」で、入れたところまでとっておく → 右下の点滅ボタンで続きから ---------- */
const DRAFT_KEY = "kbResDraft";        // 前の形（1つだけ）。読んだら新しい形に移す
const DRAFTS_KEY = "kbResDrafts";      // ⏸ 一時保存のストック（いくつでも。新しい順・10こまで）2026/11/11 店長
const DRAFT_MAX = 10;
let draftCur = null;                   // いま続きを書いている一時保存の id（同じものに上書きする）
function draftList(){
  let a = [];
  try{ a = JSON.parse(localStorage.getItem(DRAFTS_KEY) || "[]"); if(!Array.isArray(a)) a = []; }catch(e){ a = []; }
  try{ const old = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); if(old){ old.key = old.key || ("d" + Date.now()); a.unshift(old); localStorage.removeItem(DRAFT_KEY); localStorage.setItem(DRAFTS_KEY, JSON.stringify(a.slice(0, DRAFT_MAX))); } }catch(e){}
  return a;
}
function draftPut(a){ try{ localStorage.setItem(DRAFTS_KEY, JSON.stringify(a.slice(0, DRAFT_MAX))); }catch(e){} }
function draftGet(){ return draftList()[0] || null; }   // 前の形の呼び方（いちばん新しいもの）
function draftSave(close){
  if(!KB.CAN_EDIT || !$("formBg").classList.contains("show")) return;
  // 開いただけで何も変えていないときは、一時保存しない（閉じるだけ）2026/11/4
  if(!formDirty){ if(close) closeForm(); return; }
  const vals = {}, radios = {};
  document.querySelectorAll("#formBg input[id], #formBg select[id], #formBg textarea[id]").forEach(el => {
    if(["msg", "netReply"].includes(el.id) || el.type === "file") return;
    vals[el.id] = el.type === "checkbox" ? el.checked : el.value;
  });
  document.querySelectorAll("#formBg input[type=radio][name]:checked").forEach(el => { radios[el.name] = el.value; });
  const id = editing ? editing.id : null;
  // 同じ一時保存（続きから開いたもの）・同じ予約の一時保存があれば上書き。なければ新しく足す（いちばん上に）
  const a = draftList(), key = draftCur || (id != null && (a.find(x => x.id === id) || {}).key) || ("d" + Date.now() + Math.random().toString(36).slice(2, 6));
  const d = { key, id, day, at: new Date().toISOString(), by: KB.operatorName(), vals, radios,
    st: { visit, mediaSel, free: $("f_free").value, wig: typeof wigSel !== "undefined" ? wigSel : "", under: typeof underSel !== "undefined" ? underSel : "", party: JSON.parse(JSON.stringify(party)), biz: typeof bizState !== "undefined" ? JSON.parse(JSON.stringify(bizState)) : null },
    label: [$("f_start").value, $("f_cast").value ? castName($("f_cast").value) : "", $("f_name").value].filter(Boolean).join(" ") || "（まだ何も入っていない）" };
  draftCur = key;
  draftPut([d].concat(a.filter(x => x.key !== key)));
  if(close){ closeForm(); toast("⏸ 編集中として一時保存しました（右下から続きを開けます）"); }
  draftPaint();
}
async function draftResume(key){
  const a = draftList(), d = key ? a.find(x => x.key === key) : a[0]; if(!d) return;
  if(d.day && d.day !== day && $("day")){ $("day").value = d.day; await loadDay(); }
  openForm(d.id);
  draftCur = d.key;   // openForm のあとに（openForm で空になるので）
  const v = d.vals || {}, set = id => { const el = $(id); if(!el || !(id in v)) return; if(el.type === "checkbox") el.checked = !!v[id]; else el.value = v[id]; };
  set("f_store"); onStore(); set("f_cast"); onCast();
  Object.keys(v).forEach(id => { const m = /^f_xop_label_(\d+)$/.exec(id); if(m) addXop(Number(m[1])); });   // ＋で足したほかのOPの欄も
  Object.keys(v).forEach(id => { if(!["f_store", "f_cast"].includes(id)) set(id); });
  Object.entries(d.radios || {}).forEach(([n, val]) => setRadio(n, val));
  const s = d.st || {};
  if(s.visit) setVisit(s.visit);
  mediaSel = s.mediaSel || []; document.querySelectorAll("#f_media .chip").forEach((b, i) => b.classList.toggle("on", mediaSel.includes(M.media[i].code)));
  if("free" in s){ $("f_free").value = s.free; renderNomiChips(); }
  if(typeof wigSel !== "undefined"){ wigSel = s.wig || ""; underSel = s.under || ""; paintWig(); }
  if(s.party){ party = s.party; paintParty(); }
  if(s.biz && typeof bizState !== "undefined") bizState = Object.assign({ twin: "", pickup: "", towel: "" }, s.biz);
  checkNewHotel();   // ビジホの確認の欄・ホテルの候補も出しなおす
  if(v.f_phone && digits(v.f_phone).length >= 6) lookupCustomer(true);
  recalc(); draftPaint(); formDirty = true;   // 続きから開いたものは、閉じるとまた一時保存する
  toast("✏️ 一時保存したところから続けます");
}
function draftDrop(key){
  const a = draftList(), d = a.find(x => x.key === key) || a[0]; if(!d) return;
  if(!confirm(`一時保存した受付「${d.label}」を消しますか？`)) return;
  draftPut(a.filter(x => x.key !== d.key)); if(draftCur === d.key) draftCur = null; draftPaint();
}
function draftDropAll(){ const a = draftList(); if(!a.length || !confirm(`一時保存した受付 ${a.length}こを、全部消しますか？`)) return; draftPut([]); draftCur = null; draftOpenList = false; draftPaint(); }
// 登録できたら、その一時保存だけ消す（ほかのストックは残す）
function draftDone(){ if(!draftCur) return; draftPut(draftList().filter(x => x.key !== draftCur)); draftCur = null; draftPaint(); }
let draftOpenList = false;
function draftPaint(){
  let el = $("draftBtn");
  const a = draftList(), open = $("formBg").classList.contains("show");
  if(!a.length || open){ if(el) el.remove(); return; }
  if(!el){ el = document.createElement("div"); el.id = "draftBtn"; document.body.appendChild(el); }
  // 一覧の1つずつに「🗑 消す」、一覧のいちばん下に「🗑 全部消す」（2026/11/11 店長）
  const item = d => `<div class="dr-row"><button type="button" class="dr-go" onclick="draftResume('${d.key}')">✏️ ${esc(d.label)}<small>（${d.day && d.day !== day ? esc(d.day.slice(5).replace("-", "/")) + "の受付・" : ""}${KBF.staffTag(d.by)} ${whenShort(d.at)}・押すと続きから）</small></button><button type="button" class="dr-x" onclick="draftDrop('${d.key}')" title="この一時保存を消す">🗑 消す</button></div>`;
  el.innerHTML = a.length === 1 ? item(a[0])
    : `<div class="dr-head"><button type="button" class="dr-go" onclick="draftOpenList=!draftOpenList;draftPaint()">⏸ 一時保存の受付が <b>${a.length}こ</b> あります<small>（${draftOpenList ? "押すとしまう" : "押すと一覧"}）</small></button></div>${draftOpenList ? `<div class="dr-list">${a.map(item).join("")}<div class="dr-row" style="justify-content:flex-end"><button type="button" class="dr-x" onclick="draftDropAll()">🗑 全部消す</button></div></div>` : ""}`;
}
// 受付の外を押したときの一時保存は、上の KB.closeOnBackdrop で（閉じる前に保存する）
// 別のタブ・アプリに移ったとき・ページを閉じるときも、入力中なら一時保存しておく（閉じない）
document.addEventListener("visibilitychange", () => { if(document.visibilityState === "hidden") draftSave(false); });
window.addEventListener("pagehide", () => draftSave(false));
{ const __closeFormD = closeForm; closeForm = function(){ const r = __closeFormD.apply(this, arguments); setTimeout(draftPaint, 0); return r; }; }
{ const __openFormD = openForm; openForm = function(){ formDirty = false; draftCur = null; const r = __openFormD.apply(this, arguments); draftPaint(); return r; }; }
// 受付の中で何か入れた・選んだ・押した → 「変えた」とする（開いたときに自動で入る値は数えない）
var formDirty = false;
["input", "change"].forEach(ev => $("formBg").addEventListener(ev, e => { if(e.isTrusted) formDirty = true; }, true));
$("formBg").addEventListener("click", e => { if(e.isTrusted && e.target.closest && e.target.closest("#formBg .drawer button:not(.x), #formBg .drawer .chip, #formBg .drawer .ynp")) formDirty = true; }, true);
document.head.insertAdjacentHTML("beforeend", `<style>
  #draftBtn{position:fixed;right:14px;bottom:70px;z-index:960;display:flex;flex-direction:column;gap:4px;align-items:flex-end;max-height:70vh;overflow:auto}
  #draftBtn .dr-row{display:flex;gap:4px;align-items:stretch} #draftBtn .dr-list{display:flex;flex-direction:column;gap:4px}
  body:has(#draftBtn) #toTopBtn{bottom:136px}   /* 一時保存の札があるときは、⬆（上に戻る）をその上へ（かぶらないように）2026/11/7 */
  #draftBtn .dr-go{font-family:inherit;font-size:14px;font-weight:800;border:2.5px solid #E5486C;background:#FFE8EC;color:#B0213F;border-radius:14px;padding:8px 14px;cursor:pointer;text-align:left;display:flex;flex-direction:column;animation:blinkwarn 1.1s ease-in-out infinite;box-shadow:0 4px 14px rgba(0,0,0,.18)}
  #draftBtn .dr-go small{font-size:11px;font-weight:700;opacity:.8}
  #draftBtn .dr-x{font-family:inherit;border:1.5px solid #ddd;background:#fff;border-radius:10px;padding:0 10px;cursor:pointer;color:#999}
  @keyframes draftblink{0%,100%{box-shadow:0 0 0 0 rgba(242,169,0,.0)}50%{box-shadow:0 0 0 6px rgba(242,169,0,.45)}}
</style>`);
setTimeout(draftPaint, 1500);

/* ---------- 受付の指名キャスト：その日の出勤のキャストだけ（出勤が早い順）。「シフトにない人も出す」で全員 ---------- */
function fillCastSel(){
  const sel = $("f_cast"); if(!sel) return;
  const cur = sel.value || (editing && editing.cast_id) || "";
  // 受付の日付を変えたときは、その日のシフトで（まだ読んでいなければ読んでから、もう一度）
  const bd = ($("f_day") && $("f_day").value) || day;
  let sh = shiftCache[day] || {};
  if(bd !== day){ if(typeof otherDay !== "undefined" && otherDay[bd]) sh = otherDay[bd].sh || {}; else { sh = {}; if(typeof loadOtherDay === "function") loadOtherDay(bd); } }
  const dayLbl = bd === day ? "今日" : Number(bd.slice(5, 7)) + "/" + Number(bd.slice(8));
  // 🚫 その日に欠勤・精算ずみの子は出さない（選んである子はそのまま）2026/11/12 店長
  const castOff = id => { if(bd !== day || id === cur) return false; const cd = (typeof castDays !== "undefined" && castDays[id]) || {}; return cd.status === "欠勤" || !!cd.settled; };
  const onShift = M.casts.filter(c => !castOff(c.id)).map(c=>{ const nm = Object.keys(sh).find(n=>n === c.shift_name || n === c.official_name); return nm ? { c, s: sh[nm] } : null; })
    .filter(Boolean).sort((a, b)=>a.s.start - b.s.start);
  const ids = new Set(onShift.map(x=>x.c.id));
  let h = `<option value="">（キャストを選ぶ）</option>`;
  h += onShift.length ? `<optgroup label="${dayLbl}の出勤">${onShift.map(x=>`<option value="${x.c.id}">${esc(x.c.official_name || x.c.temp_name)}　${tlLabel(x.s.start)}〜${tlLabel(x.s.end)}${x.s.confirmed ? "" : "（未確定）"}</option>`).join("")}</optgroup>`
                      : `<optgroup label="この日のシフトがありません"></optgroup>`;
  const others = M.casts.filter(c=>!ids.has(c.id) && (c.id === cur || ($("f_castAll") && $("f_castAll").checked && c.status !== "left" && !castOff(c.id))));
  if(others.length) h += `<optgroup label="シフトにない人">${others.map(c=>`<option value="${c.id}">${esc(c.official_name || c.temp_name)}</option>`).join("")}</optgroup>`;
  sel.innerHTML = h; sel.value = cur;
}
const __openFormC = openForm;
openForm = function(id){
  if($("f_castAll")) $("f_castAll").checked = false;
  __openFormC(id);
  fillCastSel();
};

/* ---------- 📝 勤怠の取り消し（「やっぱりやめた！」）：その記録を消して、欠勤・出勤時間の変更も元にもどす ---------- */
// 記録から、変えた出勤・退勤の時刻を読む（前の記録は文字から）
function attendShift(a){
  const pick = (v, re)=>{ if(v != null) return Number(v); const m = String(a.time || "").match(re); return m ? toHour(m[1]) : null; };
  return { st: pick(a.st, /出勤→(\d{1,2}:\d{2})/), en: pick(a.en, /退勤→(\d{1,2}:\d{2})/) };
}
attendHtml = function(cid){
  const log = ((castDays[cid] || {}).attend_log) || [];
  if(!log.length) return "";
  return `<div class="attend">${log.map((a, i)=>`<span class="ak ${a.kind === "欠勤" ? "absent" : ""}">📝 <b>${esc(a.kind)}</b>${a.time ? "（" + esc(a.time) + "）" : ""}：${esc(a.reason || "理由なし")}<small> ${KBF.staffTag(a.by)} ${whenShort(a.at)}</small>
    ${KB.CAN_EDIT ? `<button type="button" class="undo" onclick="event.stopPropagation();undoAttend('${cid}',${i})">✖ 取り消し</button>` : ""}</span>`).join("")}</div>`;
};
{ const __attendInfo = attendHtml; attendHtml = function(cid){ return infoNoteHtml(cid) + __attendInfo(cid); }; }   // 📌 今日のことを、勤怠の上に
async function undoAttend(cid, i){
  const cd = castDays[cid] || {}, log = (cd.attend_log || []).slice(), a = log[i];
  if(!a) return;
  if(!confirm(`「${a.kind}」の記録を取り消しますか？` + (a.kind === "欠勤" ? "\n（欠勤ではなくなり、今どこに誰がの「今いない（不在）」にもどります）" : "\n（変えた出勤・退勤の時刻も元にもどします）"))) return;
  log.splice(i, 1);
  const patch = { attend_log: log };
  if(a.kind === "欠勤" && !log.some(x=>x.kind === "欠勤") && cd.status === "欠勤") patch.status = "";
  // 出勤・退勤の時刻：残っている記録のうち、いちばん新しいものにもどす（なければシフトの時間）
  const sh = attendShift(a);
  if(sh.st != null || sh.en != null){
    let st = null, en = null;
    log.forEach(x=>{ const s = attendShift(x); if(s.st != null) st = s.st; if(s.en != null) en = s.en; });
    if(sh.st != null) patch.shift_start_ov = st;
    if(sh.en != null) patch.shift_end_ov = en;
  }
  if(await saveDayPart(cid, patch)){
    toast("取り消しました");
    // サクラシフトも元にもどす（欠勤の取り消し → 元のシフト／時間の取り消し → 残っている記録の時間か、元のシフト）
    const cdn = castDays[cid] || {};
    if(a.kind === "欠勤" && !log.some(x => x.kind === "欠勤")) pushShiftChange(cid, "time", cdn.shift_start_ov != null ? Number(cdn.shift_start_ov) : null, cdn.shift_end_ov != null ? Number(cdn.shift_end_ov) : null);
    else if(sh.st != null || sh.en != null) pushShiftChange(cid, "time", cdn.shift_start_ov != null ? Number(cdn.shift_start_ov) : null, cdn.shift_end_ov != null ? Number(cdn.shift_end_ov) : null);
  }
}

// 今いないの札で「欠勤」の窓が出たけど、やっぱり欠勤にしない → ⬜不在 にもどす
async function skipAbsent(){
  const cid = attendCid; if(!cid) return;
  if(await saveDayPart(cid, { status: "" })){ $("attendBg").classList.remove("show"); toast("不在にもどしました"); }
}

// シフトを5分ごとに読みなおす（サクラシフトで受理したら、記録簿を開いたままでも出てくる）。予約の入力中は待つ
setInterval(async ()=>{
  if(!day || $("formBg").classList.contains("show")) return;
  try{ delete shiftCache[day]; await loadShifts(day); renderList(); }catch(e){}
}, 300000);

// 🔄 シフトを今すぐ読みなおす（サクラシフトで受理した直後など）
async function reloadShifts(){
  const b = $("shiftReloadBtn"); if(b){ b.disabled = true; b.textContent = "🔄 読みこみ中…"; }
  try{ delete shiftCache[day]; await loadShifts(day); renderList(); toast("シフトを読みなおしました"); }
  catch(e){ toast("読みこめませんでした：" + (e.message || e)); }
  finally{ if(b){ b.disabled = false; b.textContent = "🔄 シフトを読みなおす"; } }
}

// 勤怠の小窓も、外を押したら閉じる（ほかの小窓と同じ）
KB.closeOnBackdrop($("attendBg"), ()=>$("attendBg").classList.remove("show"));

