/* ============================================================
   📒 記録簿（kiroku.html）の 2/7：画面：数字のカード・タイムライン・探す・ボード（今どこに誰が）
   ※ kiroku.html の <script src> の順番どおりに読む（順番を変えると動かなくなる。2026/11/10 1つのファイルから分けた）
   ============================================================ */
/* ============================================================
   ここから下：新しい記録簿の画面だけで使うもの
   （上の受付のしくみ・計算・保存はそのまま使う）
   ============================================================ */
$("navArea").innerHTML = KB.nav("kiroku.html");

/* ---------- 数字のカード・税務集計 ---------- */
const __renderList = renderList;
renderList = function(){
  __renderList();
  const live = rows.filter(r=>r.status !== "cancel" && r.status !== "tobi" && r.status !== "flowed");
  const total = live.reduce((a, r)=>a + (r.total || 0), 0), back = live.reduce((a, r)=>a + backOf(r), 0);
  const casts = new Set(live.map(r=>r.cast_id).filter(Boolean)).size;
  const tax = KBM.gensen(back);   // 源泉はエクセルと同じく「報酬の合計÷9」を四捨五入（1予約ずつだと数円ずれる）2026/11/10
  const card = live.filter(r=>r.payment !== "cash").reduce((a, r)=>a + (r.total || 0), 0);
  $("stats").className = "stats" + (showMoney ? "" : " hide");
  $("tax").className = "tax" + (showMoney ? "" : " hide");
  if($("moneyBtn")) $("moneyBtn").textContent = showMoney ? "🙈 金額をかくす" : "👁 金額を見る";
  $("stats").innerHTML = `
    <div class="stat"><div class="k">本日売上</div><div class="v pink m">${yen(total)}</div></div>
    <div class="stat"><div class="k">予約件数</div><div class="v">${live.length}件</div></div>
    <div class="stat"><div class="k">予約のあるキャスト</div><div class="v">${casts}名</div></div>
    <div class="stat"><div class="k">キャスト報酬計</div><div class="v green m">${yen(back)}</div></div>
    <div class="stat"><div class="k">店落ち（暫定）</div><div class="v m">${yen(total - back)}</div></div>`;
  $("tax").innerHTML = `<span>📊 税務集計（本日分）</span>
    <span>源泉徴収合計<b>${yen(tax)}</b></span><span>暫定残額合計<b>${yen(total - back)}</b></span>
    <span>実質店落ち<b>${yen(total - back - tax)}</b></span><span>カード売上<b>${yen(card)}</b></span>`;
};

/* ---------- 支払い方法のボタン ---------- */
const PAYS = [["cash", "現金"], ["card", "カード（×1.15）"]];   // 決済したかは、本日のキャスト一覧のカードのプルダウンで
function renderPayChips(){
  const v = $("f_pay").value;   // 新しい受付は「まだ選んでいない」（必須）
  $("f_payChips").innerHTML = PAYS.map(([k, l])=>`<button type="button" class="chip ${v === k ? "on" : ""}" onclick="setPay('${k}')">${l}</button>`).join("");
}
function setPay(v){ $("f_pay").value = v; renderPayChips(); recalc(); }

/* ---------- 開いたとき：希望プレイ・支払い ---------- */
const __openForm = openForm;
openForm = function(id){
  __openForm(id);
  const r = (id ? rows.find(x=>x.id === id) : null) || {};
  $("formTitle").textContent = id ? `予約の編集（No.${id}）` : "予約を追加";
  $("f_play").value = r.play_wish || "";
  renderPayChips();
  recalc();
  $("formBg").scrollTop = 0;
};

/* ---------- 計算のたびに：終了時刻・総額の帯・タイムライン ---------- */
const __recalc = recalc;
recalc = function(){
  __recalc();
  if(!last) return;
  // 打っているとちゅう（100・１２４０ など）でも終了時刻を出す。0〜5時は深夜（100 → 25:00）
  const s = String($("f_start").value || "").normalize("NFKC").trim();
  let h = NaN, m = NaN;
  { const a = /^(\d{1,2}):(\d{1,2})$/.exec(s), d = s.replace(/[^\d]/g, "");
    if(a){ h = +a[1]; m = +a[2]; } else if(d && d.length <= 4){ if(d.length <= 2){ h = +d; m = 0; } else { h = +d.slice(0, d.length - 2); m = +d.slice(-2); } }
    if(h < 6) h += 24; }
  if(s && isFinite(h) && isFinite(m)){
    const t = h * 60 + m + minutesOf(last.course) + last.ext * 30 + last.date * 30;
    $("endView").textContent = lateHM(t);
  } else $("endView").textContent = "--:--";
  $("footTotal").textContent = yen(last.total);
  // 希望プレイを予約連絡に入れる
  const pw = $("f_play").value.trim();
  if(pw) $("msg").value = $("msg").value.replace(/(【バック無OP】[^\n]*)/, "$1\n【希望プレイ】" + pw);
  netReply();
  // 👥 3P・4P：一緒に行くキャストを予約連絡に
  if(party.kind === "cast"){
    const all = editing ? [] : [$("f_cast").value, ...party.casts].filter(Boolean);
    const line = editing ? (party.note || "👥 3P").replace(/^👥\s*/, "") : `キャスト${party.n}名${all.length > 1 ? "：" + all.map(castName).join("・") : ""}`;
    $("msg").value = $("msg").value.replace(/(【コース】[^\n]*)/, "$1\n【" + (party.n === 3 ? "4P" : "3P") + "】" + line);
    // 💴 1人あたりと総額・代表してもらう子 → ほかの子に渡す額
    if(!editing && all.length > 1 && last.pay === "cash"){
      partyRepPaint();
      const sh = partyShares(), sum = sh.reduce((a, x) => a + x.total, 0), rep = party.rep || all[0];
      const give = sh.filter(x => x.cid !== rep).map(x => `${castName(x.cid)}さんへ ${x.total.toLocaleString("ja-JP")}円`).join("、");
      $("msg").value = $("msg").value.replace(/【料金総額】[^\n]*\n※[^\n]*/,
        `【料金（1人あたり）】${sh.map(x => castName(x.cid) + " " + x.total.toLocaleString("ja-JP") + "円").join("／")}\n【料金総額】${sum.toLocaleString("ja-JP")}円\n` +
        `※${castName(rep)}さんが総額${sum.toLocaleString("ja-JP")}円を代表して受け取り、プレイ終了後に ${give} を渡してください。盗難・貰い忘れに注意！`);
    }
  } else if(party.kind === "guest") $("msg").value = $("msg").value.replace(/(【コース】[^\n]*)/, "$1\n【3P】お客様2名");
  // 🧳 キューティー：女レ道具セットを持ち物として
  const kit = $("f_store").value === "cutie" ? dressKit(getDress()) : "";
  if(kit) $("msg").value = $("msg").value.replace(/(【バック無OP】[^\n]*(\n【希望プレイ】[^\n]*)?)/, "$1\n【持ち物：女レ道具セット】" + kit);
  drawTimeline();
};

/* ---------- そのキャストの本日のタイムライン（11時〜翌5時） ---------- */
const TL_FROM = 11, TL_TO = 31;   // 11時〜翌7時（残業で朝まで働く子もいるので）
function hourOf(iso){ const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000); let h = d.getUTCHours() + d.getUTCMinutes() / 60; if(h < 8) h += 24; return h; }
// 出すはんい：出勤の前後2時間（シフトの外に予約があれば、そこまでのばす）。drawTimeline で決める
let tlA = TL_FROM, tlB = TL_TO;
function pct(h){ return Math.max(0, Math.min(100, (h - tlA) / (tlB - tlA) * 100)); }
function drawTimeline(){
  const el = $("castTimeline"); if(!el) return;
  const c = M.casts.find(x=>x.id === $("f_cast").value);
  if(!c){ el.innerHTML = ""; $("footWarn").textContent = ""; return; }
  // 日付を変えたときは、その日の予約・シフトで（読んでいなければ読んでから描きなおす）
  const bd = $("f_day") && $("f_day").value && $("f_day").value !== day ? $("f_day").value : "";
  const od = bd ? otherDay[bd] : null;
  if(bd && !od) loadOtherDay(bd);
  const sh = bd ? (od && od.sh) : shiftCache[day];
  if(!sh && !bd){ loadShifts(day).then(()=>drawTimeline()).catch(()=>{}); }
  const shift = sh ? (sh[c.shift_name] || sh[c.official_name]) : null;
  const others = (bd ? (od ? od.rows : []) : rows).filter(r=>r.cast_id === c.id && (!editing || r.id !== editing.id) && r.status !== "cancel" && r.status !== "tobi" && r.status !== "flowed" && r.start_at && r.end_at)
    .map(r=>{ const s = hourOf(r.start_at); let e = hourOf(r.end_at); if(e < s) e += 24; return { s, e, label: hm(r.start_at) + "〜" + hm(r.end_at) + (r.area ? " " + r.area : ""), st: r.status }; });
  let cur = null;
  const st = $("f_start").value;
  if(st && last){
    const [h, m] = st.split(":").map(Number);
    let s = h + m / 60; if(s < 8) s += 24;
    const e = s + (minutesOf(last.course) + last.ext * 30 + last.date * 30) / 60;
    cur = { s, e, label: st + "〜" + $("endView").textContent };
  }
  const gap = (c.interval_min || 0) / 60;   // キャストの「予約の間」
  const clash = cur && others.some(o=>o.s - gap < cur.e && cur.s < o.e + gap);
  const outShift = cur && shift && (cur.s < shift.start || cur.e > shift.end);
  $("footWarn").textContent = clash ? (gap ? "⚠️ 予約が重なっています（予約の間 " + c.interval_min + "分あけ）" : "⚠️ 予約が重なっています") : (outShift ? "⚠️ 出勤時間の外です" : "");
  { let a = shift ? shift.start - 2 : TL_FROM, b = shift ? shift.end + 2 : TL_TO;
    others.concat(cur ? [cur] : []).forEach(o=>{ a = Math.min(a, o.s - 0.5); b = Math.max(b, o.e + 0.5); });
    tlA = Math.max(6, Math.floor(a)); tlB = Math.min(36, Math.ceil(b)); if(tlB - tlA < 4) tlB = tlA + 4; }
  const span = tlB - tlA, step = span > 14 ? 3 : span > 8 ? 2 : 1, tk = [];
  for(let h = tlA; h <= tlB; h += step) tk.push(h);
  if(tk[tk.length - 1] !== tlB && tlB - tk[tk.length - 1] >= step / 2) tk.push(tlB);
  const ticks = tk.map(h=>`<span style="position:absolute;left:${pct(h)}%;transform:translateX(${h === tlA ? "0" : h === tlB ? "-100%" : "-50%"})">${h >= 24 ? "翌" + (h - 24) : h}時</span>`).join("");
  el.innerHTML = `<div class="tl"><div class="ttl">📅 ${bd ? Number(bd.slice(5, 7)) + "/" + Number(bd.slice(8)) + " の" : "本日の"}タイムライン（${esc(c.official_name || c.temp_name)}）
      ${shift ? `<span style="font-weight:400;color:#c9cbe0">出勤 ${hourLabel(shift.start)}〜${hourLabel(shift.end)}${shift.confirmed ? "" : "（未確定）"}</span>` : `<span style="font-weight:400;color:#c9cbe0">${sh ? "シフトが見つかりません" : "シフトを読み込み中…"}</span>`}</div>
    <div class="axis" style="position:relative;height:14px;display:block">${ticks}</div>
    <div class="bar">
      ${shift ? `<div class="shift" style="left:${pct(shift.start)}%;width:${pct(shift.end) - pct(shift.start)}%"></div>` : ""}
      ${others.map(o=>`<div class="bk st ${o.st}" style="left:${pct(o.s)}%;width:${Math.max(2, pct(o.e) - pct(o.s))}%" title="${esc(o.label)}">${esc(o.label)}</div>`).join("")}
      ${cur ? `<div class="bk ${clash ? "clash" : "cur"}" style="left:${pct(cur.s)}%;width:${Math.max(2, pct(cur.e) - pct(cur.s))}%">${esc(cur.label)}</div>` : ""}
    </div>
    <div class="leg">■ 出勤時間　入っている予約（状態の色）　<span style="color:#ffbe5c">■</span> この予約${clash ? '　<b style="color:#ff8a8a">重なっています</b>' : ""}</div></div>`;
}

/* ---------- キャストの情報：受付ではランクは出さない。特記事項・NG・条件はたたんでおく ----------
   受付のときすぐ見たいことは「必ず案内すること」に入れる */
const __onCast = onCast;
onCast = function(){
  __onCast();
  const c = M.casts.find(x=>x.id === $("f_cast").value);
  if(!c){ $("castInfo").innerHTML = ""; return; }
  hearings = [];
  const rules = rulesOn(c.id).map(r=>"・" + esc(r.note) + hearLink(r.hearing_text, r.by_name, r.created_at)).join("<br>");
  const parts = [];
  if(c.special_notes) parts.push(`<div class="info">📝 特記事項：${esc(c.special_notes)}</div>`);
  if(c.ng_notes) parts.push(`<div class="warn">🚫 NG：${esc(c.ng_notes)}</div>`);
  if(rules) parts.push(`<div class="info">🧮 このキャストの条件：<br>${rules}</div>`);
  $("castInfo").innerHTML = parts.length
    ? `<details style="margin-top:6px"><summary style="cursor:pointer;font-size:13px;font-weight:800;color:var(--sub)">📂 このキャストの特記事項・NG・条件を見る</summary>${parts.join("")}</details>`
    : "";
};

/* ---------- ⑥ 最終確認（お客さんに読み上げ） ---------- */
const __recalc2 = recalc;
recalc = function(){
  __recalc2();
  const el = $("finalSummary"); if(!el || !last) return;
  const d = new Date((($("f_day") && $("f_day").value) || day) + "T12:00:00Z");   // 受付の日付
  const c = M.casts.find(x=>x.id === $("f_cast").value);
  const cname = c ? (c.official_name || c.temp_name) : "（キャスト未定）";
  const dummy = isDummyStore(last.store) && $("f_dummy").value ? $("f_dummy").value : "";
  const place = [$("f_area").value, $("f_address").value].filter(Boolean).join(" ") || "（場所未定）";
  const course = last.course ? last.course + (/^\d+$/.test(last.course) ? "分" : "") + "コース" + (last.ext ? "＋延長" + last.ext * 30 + "分" : "") + (last.date ? "＋デート" + last.date * 30 + "分" : "") : "（コース未定）";
  const pay = { cash: "現金", card: "カード", card_paid: "カード済み" }[last.pay] || "";
  el.innerHTML = `<div class="l1">${d.getUTCMonth() + 1}/${d.getUTCDate()}(${DOW[d.getUTCDay()]}) ${$("f_start").value || "--:--"}〜${$("endView").textContent}　${esc(place)}</div>
    <div class="l2">${dummy ? `🎭 ${esc(dummy)}（実際：${esc(cname)}）` : esc(cname)}　${esc(course)}</div>
    ${last.opts.length ? `<div class="l2" style="font-size:16px">OP：${esc(last.opts.map(o => o.label + (o.qty > 1 ? "×" + o.qty : "")).join("・"))}</div>` : ""}
    ${last.pay === "split"
      // 💴＋💳 現金＋カード：現金で払う額と、カードで払う額（手数料こみ）を分けて読み上げる（2026/11/9 内勤さん）
      ? `<div class="l3">総額 <b>${yen(last.total)}</b>（現金＋カード）</div>
         <div class="l3 splitl">💴 現金で <b>${yen(last.total - (last.splitCard || 0))}</b>　＋　💳 カードで <b>${yen(last.splitCard || 0)}</b><small>（カードの分は手数料こみ）</small></div>`
      : last.pay === "card" || last.pay === "card_paid"
      ? `<div class="l3">総額 <b>${yen(last.total)}</b>（${pay}）</div><div class="l3 splitl">💳 カードで払う額 <b>${yen(last.total)}</b><small>（手数料こみ）</small></div>`
      : `<div class="l3">総額 <b>${yen(last.total)}</b>（${pay}）</div>`}`;
  // 👥 3P・4P（キャスト複数）：全員ぶんの総額を読み上げる
  if(party.kind === "cast" && !editing && partyMembers().length > 1){
    const sh = partyShares(), sum = sh.reduce((a, x) => a + x.total, 0);
    el.querySelector(".l2").textContent = sh.map(x => castName(x.cid)).join("・") + "（" + (party.n === 3 ? "4P" : "3P") + "）　" + course;
    el.querySelector(".l3").innerHTML = `総額 <b>${yen(sum)}</b>（${pay}・${sh.map(x => esc(castName(x.cid)) + " " + yen(x.total)).join("／")}）`;
    $("footTotal").textContent = yen(sum);
  }
};

/* ============================================================
   ⏱ タイムライン＋🔍 探す（パソコン向け）
   ・その日シフトのあるキャストを1行ずつ。11時〜翌7時を30分のマスで並べる
   ・出勤時間のマスだけ白、それ以外はグレー。マウスを乗せるとそのマスの時刻が出る。押すとその時刻で予約の入力
   ・予約は帯（押すと開く）。キャストごとの「予約の間（インターバル）」は、予約の前後をしま模様のグレーに
   ・「何時から・何分」→ 行けるキャストが緑で上に。キャストは複数選んで絞れる（空き時間も出る）
   ・並び順：出勤が早い順／あいうえお順／退勤が早い順／退勤が遅い順
   ============================================================ */
let castDays = {};
var slotMode = "cast";
let selCasts = new Set();
function showView(v){
  try{ localStorage.setItem("kirokuView", v); }catch(e){}
  // 🙋 誰が行ける？：キャストを選べば「その人の空き時間」、選ばなければ「時刻ごとに行ける人」（💁 キャスト決まってる はここにまとめた）
  // 🗺 今どこに誰が は、いつも上に出しておく（タブではない）
  if(v !== "tl") v = "new";   // タブは「＋ 新規予約」「全体を見たい」の2つ（本日のキャスト一覧のタブはなくした・一覧は新規予約の下に出る）
  const box = { tl: "viewTL", list: "viewList", new: "viewList", slotsFree: "viewSlots", seats: "viewSeats" };   // 新規予約は、絞った一覧を出す
  $("sharedFilter").style.display = "";   // フィルターは2つのタブで共通（絞りもそのまま引きつぐ）
  nfMode(nfCur);
  ["viewTL", "viewList", "viewSlots", "viewSeats"].forEach(id=>{ const el = $(id); if(el) el.style.display = box[v] === id ? "" : "none"; });
  if(v === "slotsFree" && typeof renderSlots === "function") renderSlots();
  document.querySelectorAll("#tabs button[data-v]").forEach(b=>b.classList.toggle("on", b.dataset.v === v));
}
(function(){ let v = "list"; try{ v = localStorage.getItem("kirokuView") || "list"; }catch(e){} setTimeout(()=>showView(v), 0); })();   // 基本は予約一覧
(function(){ try{ const s = localStorage.getItem("kirokuSort"); if(s && $("s_sort")) $("s_sort").value = s; }catch(e){} })();

const __loadDay = loadDay;
loadDay = async function(){
  await __loadDay();
  try{
    const [cd] = await Promise.all([ sb.from("kb_cast_days").select("*").eq("biz_date", day), loadShifts(day) ]);
    castDays = {}; (q(cd) || []).forEach(x=>{ castDays[x.cast_id] = x; });
  }catch(e){ castDays = {}; }
  renderTL();
  markDroppedAbsent();
};
// サクラシフトで当日に消された子 → 記録簿で「欠勤」の記録を自動で残す（理由は空。あとで内勤が書ける）2026/11/6
let droppedBusy = false;
async function markDroppedAbsent(){
  if(droppedBusy || !KB.CAN_EDIT || day === KB.PRACTICE_DAY) return;
  const sh = shiftCache[day] || {}, todo = [];
  Object.keys(sh).forEach(name => {
    if(!sh[name].dropped || sh[name].early) return;   // 前の日までに取り下げたシフトは、欠勤の記録をつけない（2026/11/11）
    const c = M.casts.find(x => x.shift_name === name || x.official_name === name); if(!c) return;
    const cd = castDays[c.id] || {};
    if(cd.status === "欠勤" || (cd.attend_log || []).some(a => a.kind === "欠勤")) return;
    todo.push({ c, s: sh[name] });
  });
  if(!todo.length) return;
  droppedBusy = true;
  try{
    for(const { c, s } of todo){
      const log = ((castDays[c.id] || {}).attend_log || []).concat([{ kind: "欠勤", reason: "", time: "", at: s.droppedAt || new Date().toISOString(), by: (s.droppedBy || "サクラシフト") + "（シフトで休みに）" }]);
      await saveDayPart(c.id, { attend_log: log, status: "欠勤", standby: "" });
    }
  }finally{ droppedBusy = false; }
}
// 🔒 お金の数字（精算済・エクセルから取りこんだ予約では変えない）2026/11/6
const MONEY_KEYS = ["base_price", "admission", "nomination_fee", "extension_fee", "transport", "option_total", "discount", "total", "payment", "card_total",
  "course_back", "option_back", "extra_back", "nomi_back", "back_override", "options", "extension_count", "date_count", "nh_rate", "free_kind"];
function moneyLocked(r){
  if(!r) return false;
  if(/^xl\d/.test(String(r.src || ""))) return true;   // エクセルから取りこんだ予約
  const cd = (typeof castDays !== "undefined" && castDays[r.cast_id]) || null;
  if(!cd || !cd.settled || typeof kbPartIds !== "function") return false;
  return kbPartIds(cd, rows.filter(x => x.cast_id === r.cast_id)).has(r.id);   // その日の精算に入った予約
}
// 🌐 そのあと公式HPにも入れる（その日だけ。キャスト台帳に在籍番号があるお店だけ）2026/11/6 店長OK
//   ダミー名のお店（18・極門）と媒体（ヘブン・ぴゅあらば・情報局・NHF）は、今までどおりシフトアプリで
//   入れられたお店は、サクラシフトのその日の入力チェックを ✅ に（SQL 220）
const HP_SHIFT_MEDIA = { sakuramoon: "サクラムーン", lana_uguisu: "ラナ鶯谷", lana_kinshi: "ラナ錦糸町", dressgarden: "ドレスガーデン", peachmoon: "ピーチムーン", cutie: "キューティー", gyakuanal: "逆AF倶楽部" };
async function hpPushDay(cid, shiftName, d){
  const c = M.casts.find(x => x.id === cid); if(!c) return;
  const targets = Object.entries(c.stores || {}).filter(([k, s]) => HP_SHIFT_MEDIA[k] && s && Number(s.siteNo)).map(([k, s]) => ({ key: k, no: Number(s.siteNo) }));
  if(!targets.length) return;
  toast("🌐 公式HPに入れています…（1分ほど）");
  const ok = [], ng = [];
  for(const t of targets){
    try{
      const { data, error } = await sb.functions.invoke("hp-shift-sync", { body: { action: "apply", store: t.key, by: KB.operatorName(), casts: [{ cast: shiftName, no: t.no, label: shiftName, days: [d] }] } });
      let r = data; if(error){ try{ r = await error.context.json(); }catch(e){ r = { ok: false, error: error.message }; } }
      const x = r && r.results && r.results[0];
      if(r && r.ok && x && x.ok) ok.push(t); else ng.push(HP_SHIFT_MEDIA[t.key] + "（" + ((x && x.failedDates && x.failedDates.length) ? "入らなかった" : (r && (r.error || r.message)) || "入れられませんでした") + "）");
    }catch(e){ ng.push(HP_SHIFT_MEDIA[t.key] + "（" + (e.message || e) + "）"); }
  }
  if(ok.length){ try{ await sb.rpc("kb_shift_check", { p_cast: shiftName, p_ds: day, p_media: ok.map(t => HP_SHIFT_MEDIA[t.key]).concat("記録簿"), p_by: KB.operatorName() }); }catch(e){} }
  if(ng.length) alert("🌐 公式HPに入れられなかったお店があります：\n" + ng.join("\n") + "\n\nサクラシフトで入れなおしてください");
  else toast("🌐 公式HPにも入れました（" + ok.map(t => HP_SHIFT_MEDIA[t.key]).join("・") + "）。媒体はシフトアプリで入れてください");
}
// 記録簿の欠勤・時間変更 → サクラシフトにも入れる（SQL 218。理由は入れない）2026/11/6 店長OK
async function pushShiftChange(cid, kind, st, en){
  if(day === KB.PRACTICE_DAY) return;
  const x = tlRows().find(r => r.c && r.c.id === cid);
  if(!x || !x.shift) return;   // シフトがない子（予約だけ）は、シフトアプリにさわらない
  const orig = (shiftCache[day] || {})[x.name] || x.shift;
  const p = { p_cast: x.name, p_ds: day, p_kind: kind, p_by: KB.operatorName() };
  if(kind === "time"){ p.p_start = st != null ? st : Number(orig.start); p.p_end = en != null ? en : Number(orig.end); }
  try{
    const r = q(await sb.rpc("kb_shift_from_kiroku", p)) || {};
    if(r.success){ toast(kind === "absent" ? "🗓 サクラシフトもお休みにしました" : "🗓 サクラシフトの時間も変えました"); hpPushDay(cid, x.name, kind === "absent" ? { date: day, off: true } : { date: day, start: p.p_start, end: p.p_end }); }
    else if(r.error) toast("サクラシフトに入れられませんでした（" + r.error + "）。シフトアプリで直してください");
  }catch(e){ toast("サクラシフトに入れられませんでした：" + (e.message || e) + "（SQL 218 がまだかも）"); }
}
const __renderList2 = renderList;
renderList = function(){ __renderList2(); renderTL(); };

function tlHour(s){ if(!s) return null; const [h, m] = s.split(":").map(Number); let v = h + m / 60; if(v < 8) v += 24; return v; }
function tlLabel(v){ let h = Math.floor(v + 1e-6), m = Math.round((v - h) * 60); if(m === 60){ h++; m = 0; } return (h >= 24 ? "翌" + (h - 24) : h) + ":" + String(m).padStart(2, "0"); }
function bookingsOf(castId){
  return rows.filter(r=>r.cast_id === castId && r.status !== "cancel" && r.status !== "tobi" && r.status !== "flowed" && r.start_at && r.end_at)
    .map(r=>{ const s = hourOf(r.start_at); let e = hourOf(r.end_at); if(e < s) e += 24; return { id: r.id, s, e, r }; });
}
function gapOf(x){ return ((x.c && x.c.interval_min) || 0) / 60; }   // インターバル（時間）
function tlRows(){
  const sh = shiftCache[day] || {};
  const out = [];
  Object.keys(sh).forEach(name=>{
    const c = M.casts.find(x=>x.shift_name === name || x.official_name === name);
    out.push({ name, c, shift: sh[name], bks: c ? bookingsOf(c.id) : [], cd: c ? castDays[c.id] : null });
  });
  // 予約だけあって、シフトにないキャストも出す
  rows.forEach(r=>{
    if(!r.cast_id || r.status === "cancel" || r.status === "tobi" || r.status === "flowed" || out.some(x=>x.c && x.c.id === r.cast_id)) return;
    const c = M.casts.find(x=>x.id === r.cast_id);
    out.push({ name: c ? (c.official_name || c.temp_name) : r.cast_id, c, shift: null, bks: bookingsOf(r.cast_id), cd: castDays[r.cast_id] });
  });
  return out;
}
function castLabel(x){ return x.c ? (x.c.official_name || x.c.temp_name) : x.name; }
function castKey(x){ return x.c ? x.c.id : "n:" + x.name; }
function freeSlots(x){
  if(!x.shift) return [];
  const g = gapOf(x);
  const busy = x.bks.map(b=>[b.s - g, b.e + g]).sort((a, b)=>a[0] - b[0]);
  const out = []; let t = x.shift.start;
  busy.forEach(([s, e])=>{ if(s > t + 0.01) out.push([t, Math.min(s, x.shift.end)]); t = Math.max(t, e); });
  if(t < x.shift.end - 0.01) out.push([t, x.shift.end]);
  return out.filter(([s, e])=>e - s >= 0.5);
}
function sortRows(list){
  const mode = ($("s_sort") && $("s_sort").value) || "start";
  const kana = x => String((x.c && (x.c.kana || x.c.official_name || x.c.temp_name)) || x.name);
  const st = x => x.shift ? x.shift.start : 99, en = x => x.shift ? x.shift.end : 99;
  return list.sort((a, b)=>
    mode === "kana" ? kana(a).localeCompare(kana(b), "ja")
    : mode === "endEarly" ? en(a) - en(b)
    : mode === "endLate" ? en(b) - en(a)
    : st(a) - st(b));
}
function setSort(v){ try{ localStorage.setItem("kirokuSort", v); }catch(e){} renderTL(); }
// キャストで絞る（複数OK）
function toggleSelCast(k){ if(selCasts.has(k)) selCasts.delete(k); else selCasts.add(k); renderTL(); }
function clearSearch(){ $("s_time").value = ""; $("s_free").checked = false; selCasts.clear(); playSel.clear(); renderTL(); }
// ＋ 新規予約：3つのうちどれか1つで探す（ほかの2つの絞りは外す）
var nfCur = "time";
// 当日フィルター：時間・キャスト・希望プレイの3つとも開いておく（どれを使ってもいい）。未来フィルター：🔎 キャストから行ける日を探す
function nfMode(m){
  nfCur = m || "time";
  $("nf_time").style.display = ""; ["nf_cast", "nf_play"].forEach(id => { $(id).style.display = ""; $(id).open = true; });
  const cf = $("castFind"), fb = $("fltFutureBody");
  if(cf && fb && cf.parentNode !== fb){ fb.appendChild(cf); cf.classList.add("infilter"); }
}
document.head.insertAdjacentHTML("beforeend", `<style>
  details.fltbig{background:#fff;border:2px solid #E4D3F5;border-radius:14px;padding:6px 10px;margin-bottom:8px}
  details.fltbig > summary{cursor:pointer;font-weight:900;font-size:15px;color:#6b4fa0;padding:4px 2px}
  details.fltsub{background:#FBF8FF;border:1.5px solid #EBE2F7;border-radius:12px;padding:4px 10px;margin:6px 0}
  details.fltsub > summary{cursor:pointer;font-weight:800;font-size:13.5px;color:#5c4b7a;padding:4px 2px}
  #castFind.infilter{border:none;padding:0;margin:0;background:transparent} #castFind.infilter > summary{display:none}
</style>`);

function renderTL(){
  const grid = $("tlGrid"); if(!grid || !M.casts) return;
  if(!shiftCache[day]){ grid.innerHTML = `<div class="gate">シフトを読み込み中…</div>`; return; }
  const want = tlHour($("s_time").value), mins = Number($("s_min").value) || 90;
  const wantE = want != null ? want + mins / 60 : null;
  const onlyFree = $("s_free").checked;
  const unavailable = x => !!(x.cd && (["お茶", "欠勤", "精算済"].includes(x.cd.status) || x.cd.settled));
  const all = sortRows(tlRows().map(x=>{
    let ok = null;
    if(want != null){
      const g = gapOf(x);
      ok = !!x.shift && !unavailable(x) && want >= x.shift.start - 0.01 && wantE <= x.shift.end + 0.01 && !x.bks.some(b=>b.s - g < wantE && want < b.e + g);
    }
    return Object.assign(x, { ok });
  }));
  // 絞り込みのボタン（その日の全キャスト）
  $("s_castChips").innerHTML = all.map(x=>`<button type="button" class="chip ${selCasts.has(castKey(x)) ? "on" : ""}" onclick="toggleSelCast('${castKey(x)}')">${esc(castLabel(x))}</button>`).join("")
    || `<span class="hist">この日のキャストがいません</span>`;
  $("s_castCount").textContent = selCasts.size ? `（${selCasts.size}人を選択中）` : "";
  let list = all;
  if(selCasts.size) list = list.filter(x=>selCasts.has(castKey(x)));
  list = applyPlayFilter(list);   // 🎯 希望プレイで絞る
  if(onlyFree && want != null) list = list.filter(x=>x.ok);
  if(want != null) list = list.slice().sort((a, b)=>(b.ok ? 1 : 0) - (a.ok ? 1 : 0));   // 探したときは、行ける人を上に
  // 結果の文
  let res = "";
  if(want != null){
    const okNames = list.filter(x=>x.ok).map(castLabel);
    res = `<div class="${okNames.length ? "info" : "warn"}" style="margin-bottom:8px">🕐 ${tlLabel(want)}〜${tlLabel(wantE)}（${mins}分）に行けるキャスト：<b>${okNames.length ? okNames.map(esc).join("、") : "いません"}</b></div>`;
  }
  if(selCasts.size && want == null){
    res += list.map(x=>`<div class="info" style="margin-bottom:6px">🔎 <b>${esc(castLabel(x))}</b> の空き：${freeSlots(x).map(([s, e])=>tlLabel(s) + "〜" + tlLabel(e)).join("、") || "なし"}${gapOf(x) ? `<small>（予約の間 ${x.c.interval_min}分あけ）</small>` : ""}</div>`).join("");
  }
  if(playSel.size && want == null) res += `<div class="${list.length ? "info" : "warn"}" style="margin-bottom:8px">🎯 ${esc($("s_playCount").textContent.replace(/[（）]/g, ""))} がOKのキャスト：<b>${list.length ? list.map(x=>esc(castLabel(x))).join("、") : "いません"}</b>${profById ? "" : "（キャストプロフを読み込み中…）"}${list.length ? "" : playWhyHtml()}</div>`;
  $("tlResult").innerHTML = res;

  // 表：上の時刻と左の名前は固定。30分のマス（出勤時間だけ白）
  const N = (TL_TO - TL_FROM) * 2;
  const p = h => Math.max(0, Math.min(100, (h - TL_FROM) / (TL_TO - TL_FROM) * 100));
  const heads = []; for(let i = 0; i < N; i++){ const h = TL_FROM + i / 2; heads.push(`<div class="hc ${i % 2 ? "half" : ""}">${i % 2 ? "" : (h >= 24 ? "翌" + (h - 24) : h) + "時"}</div>`); }
  const nowJ = new Date(Date.now() + 9 * 3600 * 1000); let nowH = nowJ.getUTCHours() + nowJ.getUTCMinutes() / 60; if(nowH < 8) nowH += 24;
  const isToday = day === KB.bizDateOf();
  grid.innerHTML = `<div class="tlg" style="--n:${N}">
    <div class="hd"><div class="nm corner">キャスト／出勤</div><div class="cells">${heads.join("")}</div></div>`
    + (list.length ? list.map(x=>{
      const st = x.cd && x.cd.status ? `（${esc(x.cd.status)}）` : (x.cd && x.cd.settled ? "（精算済）" : "");
      const shiftTxt = x.shift ? `${tlLabel(x.shift.start)}〜${tlLabel(x.shift.end)}${x.shift.confirmed ? "" : "（未確定）"}` : "シフトなし";
      const cid = x.c ? x.c.id : "", g = gapOf(x);
      const cells = []; for(let i = 0; i < N; i++){
        const h = TL_FROM + i / 2, inShift = x.shift && h >= x.shift.start - 0.01 && h < x.shift.end - 0.01;
        cells.push(`<div class="c ${inShift ? "on" : ""} ${i % 2 ? "half" : ""}" data-t="${tlLabel(h)}" onclick="tlCell('${cid}',${h})"></div>`);
      }
      return `<div class="r ${want != null && x.ok === false ? "dim" : ""}">
        <div class="nm ${x.ok ? "ok" : ""}" onclick="jumpCast('${cid}')">${x.c && typeof KBF !== "undefined" ? KBF.img(x.c, 30) : ""}${esc(castLabel(x))}${st}${tlNowLoc(x)}<small>${shiftTxt}${x.cd && x.cd.standby ? "・" + esc(x.cd.standby) : ""}${g ? "・間" + x.c.interval_min + "分" : ""}${esc(playMarks(x))}</small></div>
        <div class="cells">${cells.join("")}
          ${g ? x.bks.map(b=>`<div class="gap" style="left:${p(b.s - g)}%;width:${p(b.s) - p(b.s - g)}%"></div><div class="gap" style="left:${p(b.e)}%;width:${p(b.e + g) - p(b.e)}%"></div>`).join("") : ""}
          ${x.bks.map(b=>`<div class="bk st ${b.r.status}" style="left:${p(b.s)}%;width:${Math.max(1.5, p(b.e) - p(b.s))}%"
              onclick="event.stopPropagation();openForm(${b.id})" title="${esc(hm(b.r.start_at) + "〜" + hm(b.r.end_at) + " " + (b.r.area || "") + " " + (STATUS[b.r.status] || ""))}">${esc(hm(b.r.start_at))}〜${esc(hm(b.r.end_at))}<br>${esc(b.r.area || "")} ${esc(STATUS[b.r.status] || "")}</div>`).join("")}
          ${want != null && x.shift ? `<div class="want ${x.ok ? "" : "ng"}" style="left:${p(want)}%;width:${p(wantE) - p(want)}%"></div>` : ""}
          ${isToday ? `<div class="now" style="left:${p(nowH)}%"></div>` : ""}
        </div></div>`;
    }).join("") : `<div class="gate">この日のシフト・予約がありません（または絞り込みに合う人がいません）</div>`)
    + `</div>`;
}
// マスを押す → そのキャスト・そのマスの時刻で予約の入力
function tlCell(castId, h){
  if(!castId || !KB.CAN_EDIT) return;
  const hh = Math.floor(h) % 24, mm = Math.round((h - Math.floor(h)) * 60);
  newBookingFor(castId, String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0"));
}
function newBookingFor(castId, time){
  if(castId && (castDays[castId] || {}).full_at) toast("🈵 " + castName(castId) + "さんは満了です（この日の新しい予約は保存できません）");
  openForm(null);
  if(castId && ![...$("f_cast").options].some(o=>o.value === castId)){ $("f_castAll").checked = true; fillCastSel(); }
  $("f_cast").value = castId; onCast();
  if(time) $("f_start").value = time;
  recalc();
}
// キャストの名前を押す（ボードの「キャストの枠」を開く。下で上書き）
function jumpCast(castId){
  if(!castId || !KB.CAN_EDIT) return;
  const want = $("s_time").value;
  if(confirm("このキャストで予約を入れますか？" + (want ? "（" + want + " から）" : ""))) newBookingFor(castId, want);
}
setInterval(()=>{ if(day === KB.bizDateOf() && !$("formBg").classList.contains("show")) renderTL(); }, 60000);

/* ============================================================
   🗺 ボード（エクセルの「待機場所 × 待機中／仕事中／予約スタ・出勤前連絡／今いない」）
   ・その日シフトか予約のあるキャストを札（【まゆ】19-3）で並べる
   ・待機場所はキャストの1日の記録（kb_cast_days.standby）。仕事中は予約のエリアの列に出す
   ・札を押すと「キャストの枠」：その日の予約・空き時間・待機場所／状態の変更・この人で予約・精算へ
   ============================================================ */
const STANDBY = ["池袋", "鶯谷", "五反田", "キャスト宅", "出張・他エリア"];   // 錦糸町は待機場所がないので「出張・他エリア」に入る
const DAY_STATUS = ["", "予約スタート", "出勤前連絡", "お茶", "欠勤"];
const BOARD_ROWS = [["wait", "待機中"], ["work", "仕事中"], ["before", "予約スタ・出勤前連絡"], ["gone", "今いない"]];
function nowHour(){ const j = new Date(Date.now() + 9 * 3600 * 1000); let h = j.getUTCHours() + j.getUTCMinutes() / 60; if(h < 8) h += 24; return h; }
function hShort(v){ const h = Math.floor(v) % 24, m = Math.round((v - Math.floor(v)) * 60); return h + (m ? ":" + String(m).padStart(2, "0") : ""); }
function boardState(x){
  const isToday = day === KB.bizDateOf(), now = nowHour(), cd = x.cd || {};
  if((cd.settled && !["待機中", "仕事中"].includes(cd.status)) || ["お茶", "欠勤", "精算済", "不在"].includes(cd.status)) return "gone";   // 精算して待機中のまま（2026/11/6）は、まだいる
  if(cd.status === "仕事中") return "work";   // 状態のプルダウンで手で選んだもの（2026/11/5）
  const work = x.bks.find(b=>b.r.status === "working" || (isToday && b.s <= now && now < b.e && b.r.status !== "done"));
  if(work) return "work";
  if(cd.status === "待機中") return "wait";
  if(["予約スタート", "出勤前連絡", "出勤前"].includes(cd.status)) return "before";
  if(isToday && x.shift){
    if(now < x.shift.start) return "before";
    if(now >= x.shift.end) return "gone";
  }
  return "wait";
}
function boardCol(x, state){
  if(state === "work"){
    const isToday = day === KB.bizDateOf(), now = nowHour();
    const b = x.bks.find(b=>b.r.status === "working" || (isToday && b.s <= now && now < b.e));
    const a = b && b.r.area || "";
    if(a) return STANDBY.find(s=>a.includes(s)) || "出張・他エリア";
  }
  const sb = (x.cd && x.cd.standby) || "";
  return STANDBY.includes(sb) ? sb : (sb ? "出張・他エリア" : "");
}
const AREA_CLASS = { "池袋": "a-ike", "鶯谷": "a-ugu", "五反田": "a-goh", "錦糸町": "a-kin", "キャスト宅": "a-home", "出張・他エリア": "a-other" };
function renderBoard(){
  const el = $("boardGrid"); if(!el || !M.casts) return;
  if(!shiftCache[day]){ el.innerHTML = `<div class="gate">シフトを読み込み中…</div>`; return; }
  const cols = STANDBY;
  const cell = {}, gone = [];
  tlRows().forEach(x=>{
    const st = boardState(x), col = boardCol(x, st);
    // 待機中・仕事中で場所がわかる人だけ表に。ほか（出勤前・退勤・お茶・欠勤・場所なし）は全部「今いない」
    if((st === "wait" || st === "work") && col) (cell[st + "|" + col] = cell[st + "|" + col] || []).push(x);
    else gone.push(x);
  });
  const chip = (x, st)=>{
    const nm = castLabel(x);
    const sh = x.shift ? `${hShort(x.shift.start)}-${hShort(x.shift.end)}${x.shift.kanzen ? "完" : ""}` : "";
    const cds = (x.cd && x.cd.status) || "";
    const note = cds ? cds : (x.cd && x.cd.settled ? "精算済" : "");
    const now = nowHour(), live = x.bks.filter(b=>!["done", "cancel", "tobi", "flowed"].includes(b.r.status));
    const rel = x.bks.find(b=>b.r.status === "working") || live.filter(b=>b.e > now).sort((a, b)=>a.s - b.s)[0] || live.sort((a, b)=>b.s - a.s)[0];
    // 仕事中は、終わる時刻も出す（12:00〜13:30 接客中）2026/11/5
    const pill = rel ? `<span class="st ${rel.r.status}">${esc(hm(rel.r.start_at))}${st === "work" && rel.r.end_at ? "〜" + esc(hm(rel.r.end_at)) : ""} ${esc(STATUS[rel.r.status] || "")}</span>` : "";
    const seat = x.c && typeof seatOf === "function" ? seatOf(x.c.id) : null;
    const cls = st === "gone" ? "gone inl" + (cds === "お茶" ? " tea" : cds === "欠勤" ? " absent" : "") : st;
    return `<button class="chipc ${cls}" onclick="openCast('${x.c ? x.c.id : ""}','${esc(x.name)}')">【${esc(nm)}】${esc(sh)}${seat ? `<span class="seatbadge">🪑${seat.seat}</span>` : ""}${note ? `<small>（${esc(note)}）</small>` : ""}${pill && st !== "gone" ? `<br>${pill}` : ""}</button>`;
  };
  el.innerHTML = `<table class="board"><tr><th class="corner"></th>${cols.map(c=>`<th class="${AREA_CLASS[c] || ""}">${esc(c)}</th>`).join("")}</tr>`
    + [["wait", "待機中"], ["work", "仕事中"], ["start", "予約スタート"], ["precall", "出勤前連絡"]].map(([k, l])=>`<tr class="${k}"><th>${l}</th>${cols.map(c=>`<td class="${AREA_CLASS[c] || ""}">${(cell[k + "|" + c] || []).map(x=>chip(x, k)).join("")}</td>`).join("")}</tr>`).join("")
    + `<tr class="gone"><th>今いない<br><small style="font-weight:700">⬜出勤前・退勤 🟩お茶 🟥欠勤</small></th><td colspan="${cols.length}">${gone.map(x=>chip(x, "gone")).join("") || `<span class="hist" style="margin:0">なし</span>`}</td></tr>`
    + `</table>`;
}

/* ---------- キャストの枠 ---------- */
let castOpen = null;
function openCast(castId, name){
  const x = tlRows().find(r=>(castId && r.c && r.c.id === castId) || (!castId && r.name === name));
  if(!x) return;
  castOpen = x;
  const nm = castLabel(x), cd = x.cd || {};
  const free = freeSlots(x).map(([s, e])=>tlLabel(s) + "〜" + tlLabel(e)).join("、") || "なし";
  const bks = x.c ? rows.filter(r=>r.cast_id === x.c.id).sort((a, b)=>String(a.start_at).localeCompare(String(b.start_at))) : [];
  $("castTitle").textContent = "💁 " + nm;
  $("castBody").innerHTML = `
    <div class="castmeta">出勤：<b>${x.shift ? tlLabel(x.shift.start) + "〜" + tlLabel(x.shift.end) + (x.shift.confirmed ? "" : "（未確定）") : "シフトなし"}</b>　空き：<b>${esc(free)}</b></div>
    ${x.c && KB.CAN_EDIT ? `<div class="row2" style="margin:10px 0">
      <div class="f"><label>待機場所</label><select id="cd_standby" onchange="saveCastDay()">${[""].concat(STANDBY).map(s=>`<option value="${esc(s)}" ${cd.standby === s ? "selected" : ""}>${s || "（なし）"}</option>`).join("")}</select></div>
      <div class="f"><label>今の状態</label><select id="cd_status" onchange="saveCastDay()">${DAY_STATUS.map(s=>`<option value="${esc(s)}" ${(cd.status || "") === s ? "selected" : ""}>${s || "（ふつう：予約から自動）"}</option>`).join("")}</select></div>
    </div>` : ""}
    <div class="f"><label>この日の予約（押すと開く）</label></div>
    ${bks.length ? `<table class="list">${bks.map(r=>`<tr class="r" onclick="closeCast();openForm(${r.id})">
      <td>${hm(r.start_at)}〜${hm(r.end_at)}</td><td>${esc(storeLabel(r.store_key))}${r.dummy_name ? " 🎭" + esc(r.dummy_name) : ""}</td>
      <td>${esc(r.course)}${/^\d+$/.test(r.course) ? "分" : ""}</td><td>${esc(r.area || "")}</td>
      <td><span class="st ${r.status}">${STATUS[r.status] || r.status}</span></td>
      <td class="money">${showMoney ? yen(r.total) : "••••"}</td></tr>`).join("")}</table>` : `<div class="hist">まだ予約はありません</div>`}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
      ${x.c && KB.CAN_EDIT ? `<button class="btn btn-primary" onclick="closeCast();newBookingFor('${x.c.id}', $('s_time').value)">＋ この人で予約</button>` : ""}
      <button class="btn btn-ghost" onclick="closeCast();showView('tl');$('s_cast').value='${esc(nm)}';renderTL()">⏱ タイムラインで見る</button>
      ${x.c ? `<button class="btn btn-ghost" onclick="callCast('${x.c.id}', this)">📞 電話（LINEがつながらないとき）</button>` : ""}
    </div>`;
  // 💴 精算（この日のこのキャスト）
  $("castBody").insertAdjacentHTML("beforeend", `<div class="f" style="margin-top:16px"><label>💴 精算</label></div><div id="settleBox"></div>`);
  if(x.c) $("settleBox").innerHTML = cardHtml(x.c.id, calcCast(x.c.id));
  else $("settleBox").innerHTML = `<div class="hist">台帳とつながっていないキャストは精算できません</div>`;
  $("castBg").classList.add("show");
}
function closeCast(){ $("castBg").classList.remove("show"); castOpen = null; }
// 電話番号は押したときだけ取りに行く（だれが見たかが台帳に残る）
async function callCast(castId, btn){
  if(!KB.operatorName()){ toast("ポータルで自分の名前を選んでから開いてください"); return; }
  try{
    const tel = q(await sb.rpc("cast_private_phone", { p_cast_id: castId, p_by: KB.operatorName() }));
    if(!tel){ toast("電話番号がまだ入っていません（キャスト台帳の「📞 連絡先」から入れられます）"); return; }
    const num = String(tel).replace(/[^\d+]/g, "");
    btn.outerHTML = `<a class="btn btn-primary" href="tel:${esc(num)}">📞 ${esc(tel)} にかける</a>`;
  }catch(e){ toast("電話番号を見られませんでした：" + (e.message || e)); }
}
async function saveCastDay(){
  const x = castOpen; if(!x || !x.c) return;
  const row = { biz_date: day, cast_id: x.c.id, standby: $("cd_standby").value, status: $("cd_status").value, updated_at: new Date().toISOString(), updated_by: KB.operatorName() };
  try{
    const r = q(await sb.from("kb_cast_days").upsert(row, { onConflict: "biz_date,cast_id" }).select("*").single());
    castDays[x.c.id] = r; x.cd = r;
    toast("保存しました"); renderTL();
  }catch(e){ toast("保存できませんでした：" + (e.message || e)); }
}
// タイムラインのキャスト名を押したときも、キャストの枠を開く
jumpCast = function(castId){ if(castId) openCast(castId, ""); };
KB.closeOnBackdrop($("castBg"), closeCast);

// ボードもいっしょに描きなおす
const __renderTL = renderTL;
renderTL = function(){ __renderTL(); renderBoard(); };

