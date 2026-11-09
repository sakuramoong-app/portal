/* ============================================================
   📒 記録簿（kiroku.html）の 4/7：空き枠・予約一覧・対応ログ・希望プレイで絞る
   ※ kiroku.html の <script src> の順番どおりに読む（順番を変えると動かなくなる。2026/11/10 1つのファイルから分けた）
   ============================================================ */
/* ============================================================
   🕐 空き枠（ホットペッパーのような一覧）
   ・指名なし：30分ごとの開始時刻と、その時刻から行けるキャスト（押すとその人・その時刻で予約）
   ・キャスト指名：選んだキャスト（複数OK）ごとに、空いている開始時刻をボタンで
   ・行けるかどうかは、タイムラインと同じ（出勤時間・予約・予約の間・お茶／欠勤／精算済）
   ============================================================ */

let slotSel = new Set();
function canGo(x, t, mins){
  if(!x.shift || !x.c) return false;
  if(x.cd && (["お茶", "欠勤", "精算済"].includes(x.cd.status) || x.cd.settled)) return false;
  const e = t + mins / 60, g = gapOf(x);
  return t >= x.shift.start - 0.01 && e <= x.shift.end + 0.01 && !x.bks.some(b=>b.s - g < e && t < b.e + g);
}
function slotTimes(){
  // 「何時から」を入れたらその時刻から。入れていなければ、今日は今より後（30分きざみ）、ほかの日は11時から。最後は翌6時半まで
  let from = TL_FROM;
  const want = tlHour($("sl_time").value);
  if(want != null) from = Math.max(TL_FROM, want);
  else if(day === KB.bizDateOf()){
    const n = nowHour();
    if(n > TL_FROM && n < TL_TO) from = Math.ceil(n * 2) / 2;   // 朝（営業時間の前）は11時から
  }
  const out = []; for(let t = from; t <= TL_TO - 0.5 + 1e-6; t += 0.5) out.push(t);
  return out;
}
function setSlotMode(m){ slotMode = m; renderSlots(); }
function toggleSlotSel(k){ if(slotSel.has(k)) slotSel.delete(k); else slotSel.add(k); renderSlots(); }
function slotBook(castId, t){
  if(!KB.CAN_EDIT) return;
  const hh = Math.floor(t) % 24, mm = Math.round((t - Math.floor(t)) * 60);
  newBookingFor(castId, String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0"));
  // コースの分数も合わせる（同じ分数のコースがあれば）
  const mins = String(Number($("sl_min").value) || 90);
  if([...$("f_course").options].some(o=>o.value === mins)){ $("f_course").value = mins; recalc(); }
}
function renderSlots(){
  const el = $("slotList"); if(!el || !M.casts) return;
  if(!shiftCache[day]){ el.innerHTML = `<div class="gate">シフトを読み込み中…</div>`; return; }
  const mins = Number($("sl_min").value) || 90;
  const casts = sortRows(tlRows()).filter(x=>x.c && x.shift);
  // キャストを選んでいれば「その人の空き時間」、選んでいなければ「時刻ごとに行ける人」
  slotMode = slotSel.size ? "cast" : "free";
  if($("slotTitle")) $("slotTitle").textContent = slotMode === "cast" ? "🙋 選んだキャストの空いている時間" : "🙋 誰が行ける？：時刻ごとに行ける人";
  $("slotPickChips").innerHTML = casts.map(x=>`<button type="button" class="chip ${slotSel.has(x.c.id) ? "on" : ""}" onclick="toggleSlotSel('${x.c.id}')">${esc(castLabel(x))}</button>`).join("") || `<span class="hist">この日のシフトがありません</span>`;
  const times = slotTimes();
  if(!casts.length){ el.innerHTML = `<div class="gate">この日のシフトがありません</div>`; return; }
  if(slotMode === "free"){
    // 指名なし：時刻ごとに行ける人
    const rowsHtml = times.map(t=>{
      const ok = casts.filter(x=>canGo(x, t, mins));
      return `<div class="slot ${ok.length ? "" : "none"}">
        <div class="tm">${tlLabel(t)}<small>〜${tlLabel(t + mins / 60)}</small></div>
        <div class="mk">${ok.length ? (ok.length >= 3 ? "◎" : "○") : "×"}<small>${ok.length}人</small></div>
        <div class="who">${ok.length ? ok.map(x=>`<button class="pick" onclick="slotBook('${x.c.id}',${t})">${esc(castLabel(x))}${x.cd && x.cd.standby ? `<small>${esc(x.cd.standby)}</small>` : ""}</button>`).join("") : `<span class="hist" style="margin:0">行ける人はいません</span>`}</div>
      </div>`;
    }).join("");
    el.innerHTML = `<div class="slothead">${mins}分コースで、開始時刻ごとに行けるキャスト（名前を押すと、その人・その時刻で予約）</div>` + rowsHtml;
  } else {
    // キャスト指名：選んだ人の空いている開始時刻
    const list = slotSel.size ? casts.filter(x=>slotSel.has(x.c.id)) : [];
    el.innerHTML = list.length ? list.map(x=>{
      const ok = times.filter(t=>canGo(x, t, mins));
      return `<div class="slotcast">
        <div class="nm">${esc(castLabel(x))}<small>出勤 ${tlLabel(x.shift.start)}〜${tlLabel(x.shift.end)}${x.cd && x.cd.standby ? "・" + esc(x.cd.standby) : ""}${gapOf(x) ? "・予約の間" + x.c.interval_min + "分" : ""}</small></div>
        <div class="times">${ok.length ? ok.map(t=>`<button class="pick" onclick="slotBook('${x.c.id}',${t})">${tlLabel(t)}</button>`).join("") : `<span class="hist" style="margin:0">${mins}分で空いている時間はありません</span>`}</div>
      </div>`;
    }).join("") : `<div class="gate">上のボタンでキャストを選んでください（複数OK）</div>`;
  }
}
const __renderTL3 = renderTL;
renderTL = function(){ __renderTL3(); renderSlots(); };

/* ============================================================
   📋 予約一覧（作り直し）＋ 対応ログ
   ・店舗は最初の3文字、総額・報酬は出さない、電話番号を出す（こちらから電話するとき見るので）
   ・状態はその場で変える（色つき）。キャストに伝えたかは、ボタンで切りかえ（だれ・いつが残る）
   ・対応ログ：だれが・いつ・どんな対応をしたかを、予約ごとに時系列で（エクセルの備考欄の日付サインのかわり）
     状態を変えた・キャストに伝えた、も自動でログに入る
   ============================================================ */
function statusKeys(cur){ return Object.keys(STATUS).filter(k=>!STATUS_OLD.includes(k) || k === cur); }
function whenShort(t){ if(!t) return ""; const d = new Date(t); return (d.getMonth() + 1) + "/" + d.getDate() + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
function logOf(r){ return Array.isArray(r.memo_log) ? r.memo_log : []; }
// 備考（対応ログ）に状態の経緯：登録したとき「🔁 登録時の状態：○○」、受付の画面で変えたとき「🔁 状態 ○○ →「△△」」
function statusLog(r, newSt, by){
  const prev = r ? r.status : "";
  if(!newSt || prev === newSt) return null;
  const text = r ? `🔁 状態 ${STATUS[prev] || prev || "（なし）"} →「${STATUS[newSt] || newSt}」` : `🔁 登録時の状態：「${STATUS[newSt] || newSt}」`;
  return logOf(r || {}).concat([{ at: new Date().toISOString(), by: by || "（担当者なし）", text }]);
}
async function pushLog(id, text, extra){
  const r = rows.find(x=>x.id === id); if(!r) return false;
  const log = logOf(r).concat([{ at: new Date().toISOString(), by: KB.operatorName() || "（担当者なし）", text }]);
  try{
    q(await sb.from("kb_reservations").update(Object.assign({ memo_log: log, updated_by: KB.operatorName() }, extra || {})).eq("id", id));
    Object.assign(r, extra || {}, { memo_log: log, updated_by: KB.operatorName(), updated_at: new Date().toISOString() });
    return true;
  }catch(e){ toast("保存できませんでした：" + (e.message || e)); return false; }
}
// 一覧から状態を変える（ログにも残す）
quickStatus = async function(id, st){
  if(!KB.CAN_EDIT) return;
  if(await pushLog(id, "状態 →「" + STATUS[st] + "」", Object.assign({ status: st }, (rows.find(x => x.id === id) || {}).status_at ? { status_at: null } : {}))){ toast("状態を「" + STATUS[st] + "」にしました"); renderList(); if(editing && editing.id === id) renderFormLog(); }
};
// キャストに伝えた（切りかえ・ログにも残す）
async function toggleNotified(id){
  if(!KB.CAN_EDIT) return;
  const r = rows.find(x=>x.id === id); if(!r) return;
  if(r.cast_notified_at){
    if(!confirm("「キャストに伝えた」を取り消しますか？")) return;
    if(await pushLog(id, "キャストに伝えた を取り消し", { cast_notified_at: null, cast_notified_by: "" })) renderList();
  } else {
    if(await pushLog(id, "キャストに伝えた", { cast_notified_at: new Date().toISOString(), cast_notified_by: KB.operatorName() })){ toast("✅ キャストに伝えた、にしました"); renderList(); }
  }
}
async function addLogPrompt(id){
  if(!KB.CAN_EDIT) return;
  const t = prompt("備考に書くこと（例：お客様に折り返し済み／キャストに場所変更を連絡）");
  if(!t || !t.trim()) return;
  if(await pushLog(id, t.trim())){ toast("ログに書きました"); renderList(); if(editing && editing.id === id) renderFormLog(); }
}
function renderListTable(){
  const el = $("list"); if(!el) return;
  el.innerHTML = rows.length ? `<tr><th>時間</th><th>キャスト</th><th>店舗</th><th>コース</th><th>お客さん・電話</th><th>状態</th><th>キャストに</th><th>対応ログ（新しい順）</th></tr>` +
    rows.map(r=>{
      const c = r.kb_customers || {};
      const stSel = KB.CAN_EDIT
        ? `<select class="stsel st ${r.status}" onclick="event.stopPropagation()" onchange="quickStatus(${r.id},this.value)">${stOpts(r)}</select>`
        : `<span class="st ${r.status}">${STATUS[r.status] || r.status}</span>`;
      const told = r.cast_notified_at
        ? `<button class="told on" onclick="event.stopPropagation();toggleNotified(${r.id})" title="押すと取り消し">✅ 伝えた<small>${esc(r.cast_notified_by || "")} ${whenShort(r.cast_notified_at)}</small></button>`
        : `<button class="told" onclick="event.stopPropagation();toggleNotified(${r.id})">⚠️ まだ<small>押すと「伝えた」</small></button>`;
      const logs = logOf(r).slice().reverse();
      const logHtml = `<div class="mlog">${logs.length
          ? logs.slice(0, 3).map(l=>`<div><b>${esc(whenShort(l.at))} ${esc(l.by || "")}</b> ${esc(l.text)}</div>`).join("") + (logs.length > 3 ? `<div class="more">ほか ${logs.length - 3}件（予約を開くと全部）</div>` : "")
          : `<div class="none">受付：${esc(r.created_by || "")} ${whenShort(r.created_at)}</div>`}
        ${KB.CAN_EDIT ? `<button class="addlog" onclick="event.stopPropagation();addLogPrompt(${r.id})">＋ 備考</button>` : ""}</div>`;
      return `<tr class="r" onclick="openForm(${r.id})">
        <td><b>${hm(r.start_at)}</b>〜${hm(r.end_at)}</td>
        <td>${r.dummy_name ? `<small style="color:#6c5896">🎭${esc(r.dummy_name)} →</small><br>` : ""}<b>${esc(castName(r.cast_id))}</b></td>
        <td>${esc(String(storeLabel(r.store_key) || "").slice(0, 3))}</td>
        <td>${esc(r.course)}${/^\d+$/.test(r.course) ? "分" : ""}${r.free_kind ? "・" + FREE_SUFFIX[r.free_kind] : ""}${r.extension_count ? " 延長" + r.extension_count : ""}${r.payment !== "cash" ? " 💳" : ""}</td>
        <td>${c.ng ? "⚠️" : ""}${esc(c.name || "")}<small style="color:var(--sub)"> ${VISIT.find(v=>v[0] === r.visit_kind)?.[1] || ""}</small>${c.phone ? `<br><span class="tel">📞 ${esc(c.phone)}</span>` : ""}</td>
        <td>${stSel}${todosHtml(r)}</td>
        <td>${told}</td>
        <td>${logHtml}</td></tr>`;
    }).join("") : `<tr><td style="text-align:center;color:var(--sub);font-weight:800;padding:24px">この日の予約はまだありません</td></tr>`;
}
const __renderList3 = renderList;
renderList = function(){ __renderList3(); renderListTable(); };

/* ---------- 📋 受付ルール：お客様のこと・描きなおし・⏳やること ---------- */
const __openFormR = openForm;
openForm = function(id){
  const r = id ? rows.find(x=>x.id === id) : null;
  guestFlags = new Set((r && r.guest_flags) || []);
  backOvFor = -1; custPast = null;   // 新しく開いたら、手で直した報酬・お客さんの履歴は読みなおす
  $("castChecks").dataset.cast = "";
  __openFormR(id);
  renderGuestChips();
  renderCastChecks(M.casts.find(c=>c.id === $("f_cast").value));
};
// コース・オプション・種別・店が変わったら、当てはまるルールを出しなおす
const __recalcR = recalc;
recalc = function(){
  const out = __recalcR.apply(this, arguments);
  const c = M.casts.find(x=>x.id === $("f_cast").value);
  if(c) renderCastChecks(c);
  return out;
};
function todosHtml(r){
  const t = r.todos || []; if(!t.length) return "";
  return `<div style="margin-top:4px">${t.map((x, i)=>`<button type="button" class="told ${x.done_at ? "on" : ""}" style="display:block;margin-top:2px;text-align:left"
      onclick="event.stopPropagation();toggleTodo(${r.id},${i})">${x.done_at ? "✅" : "⏳"} ${esc(x.text)}<small>${x.done_at ? esc(x.done_by || "") + " " + whenShort(x.done_at) : "済んだら押す✅"}</small></button>`).join("")}</div>`;
}
async function toggleTodo(id, i){
  if(!KB.CAN_EDIT){ toast("作成中のため、直せるのは店長だけです"); return; }
  const r = rows.find(x=>x.id === id); if(!r) return;
  const todos = (r.todos || []).map(x=>Object.assign({}, x));
  const x = todos[i]; if(!x) return;
  if(x.done_at){ if(!confirm("「" + x.text + "」を、まだにもどしますか？")) return; x.done_at = null; x.done_by = ""; }
  else { x.done_at = new Date().toISOString(); x.done_by = KB.operatorName(); }
  try{ q(await sb.from("kb_reservations").update({ todos, updated_by: KB.operatorName() }).eq("id", id)); r.todos = todos; renderList(); toast(x.done_at ? "やったことにしました" : "もどしました"); }
  catch(e){ toast("保存できませんでした：" + (e.message || e)); }
}

/* ---------- 📊 今日の数字（内勤用）：店落ち（暫定＋雑費・22時まで／22時から）・カード・件数・人数・お茶・欠勤 ---------- */
// 店落ち（暫定的な残額＋雑費）を [22時まで, 22時から] に分ける。rs＝その日の予約（キャンセルなども入れて渡す）、zappiOf(castId)＝その子の雑費
//   雑費は、その子のその日最初の予約の時間帯に入れる。交通費バック・プラスマイナス（雑費以外）と内勤日払いは入れない（今日の数字・前の日の売上の報告で同じ計算）2026/11/10
function dropParts(rs, zappiOf){
  const live = (rs || []).filter(r => KBM.isLive(r));
  const night = r => !!r.start_at && hourOf(r.start_at) >= 22;
  const part = [0, 0];
  [...new Set(live.map(r => r.cast_id).filter(Boolean))].forEach(id => {
    const mine = live.filter(r => r.cast_id === id).sort((a, b) => String(a.start_at || "").localeCompare(String(b.start_at || "")));
    mine.forEach(r => { part[night(r) ? 1 : 0] += (r.total || 0) - (Number(backOf(r)) || 0); });
    try{ part[mine[0] && night(mine[0]) ? 1 : 0] += zappiOf(id) || 0; }catch(e){}
  });
  return part;
}
function renderToday(){
  const el = $("todayGrid"); if(!el) return;
  const live = rows.filter(r=>r.status !== "cancel" && r.status !== "tobi" && r.status !== "flowed");
  const ids = [...new Set(live.map(r=>r.cast_id).filter(Boolean))];
  const card = live.filter(r=>r.payment !== "cash").reduce((a, r)=>a + (r.total || 0), 0);
  const st = Object.values(castDays || {}).map(c=>c.status || "");
  const t = (k, v)=>`<div class="t"><div class="k">${k}</div><div class="v">${v}</div></div>`;
  // 店落ち（暫定的な残額＋雑費）を22時まで／22時からに分ける（予約の始まりで分ける）。雑費は、その子のその日最初の予約の時間帯に入れる
  // 交通費バック・プラスマイナス（雑費以外）と内勤日払いは入れない
  const part = dropParts(rows, id => calcCast(id).zappi || 0);
  // 今日の店落ち＝暫定＋雑費 − 内勤の日払い（まだ払っていない人も。エクセルの「店落ち」と同じ）
  //   内勤さんの画面は、日払いの一覧は自分の分だけ。でも店落ちは全員分で引く（staffPay.all）2026/11/10
  const spRows = (typeof staffPay !== "undefined" && (staffPay.all || staffPay.rows)) || [];
  const staffPaid = staffPaidSum(spRows);
  el.innerHTML = t("今日の店落ち", yen(part[0] + part[1] - staffPaid) + `<div style="font-size:11.5px;font-weight:700;color:var(--sub);margin-top:2px">暫定＋雑費 ${yen(part[0] + part[1])} − 内勤の日払い${KB.IS_BOSS ? " " + yen(staffPaid) : "（全員分）"}</div>`) + t("☀️ 22時までの店落ち", yen(part[0])) + t("🌙 22時からの店落ち", yen(part[1])) + t("カード合計", yen(card)) + t("予約件数", live.length + "件")
    + t("予約のあるキャスト", ids.length + "名") + t("お茶", st.filter(s=>s === "お茶").length + "名") + t("欠勤", st.filter(s=>s === "欠勤").length + "名")
    + t("キャンセル・トビ", rows.filter(r=>r.status === "cancel").length + "件・" + rows.filter(r=>r.status === "tobi").length + "件");
  // 📋 売上の報告（社長に送る文）：ふつうは前の日の店落ち（暫定＋雑費 − 内勤の日払い）を、次の日に送る（2026/11/7 店長）
  //   2026/11/10 店長：今日（営業日）を開いたまま、前の日の報告を出してコピーできるように（日付は変えない）
  const isToday = day === KB.bizDateOf();
  salesToday = { d: day, drop: part[0] + part[1] - staffPaid };
  if(isToday) salesPrevLoad();
  paintSales();
}
// 売上の報告の文
const salesText = (d, drop) => { const dd = new Date(d + "T12:00:00Z"); return `お疲れ様です。\n${dd.getUTCMonth() + 1}月${dd.getUTCDate()}日\n売上   ${Number(drop).toLocaleString("ja-JP")}円\nお願いします<(_ _)>`; };
const mdOf = d => { const dd = new Date(d + "T12:00:00Z"); return (dd.getUTCMonth() + 1) + "/" + dd.getUTCDate(); };
let salesToday = null, salesPrev = null, salesShowToday = false, salesPrevBusy = false;
// 前の日の店落ちを、日付を変えずに読んで計算する（今日の店落ちと同じ計算：dropParts＋KBM.calcCast の雑費 − 全員分の日払い）
async function salesPrevLoad(){
  const prev = addDays(day, -1);
  if(salesPrevBusy || (salesPrev && salesPrev.d === prev && Date.now() - salesPrev.at < 60000)) return;
  salesPrevBusy = true;
  try{
    const [rs, ds] = await Promise.all([
      sb.from("kb_reservations").select("*").eq("biz_date", prev).eq("deleted", false),
      sb.from("kb_cast_days").select("*").eq("biz_date", prev),
    ]);
    const pr = q(rs) || [], pd = {}; (q(ds) || []).forEach(x => { pd[x.cast_id] = x; });
    const zappiOf = id => { try{ return KBM.calcCast({ all: pr.filter(r => r.cast_id === id), cd: pd[id] || {}, rules: KBM.rulesOn(M.rules, id, prev), day: prev }).zappi || 0; }catch(e){ return 0; } };
    const p2 = dropParts(pr, zappiOf), sp = await staffRowsOf(prev);
    salesPrev = { d: prev, drop: p2[0] + p2[1] - staffPaidSum(sp), at: Date.now() };
  }catch(e){ salesPrev = { d: prev, err: e.message || String(e), at: Date.now() }; }
  salesPrevBusy = false;
  paintSales();
}
function paintSales(){
  const el = $("todayGrid"); if(!el || !salesToday) return;
  const old = el.querySelector(".salesrep"); if(old) old.remove();
  const isToday = salesToday.d === KB.bizDateOf();
  // 今日を見ているとき：前の日の報告（読みこみ中なら待つ）。「今日の分」に切りかえもできる。今日でない日を見ているとき：その日の報告
  const usePrev = isToday && !salesShowToday;
  const cur = usePrev ? salesPrev : salesToday;
  const ready = cur && cur.d === (usePrev ? addDays(salesToday.d, -1) : salesToday.d) && !cur.err && cur.drop != null;
  salesReport = ready ? salesText(cur.d, cur.drop) : "";
  const tgt = usePrev ? addDays(salesToday.d, -1) : salesToday.d;
  el.insertAdjacentHTML("beforeend", `<div class="t salesrep"><div class="k">📋 売上の報告（${mdOf(tgt)}の店落ち・コピーして送る）</div>
    ${isToday ? `<div class="hint2" style="margin:4px 0">${usePrev ? `ふつうは前の日の分を送ります（日付はそのまま）。<a href="javascript:void(0)" onclick="salesShowToday=true;paintSales()">今日（${mdOf(salesToday.d)}）の分を見る</a>` : `今日の分です（まだ途中）。<a href="javascript:void(0)" onclick="salesShowToday=false;paintSales()">◀ 前の日（${mdOf(addDays(salesToday.d, -1))}）の分にもどす</a>`}</div>` : ""}
    ${ready ? `<pre>${esc(salesReport)}</pre><button type="button" class="btn btn-primary btn-sm" onclick="navigator.clipboard.writeText(salesReport).then(()=>toast('📋 売上の報告をコピーしました'),()=>prompt('コピーしてください',salesReport))">📋 コピー</button>`
      : cur && cur.err ? `<div class="hint2" style="color:#C0392B">前の日の数字が読めませんでした：${esc(cur.err)}</div>` : `<div class="hint2">前の日の数字を計算しています…</div>`}</div>`);
}
let salesReport = "";
document.head.insertAdjacentHTML("beforeend", `<style>.todaygrid .salesrep pre{font-family:inherit;font-size:14px;font-weight:800;white-space:pre-wrap;margin:4px 0 6px;color:var(--ink)}</style>`);
const __renderListT = renderList;
renderList = function(){ __renderListT(); renderToday(); renderOwner(); };

/* ---------- 👑 社長用：今の記録簿の金額の列と同じ並び（予約ごと＋合計）・雑費合計・カード合計。「社長」で入ったときだけ ---------- */
const OWNER_NAME = "社長";
function renderOwner(){
  const box = $("ownerBox"); if(!box) return;
  if(!KB.IS_OWNER){ box.style.display = "none"; return; }   // 社長（内勤の一覧の役わり「社長」。きぬ・はな）だけ
  box.style.display = "";
  const live = rows.filter(r=>r.status !== "cancel" && r.status !== "tobi" && r.status !== "flowed").sort((a, b)=>String(a.start_at).localeCompare(String(b.start_at)));
  const cols = [["基本額", r=>r.base_price], ["入会金", r=>r.admission], ["指名料", r=>r.nomination_fee], ["延長", r=>r.extension_fee], ["交通費", r=>r.transport],
    ["オプション額", r=>r.option_total], ["割引", r=>r.discount], ["総額", r=>r.total], ["キャスト報酬", r=>backOf(r)],
    ["暫定的な残額（源泉含む）", r=>(r.total || 0) - backOf(r)], ["【税務用】源泉徴収", r=>KBM.gensen(backOf(r))],
    ["実質的な店落ち", r=>(r.total || 0) - backOf(r) - KBM.gensen(backOf(r))]];
  // 👤 内勤（スタッフ）：記録簿エクセルと同じく、合計にスタッフ分も入れる。報酬＝日払い（まだ払っていない人も）、残額・店落ちはマイナス、源泉は報酬÷9
  const spRows = (typeof staffPay !== "undefined" && staffPay.rows) || [];
  const staffAmt = r => r.amount != null ? Number(r.amount) || 0 : spAuto(r);
  const staff = spRows.filter(r => staffAmt(r) > 0).map(r => { const p = staffAmt(r), w = KBM.gensen(p); return { name: r.name, vals: [0, 0, 0, 0, 0, 0, 0, 0, p, -p, w, -p - w] }; });
  const sum = cols.map(([, f], i)=>live.reduce((a, r)=>a + (Number(f(r)) || 0), 0) + staff.reduce((a, s)=>a + s.vals[i], 0));
  // 合計の源泉は、エクセルと同じく「報酬の合計 ÷ 9 を四捨五入」（1行ずつ四捨五入して足すと数円ずれる）。実質的な店落ちは 残額の合計 − その源泉
  sum[10] = KBM.gensen(sum[8]); sum[11] = sum[9] - sum[10];
  const ids = [...new Set(live.map(r=>r.cast_id).filter(Boolean))];
  let zappi = 0; ids.forEach(id=>{ try{ zappi += calcCast(id).zappi || 0; }catch(e){} });
  const card = live.filter(r=>r.payment !== "cash").reduce((a, r)=>a + (r.total || 0), 0);
  $("ownerGrid").innerHTML = `<div class="todaygrid">
      <div class="t"><div class="k">雑費合計</div><div class="v">${yen(zappi)}</div></div>
      <div class="t"><div class="k">カード合計</div><div class="v">${yen(card)}</div></div>
      <div class="t"><div class="k">実質的な店落ち（合計）</div><div class="v">${yen(sum[11])}</div></div></div>
    <div class="wrapx"><table class="list" style="font-size:12.5px"><tr><th>時間</th><th>キャスト</th>${cols.map(([l])=>`<th>${l}</th>`).join("")}</tr>
      ${live.map(r=>`<tr><td>${hm(r.start_at)}</td><td>${esc(castName(r.cast_id))}</td>${cols.map(([, f])=>`<td class="money">${yen(Number(f(r)) || 0)}</td>`).join("")}</tr>`).join("")}
      ${staff.map(s=>`<tr style="background:#F4F8FF"><td>内勤</td><td>👤 ${esc(s.name)}</td>${s.vals.map((v, i)=>`<td class="money">${i < 8 ? "" : yen(v)}</td>`).join("")}</tr>`).join("")}
      <tr style="font-weight:800;background:#FFF7FA"><td colspan="2">合計（${live.length}件${staff.length ? "・スタッフ分含む" : ""}）</td>${sum.map(v=>`<td class="money">${yen(v)}</td>`).join("")}</tr></table></div>
    <div style="display:flex;gap:16px;flex-wrap:wrap;justify-content:flex-end;margin-top:8px;font-weight:900;font-size:14px">
      <span>雑費合計 <span style="color:#e5638c">${yen(zappi)}</span></span><span>カード合計 <span style="color:#e5638c">${yen(card)}</span></span>
      <span>暫定的な残額＋雑費（スタッフ分含む） <span style="color:#e5638c">${yen(sum[9] + zappi)}</span></span></div>`;
}

/* ---------- 🪑 鶯谷待機席（1〜5番）：座った時刻〜退席の時刻を、日付ごとに記録（kb_seat_logs） ---------- */
let seatLogs = [], seatsOk = true;
async function loadSeats(){
  try{ seatLogs = q(await sb.from("kb_seat_logs").select("*").eq("biz_date", day).order("start_at")) || []; seatsOk = true; }
  catch(e){ seatLogs = []; seatsOk = false; }
}
function seatOf(castId){ return seatLogs.find(l=>l.cast_id === castId && !l.end_at) || null; }
function seatCandidates(){ return tlRows().filter(x=>x.c && (x.cd && x.cd.standby) === "鶯谷" && boardState(x) === "wait" && !seatOf(x.c.id)); }
function renderSeats(){
  const el = $("seatBox"); if(!el) return;
  if(!seatsOk){ el.innerHTML = `<div class="gate">SQL 102（鶯谷待機席）を実行すると使えます</div>`; return; }
  const cand = seatCandidates();
  const cards = [1, 2, 3, 4, 5].map(n=>{
    const l = seatLogs.find(x=>x.seat === n && !x.end_at);
    if(l) return `<div class="seat on"><div class="no">🪑 ${n}番</div><div class="who">${esc(castName(l.cast_id))}</div><div class="since">${hm(l.start_at)} から</div>
      ${KB.CAN_EDIT ? `<button class="btn btn-ghost btn-sm" onclick="leaveSeat(${l.id})">退席</button>` : ""}</div>`;
    return `<div class="seat"><div class="no">🪑 ${n}番</div><div class="who" style="color:var(--sub)">あいている</div>
      ${KB.CAN_EDIT ? (cand.length ? `<select id="seatSel${n}"><option value="">だれが座る？</option>${cand.map(x=>`<option value="${x.c.id}">${esc(castLabel(x))}</option>`).join("")}</select>
        <button class="btn btn-primary btn-sm" onclick="sitDown(${n})">座る</button>` : `<div class="hint2">鶯谷で待機中の人がいません</div>`) : ""}</div>`;
  }).join("");
  const mins = l=>Math.round(((l.end_at ? new Date(l.end_at) : new Date()) - new Date(l.start_at)) / 60000);
  const log = seatLogs.slice().sort((a, b)=>String(a.start_at).localeCompare(String(b.start_at)));
  el.innerHTML = `<div class="hint2" style="margin:4px 0 8px">鶯谷で「待機中」のキャストを席に座らせると、その時刻から「退席」を押した時刻までが記録されます（日付ごと）。キャストの枠（今どこに誰がの札）からも選べます。</div>
    <div class="seats">${cards}</div>
    <div style="font-weight:800;margin:14px 0 6px">📜 この日の記録</div>
    ${log.length ? `<table class="list"><tr><th>席</th><th>キャスト</th><th>座った</th><th>退席</th><th>時間</th><th>記録</th></tr>${log.map(l=>`<tr>
      <td>${l.seat}番</td><td><b>${esc(castName(l.cast_id))}</b></td><td>${hm(l.start_at)}</td><td>${l.end_at ? hm(l.end_at) : "<b style='color:#6c5ce7'>座っている</b>"}</td>
      <td>${mins(l)}分</td><td><small>${esc(l.start_by)}${l.end_by ? " → " + esc(l.end_by) : ""}</small></td></tr>`).join("")}</table>` : `<div class="hist">まだ記録はありません</div>`}`;
}
async function sitDown(n, castId){
  if(!KB.CAN_EDIT) return;
  const id = castId || ($("seatSel" + n) && $("seatSel" + n).value);
  if(!id){ toast("だれが座るか選んでください"); return; }
  await loadSeats();   // ほかのPCで座らせたばかりかもしれないので、いまの席を読みなおしてから（同じ子が2つの席に座らないように）2026/11/10
  if(seatLogs.some(l=>l.seat === n && !l.end_at && l.cast_id !== id)){ renderSeats(); renderBoard(); toast(n + "番はもう使われています（ほかのPCで座らせたかもしれません）"); return; }
  const old = seatOf(id);
  try{
    if(old && old.seat === n){ renderSeats(); renderBoard(); toast(castName(id) + " はもう " + n + "番に座っています"); return; }
    if(old) q(await sb.from("kb_seat_logs").update({ end_at: new Date().toISOString(), end_by: KB.operatorName() + "（" + n + "番に移動）" }).eq("id", old.id));   // 席の移動：前の席は退席
    q(await sb.from("kb_seat_logs").insert({ biz_date: day, seat: n, cast_id: id, start_by: KB.operatorName() }));
    await loadSeats(); renderSeats(); renderBoard();
    toast(castName(id) + " → 🪑" + n + "番");
  }catch(e){ toast("記録できませんでした：" + (e.message || e)); }
}
async function leaveSeat(logId){
  if(!KB.CAN_EDIT) return;
  const l = seatLogs.find(x=>x.id === logId);
  try{
    q(await sb.from("kb_seat_logs").update({ end_at: new Date().toISOString(), end_by: KB.operatorName() }).eq("id", logId));
    await loadSeats(); renderSeats(); renderBoard(); if(l && castOpen && castOpen.c && castOpen.c.id === l.cast_id) openCast(l.cast_id, "");
    toast("退席しました");
  }catch(e){ toast("記録できませんでした：" + (e.message || e)); }
}
const __loadDayS = loadDay;
loadDay = async function(){ await __loadDayS(); await loadSeats(); renderSeats(); renderBoard(); renderToday(); };
// キャストの枠：鶯谷で待機のときは、席を選べる
const __openCastS = openCast;
openCast = function(castId, name){
  __openCastS(castId, name);
  const x = castOpen; if(!x || !x.c || !seatsOk || !KB.CAN_EDIT) return;
  if(((x.cd && x.cd.standby) || "") !== "鶯谷") return;
  const cur = seatOf(x.c.id), used = seatLogs.filter(l=>!l.end_at && l.cast_id !== x.c.id).map(l=>l.seat);
  const html = `<div class="seatpick">🪑 鶯谷の席：${[1, 2, 3, 4, 5].map(n=>`<button class="btn btn-sm ${cur && cur.seat === n ? "btn-primary" : "btn-ghost"}" ${used.includes(n) ? "disabled" : ""} onclick="sitDown(${n},'${x.c.id}')">${n}</button>`).join("")}
    ${cur ? `<span class="hint2">${hm(cur.start_at)}から ${cur.seat}番</span> <button class="btn btn-ghost btn-sm" onclick="leaveSeat(${cur.id})">退席</button>` : ""}</div>`;
  const meta = document.querySelector("#castBody .castmeta");
  if(meta) meta.insertAdjacentHTML("afterend", html);
};

/* ---------- 予約の入力 ⑥：対応ログ ---------- */
function renderFormLog(){
  const el = $("formLog"); if(!el) return;
  // 新しい予約：書いた備考は、保存したときにいっしょに入る
  const logs = editing ? logOf(rows.find(x=>x.id === editing.id) || editing) : formPending;
  el.innerHTML = `<div class="mlog full">${logs.length ? logs.map(l=>`<div><b>${esc(whenShort(l.at))} ${esc(l.by || "")}</b> ${esc(l.text)}</div>`).join("") : `<div class="none">まだありません</div>`}</div>
    ${KB.CAN_EDIT ? `<div style="display:flex;gap:6px;margin-top:6px"><input id="formLogText" maxlength="200" placeholder="例：お客様に折り返し済み" style="flex:1"
      onkeydown="if(event.key==='Enter'&&!event.isComposing){event.preventDefault();addFormLog();}"><button type="button" class="btn btn-ghost btn-sm" onclick="addFormLog()">＋ 書く</button></div>` : ""}`;
}
async function addFormLog(){
  const t = $("formLogText").value.trim(); if(!t) return;
  if(!editing){ formPending.push({ at: new Date().toISOString(), by: KB.operatorName() || "（担当者なし）", text: t }); $("formLogText").value = ""; renderFormLog(); return; }
  if(await pushLog(editing.id, t)){ $("formLogText").value = ""; renderFormLog(); renderList(); }
}
let formPending = [];   // 新しい予約で、保存の前に書いた備考
// 「＋ 書く」を押し忘れて保存しても、欄に書いてあるものは入れる
function formPendingNow(){ const t = $("formLogText") ? $("formLogText").value.trim() : ""; return t ? formPending.concat([{ at: new Date().toISOString(), by: KB.operatorName() || "（担当者なし）", text: t }]) : formPending; }
const __openForm2 = openForm;
openForm = function(id){
  formPending = [];
  __openForm2(id);
  if(!id){ $("f_status").value = ""; stColor(); }   // 新しい予約は「選択してください」から（点滅）
  renderFormLog();
};

/* ============================================================
   🎯 希望プレイで絞る（⏱ 全体を見たい）
   ・キャストプロフのオプションの可否（◎大好き／○OK／△条件つき／×NG）を読む
   ・選んだプレイが全部「◎か○」のキャストだけにする（「△も入れる」にチェックすると△も）
   ・名前の下に、選んだプレイの可否を出す
   ============================================================ */
const PLAYS = [["AF", "AF"], ["逆AF", "逆AF"], ["キャスト射精", "射精"], ["無限射精", "無限射精"], ["前立腺", "前立腺"], ["兜合わせ", "兜合わせ"],
  ["玉舐め", "玉舐め"], ["キス", "キス"], ["全身リップ", "全身リップ"], ["乳首責め", "乳首責め"], ["生フェラ", "生フェラ"], ["69", "69"],
  ["Sプレイ", "Sプレイ"], ["Mプレイ", "Mプレイ"], ["ごっくん", "ごっくん"], ["聖水", "聖水"], ["コスプレ", "コスプレ"],
  ["女装", "女装のお客様"], ["外国人", "外国人のお客様"], ["3P_お客2名", "3P お客2名"], ["3P_キャスト2名", "3P キャスト2名"], ["お泊り", "お泊り"], ["デート", "デート"]];
let playSel = new Set();
let profLoading = false;
function profOpts(c){
  if(!c || !c.prof_id || !profById) return null;
  const d = profById[c.prof_id]; if(!d) return null;
  // サクラムーンの可否 → なければ、可否が入っているほかのお店のプロフ（サクラムーンにいない子が「いません」にならないように）
  const sps = d.storeProfiles || {}, has = p => p && p.options && Object.keys(p.options).some(k => p.options[k]);
  const sp = has(sps["サクラムーン"]) ? sps["サクラムーン"] : (Object.values(sps).find(has) || {});
  const o = Object.assign({}, d.options || {}, sp.options || {});
  Object.keys(o).forEach(k => { o[k] = markNorm(o[k]); });
  // HPから取りこんだプロフは、名前（例：「キャスト射精（有料）」「外国人のお客様」）で入っている → プロフの id にそろえる
  Object.keys(o).forEach(k => {
    const ids = OPT_ALIAS[k] || OPT_ALIAS[k.replace(/（有料）$/, "")] || [k.replace(/（有料）$/, "")];
    ids.forEach(id => { if(!o[id]) o[id] = o[k]; });
  });
  return o;
}
const OPT_ALIAS = { "前立腺マッサージ": ["前立腺"], "お泊りコース": ["お泊り"], "デートコース": ["デート"],
  "コース内キャスト2回以上射精": ["無限射精"], "3P": ["3P_お客2名", "3P_キャスト2名"], "3P／お客様2名": ["3P_お客2名"], "3P／キャスト2名": ["3P_キャスト2名"],
  "女装されているお客様": ["女装"], "外国人のお客様": ["外国人"] };
// 可否の印をそろえる（◯・〇・OK → ○、✕・x・NG → × など。プロフやHPの取りこみで字がちがうことがある）
function markNorm(v){
  const s = String(v == null ? "" : v).trim();
  if(!s) return "";
  const h = s[0];
  if(h === "◎") return "◎";
  if("○◯〇Oo".includes(h) || /^ok/i.test(s)) return "○";
  if("△▲".includes(h)) return "△";
  if("×✕✖xX".includes(h) || /^ng/i.test(s)) return "×";
  return s;
}
function togglePlay(k){ if(playSel.has(k)) playSel.delete(k); else playSel.add(k); renderTL(); }
function clearPlay(){ playSel.clear(); renderTL(); }
function renderPlayChips(){
  const el = $("s_playChips"); if(!el) return;
  el.innerHTML = PLAYS.map(([k, l])=>`<button type="button" class="chip ${playSel.has(k) ? "on" : ""}" onclick="togglePlay('${k}')">${esc(l)}</button>`).join("");
  $("s_playCount").textContent = playSel.size ? `（${[...playSel].map(k=>(PLAYS.find(p=>p[0] === k) || [k, k])[1]).join("・")}）` : "";
}
// 絞り込み（タイムラインの一覧から呼ばれる）
function applyPlayFilter(list){
  renderPlayChips();
  if(!playSel.size) return list;
  if(!profById){
    if(!profLoading){ profLoading = true; loadProfs().then(()=>{ profLoading = false; renderTL(); }).catch(()=>{ profLoading = false; }); }
    return list;
  }
  const okMarks = $("s_playTri") && $("s_playTri").checked ? ["◎", "○", "△"] : ["◎", "○"];
  // 「いません」のとき、なぜかわかるように数える（プロフとつながっていない・その可否が空・×や△）
  playWhy = { noProf: [], blank: [], ng: [] };
  return list.filter(x=>{
    const o = profOpts(x.c);
    if(!o){ if(x.c) playWhy.noProf.push(castLabel(x)); return false; }
    const ok = [...playSel].every(k=>okMarks.includes(o[k]));
    if(!ok) ([...playSel].some(k=>!o[k]) ? playWhy.blank : playWhy.ng).push(castLabel(x));
    return ok;
  });
}
let playWhy = null;
function playWhyHtml(){
  if(!playWhy) return "";
  const p = [playWhy.noProf.length ? `プロフとつながっていない：${playWhy.noProf.map(esc).join("、")}` : "",
    playWhy.blank.length ? `プロフに可否が入っていない：${playWhy.blank.map(esc).join("、")}` : "",
    playWhy.ng.length ? `×・△など：${playWhy.ng.map(esc).join("、")}` : ""].filter(Boolean);
  return p.length ? `<div style="font-size:12px;font-weight:700;margin-top:4px">${p.join("<br>")}</div>` : "";
}
// 名前の下に出す可否（例：AF◎ 逆AF○）
function playMarks(x){
  if(!playSel.size || !profById) return "";
  const o = profOpts(x.c);
  if(!o) return "・プロフなし";
  return "・" + [...playSel].map(k=>(PLAYS.find(p=>p[0] === k) || [k, k])[1] + (o[k] || "？")).join(" ");
}

