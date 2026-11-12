/* ============================================================
   📒 記録簿（kiroku.html）の 7/7：10
   ※ kiroku.html の <script src> の順番どおりに読む（順番を変えると動かなくなる。2026/11/10 1つのファイルから分けた）
   ============================================================ */
/* ============================================================
   2026/10/25：⏱ 延長・デートは「注文ごと」に足す（30分→60分→60分 のように、経緯と結果が残る）
   ・ext_orders：[{ kind:"ext"|"date", min, price（その注文で増えたお金）, total_after, end_after, at, by }]
   ・extension_count / date_count（30分の回数）は、注文の合計から作る（計算・集計は今までどおり）
   ・ext_orders の列がまだないとき（SQL 136 の前）は、回数だけ保存する
   ============================================================ */
let extOrders = [];
let HAS_EXT_ORDERS = false;
Promise.resolve(sb.from("kb_reservations").select("ext_orders").limit(1)).then(res=>{ HAS_EXT_ORDERS = !!res && !res.error; }).catch(()=>{});
const EXT_LABEL = { ext: "延長", date: "デート" };
function syncExtCounts(){
  const sum = k => extOrders.filter(o=>o.kind === k).reduce((a, o)=>a + (+o.min || 0), 0);
  $("f_ext").value = Math.round(sum("ext") / 30); $("f_date").value = Math.round(sum("date") / 30);
}
function addExtOrder(){
  if(!KB.CAN_EDIT) return;
  const kind = $("x_kind").value, min = +$("x_min").value || 30;
  recalc();
  const before = last ? last.total : 0;
  extOrders.push({ kind, min, at: new Date().toISOString(), by: KB.operatorName() });
  syncExtCounts(); recalc();
  const o = extOrders[extOrders.length - 1];
  o.price = (last ? last.total : 0) - before; o.total_after = last ? last.total : 0; o.end_after = $("endView").textContent;
  renderExtList();
}
// 💑 デートの中身：先か後か・内容・待ち合わせ場所（先のとき）。キャストに送る文のコースにも出る（2026/11/11 店長）
const DATE_WHEN = { pre: "先", post: "後" };
function dateInfoHtml(o, i){
  const dis = KB.CAN_EDIT ? "" : "disabled";
  return `<div style="flex-basis:100%;display:flex;gap:6px;flex-wrap:wrap;align-items:center;background:#FFF0F5;border-radius:8px;padding:6px 8px">
    <span style="font-weight:800;color:#c2185b">💑 デート</span>
    <select ${dis} style="max-width:150px" onchange="setDateInfo(${i},'when',this.value)"><option value="">先？後？</option>${Object.entries(DATE_WHEN).map(([k, l]) => `<option value="${k}" ${o.when === k ? "selected" : ""}>${l}（プレイの${k === "pre" ? "前" : "後"}）</option>`).join("")}</select>
    <input ${dis} value="${esc(o.memo || "")}" maxlength="80" placeholder="デートの内容（例：食事・カラオケ）" style="flex:1;min-width:180px" onchange="setDateInfo(${i},'memo',this.value)">
    ${o.when === "pre" ? `<input ${dis} value="${esc(o.meet || "")}" maxlength="80" placeholder="📍 待ち合わせ場所（例：池袋駅 東口）" style="flex:1;min-width:180px" onchange="setDateInfo(${i},'meet',this.value)">` : ""}</div>`;
}
function setDateInfo(i, k, v){
  const o = extOrders[i]; if(!o || !KB.CAN_EDIT) return;
  o[k] = String(v || "").trim();
  if(k === "when" && v !== "pre") delete o.meet;
  if(k === "when") renderExtList();
  try{ recalc(); }catch(e){}
}
// キャストに送る文のコース：「＋デート60分（先・待ち合わせ：〇〇・内容：〇〇）」
function dateMsgText(){
  const ds = (typeof extOrders !== "undefined" ? extOrders : []).filter(o => o.kind === "date");
  if(!ds.length || !ds.some(o => o.when || o.memo || o.meet)) return "";
  return ds.map(o => "＋デート" + (+o.min || 0) + "分" + (() => { const p = [o.when ? DATE_WHEN[o.when] || "" : "", o.when === "pre" && o.meet ? "待ち合わせ：" + o.meet : "", o.memo ? "内容：" + o.memo : ""].filter(Boolean); return p.length ? "（" + p.join("・") + "）" : ""; })()).join("");
}
function removeExtOrder(i){
  const o = extOrders[i]; if(!o) return;
  if(!confirm(`${i + 1}つ目の「${EXT_LABEL[o.kind] || o.kind} ${o.min}分」を消しますか？`)) return;
  extOrders.splice(i, 1); syncExtCounts(); recalc();
}
function renderExtList(){
  const el = $("extList"); if(!el) return;
  if(!extOrders.length){ el.innerHTML = `<div style="font-size:12.5px;color:var(--sub)">まだありません（追加の注文が来たら、そのたびに「＋ 足す」）</div>`; return; }
  const sum = k => extOrders.filter(o=>o.kind === k).reduce((a, o)=>a + (+o.min || 0), 0);
  const dt = s => { if(!s) return ""; const d = new Date(new Date(s).getTime() + 9 * 3600000); return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`; };
  el.innerHTML = extOrders.map((o, i)=>`<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13.5px;padding:4px 0;border-top:${i ? "1px dashed #C9D8F2" : "0"}">
      <b>${"①②③④⑤⑥⑦⑧⑨⑩"[i] || (i + 1) + "."} ${esc(EXT_LABEL[o.kind] || o.kind)} ${o.min}分</b>
      ${o.legacy ? `<small style="color:var(--sub)">（前に入れた分）</small>` : `<span>＋${yen(o.price || 0)} → 終了 ${esc(o.end_after || "--:--")}・総額 ${yen(o.total_after || 0)}</span>
      <small style="color:var(--sub)">${KBF.staffTag(o.by)} ${dt(o.at)}</small>`}
      ${KB.CAN_EDIT ? `<button type="button" class="btn btn-ghost btn-sm" style="margin-left:auto;padding:2px 10px" onclick="removeExtOrder(${i})">✖</button>` : ""}
      ${o.kind === "date" ? dateInfoHtml(o, i) : ""}</div>`).join("")
    + `<div style="margin-top:6px;padding:6px 8px;background:#fff;border-radius:8px;font-size:13.5px;font-weight:800">計：${sum("ext") ? "延長 " + sum("ext") + "分" : ""}${sum("ext") && sum("date") ? "・" : ""}${sum("date") ? "デート " + sum("date") + "分" : ""}
      → 終了 ${esc($("endView").textContent)}・<span style="color:#e5638c">総額 ${yen(last ? last.total : 0)}</span>${last && (last.extFee + last.dateFee) ? `（延長・デート分 ${yen(last.extFee + last.dateFee)}${last.pay && last.pay !== "cash" ? "＋カード手数料" : ""}）` : ""}</div>`;
}
const __openFormEX = openForm;
openForm = function(id){
  const r = (id ? rows.find(x=>x.id === id) : null) || {};
  extOrders = Array.isArray(r.ext_orders) && r.ext_orders.length ? r.ext_orders.map(o=>({ ...o }))
    : [ ...(r.extension_count ? [{ kind: "ext", min: r.extension_count * 30, legacy: true }] : []), ...(r.date_count ? [{ kind: "date", min: r.date_count * 30, legacy: true }] : []) ];
  if($("f_day")) $("f_day").value = r.biz_date || day;
  const ret = __openFormEX.apply(this, arguments);
  syncExtCounts(); recalc();
  if(extOrders.length) $("optDetails").open = true;
  return ret;
};
// 予約カードの「延長 ○回」：増えたら注文を足す・減ったら後ろから減らす
qExt = function(id, v){
  quickEdit(id, ()=>{
    const want = Math.max(0, +v || 0) * 30;
    let have = extOrders.filter(o=>o.kind === "ext").reduce((a, o)=>a + (+o.min || 0), 0);
    if(want > have){ extOrders.push({ kind: "ext", min: want - have, at: new Date().toISOString(), by: KB.operatorName() }); }
    while(want < have){
      const i = extOrders.map(o=>o.kind).lastIndexOf("ext"); if(i < 0) break;
      const cut = Math.min(extOrders[i].min, have - want); extOrders[i].min -= cut; have -= cut;
      if(extOrders[i].min <= 0) extOrders.splice(i, 1);
    }
    syncExtCounts();
  }, "延長 → " + (+v || 0) + "回");
};

/* ---------- 前後の予約：時間・場所・あいだが何分か（ブッキング・移動・インターバルの確認） ---------- */
const otherDay = {}, otherDayLoading = {};   // 日付を変えたときの、その日の予約・シフト（フォームを開きなおしたら読みなおす）
const fmtHour = h => { h = Number(h); const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return (hh >= 24 ? "翌" + (hh - 24) : hh) + ":" + String(mm).padStart(2, "0"); };
function renderNeighbors(){
  const el = $("neighborBox"); if(!el) return;
  const c = M.casts.find(x=>x.id === $("f_cast").value);
  const st = $("f_start").value;
  // 日付を変えたとき：タイムライン・前後の予約は「いま開いている日」のものなので、その日を開いて確かめる
  const bd = $("f_day") ? $("f_day").value : day;
  if($("dayMoved")) $("dayMoved").textContent = bd && bd !== day ? "📅 " + Number(bd.slice(5, 7)) + "/" + Number(bd.slice(8)) + " の予約になります（タイムライン・前後の予約もこの日のもの）" : "";
  if(!c){ el.innerHTML = ""; return; }
  // 日付を変えたとき：その日の予約・シフトを読んできて、同じように前後を出す（上のタイムラインは今開いている日のまま）
  let src = rows, shiftNote = "";
  if(bd && bd !== day){
    const od = otherDay[bd];
    if(!od){
      el.innerHTML = `<div class="info" style="font-size:13px">📅 ${Number(bd.slice(5, 7))}/${Number(bd.slice(8))} の予約を読んでいます…</div>`;
      loadOtherDay(bd);
      return;
    }
    src = od.rows;
    const s = od.sh[c.shift_name] || od.sh[c.official_name];
    shiftNote = od.err ? `<div style="font-size:12.5px;color:#B0213F">その日の予約が読めませんでした。その日を開いて確かめてください</div>`
      : `<div style="font-size:12.5px;padding:2px 0">📅 ${Number(bd.slice(5, 7))}/${Number(bd.slice(8))} の出勤：${s ? `<b>${fmtHour(s.start)}〜${fmtHour(s.end)}</b>` : `<b style="color:#B0213F">シフトなし</b>`}</div>`;
  }
  const list = src.filter(r=>r.cast_id === c.id && (!editing || r.id !== editing.id) && !["cancel", "tobi", "flowed"].includes(r.status) && r.start_at && r.end_at)
    .map(r=>{ const s = hourOf(r.start_at); let e = hourOf(r.end_at); if(e < s) e += 24; return { r, s, e }; }).sort((a, b)=>a.s - b.s);
  if(!list.length){ el.innerHTML = shiftNote + `<div class="info" style="font-size:13px">📭 この日、このキャストのほかの予約はありません</div>`; return; }
  const need = c.interval_min || 0;
  let cs = null, ce = null;
  if(st && last){ const [h, m] = st.split(":").map(Number); cs = h + m / 60; if(cs < 8) cs += 24; ce = cs + (minutesOf(last.course) + last.ext * 30 + last.date * 30) / 60; }
  const here = [$("f_area").value, $("f_address").value].filter(Boolean).join(" ");
  const place = r => [r.area, r.address].filter(Boolean).join(" ") || "場所未定";
  const line = (x, tag, gapMin) => {
    const bad = gapMin != null && (gapMin < 0 || gapMin < need);
    return `<div style="padding:4px 0;font-size:13.5px;${bad ? "color:#B0213F;font-weight:800" : ""}">${tag} <b>${hm(x.r.start_at)}〜${hm(x.r.end_at)}</b>　📍${esc(place(x.r))}　<small>${esc(STATUS[x.r.status] || "")}</small>
      ${gapMin == null ? "" : gapMin < 0 ? `<br>　🚫 ${-gapMin}分 重なっています` : `<br>　↔ この予約との間 <b>${gapMin}分</b>${need ? `（このキャストは ${need}分あける）` : ""}${bad ? " ⚠️ 足りません" : ""}`}</div>`;
  };
  let h = "";
  if(cs == null){ h = list.map(x=>line(x, "・", null)).join(""); }
  else {
    const prev = list.filter(x=>x.s < cs).pop(), next = list.find(x=>x.s >= cs);
    const lap = list.filter(x=>x !== prev && x !== next && x.s < ce && cs < x.e);
    if(prev) h += line(prev, "⬅ 前の予約", Math.round((cs - prev.e) * 60));
    h += `<div style="padding:4px 0;font-size:13.5px;background:#FFF7E0;border-radius:8px;padding-left:6px">▶ この予約 <b>${esc(st)}〜${esc($("endView").textContent)}</b>　📍${esc(here || "場所未定")}</div>`;
    if(next) h += line(next, "➡ 次の予約", Math.round((next.s - ce) * 60));
    lap.forEach(x=>{ h += line(x, "🚫 重なり", -1); });
    if(!prev && !next) h += `<div style="font-size:12.5px;color:var(--sub)">前後に予約はありません</div>`;
  }
  el.innerHTML = `<div style="background:#fff;border:1.5px solid var(--line);border-radius:12px;padding:6px 10px;margin:6px 0">
    <div style="font-weight:800;font-size:13px;color:var(--sub)">🕐 前後の予約（${esc(c.official_name || c.temp_name)}${bd && bd !== day ? "・" + Number(bd.slice(5, 7)) + "/" + Number(bd.slice(8)) : ""}）</div>${shiftNote}${h}</div>`;
}
/* ---------- このキャストの AF・逆AF・有料オプションの可否（キャストプロフの ◎○△×） ---------- */
const MARK_STYLE = { "◎": ["◎", "#1f9d6b"], "○": ["○", "#1f9d6b"], "〇": ["○", "#1f9d6b"], "△": ["△", "#c77700"], "×": ["×", "#d9534f"] };
function markHtml(m){ const s = MARK_STYLE[m]; return s ? `<b style="color:${s[1]};margin-left:6px">${s[0]}</b>` : `<small style="color:var(--sub);margin-left:6px">？（プロフに書いていない）</small>`; }
// オプションの名前 → プロフの項目（AF・聖水など）。見つからなければ出さない
function playKeyOf(label){
  const t = String(label || "").replace(/\s/g, "");
  if(/逆\s*AF|逆ＡＦ/.test(t)) return "逆AF";
  const hit = PLAYS.filter(([k, l])=>k !== "逆AF" && (t.includes(k.replace(/_.*/, "")) || t.includes(l.replace(/\s/g, "")))).sort((a, b)=>b[0].length - a[0].length)[0];
  return hit ? hit[0] : "";
}
function castOptMarks(){
  const c = M.casts.find(x=>x.id === $("f_cast").value);
  if(c && !profById){
    if(!profLoading){ profLoading = true; loadProfs().then(()=>{ profLoading = false; castOptMarks(); }).catch(()=>{ profLoading = false; }); }
  }
  const o = c && profById ? profOpts(c) : null;
  // プロフのオプションのメモ（△の条件など）
  const d = c && c.prof_id && profById ? (profById[c.prof_id] || {}) : {};
  const memo = Object.assign({}, d.optMemo || {}, ((d.storeProfiles || {})["サクラムーン"] || {}).optMemo || {});
  const one = k => !c ? "" : !profById ? `<small style="color:var(--sub);margin-left:6px">（読み込み中）</small>` : !o ? `<small style="color:var(--sub);margin-left:6px">（プロフなし）</small>`
    : markHtml(o[k]) + (memo[k] ? `<small style="color:#8a5a00;margin-left:4px">${esc(memo[k])}</small>` : "");
  if($("afMark")) $("afMark").innerHTML = one("AF");
  if($("rafMark")) $("rafMark").innerHTML = one("逆AF");
  document.querySelectorAll("#f_opts .opt").forEach(div=>{
    const lb = div.querySelector(".lbl"); if(!lb) return;
    let sp = lb.querySelector(".cmark");
    const k = playKeyOf(lb.firstChild ? lb.firstChild.textContent : lb.textContent);
    if(!k || !c){ if(sp) sp.remove(); return; }
    if(!sp){ sp = document.createElement("span"); sp.className = "cmark"; lb.insertBefore(sp, lb.childNodes[1] || null); }
    sp.innerHTML = one(k);
  });
}
const __recalcEX = recalc;
recalc = function(){ __recalcEX.apply(this, arguments); renderExtList(); renderNeighbors(); castOptMarks(); };

/* ============================================================
   2026/10/25：受付に出すキャストの注意は「受付ルール」だけにする
   台帳の特記事項・NG・プロフの内勤連絡は、台帳で受付ルールに移していく（notes_moved に「移した」の印）。
   まだ移していないメモだけ、ここに出す（なくならないように）
   ============================================================ */
const NOTE_PROF_STORE = { sakuramoon:"サクラムーン", lana_uguisu:"ラナ鶯谷", lana_kinshi:"ラナ錦糸町", dressgarden:"ドレスガーデン", peachmoon:"ピーチムーン五反田", gyakuanal:"逆AF倶楽部", cutie:"キューティー", eighteen:"18", gokumon:"極門" };
function unmovedNotes(c, profs, storeKey){
  const out = [], seen = new Set();
  const add = (src, label, text) => { text = String(text || "").trim(); if(!text || /^(なし|特になし|とくになし|ない|無し|ありません)[。\s]*$/.test(text) || seen.has(text)) return; seen.add(text);   // 「特になし」などは出さない
    if(!(c.notes_moved || []).some(m => m.src === src && m.text === text)) out.push({ label, text }); };
  add("special", "特記事項", c.special_notes);
  add("ng", "NG", c.ng_notes);
  const d = c.prof_id && profs ? profs[c.prof_id] : null, sk = NOTE_PROF_STORE[storeKey];
  if(d && sk){
    const sp = (d.storeProfiles || {})[sk] || {};
    add("internal:" + sk, "プロフの内勤連絡", sk === "サクラムーン" ? (sp.internal || d.internal) : sp.internal);
  }
  return out;
}
let castNotesSeq = 0;
async function paintCastNotes(){
  const seq = ++castNotesSeq, el = $("castInfo");
  const c = M.casts.find(x => x.id === $("f_cast").value);
  if(!c){ el.innerHTML = ""; ["castHotel", "castArea", "castLink"].forEach(k => { $(k).innerHTML = ""; }); return; }
  let profs = null;
  try{ profs = await loadProfs(); }catch(e){ /* プロフが読めなくても台帳のメモは出す */ }
  if(seq !== castNotesSeq) return;
  const list = unmovedNotes(c, profs, $("f_store").value);
  const rules = rulesOn(c.id).map(r => "・" + esc(r.note) + hearLink(r.hearing_text, r.by_name, r.created_at)).join("<br>");
  // 🏨 このキャストのホテル：プロフのホテルの◎△×（ホテル一覧から）＋ 受付ルールの 🏨 のメモ
  const hp = (c.prof_id && profs && profs[c.prof_id] && profs[c.prof_id].hotelPrefs) || {};
  const hname = id => { const h = (M.hotels || []).find(x => x.hotel_id === id); return h ? h.hotel_name + (h.area ? "(" + h.area + ")" : "") : ""; };
  const hl = (ids) => (ids || []).map(hname).filter(Boolean).map(esc).join("、");
  const hotelLines = [];
  if(hl(hp.ok)) hotelLines.push(`<div>◎ ${hl(hp.ok)}</div>`);
  if((hp.conditional || []).length) hotelLines.push(`<div>△ ${(hp.conditional || []).map(id => { const n = hname(id); return n ? esc(n) + ((hp.memo || {})[id] ? `<small>（${esc(hp.memo[id])}）</small>` : "") : ""; }).filter(Boolean).join("、")}</div>`);   // △はメモ（条件）も 2026/11/12
  if((hp.ng || []).length) hotelLines.push(`<div style="color:#B0213F;font-weight:700">× ${(hp.ng || []).map(id => { const n = hname(id); return n ? esc(n) + ((hp.memo || {})[id] ? `<small>（${esc(hp.memo[id])}）</small>` : "") : ""; }).filter(Boolean).join("、")}</div>`);
  M.castChecks.filter(x => x.cast_id === c.id && String(x.text).startsWith("🏨")).forEach(x => hotelLines.push(`<div style="white-space:pre-wrap">${esc(String(x.text).replace(/^🏨\s*/, ""))}</div>`));
  // 🏨 ホテルは「ホテル・自宅」の下、🚃 最寄り駅は「エリア」の下、📒 台帳はキャストの下（いつも同じ場所に）
  $("castHotel").innerHTML = hotelLines.length ? `<div style="background:#F2F7FF;border:1.5px solid #B9CDF2;border-radius:12px;padding:6px 10px;margin:6px 0;font-size:13px">
      <div style="font-weight:800;color:#2b5aa8;font-size:12.5px">🏨 このキャストのホテル</div>${hotelLines.join("")}</div>` : "";
  $("castArea").innerHTML = c.area_note && String(c.area_note).trim() ? `<div style="background:#F2FBF6;border:1.5px solid #BFE8D2;border-radius:12px;padding:6px 10px;margin:6px 0;font-size:13px">
      <div style="font-weight:800;color:#1a7f4b;font-size:12.5px">🚃 キャストの最寄り駅・各店までの時間</div><div style="white-space:pre-wrap">${esc(c.area_note)}</div></div>` : "";
  $("castLink").innerHTML = c.id ? `<a class="proflink" style="font-size:12px;margin-top:6px" href="index.html?cast=${encodeURIComponent(c.id)}" target="_blank" rel="noopener">📒 ${esc(c.official_name || c.temp_name)}のキャスト台帳を開く</a>` : "";
  el.innerHTML =
    (list.length ? `<div style="background:#FFF9EE;border:1.5px dashed #FFB547;border-radius:12px;padding:6px 10px;margin:6px 0;font-size:13px">
      <div style="font-weight:800;color:#a35a00;font-size:12.5px">📝 まだ受付ルールに移していないメモ（キャスト台帳で整理中）</div>
      ${list.map(n => `<div style="white-space:pre-wrap;margin-top:3px"><small style="color:#9C8B8F">${esc(n.label)}：</small>${esc(n.text)}</div>`).join("")}</div>` : "")
    + (rules ? `<details style="margin-top:4px"><summary style="cursor:pointer;font-size:12.5px;font-weight:800;color:var(--sub)">🧮 このキャストの条件を見る</summary><div class="info">${rules}</div></details>` : "");
}
const __onCastNM = onCast;
onCast = function(){ __onCastNM.apply(this, arguments); paintCastNotes(); };

/* ============================================================
   2026/10/25：バック表にないランク×コースのとき（交通費の提案額と同じ考え方）
   参考：コースの基本額・ほかのランクのバック（バック表）・ほかのキャストが前に入ったときのバック（その日のランクつき）
   受付で入れたバックは、予約を保存したときにバック表へ（次からは自動）
   ============================================================ */
const backRefCache = {};
function rankAt(castId, g, ymd){
  const rows = (M.rankHist || []).filter(r => r.cast_id === castId && r.grp === g && String(r.valid_from || "") <= ymd)
    .sort((a, b) => String(b.valid_from).localeCompare(String(a.valid_from)) || (b.id || 0) - (a.id || 0));
  if(rows.length) return rows[0].rank || "";
  const c = M.casts.find(x => x.id === castId); return (c && c.ranks && c.ranks[g]) || "";
}
async function loadBackRef(bm){
  const ck = bm.g + "|" + bm.key, el = () => $("cbackRef");
  const paint = html => { if(el()) el().innerHTML = html; };
  if(backRefCache[ck]){ paint(backRefCache[ck]); return; }
  const tbl = Object.keys(M.back).filter(k => k.split("|")[1] === bm.key && M.back[k] != null).map(k => ({ rank: k.split("|")[0], amount: M.back[k] }));
  let past = [];
  try{
    const rows = q(await sb.from("kb_reservations").select("biz_date,cast_id,course,base_price,course_back,store_key,visit_kind,free_kind")
      .eq("course", bm.course).gt("course_back", 0).order("biz_date", { ascending: false }).limit(60)) || [];
    past = rows.filter(r => r.course_back > 0 && storeGroup(r.store_key) === bm.g && (r.course + (r.free_kind ? FREE_SUFFIX[r.free_kind] : (r.visit_kind === "honshi" ? "本指" : ""))) === bm.key).slice(0, 8);
  }catch(e){ /* 読めなくてもバック表の参考は出す */ }
  const nm = id => { const c = M.casts.find(x => x.id === id); return c ? (c.official_name || c.temp_name) : "（不明）"; };
  const html = `コースの基本額：<b>${yen(bm.price)}</b><br>`
    + (tbl.length ? `バック表（ほかのランク）：${tbl.map(t => `<b>${esc(t.rank)}</b> ${yen(t.amount)}`).join("・")}<br>` : "バック表には、このコースのほかのランクもありません<br>")
    + (past.length ? `前に入ったとき：<br>${past.map(r => `・${esc(String(r.biz_date).slice(5).replace("-", "/"))} ${esc(nm(r.cast_id))}（${esc(rankAt(r.cast_id, bm.g, r.biz_date) || "ランク不明")}）基本額 ${yen(r.base_price)} → バック <b>${yen(r.course_back)}</b>`).join("<br>")}` : "前に入った記録はありません");
  backRefCache[ck] = html; paint(html);
}
// 🕘 バック表を変えた記録（キャスト台帳の 💴 バック表 と同じ kb_settings.back_edit_log。新しい順・300件まで）2026/11/10
async function backLogAdd(list){
  try{
    const lg = q(await sb.from("kb_settings").select("value").eq("key", "back_edit_log").maybeSingle());
    const old = lg && Array.isArray(lg.value) ? lg.value : [];
    const by = (KB.operatorName && KB.operatorName()) || "", at = new Date().toISOString();
    const v = list.map(x => Object.assign({ at, by }, x)).concat(old).slice(0, 300);
    q(await sb.from("kb_settings").upsert({ key: "back_edit_log", value: v, note: "バック表を変えた記録（キャスト台帳の 💴 バック表）" }));
    return v;
  }catch(e){ return null; }   // 記録が残せなくても、バックは入っている
}
const __saveResBL = saveRes;
saveRes = async function(){
  const bm = last && last.backMissing && Number(cbackOv) > 0 ? { rank: last.backMissing.rank, course: last.backMissing.key, amount: Math.round(Number(cbackOv)) } : null;
  const r = await __saveResBL.apply(this, arguments);
  if(bm && !$("formBg").classList.contains("show")){   // 保存できた（小窓が閉じた）ときだけ、バック表に入れる
    try{
      const wasNew = M.back[bm.rank + "|" + bm.course] == null;
      q(await sb.from("kb_back").upsert(bm, { onConflict: "rank,course", ignoreDuplicates: true }));
      if(wasNew) await backLogAdd([{ rank: bm.rank, course: bm.course, before: null, after: bm.amount, from: "受付" }]);   // 🕘 変えた記録に（2026/11/10）
      if(M.back[bm.rank + "|" + bm.course] == null) M.back[bm.rank + "|" + bm.course] = bm.amount;
      delete backRefCache[last.backMissing.g + "|" + bm.course];
      alert(`バック表に「${bm.rank}・${bm.course}」${yen(bm.amount)} を入れました（次から自動）。\n\n⚠️ 店長に報告してください。\nキャストには「過去にないコース内容だったので、バックを手で入れました。万が一直しが必要な場合は、店長から連絡が来ます」とお伝えください。`);
    }catch(e){ toast("バック表に入れられませんでした：" + (e.message || e)); }
  }
  return r;
};
const __onStoreNM = onStore;
onStore = function(){ const r = __onStoreNM.apply(this, arguments); paintCastNotes(); return r; };

/* ---------- 🗓 出勤日のカレンダー：お客さんが日付を変えたいとき、選んでいるキャストの出勤日に印（押すとその日に） ----------
   ・シフトは loadShifts と同じもの（内勤が受理したシフトだけ）。週ごとに読んで覚えておく */
const CAL_OK = ["input_waiting", "inputting", "confirmed", "change_requested", "change_inputting", "change_confirmed"];
const calCache = {};   // "キャストID|週" → { ymd: { start, end } }
let calYm = "";
async function castShiftDays(c, wks){
  const names = [c.shift_name, c.official_name].filter(Boolean);
  const need = wks.filter(w => !calCache[c.id + "|" + w]);
  if(need.length && names.length){
    const rows = q(await sb.from("shift_weeks").select("wk,cast_name,data").in("wk", need).in("cast_name", names)) || [];
    need.forEach(w => { calCache[c.id + "|" + w] = {}; });
    rows.sort((a, b) => (a.cast_name === c.shift_name ? 0 : 1) - (b.cast_name === c.shift_name ? 0 : 1)).forEach(r => {
      const d = r.data || {}, m = calCache[c.id + "|" + r.wk]; if(!m || !CAL_OK.includes(d.status)) return;
      Object.entries(d.shifts || {}).forEach(([ymd, sh]) => { if(sh && sh.start != null && sh.end != null && !m[ymd]) m[ymd] = { start: Number(sh.start), end: Number(sh.end) }; });
    });
  }
  const out = {}; wks.forEach(w => Object.assign(out, calCache[c.id + "|" + w] || {}));
  return out;
}
function toggleCastCal(){
  const el = $("castCal");
  if(el.style.display !== "none"){ el.style.display = "none"; return; }
  calYm = ($("f_day").value || KB.bizDateOf()).slice(0, 7);
  el.style.display = ""; paintCastCal();
}
function calMove(n){ const [y, m] = calYm.split("-").map(Number), d = new Date(Date.UTC(y, m - 1 + n, 1)); calYm = d.toISOString().slice(0, 7); paintCastCal(); }
function calPick(ymd){ $("f_day").value = ymd; $("f_day").dispatchEvent(new Event("change")); paintCastCal(); }
async function paintCastCal(){
  const el = $("castCal"); if(!el || el.style.display === "none" || !calYm) return;
  const ym = calYm, [y, m] = ym.split("-").map(Number);
  const c = M.casts.find(x => x.id === $("f_cast").value);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate(), lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;   // 月曜はじまり
  const ymdOf = d => `${ym}-${String(d).padStart(2, "0")}`;
  const head = `<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
      <button type="button" class="btn btn-ghost btn-sm" onclick="calMove(-1)">◀</button><b style="flex:1;text-align:center">${y}年${m}月</b>
      <button type="button" class="btn btn-ghost btn-sm" onclick="calMove(1)">▶</button>
      <button type="button" class="btn btn-ghost btn-sm" onclick="$('castCal').style.display='none'">✕</button></div>
    <div style="font-size:12px;color:var(--sub);margin-bottom:6px">${c ? `🌸 ＝ <b>${esc(c.official_name || c.temp_name)}</b> の出勤日（押すとその日にします）` : "キャストを選ぶと、出勤日に印が付きます"}</div>`;
  el.innerHTML = `<div class="ccal">${head}<div style="color:var(--sub);font-size:12px">読んでいます…</div></div>`;
  let sh = {};
  try{ if(c) sh = await castShiftDays(c, [...new Set(Array.from({ length: days }, (_, i) => weekKeyOfYmd(ymdOf(i + 1))))]); }catch(e){}
  if(calYm !== ym || el.style.display === "none") return;   // 読んでいる間に月を変えた・閉じた
  const t = h => { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return (hh >= 24 ? "翌" + (hh - 24) : hh) + (mm ? ":" + String(mm).padStart(2, "0") : ""); };
  const today = KB.bizDateOf(), sel = $("f_day").value;
  let cells = ["月", "火", "水", "木", "金", "土", "日"].map((w, i) => `<div class="ccw ${i === 5 ? "sat" : i === 6 ? "sun" : ""}">${w}</div>`).join("") + "<div></div>".repeat(lead);
  for(let d = 1; d <= days; d++){
    const ymd = ymdOf(d), s = sh[ymd], dow = (lead + d - 1) % 7;
    cells += `<button type="button" class="ccd ${s ? "on" : ""} ${ymd === sel ? "sel" : ""} ${ymd < today ? "past" : ""} ${ymd === today ? "today" : ""} ${dow === 5 ? "sat" : dow === 6 ? "sun" : ""}" onclick="calPick('${ymd}')">
      <span class="n">${d}</span>${s ? `<span class="tm">${t(s.start)}〜${t(s.end)}</span>` : ""}</button>`;
  }
  el.innerHTML = `<div class="ccal">${head}<div class="ccg">${cells}</div></div>`;
}
document.head.insertAdjacentHTML("beforeend", `<style>
  .ccal{border:1.5px solid #FFC2D1;border-radius:14px;padding:10px;margin:6px 0 10px;background:#FFFBFD}
  .ccg{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
  .ccw{text-align:center;font-size:11.5px;font-weight:800;color:var(--sub)} .ccw.sat{color:#1E6FD9} .ccw.sun{color:#E0245E}
  .ccd{border:1.5px solid #F1E3E7;background:#fff;border-radius:10px;min-height:46px;padding:3px 2px;cursor:pointer;font-family:inherit;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:1px}
  .ccd .n{font-size:13.5px;font-weight:800;color:var(--ink)} .ccd.sat .n{color:#1E6FD9} .ccd.sun .n{color:#E0245E}
  .ccd .tm{font-size:10px;font-weight:800;color:#B0124F;line-height:1.2;text-align:center}
  .ccd.on{background:#FFE0EA;border-color:#FF8FAB} .ccd.on .n::after{content:" 🌸";font-size:10px}
  .ccd.past{opacity:.45} .ccd.today{box-shadow:inset 0 0 0 2px #FFB547} .ccd.sel{outline:3px solid #E5638C;outline-offset:-1px}
</style>`);
const __onCastCal = onCast;
onCast = function(){ const r = __onCastCal.apply(this, arguments); paintCastCal(); return r; };
const __openFormCal = openForm;
openForm = function(){
  for(const k in otherDay) delete otherDay[k];   // ほかの日の予約は、開くたびに読みなおす
  const r = __openFormCal.apply(this, arguments); $("castCal").style.display = "none"; return r;
};

/* ---------- ✨ まだ入れていない必須の欄・まだチェックしていない「お客様に案内」をピカピカ光らせる（入れたら止まる） ---------- */
document.head.insertAdjacentHTML("beforeend", `<style>
  @keyframes needblink{0%,100%{box-shadow:0 0 0 0 rgba(255,107,157,0);}50%{box-shadow:0 0 0 4px rgba(255,107,157,.65);}}
  #formBg .need{animation:needblink 1.1s ease-in-out infinite;border-radius:10px;}
</style>`);
function refreshNeed(){
  if(!$("formBg").classList.contains("show")) return;
  document.querySelectorAll("#formBg .need").forEach(el => el.classList.remove("need"));
  const stv = $("f_status").value;
  if(["cancel", "tobi"].includes(stv)) return;   // キャンセル・トビのときは光らせない（流れたは、電話番号と名前だけ光らせる 2026/11/12）
  let list = [];
  try{ list = stv === "flowed" ? tentativeMissing() : missingRequired(true); }catch(e){}
  list.forEach(([, id]) => { const el = $(id); if(el) el.classList.add("need"); });
  document.querySelectorAll('#castChecks .cchk[data-kind="announce"]').forEach(b => { if(!b.checked) b.closest("label").classList.add("need"); });
}
let needTimer = null;
const needSoon = () => { clearTimeout(needTimer); needTimer = setTimeout(refreshNeed, 50); };
["input", "change", "click"].forEach(ev => $("formBg").addEventListener(ev, needSoon));
const __renderCastChecksNeed = renderCastChecks;
renderCastChecks = function(){ const r = __renderCastChecksNeed.apply(this, arguments); needSoon(); return r; };
const __openFormBlink = openForm;
openForm = function(){ const r = __openFormBlink.apply(this, arguments); needSoon(); return r; };

/* ---------- 🎭 18・極門の受付：ダミー指名（このお客さんに行ける子だけ出す）／名前のある子を指名（その子だけ。特例でほかの子も） ----------
   行ける子＝この日出勤していて、このお客さんに18・極門で行ったことがない子（前に同じダミー名で行った子がいれば、その子だけ）
   ほかのお店で会ったことは、名前の横に出す（外さない） */
let dmMode = "dummy";
const DUMMY_STORES = () => M.stores.filter(s => s.dummy).map(s => s.key);
function namedCasts(store){ return M.casts.filter(c => c.status !== "left" && c.stores && c.stores[store] && c.stores[store].name); }
function onNamedPick(quiet){
  const id = $("f_named").value, ex = $("f_namedEx").checked;
  { const c = M.casts.find(x => x.id === id), nm = ownName(c, $("f_store").value);   // 専用の名前を、お客さんに伝える名前に
    if(nm){ if(![...$("f_dummy").options].some(o => o.value === nm)) $("f_dummy").insertAdjacentHTML("beforeend", `<option>${esc(nm)}</option>`); $("f_dummy").value = nm; } }
  $("f_cast").disabled = !ex;   // 特例でないときは、指名された子に決まり
  if(!ex && $("f_cast").value !== id){ $("f_cast").value = id; if(id && $("f_cast").value !== id && $("f_castAll")){ $("f_castAll").checked = true; fillCastSel(); $("f_cast").value = id; } onCast(); }   // 特例でないときは、指名された子（まだ選んでいなければ空）
  if(!quiet) recalc();
}
// このお客さんの18・極門・ほかのお店の履歴（キャストごと）
function custHistByCast(){
  const ds = DUMMY_STORES(), out = {};
  seenNorm().filter(p => p.cast_id && !["cancel", "tobi", "flowed"].includes(p.status)).forEach(p => {
    const o = out[p.cast_id] = out[p.cast_id] || { dummy: [], other: [] };
    (ds.includes(p.store_key) ? o.dummy : o.other).push(p);
  });
  return out;
}
const __renderDummyMatchM = renderDummyMatch;
renderDummyMatch = async function(){
  const el = $("dummyMatch"), store = $("f_store").value;
  if(!isDummyStore(store)){ el.innerHTML = ""; return; }
  if(dmMode === "time"){ el.innerHTML = ""; tmPaint(); return; }   // ⏱ 時間から探す は timeBox に出す
  if(dmMode === "cast"){ crPaint(); tmPaint(); return; }   // 🙋 行けるサクラ在籍の子から
  if(dmMode === "named"){ el.innerHTML = namedCasts(store).length ? "" : `<div class="warn" style="margin-top:4px">台帳で、このお店の名前を持っている子がいません（台帳の「🏪 在籍店舗」でこのお店の名前を入れてください）</div>`; return; }
  await __renderDummyMatchM.apply(this, arguments);
  // 出した一覧を「行ける子／行けない子」に分けなおす
  const name = $("f_dummy").value; if(!name || !el.querySelector("button")) return;
  const hist = custHistByCast(), md = s => s.biz_date.slice(5).replace("-", "/");
  const same = Object.entries(hist).filter(([, h]) => h.dummy.some(p => p.store_key === store && p.dummy_name === name)).map(([id]) => id);
  const rowsEl = [...el.querySelectorAll("button")].map(b => b.closest("div[style*='display:flex']")).filter(Boolean);
  const ng = [];
  rowsEl.forEach(r => {
    const id = ((r.querySelector("button").getAttribute("onclick") || "").match(/value='([^']+)'/) || [])[1]; const h = hist[id];
    const note = [];
    if(h && h.dummy.length) note.push(`18・極門：${h.dummy.map(p => md(p) + " " + storeLabel(p.store_key) + (p.dummy_name ? "🎭" + p.dummy_name : "")).join("、")}`);
    if(h && h.other.length) note.push(`ほかのお店：${h.other.slice(0, 3).map(p => md(p) + " " + storeLabel(p.store_key)).join("、")}`);
    if(note.length) r.querySelector("div").insertAdjacentHTML("beforeend", `<br><small style="color:#7a4a00;font-weight:700">👀 会ったことあり　${esc(note.join("／"))}</small>`);
    if(!dmGoer(M.casts.find(x => x.id === id), store)){ r.remove(); return; }   // 専用の名前の子・ダミーの人は、ダミー在籍指名には出さない
    const owners = ownersOf(store, name), own = ownName(M.casts.find(x => x.id === id), store);
    const ownWhy = owners.length ? (owners.some(o => o.id === id) ? "" : `「${name}」は ${owners.map(o => castName(o.id)).join("・")} 専用`) : own ? `この子は自分の名前「${own}」で行きます` : "";
    if(ownWhy) r.querySelector("div").insertAdjacentHTML("beforeend", `<br><small style="color:#d9534f;font-weight:700">${esc(ownWhy)}</small>`);
    const bad = !!ownWhy || (same.length ? !same.includes(id) : !!(h && h.dummy.length));
    if(bad){ r.style.opacity = ".45"; r.querySelector("button").disabled = true; ng.push(r); }
    else if(same.includes(id)) r.style.boxShadow = "0 0 0 2px #2f9e6e inset";
  });
  const head = same.length && !same.some(dmWorking) ? `<div class="warn" style="margin:6px 0 2px;font-size:13px">🚫 このお客さんは前に「${esc(name)}」で <b>${same.map(castName).map(esc).join("・")}</b> が行っています。<b>この日は出勤していない</b>ので、「${esc(name)}」では受けられません</div>`
    : same.length ? `<div class="info" style="margin:6px 0 2px;font-size:12.5px">🎭 このお客さんは前に「${esc(name)}」で <b>${same.map(castName).map(esc).join("・")}</b> が行っています → この子だけが行けます（キャストは自動でこの子に）</div>`
    : Array.isArray(custPast) ? `<div style="font-size:12px;margin:6px 0 2px;color:#2f9e6e;font-weight:800">✅ 行ける子：18・極門でこのお客さんに行ったことがない子（うすい子は行けません）</div>`
    : `<div class="warn" style="margin:6px 0 2px;font-size:12.5px">先に電話番号で「🔍 調べる」と、このお客さんに行ける子だけにしぼれます</div>`;
  const list = el.querySelector("div[style*='font-weight:800;margin:6px 0 2px']");
  // ⚠️ 同じダミー名で、前に2人以上の子が行っている（お客さんから見ると同じ名前なのに顔がちがう）
  const multi = same.length >= 2 ? `<div class="warn" style="margin:6px 0 2px;font-size:13.5px;font-weight:800;background:#FFF1E0;border:2px solid #F0A040;color:#8a4a00">⚠️ 注意：このお客さんは前に「${esc(name)}」で <b>${same.length}人</b> の子が行っています<br>
      ${same.map(id => { const ds = seenNorm().filter(p => p.cast_id === id && p.store_key === store && p.dummy_name === name && !["cancel", "tobi", "flowed"].includes(p.status)).map(p => (p.biz_date || "").replace(/^\d\d(\d\d)-(\d\d)-(\d\d)$/, "$1/$2/$3")).sort().reverse();
        return `・<b>${esc(castName(id))}</b>（${ds.slice(0, 3).join("、")}${ds.length > 3 ? " ほか" + (ds.length - 3) + "回" : ""}）${dmWorking(id) ? "" : "　…この日はお休み"}`; }).join("<br>")}
      <br><span style="font-weight:600">いちばん最近に行った子にするか、お客さんの記憶に近い子にするか、確かめてから受けてください</span></div>` : "";
  if(list) list.insertAdjacentHTML("beforebegin", multi + head);
  ng.forEach(r => r.parentNode.appendChild(r));   // 行けない子は下へ
  // 前にこのダミー名で行った子が1人なら、その子を自動で選んで本指名（新しい受付で、まだキャストを選んでいないとき）
  const lastOf = id => seenNorm().filter(p => p.cast_id === id && p.store_key === store && p.dummy_name === name).map(p => p.biz_date || "").sort().pop() || "";
  const sameOn = same.filter(id => dmWorking(id)).sort((a, b) => lastOf(b).localeCompare(lastOf(a)));   // 2人以上なら、いちばん最近に行った子から
  if(!editing && sameOn.length && !sameOn.includes($("f_cast").value)){
    const cid = sameOn[0]; $("f_cast").value = cid;
    if($("f_cast").value !== cid && $("f_castAll")){ $("f_castAll").checked = true; fillCastSel(); $("f_cast").value = cid; }
    if($("f_cast").value === cid){ onCast(); setVisit(visitFrom(custSeen || custPast, cid)); toast(`🎭 前に「${name}」で行った ${castName(cid)} にしました（${visit === "honshi" ? "本指名" : "キャストを確かめてください"}）`); }
  }
  const foot = [...el.children].find(x => /％は身長/.test(x.textContent || "")); if(foot) el.appendChild(foot);   // 説明はいちばん下に
};
// マッチ率：高いほど目立たせる（80%〜 緑の太字、60%〜 オレンジ、それより下はうすく）
function pctBadge(v){
  if(v == null || v < 0) return `<b class="pct pct-no">－</b>`;
  return `<b class="pct ${v >= 80 ? "pct-hi" : v >= 60 ? "pct-mid" : "pct-lo"}">${v}%</b>`;
}
document.head.insertAdjacentHTML("beforeend", `<style>
  .pct{min-width:46px;text-align:center;border-radius:8px;padding:3px 4px;font-size:13px;flex:none}
  .pct-hi{background:#2f9e6e;color:#fff;font-size:15px} .pct-mid{background:#FFE9C7;color:#b35c00} .pct-lo{color:#9C8B8F;font-weight:600} .pct-no{color:#C9BDC0}
  .tm-dm.hi{border-color:#2f9e6e;background:#E8F7EF} .tm-dm.hi.on{background:#8a6fd1;border-color:#8a6fd1}
</style>`);
/* 18・極門の名前：個人（または複数人）専用の名前を持っている子は、フリーでも指名でも、その名前で行く。専用の名前は、その子たちだけ */
function ownName(c, store){ return (c && c.stores && c.stores[store] && c.stores[store].name) || ""; }
function ownersOf(store, name){ return namedCasts(store).filter(c => c.stores[store].name === name); }
function dmNamesOf(store){   // このお店のダミー名だけ（キャスト専用の名前は「個人または複数人専用在籍指名」で）
  const own = new Set(namedCasts(store).map(c => c.stores[store].name));
  return M.dummies.filter(d => d.store_key === store && d.active !== false && !own.has(d.name));
}
// ダミーの人（台帳にダミー名で入っている子。サクラのお店の在籍がない）は、実際に行く子の一覧に出さない
function isDummyPerson(c){
  if(!c) return false;
  const nm = [c.official_name, c.temp_name, c.shift_name].filter(Boolean);
  return M.dummies.some(d => nm.includes(d.name)) && !Object.keys(c.stores || {}).some(k => !isDummyStore(k));
}
// 実際に行ける子（ダミーで行く）：ダミーの人と、専用の名前を持つ子（その名前でしか行かない）はのぞく
const dmGoer = (c, store) => !isDummyPerson(c) && !ownName(c, store);
// これまで（記録簿＋台帳エクセル）を、実際の子・ダミー名がわかる形に（エクセルの「あや（茜」「櫻井美咲」も読む）
function seenNorm(){
  const src = Array.isArray(custSeen) ? custSeen : (Array.isArray(custPast) ? custPast : []);
  const byName = n => { n = String(n || "").trim(); if(!n) return null; return M.casts.find(c => [c.official_name, c.temp_name, c.shift_name].filter(Boolean).some(x => x === n || n.endsWith(x) && x.length >= 2)); };
  return src.map(p => {
    if(!p.excel) return p;
    const raw = String(p.cast_raw || ""), m = raw.match(/^(.+?)[（(]([^）)]+)[）)]?$/);
    let cid = p.cast_id, dn = p.dummy_name || "";
    if(isDummyStore(p.store_key)){
      if(m){ dn = dn || m[2].trim(); if(!cid){ const c = byName(m[1]); cid = c && c.id; } }
      else { const own = namedCasts(p.store_key).find(c => raw && (raw === c.stores[p.store_key].name || raw.endsWith(c.stores[p.store_key].name)));
        if(own){ cid = cid || own.id; dn = dn || own.stores[p.store_key].name; }
        else if(M.dummies.some(d => d.store_key === p.store_key && d.name === raw)) dn = dn || raw; }
    }
    if(!cid){ const c = byName(m ? m[1] : raw); cid = c && c.id; }
    return Object.assign({}, p, { cast_id: cid || null, dummy_name: dn });
  });
}
function crCtx(store){
  return { hist: custHistByCast(), past: seenNorm().filter(p => p.store_key === store && p.dummy_name && !["cancel", "tobi", "flowed"].includes(p.status) && (!editing || p.id !== editing.id)) };
}
// この子が出せる名前（近い順）。出せない名前は why に理由
function crList(c, store, sp, ctx){
  const { hist, past } = ctx, own = ownName(c, store);
  const mine = [...new Set(past.filter(p => p.cast_id === c.id).map(p => p.dummy_name))];   // この子がこのお客さんに使った名前
  const metOther = hist[c.id] && hist[c.id].dummy.some(p => p.store_key !== store);   // もう一方のお店（18⇔極門）で会っている
  return dmNamesOf(store).map(d => {
    const usedBy = [...new Set(past.filter(p => p.dummy_name === d.name).map(p => p.cast_id))], owners = ownersOf(store, d.name);
    let why = "";
    if(own && d.name !== own) why = `この子は自分の名前「${own}」で行きます`;
    else if(owners.length && !owners.some(o => o.id === c.id)) why = `${owners.map(o => castName(o.id)).join("・")} 専用の名前です`;
    else if(mine.length && !mine.includes(d.name)) why = `この子は前に「${mine.join("・")}」で行っています`;
    else if(usedBy.length && !usedBy.includes(c.id)) why = `前に ${usedBy.map(castName).join("・")} がこの名前で行っています`;
    else if(!mine.length && metOther) why = `この子は18・極門でこのお客さんに会っています`;
    const s = matchScore(d, sp, c);
    return { d, why, s: s == null ? -1 : s, prev: mine.includes(d.name), own: !!own && d.name === own, owners };
  }).sort((a, b) => (a.why ? 1 : 0) - (b.why ? 1 : 0) || (b.own ? 1 : 0) - (a.own ? 1 : 0) || (b.prev ? 1 : 0) - (a.prev ? 1 : 0) || b.s - a.s);
}
/* 誰行ける？（時間指定）
   ⏱ time：その時間に出せるダミー名 → 選ぶと、その名前で行けるサクラ在籍の子（近い順）
   🙋 cast：その時間に行けるサクラ在籍の子 → 選ぶと、その子が出せるダミー名（近い順。下の dummyMatch に出す） */
let tmPick = "", tmSeq = 0;
async function tmPaint(){
  const out = $("tmOut"), store = $("f_store").value, seq = ++tmSeq, byCast = dmMode === "cast";
  if(!out || !["time", "cast"].includes(dmMode) || !isDummyStore(store)) return;
  const st = $("f_start").value, bd = ($("f_day") && $("f_day").value) || day;
  if(!st){ out.innerHTML = `<div class="hint2" style="font-size:12.5px;color:var(--sub)">何時からかを入れると、${byCast ? "行けるサクラ在籍の子" : "出せるダミー名"}が出ます</div>`; return; }
  const [h, mi] = st.split(":").map(Number); let s = h + mi / 60; if(s < 8) s += 24;
  const len = (minutesOf($("f_course").value) || 60) / 60 + ((Number($("f_ext").value) || 0) + (Number($("f_date").value) || 0)) * 0.5, e = s + len;
  out.innerHTML = `<div class="hint2" style="font-size:12.5px;color:var(--sub)">探しています…</div>`;
  try{
    const [shifts, profs] = await Promise.all([loadShifts(bd), loadProfs()]);
    const rs = bd === day ? rows : (q(await sb.from("kb_reservations").select("id,cast_id,start_at,end_at,status,biz_date").eq("biz_date", bd).eq("deleted", false)) || []);
    if(seq !== tmSeq) return;
    // その時間に行けるか：出勤の時間の中で、ほかの予約（＋予約の間）と重ならない
    const free = c => {
      const sh = shifts[c.shift_name] || shifts[c.official_name]; if(!sh || s < sh.start || e > sh.end) return false;
      const gap = (c.interval_min || 0) / 60;
      return !rs.some(r => r.cast_id === c.id && (!editing || r.id !== editing.id) && !["cancel", "tobi", "flowed"].includes(r.status) && r.start_at && r.end_at &&
        (() => { const a = hourOf(r.start_at); let b = hourOf(r.end_at); if(b < a) b += 24; return a - gap < e && s < b + gap; })());
    };
    const okCasts = M.casts.filter(c => c.status !== "left" && free(c) && dmGoer(c, store));
    const ctx = crCtx(store), hist = ctx.hist, md = p => p.biz_date.slice(5).replace("-", "/");
    const opts = {}; okCasts.forEach(c => { opts[c.id] = crList(c, store, specOfProf(profs[c.prof_id] || {}), ctx); });
    const noLook = Array.isArray(custPast) ? "" : ` <span style="color:#d9534f">※先に電話番号で「🔍 調べる」と、このお客さんの履歴で絞れます</span>`;
    if(byCast){
      const cur = $("f_cast").value;
      const L = okCasts.map(c => { const ok = opts[c.id].filter(x => !x.why); return { c, ok, best: ok[0], why: (opts[c.id].find(x => x.own) || opts[c.id][0] || {}).why || "出せる名前がありません" }; });
      const ok = L.filter(x => x.ok.length).sort((a, b) => (b.best.own ? 1 : 0) - (a.best.own ? 1 : 0) || b.best.s - a.best.s), ng = L.filter(x => !x.ok.length);
      out.innerHTML = `<div style="font-size:12.5px;font-weight:800;margin:2px 0 4px">👤 ${fmtHour(s)}〜${fmtHour(e)} に行けるサクラ在籍の子（${ok.length}人）${noLook}</div>
        <div class="tm-dms">${ok.map(x => `<button type="button" class="tm-dm ${x.c.id === cur ? "on" : ""} ${x.best.own || x.best.s >= 80 ? "hi" : ""}" onclick="tmCast('${x.c.id}')">${esc(castName(x.c.id))}<small>${x.best.own ? "🎭" + esc(x.best.d.name) + "（専用）" : "🎭" + esc(x.best.d.name) + (x.best.s < 0 ? "" : " " + x.best.s + "%" + (x.best.s >= 80 ? "🔥" : ""))}</small></button>`).join("") || `<div class="warn">この時間に行ける子がいません</div>`}</div>
        ${ng.length ? `<details style="margin-top:4px;font-size:12px;color:var(--sub)"><summary>この時間に出勤しているけど行けない子（${ng.length}）</summary>${ng.map(x => `<div>👤${esc(castName(x.c.id))}：${esc(x.why)}</div>`).join("")}</details>` : ""}
        <div class="hint2" style="font-size:12px;color:var(--sub);margin-top:4px">${ok.some(x => x.c.id === cur) ? `↓ 下に「${esc(castName(cur))}」が出せるダミー名が近い順に出ています` : "子を押すと、その子が出せるダミー名が近い順に出ます"}</div>`;
      return;
    }
    const list = dmNamesOf(store).map(d => {
      const same = ctx.past.filter(p => p.dummy_name === d.name), sameIds = [...new Set(same.map(p => p.cast_id))], owners = ownersOf(store, d.name);
      const scOf = {};
      const cands = okCasts.filter(c => { const it = opts[c.id].find(x => x.d.name === d.name); if(it && !it.why){ scOf[c.id] = it.s; return true; } return false; });
      cands.sort((a, b) => scOf[b.id] - scOf[a.id]);
      return { d, sameIds, same, owners, cands, sc: c => scOf[c.id] };
    });
    const ok = list.filter(x => x.cands.length), ng = list.filter(x => !x.cands.length);
    const pick = list.find(x => x.d.name === tmPick && x.cands.length);
    // ⭐ 本物（このお店の名前を持つ子）：その時間に行けるか。押すと、その子に決まり（マッチ率なし）2026/11/7
    const reals = namedCasts(store).filter(c => c.status !== "left"), realOk = reals.filter(free), realNg = reals.filter(c => !free(c));
    const skName = c => (c.stores.sakuramoon && c.stores.sakuramoon.name) || c.official_name || c.temp_name || "";
    const realHtml = `<div style="font-size:12.5px;font-weight:800;margin:10px 0 4px">⭐ ${fmtHour(s)}〜${fmtHour(e)} に行ける本物（${realOk.length}人）</div>
      <div class="tm-dms">${realOk.map(c => { const sh = shifts[c.shift_name] || shifts[c.official_name];
        return `<button type="button" class="tm-dm real" onclick="pickChoose('n:${esc(c.id)}')">⭐ ${esc(c.stores[store].name)}<small>サクラムーン：${esc(skName(c))}${sh ? "・" + fmtHour(sh.start) + "〜" + fmtHour(sh.end) : ""}</small></button>`; }).join("") || `<div class="hint2" style="font-size:12px;color:var(--sub)">この時間に行ける本物はいません</div>`}</div>
      ${realNg.length ? `<details style="margin-top:4px;font-size:12px;color:var(--sub)"><summary>この時間に行けない本物（${realNg.length}）</summary>${realNg.map(c => `<div>⭐${esc(c.stores[store].name)}（${esc(skName(c))}）：出勤していない・予約が重なる</div>`).join("")}</details>` : ""}`;
    out.innerHTML = `<div style="font-size:12.5px;font-weight:800;margin:2px 0 4px">🎭 ${fmtHour(s)}〜${fmtHour(e)} に出せるダミー名（${ok.length}人）${noLook}</div>
      <div class="tm-dms">${ok.map(x => `<button type="button" class="tm-dm ${x.d.name === tmPick ? "on" : ""} ${x.owners.length || x.sc(x.cands[0]) >= 80 ? "hi" : ""}" onclick="tmPick='${esc(x.d.name).replace(/'/g, "")}';tmPaint()">${dmPhoto(x.d, 54)}${esc(x.d.name)}${x.d.nomination_fee != null ? `<small>${yen(x.d.nomination_fee)}</small>` : ""}${x.owners.length ? `<small>専用</small>` : x.sameIds.length ? `<small>前回の子</small>` : `<small>${x.cands.length}人</small>`}</button>`).join("") || `<div class="warn">この時間に出せるダミー名がありません</div>`}</div>
      ${ng.length ? `<details style="margin-top:4px;font-size:12px;color:var(--sub)"><summary>出せないダミー名（${ng.length}）</summary>${ng.map(x => `<div>🎭${esc(x.d.name)}：${x.owners.length ? `${x.owners.map(o => castName(o.id)).map(esc).join("・")} 専用の名前（この時間に行けない／このお客さんに出せない）` : x.sameIds.length ? `前回（${md(x.same[0])}）の ${x.sameIds.map(castName).map(esc).join("・")} がこの時間に行けない` : "この時間に行ける子がいない"}</div>`).join("")}</details>` : ""}
      ${pick ? `<div style="font-size:12.5px;font-weight:800;margin:8px 0 4px">👤 「${esc(pick.d.name)}」で行けるサクラ在籍の子${pick.owners.length ? "（この名前の専用の子）" : pick.sameIds.length ? "（前回この名前で行った子）" : "（近い順）"}</div>
        ${pick.cands.map(c => { const hh = hist[c.id], sh = shifts[c.shift_name] || shifts[c.official_name];
          return `<div class="tm-c">${pctBadge(pick.sc(c))}<div style="flex:1"><b>${esc(castName(c.id))}</b> <small>${fmtHour(sh.start)}〜${fmtHour(sh.end)}</small>
            ${hh && hh.other.length ? `<br><small style="color:#7a4a00;font-weight:700">👀 ほかのお店で会ったことあり：${hh.other.slice(0, 3).map(p => md(p) + " " + esc(storeLabel(p.store_key))).join("、")}</small>` : ""}</div>
            <button type="button" class="btn btn-ghost btn-sm" onclick="tmChoose('${esc(pick.d.name).replace(/'/g, "")}','${c.id}')">この子で行く</button></div>`; }).join("")}` : ok.length ? `<div class="hint2" style="font-size:12px;color:var(--sub);margin-top:4px">ダミー名を押すと、その名前で行ける子とマッチ率が出ます</div>` : ""}` + realHtml;
  }catch(err){ out.innerHTML = `<div class="warn">探せませんでした：${esc(err.message || err)}</div>`; }
}
function tmCast(cid){
  $("f_cast").value = cid; if($("f_cast").value !== cid && $("f_castAll")){ $("f_castAll").checked = true; fillCastSel(); $("f_cast").value = cid; }
  onCast(); recalc(); tmPaint();
}
/* 🙋 サクラ在籍の子から：選んだ子に、近い順のダミー名（このお客さんの履歴・専用の名前で出せない名前はうすく） */
let crSeq = 0;
async function crPaint(){
  const el = $("dummyMatch"), store = $("f_store").value, seq = ++crSeq;
  const c = M.casts.find(x => x.id === $("f_cast").value);
  if(!c){ el.innerHTML = `<div class="hint2" style="font-size:12.5px;color:var(--sub);margin-top:6px">👆 上の一覧（または「キャスト」）で、実際に行く子を選んでください。その子に近い順にダミー名が出ます</div>`; return; }
  el.innerHTML = `<div class="hint2" style="font-size:12.5px;color:var(--sub);margin-top:6px">探しています…</div>`;
  try{
    const profs = await loadProfs(); if(seq !== crSeq) return;
    const ctx = crCtx(store), md = p => p.biz_date.slice(5).replace("-", "/");
    const list = crList(c, store, specOfProf(profs[c.prof_id] || {}), ctx), own = ownName(c, store);
    const hh = ctx.hist[c.id];
    el.innerHTML = `<div style="font-size:12.5px;font-weight:800;margin:6px 0 4px">🎭 ${esc(castName(c.id))} に近いダミー名${Array.isArray(custPast) ? "" : ` <span style="color:#d9534f">※先に電話番号で「🔍 調べる」</span>`}</div>
      ${own ? `<div class="info" style="margin:0 0 4px;font-size:12.5px">👤 ${esc(castName(c.id))} はこのお店の専用の名前「<b>${esc(own)}</b>」を持っています → フリーでも指名でも「${esc(own)}」で行きます</div>` : ""}
      ${hh && hh.other.length ? `<div style="font-size:12px;color:#7a4a00;font-weight:700;margin-bottom:4px">👀 ${esc(castName(c.id))} はほかのお店でこのお客さんに会ったことがあります：${hh.other.slice(0, 3).map(p => md(p) + " " + esc(storeLabel(p.store_key))).join("、")}</div>` : ""}
      ${list.map(x => { const d = x.d, spec = [d.age ? d.age + "歳" : "", d.height ? "T" + d.height : "", d.cup ? d.cup : "", d.psize ? "P" + d.psize : ""].filter(Boolean).join(" ");
        return `<div class="tm-c" style="${x.why ? "opacity:.45" : x.prev || x.own ? "box-shadow:0 0 0 2px #2f9e6e inset" : ""}">${pctBadge(x.s)}${dmPhoto(d, 42)}
          <div style="flex:1"><b>🎭${esc(d.name)}</b>${x.owners.length ? ` <small style="color:#8a6fd1;font-weight:800">専用</small>` : ""} <small>${esc(spec || "データなし")}${d.nomination_fee != null ? "・指名料 " + yen(d.nomination_fee) : ""}${lookText(d.look) ? "・👀" + esc(lookText(d.look)) : ""}</small>
          ${x.own ? `<br><small style="color:#2f9e6e;font-weight:800">この子の専用の名前です</small>` : x.prev ? `<br><small style="color:#2f9e6e;font-weight:800">前回この名前で行っています</small>` : ""}${x.why ? `<br><small style="color:#d9534f;font-weight:700">${esc(x.why)}</small>` : ""}</div>
          ${$("f_dummy").value === d.name ? `<b style="color:#2f9e6e;font-size:12.5px">✅ この名前にしています</b>` : `<button type="button" class="btn btn-ghost btn-sm" ${x.why ? "disabled" : ""} onclick="crChoose('${esc(d.name).replace(/'/g, "")}')">この名前にする</button>`}</div>`; }).join("") || `<div class="warn">このお店のダミー名がありません</div>`}
      <div style="font-size:11px;color:var(--sub)">％は身長・カップ・Pサイズ・AF/逆AF/射精の近さの目安です</div>`;
  }catch(e){ el.innerHTML = `<div class="warn">探せませんでした：${esc(e.message || e)}</div>`; }
}
const __onCastCr = onCast;   // 🙋 のとき、キャストを変えたら出しなおす
onCast = function(){ const r = __onCastCr.apply(this, arguments); if(dmMode === "cast" && isDummyStore($("f_store").value)) crPaint(); return r; };
// 💗 キューティー：バックのランクに「NH」と書いてある子（例：A+NH指名）は、はじめから NH料金（指名料 5,000円）にチェック 2026/11/6 店長
//   新しい予約のときだけ（前の予約は、保存したときのまま）。外したいときはチェックを外せる
function autoNhRate(){
  if(editing || !$("f_nh") || $("f_store").value !== "cutie") return;
  const c = M.casts.find(x => x.id === $("f_cast").value); if(!c) return;
  const rk = String((ranksOn(c) || {}).cutie || "");
  if(/NH/i.test(rk.normalize("NFKC")) && !$("f_nh").checked){ $("f_nh").checked = true; recalc(); toast("💗 CCのランクが NH指名 の子なので、NH料金（指名料 5,000円）にしました"); }
}
{ const __onCastNh = onCast; onCast = function(){ const r = __onCastNh.apply(this, arguments); try{ autoNhRate(); }catch(e){} return r; }; }
{ const __sofNh = storeOnlyFields; storeOnlyFields = function(){ const r = __sofNh.apply(this, arguments); try{ autoNhRate(); }catch(e){} return r; }; }
function crChoose(name){
  if(![...$("f_dummy").options].some(o => o.value === name)) $("f_dummy").insertAdjacentHTML("beforeend", `<option>${esc(name)}</option>`);
  $("f_dummy").value = name; recalc(); toast(`🎭${name} → ${castName($("f_cast").value)} にしました`); crPaint();
}
function tmChoose(name, cid){
  if(![...$("f_dummy").options].some(o => o.value === name)) $("f_dummy").insertAdjacentHTML("beforeend", `<option>${esc(name)}</option>`);
  $("f_dummy").value = name; tmPick = name;
  $("f_cast").value = cid; if($("f_cast").value !== cid && $("f_castAll")){ $("f_castAll").checked = true; fillCastSel(); $("f_cast").value = cid; }
  onCast(); recalc(); toast(`🎭${name} → ${castName(cid)} にしました`);
}
document.head.insertAdjacentHTML("beforeend", `<style>
  .tm-dms{display:flex;flex-wrap:wrap;gap:6px} .tm-dm{border:1.5px solid #D9CCF2;background:#fff;border-radius:12px;padding:5px 10px;font-family:inherit;font-size:14px;font-weight:800;color:#5c3d7a;cursor:pointer;display:flex;flex-direction:column;align-items:center;line-height:1.2}
  .tm-dm small{font-size:10.5px;font-weight:700;color:#9C8B8F} .tm-dm.on{background:#8a6fd1;border-color:#8a6fd1;color:#fff} .tm-dm.on small{color:#f0eaff}
  .tm-dm.real{border-color:#F2C94C;background:#FFFBEA;color:#7a5a00}
  .tm-c{display:flex;gap:6px;align-items:center;background:#fff;border-radius:10px;padding:6px 8px;margin-bottom:4px;font-size:12.5px}
</style>`);
// お客さんを調べたら、行ける子を出しなおす。店を変えたら、ダミー指名から
const __lookupCustomerDm = lookupCustomer;
lookupCustomer = async function(){ const r = await __lookupCustomerDm.apply(this, arguments); try{ renderDummyMatch(); }catch(e){} return r; };
const __renderDummyM = renderDummy;
renderDummy = function(keep){
  const r = __renderDummyM.apply(this, arguments);
  if(!isDummyStore($("f_store").value)){ $("f_cast").disabled = false; return r; }
  if(dmMode === "named") setDmMode("named");   // お店を変えたときは、そのお店の名前で選びなおす
  else if(dmMode === "dummy") dmUiDummy();
  else document.querySelectorAll("#dmModeChips .chip").forEach(b => b.classList.toggle("on", b.dataset.m === "dummy"));
  return r;
};
// ダミー在籍指名の見た目にそろえる（ボタン・中の欄）。2026/11/7 バグ：受付を開きなおすと、ボタンは「ダミー在籍指名」なのに中は「専用在籍指名」の欄のまま
//   → 美沙（専用の名前）を選んでも、ダミー在籍指名として専用の名前が消され「ダミー名を選んでください」で保存できなかった
function dmUiDummy(){
  document.querySelectorAll("#dmModeChips .chip").forEach(b => b.classList.toggle("on", b.dataset.m === "dummy"));
  if($("namedBox")) $("namedBox").style.display = "none";
  if($("timeBox")) $("timeBox").style.display = "none";
  if($("dummyRow")) $("dummyRow").style.display = "";
}
/* 🎭⭐ 18・極門の指名：ダミーと本物を1つの一覧で選ぶ（2026/11/7 店長）
   中の仕組み（f_dummy・f_named・dmMode）はそのまま。この一覧で選ぶと、ダミーなら dmMode=dummy＋f_dummy、本物なら dmMode=named＋f_named にする
   ダミーを選ぶと、行ける子とマッチ率（dummyMatch）。本物は、その子に決まり（マッチ率なし） */
function pickSync(){
  const sel = $("f_pick"), store = $("f_store").value; if(!sel || !isDummyStore(store)) return;
  const dOpts = [...$("f_dummy").options].filter(o => o.value);
  const named = namedCasts(store);
  const sk = c => (c.stores.sakuramoon && c.stores.sakuramoon.name) || c.official_name || c.temp_name || "";
  sel.innerHTML = `<option value="">（ダミー or 本物を選ぶ）</option>`
    + `<optgroup label="🎭 ダミー（マッチ率が出ます）">${dOpts.map(o => `<option value="d:${esc(o.value)}" ${o.disabled ? "disabled" : ""}>🎭 ${esc(o.textContent)}</option>`).join("") || `<option disabled>（ダミー名がありません ⚙️ から足せます）</option>`}</optgroup>`
    + `<optgroup label="⭐ 本物（18・極門の名前／サクラムーンの名前）">${named.map(c => `<option value="n:${esc(c.id)}">⭐ ${esc(c.stores[store].name)}　／　サクラムーン：${esc(sk(c))}</option>`).join("") || `<option disabled>（このお店の名前を持っている子がいません）</option>`}</optgroup>`;
  const cur = dmMode === "named" ? ($("f_named").value ? "n:" + $("f_named").value : "") : ($("f_dummy").value && !ownersOf(store, $("f_dummy").value).length ? "d:" + $("f_dummy").value : "");
  sel.value = [...sel.options].some(o => o.value === cur) ? cur : "";
}
function pickChoose(v){
  if(!v){ return; }
  if(v.startsWith("d:")){
    const name = v.slice(2);
    if(dmMode !== "dummy") setDmMode("dummy");
    if(![...$("f_dummy").options].some(o => o.value === name)) $("f_dummy").insertAdjacentHTML("beforeend", `<option>${esc(name)}</option>`);
    $("f_dummy").value = name; recalc(); renderDummyMatch();
  } else if(v.startsWith("n:")){
    const id = v.slice(2);
    setDmMode("named");
    $("f_named").value = id; onNamedPick();
  }
  pickSync();
}
{ const __rdmPick = renderDummyMatch; renderDummyMatch = async function(){ const r = await __rdmPick.apply(this, arguments); try{ pickSync(); }catch(e){} return r; }; }
{ const __sdmPick = setDmMode; setDmMode = function(){ const r = __sdmPick.apply(this, arguments); try{ pickSync(); }catch(e){} return r; }; }
{ const __onpPick = onNamedPick; onNamedPick = function(){ const r = __onpPick.apply(this, arguments); try{ pickSync(); }catch(e){} return r; }; }
document.head.insertAdjacentHTML("beforeend", `<style>#dummyRow{display:none !important} #namedBox > .f{display:none}
  #f_pick{font-size:15.5px;font-weight:800}</style>`);
const __openFormDm = openForm;
openForm = function(id){ dmMode = "dummy"; tmPick = ""; $("f_namedEx").checked = false; $("f_cast").disabled = false; const r = __openFormDm.apply(this, arguments);
  // 前の予約を開くとき：ダミー名がない・または専用の名前（美沙など）なら「専用在籍指名」で開く
  const ownNamed = editing && editing.dummy_name && ownersOf(editing.store_key || "", editing.dummy_name).length;
  if(editing && isDummyStore(editing.store_key || "") && (!editing.dummy_name || ownNamed)) setDmMode("named"); else dmUiDummy(); dmLock(); return r; };

/* 🎭 18・極門：電話番号で調べたら、前にこのお店で会った名前（記録簿・台帳エクセル）を自動で選ぶ → 本指名
   専用の名前（みさ→美咲 など）なら「個人または複数人専用在籍指名」、ダミー名（茜 など）なら「ダミー在籍指名」＋前に行った実際の子 */
let dmAutoKey = "";
// 自動では選ばない（その子が休み・ちがう子を指名、もあるので）。「前回と同じにする」のボタンを出すだけ
let dmSuggest = null;   // { p, md, owner, off }
function dmAutoPick(){
  const store = $("f_store").value, box = dmSuggestBox();
  if(editing || !isDummyStore(store) || !Array.isArray(custSeen) || !curCustomer){ box.innerHTML = ""; dmSuggest = null; return; }
  const p = seenNorm().filter(x => x.store_key === store && x.dummy_name && !["cancel", "tobi", "flowed"].includes(x.status)).sort((a, b) => String(b.biz_date).localeCompare(String(a.biz_date)))[0];
  if(!p){ box.innerHTML = ""; dmSuggest = null; return; }
  const md = (p.biz_date || "").replace(/^\d\d(\d\d)-(\d\d)-(\d\d)$/, "$1/$2/$3");
  const owners = ownersOf(store, p.dummy_name), owner = owners.find(o => o.id === p.cast_id) || owners[0] || null;
  const cid = owner ? owner.id : p.cast_id, off = cid ? !dmWorking(cid) : false;
  dmSuggest = { p, md, owner, cid, off };
  const now = owner ? (dmMode === "named" && $("f_named").value === owner.id) : ($("f_dummy").value === p.dummy_name);
  box.innerHTML = `<div class="dmsug ${off ? "off" : ""}">🕘 前回（${md}）は「<b>${esc(p.dummy_name)}</b>」${cid ? `（${esc(castName(cid))}）` : ""}${owner ? "＝専用在籍指名" : "＝ダミー在籍指名"}
    ${off ? `<b class="offb">… ${esc(cid ? castName(cid) : "")} はこの日お休み</b>` : now ? `<b style="color:#2f9e6e">✅ 前回と同じにしています</b>` : `<button type="button" class="btn btn-ghost btn-sm" onclick="dmAutoApply()">前回と同じにする</button>`}</div>`;
}
document.head.insertAdjacentHTML("beforeend", `<style>.dmsug{background:#fff;border:1.5px dashed #A98BE6;border-radius:10px;padding:6px 10px;margin-bottom:6px;font-size:13px;display:flex;gap:8px;align-items:center;flex-wrap:wrap} .dmsug.off{border-color:#E5486C;background:#FFF5F7} .dmsug .offb{color:#C62828}</style>`);
function dmSuggestBox(){
  let el = $("dmSuggest");
  if(!el){ el = document.createElement("div"); el.id = "dmSuggest"; const w = $("dummyWrap"), chips = $("dmModeChips"); w.insertBefore(el, chips); }
  return el;
}
function dmAutoApply(){
  const s = dmSuggest, store = $("f_store").value; if(!s || s.off) return;
  const { p, md, owner } = s;
  if(owner){
    setDmMode("named"); $("f_named").value = owner.id; onNamedPick(); setVisit(visitFrom(custSeen, owner.id));
    toast(`👤 前回（${md}）と同じ「${p.dummy_name}」（${castName(owner.id)}）にしました`);
  } else if(dmBlocked(store)[p.dummy_name]){
    toast(`🚫 「${p.dummy_name}」は、${dmBlocked(store)[p.dummy_name]}なので選べません`);
  } else {
    setDmMode("dummy");
    if(![...$("f_dummy").options].some(o => o.value === p.dummy_name)) $("f_dummy").insertAdjacentHTML("beforeend", `<option>${esc(p.dummy_name)}</option>`);
    $("f_dummy").value = p.dummy_name;
    if(p.cast_id){ $("f_cast").value = p.cast_id; if($("f_cast").value !== p.cast_id && $("f_castAll")){ $("f_castAll").checked = true; fillCastSel(); $("f_cast").value = p.cast_id; } onCast(); setVisit(visitFrom(custSeen, p.cast_id)); }
    recalc(); renderDummyMatch();
    toast(`🎭 前回（${md}）と同じ「${p.dummy_name}」${p.cast_id ? "（" + castName(p.cast_id) + "）" : ""}にしました`);
  }
  dmAutoPick();
}
{ const __lcAuto = lookupCustomer; lookupCustomer = async function(){ const r = await __lcAuto.apply(this, arguments); try{ if(isDummyStore($("f_store").value)) renderDummy(); dmAutoPick(); }catch(e){} return r; }; }
{ const __rdAuto = renderDummy; renderDummy = function(){ const r = __rdAuto.apply(this, arguments); setTimeout(() => { try{ dmAutoPick(); }catch(e){} }, 0); return r; }; }
{ const __ofAuto = openForm; openForm = function(){ dmAutoKey = ""; return __ofAuto.apply(this, arguments); }; }/* 🔒 18・極門は、先に電話番号で調べないと選べない（履歴で行ける子が決まるので）。電話番号と売上店舗のほかはロック */
function dmLock(){
  const store = $("f_store").value, need = isDummyStore(store) && digits($("f_phone").value) !== "00" && !(digits($("f_phone").value).length >= 6 && Array.isArray(custPast));   // 00＝電話番号不明は、調べずに進める
  let msg = $("dmLockMsg");
  if(!msg){ msg = document.createElement("div"); msg.id = "dmLockMsg"; $("dummyWrap").insertBefore(msg, $("dummyWrap").firstChild); }
  msg.innerHTML = need ? `<div class="warn" style="font-size:14px;font-weight:800;margin-bottom:6px">📞 先に電話番号を入れて「🔍 調べる」を押してください（このお客さんの履歴で、行ける子が決まります）</div>` : "";
  const keep = el => ["f_phone", "f_store"].includes(el.id) || el.closest(".x") || el.closest("#dummyEdit") || /lookupCustomer|closeForm|toggleDummyEdit/.test(el.getAttribute("onclick") || "");   // ⚙️ 一覧（ダミー名の設定）は電話番号なしでも
  document.querySelectorAll("#formBg input, #formBg select, #formBg textarea, #formBg button").forEach(el => {
    if(keep(el)) return;
    if(need && !el.disabled){ el.disabled = true; el.dataset.dmlock = "1"; }
    else if(!need && el.dataset.dmlock){ el.disabled = false; delete el.dataset.dmlock; }
  });
  $("formBg").classList.toggle("dmlocked", need);
  if(!need && dmMode === "named" && isDummyStore(store)) onNamedPick(true);   // 名前のある子の指名は、キャストを決まりのままに
  if(need && document.activeElement !== $("f_phone") && !digits($("f_phone").value)) $("f_phone").classList.add("need");
}
const __lookupCustomerLock = lookupCustomer;
lookupCustomer = async function(){ const r = await __lookupCustomerLock.apply(this, arguments); dmLock(); return r; };
/* ---------- 📞 副番号（SQL 179）：電話番号で調べたら、副番号と「＋ 番号を追加」を出す。副番号で見つかったら、主の番号も出す ---------- */
function paintSubPhones(){
  const box = $("custInfo"); if(!box) return;
  box.querySelectorAll(".subph").forEach(x => x.remove());
  const c = curCustomer, typed = phoneNorm($("f_phone").value);
  if(!c || !c.id){   // はじめての番号：話してみたら前のお客さんだった → 前の番号でつなぐ
    if(KB.CAN_EDIT && digits(typed).length >= 6) box.insertAdjacentHTML("beforeend", `<div class="subph" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:13px;margin:6px 0 0">
      <span style="color:var(--sub);font-weight:700">前に別の番号で来たお客さんなら →</span>
      <button type="button" class="btn btn-ghost btn-sm" onclick="linkOldPhone()">🔗 前の番号でつなぐ</button></div>`);
    return;
  }
  const ps = c.phones || [];
  box.insertAdjacentHTML("afterbegin", `<div class="subph" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:13px;margin:0 0 6px">
    ${c.phone && typed && typed !== c.phone ? `<span style="font-weight:800;color:#6b4fa0">📞 副番号で見つかりました（主の番号 ${esc(c.phone)}）</span>` : ""}
    <span style="color:var(--sub);font-weight:700">副番号：</span>${ps.length ? ps.map(p => `<span style="border:1.5px solid var(--line);border-radius:99px;padding:1px 9px;font-weight:700">${esc(p)}</span>`).join("") : `<span style="color:var(--sub)">なし</span>`}
    ${KB.CAN_EDIT ? `<button type="button" class="btn btn-ghost btn-sm" onclick="addSubPhoneK()">＋ 番号を追加</button>` : ""}</div>`);
}
// 🔗 入電した番号（はじめて）を、前の番号のお客さんにつなぐ：メイン＝いまの番号、前のメイン番号は副番号へ
async function linkOldPhone(oldArg){
  const now = phoneNorm($("f_phone").value); if(digits(now).length < 6) return;
  const old = phoneNorm(oldArg || prompt("前の電話番号（そのお客さんが前に使っていた番号）") || "");
  if(digits(old).length < 6) return;
  const c = await custByPhone(old, "*");
  if(!c){ toast("その番号のお客さんは見つかりませんでした"); return; }
  if(!("phones" in c)){ toast("先に SQL 179（副番号）を実行してください"); return; }
  if(!confirm(`「${c.name || "名前なし"}」さん（${c.phone || old}）とつなぎます。\n\nメインの番号 → ${now}（今回の番号）\n副番号 → ${[...new Set([...(c.phones || []), c.phone].filter(p => p && p !== now))].join("・")}\n\nよろしいですか？`)) return;
  try{
    const phones = [...new Set([...(c.phones || []), c.phone].filter(p => p && p !== now))];
    q(await sb.from("kb_customers").update({ phone: now, phones, updated_by: KB.operatorName() }).eq("id", c.id));
    toast(`🔗 ${c.name || "お客さん"}さんとつなぎました`);
    await lookupCustomer();   // つないだお客さんの履歴などを出しなおす
  }catch(e){ toast("つなげませんでした：" + (e.message || e)); }
}
async function addSubPhoneK(){
  const c = curCustomer; if(!c || !c.id) return;
  if(!("phones" in c)){ toast("先に SQL 179（副番号）を実行してください"); return; }
  const p = phoneNorm(prompt(`${c.name || "このお客さん"} に足す電話番号（海外は + から）`) || "");
  if(digits(p).length < 6) return;
  if(p === c.phone || (c.phones || []).includes(p)){ toast("この番号は、もう入っています"); return; }
  const ex = await custByPhone(p, "id,name");
  if(ex && ex.id !== c.id && !confirm(`この番号は「${ex.name || "名前なし"}」さんでも使われています。このまま足しますか？`)) return;
  try{
    const list = [...(c.phones || []), p];
    q(await sb.from("kb_customers").update({ phones: list, updated_by: KB.operatorName() }).eq("id", c.id));
    c.phones = list; paintSubPhones(); toast("📞 副番号を足しました");
  }catch(e){ toast("保存できませんでした：" + (e.message || e)); }
}
{ const __lcSub = lookupCustomer; lookupCustomer = async function(){ const r = await __lcSub.apply(this, arguments); try{ nameHintPaint(curCustomer); }catch(e){} try{ paintSubPhones(); }catch(e){} try{ await paintSimilarPhones(); }catch(e){} return r; }; }
// 🤔 見つからなかったとき：下8けたが同じ番号のお客さん（090↔080 の打ちまちがい・番号の変更など）を出す。同じ人なら「🔗 つなぐ」
async function paintSimilarPhones(){
  const now = digits(phoneNorm($("f_phone").value));
  if(!curCustomer && now.length >= 6) await paintPartialPhones(now);
  if(curCustomer && now.length >= 6) await paintDupCustomers(now);
  if(curCustomer || now.length < 10) return;
  const last8 = now.slice(-8);
  const l = (q(await sb.from("kb_customers").select("id,name,phone").like("phone", "%" + last8).neq("phone", now).limit(3)) || []);
  if(!l.length || digits(phoneNorm($("f_phone").value)) !== now) return;
  const mask = p => String(p).slice(0, -8) + "-" + String(p).slice(-8, -4) + "-" + String(p).slice(-4);
  $("custInfo").insertAdjacentHTML("beforeend", `<div class="info" style="background:#FFF8E1;border:2px solid #FFB547;margin-top:6px">🤔 <b>下8けたが同じ番号のお客さんがいます</b>（最初の数字だけちがう：打ちまちがい・番号を変えた など）
    ${l.map(c => `<div style="margin-top:4px">・<b>${esc(c.name || "名前なし")}</b>（${esc(mask(c.phone))}）${KB.CAN_EDIT ? ` <button type="button" class="btn btn-ghost btn-sm" onclick="linkOldPhone('${esc(c.phone)}')">🔗 同じ人ならつなぐ</button>` : ""}</div>`).join("")}
    <div style="font-size:12px;color:var(--sub);margin-top:4px">つなぐと、メインの番号が今回の番号になり、前の番号は副番号に入ります。</div>
    <div class="xlwarn" style="margin-top:6px">📒 同じ人か分からないときは、<b>キャストを行かせる前に、エクセルの台帳も確認してください</b></div></div>`);
}

// ⚠️ 同じ番号のお客さんが2人以上いる → 顧客台帳で1人にまとめて（履歴・NG が分かれて見えないので）2026/11/7
async function paintDupCustomers(now){
  const me = curCustomer; let l = [];
  try{ l = q(await sb.from("kb_customers").select("id,name,ng").or(`phone.eq.${now},phones.cs.{${now}}`).neq("id", me.id).limit(5)) || []; }catch(e){ return; }
  if(!l.length || curCustomer !== me) return;
  $("custInfo").insertAdjacentHTML("afterbegin", `<div class="warn" style="margin-bottom:6px">⚠️ <b>同じ番号のお客さんが、ほかに${l.length}人います</b>（${l.map(c => (c.ng ? "⚠️店NG " : "") + esc(c.name || "名前なし")).join("・")}）<br>
    これまでの利用・NG が分かれて見えません。<b>顧客台帳で1人にまとめてください</b>（残すほうを開いて「🔗 同じ人をこのお客さんにまとめる」）
    <div style="margin-top:4px">${[me].concat(l).map(c => `<a href="customers.html?id=${c.id}" target="_blank" rel="noopener" style="font-weight:800;color:var(--pink-deep);margin-right:10px">👥 ${esc(c.name || "名前なし")}を顧客台帳で開く</a>`).join("")}</div></div>`);
}
// 🔎 完全一致で見つからない → 一部が合う番号のお客さん（エクセルの Ctrl+F と同じ。主の番号・副番号の中に入れた数字がある）2026/11/7
//   例：台帳で2つの番号が1つのマスに書いてあった・番号の一部だけ聞いた など。押すと、その番号で調べる
async function paintPartialPhones(now){
  let l = [];
  try{ l = q(await sb.rpc("kb_customer_search", { p_q: now, p_limit: 10 })) || []; }catch(e){ return; }
  if(curCustomer || digits(phoneNorm($("f_phone").value)) !== now) return;
  l = l.filter(c => digits(c.phone) !== now);
  if(!l.length) return;
  l.sort((a, b) => (b.ng ? 1 : 0) - (a.ng ? 1 : 0));
  const hl = p => { const s = String(p || ""), i = s.indexOf(now); return i < 0 ? esc(s) + "<small>（副番号に一部一致）</small>" : esc(s.slice(0, i)) + "<b style='background:#FFE58A'>" + esc(now) + "</b>" + esc(s.slice(i + now.length)); };
  $("custInfo").insertAdjacentHTML("beforeend", `<div class="info" style="background:#EEF6FF;border:2px solid #7FB2E5;margin-top:6px">🔎 <b>一部が合う番号のお客さん（${l.length >= 10 ? "10人以上" : l.length + "人"}）</b>　押すと、そのお客さんで調べます
    <div class="l4list">${l.map(c => `<button type="button" class="l4" onclick="$('f_phone').value='${esc(c.phone)}';lookupCustomer()">${c.ng ? "⚠️店NG " : ""}<b>${esc(c.name || "名前なし")}</b> <small>${hl(c.phone)}${c.visits ? "・" + c.visits + "回" : ""}</small></button>`).join("")}</div>
    <div class="xlwarn" style="margin-top:6px">📒 同じ人か分からないときは、<b>キャストを行かせる前に、エクセルの台帳も確認してください</b></div></div>`);
}

/* ---------- 🔎 似た名前のお客さん：お客さんの名前を入れたら、ちがう番号で同じ・似た名前のお客さんがいないか探す
   いれば「エクセルの台帳も確認してください」と出す（店NGが番号を変えて電話してくることがあるので） ---------- */
let nameChkTimer = null, nameChkSeq = 0;
function nameKey(s){ return String(s || "").normalize("NFKC").replace(/\s|　|さん$|様$|さま$|くん$/g, "").trim(); }
async function paintSimilarNames(){
  const box = $("nameCheck"); if(!box) return;
  const nm = nameKey($("f_name").value), seq = ++nameChkSeq;
  if(nm.length < 2){ box.innerHTML = ""; return; }
  let l = [];
  try{ l = q(await sb.from("kb_customers").select("id,name,phone,ng").ilike("name", "%" + nm.replace(/[%_]/g, "") + "%").limit(8)) || []; }catch(e){ return; }
  if(seq !== nameChkSeq) return;
  l = l.filter(c => !(curCustomer && c.id === curCustomer.id));
  if(!l.length){ box.innerHTML = ""; return; }
  l.sort((a, b) => (b.ng ? 1 : 0) - (a.ng ? 1 : 0));
  const ngN = l.filter(c => c.ng).length;
  box.innerHTML = `<div class="xlwarn ${ngN ? "ng" : ""}">🔎 <b>似た名前のお客さんが${l.length >= 8 ? "たくさん" : " " + l.length + "人"}います${ngN ? `（うち ⚠️店NG ${ngN}人）` : ""}</b>
    ${l.slice(0, 6).map(c => `<div>・${c.ng ? "⚠️" : ""}<b>${esc(c.name || "")}</b>（番号の下4けた ${esc(String(c.phone || "").slice(-4) || "なし")}）</div>`).join("")}
    <div style="margin-top:4px">同じ人かもしれないときは、<b>キャストを行かせる前に、エクセルの台帳も確認してください</b></div></div>`;
}
(function(){
  const inp = $("f_name"); if(!inp) return;
  inp.parentElement.insertAdjacentHTML("beforeend", `<div id="nameCheck"></div>`);
  inp.addEventListener("input", () => { clearTimeout(nameChkTimer); nameChkTimer = setTimeout(paintSimilarNames, 600); });
  const css = document.createElement("style");
  css.textContent = `.xlwarn{background:#FFF8E1;border:2px solid #FFB547;border-radius:12px;padding:8px 12px;margin-top:6px;font-size:13px;color:#7a4a00;line-height:1.7}
  .xlwarn.ng{background:#FFE8EC;border-color:#E5486C;color:#7a1328}`;
  document.head.appendChild(css);
})();
{ const __ofNameChk = openForm; openForm = function(){ const r = __ofNameChk.apply(this, arguments); Promise.resolve(r).then(() => { const b = $("nameCheck"); if(b) b.innerHTML = ""; }); return r; }; }
// 数字の欄（交通費・割引・延長など）：クリックしたら中身をぜんぶ選ぶ → そのまま打つと入れかわる（「0」のうしろに続いて 08000 にならない）
document.addEventListener("focusin", e => { const t = e.target; if(t && t.matches && t.matches("#formBg input[type=number]")) setTimeout(() => { try{ t.select(); }catch(err){} }, 0); });
// 数字の欄の上でスクロールしても、数字は変えない（欄から外して、画面だけスクロールする）
document.addEventListener("wheel", e => { const t = e.target; if(t && t.matches && t.matches("input[type=number]") && document.activeElement === t) t.blur(); }, { passive: true, capture: true });
const __renderDummyLock = renderDummy;
renderDummy = function(){ const r = __renderDummyLock.apply(this, arguments); dmLock(); return r; };
$("f_phone").addEventListener("input", () => { custPast = null; dmLock(); });   // 番号を打ちなおしたら、調べなおすまでロック

/* ---------- 🔎 キャストから行ける日を探す：今日から○日分の出勤（受理したシフト）と、入っている予約・あいている時間 ---------- */
async function cfPaint(){
  const sel = $("cf_cast"), out = $("cf_out");
  if(!sel.options.length){
    const cs = M.casts.filter(c => c.status !== "left").sort((a, b) => String(a.kana || castName(a.id)).localeCompare(String(b.kana || castName(b.id)), "ja"));
    sel.innerHTML = `<option value="">（キャストを選ぶ）</option>` + cs.map(c => `<option value="${c.id}">${esc(castName(c.id))}</option>`).join("");
  }
  const c = M.casts.find(x => x.id === sel.value);
  if(!c){ out.innerHTML = `<div class="hint2" style="font-size:12.5px;color:var(--sub)">キャストを選ぶと、出勤日と空いている時間が出ます</div>`; return; }
  const n = Number($("cf_days").value) || 14, from = KB.bizDateOf();
  const ymds = Array.from({ length: n }, (_, i) => new Date(Date.parse(from + "T00:00:00Z") + i * 864e5).toISOString().slice(0, 10));
  out.innerHTML = `<div class="hint2" style="font-size:12.5px;color:var(--sub)">読んでいます…</div>`;
  try{
    const sh = await castShiftDays(c, [...new Set(ymds.map(weekKeyOfYmd))]);
    const rs = q(await sb.from("kb_reservations").select("id,biz_date,start_at,end_at,status,area").eq("cast_id", c.id).eq("deleted", false).gte("biz_date", ymds[0]).lte("biz_date", ymds[ymds.length - 1])) || [];
    if(sel.value !== c.id) return;
    const gap = (c.interval_min || 0) / 60, DOWJ = ["日", "月", "火", "水", "木", "金", "土"];
    const rowsH = ymds.map(ymd => {
      const s = sh[ymd], d = new Date(ymd + "T12:00:00Z"), lab = `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${DOWJ[d.getUTCDay()]})`;
      if(!s) return `<div class="cf-row off"><b>${lab}</b><span>お休み</span></div>`;
      const bk = rs.filter(r => r.biz_date === ymd && !["cancel", "tobi", "flowed"].includes(r.status) && r.start_at && r.end_at)
        .map(r => { const a = hourOf(r.start_at); let b = hourOf(r.end_at); if(b < a) b += 24; return { a, b, r }; }).sort((x, y) => x.a - y.a);
      // あいている時間＝出勤時間から、予約（＋このキャストの「予約の間」）を引いたもの。30分より短いすき間は出さない
      const free = []; let t = s.start;
      bk.forEach(x => { if(x.a - gap - t >= 0.5) free.push([t, x.a - gap]); t = Math.max(t, x.b + gap); });
      if(s.end - t >= 0.5) free.push([t, s.end]);
      return `<div class="cf-row"><b>${lab}</b>${KB.CAN_EDIT ? `<button type="button" class="rc-open" onclick="cfBook('${c.id}','${ymd}')">＋ この日で予約</button>` : ""}
        <span class="sh">出勤 ${fmtHour(s.start)}〜${fmtHour(s.end)}</span>
        <span class="fr">${free.length ? "空き " + free.map(([a, b]) => `<b>${fmtHour(a)}〜${fmtHour(b)}</b>`).join("・") : `<b style="color:#d9534f">うまっています</b>`}</span>
        ${bk.length ? `<span class="bk">予約 ${bk.map(x => `${fmtHour(x.a)}〜${fmtHour(x.b)}${x.r.area ? " " + esc(x.r.area) : ""}`).join("・")}</span>` : ""}</div>`;
    }).join("");
    out.innerHTML = `<div class="cf-list">${rowsH}</div><div class="hint2" style="font-size:11.5px;color:var(--sub);margin-top:4px">出勤は、内勤が受理したシフトだけです。${gap ? `このキャストは予約の間を${c.interval_min}分あけます（空きの時間は、それを引いてあります）。` : ""}</div>`;
  }catch(e){ out.innerHTML = `<div class="warn">読めませんでした：${esc(e.message || e)}</div>`; }
}
function cfBook(cid, ymd){
  openForm(null);
  $("f_day").value = ymd; $("f_day").dispatchEvent(new Event("change"));
  $("f_cast").value = cid; if($("f_cast").value !== cid && $("f_castAll")){ $("f_castAll").checked = true; fillCastSel(); $("f_cast").value = cid; }
  onCast();
}
document.head.insertAdjacentHTML("beforeend", `<style>
  .cf-list{display:flex;flex-direction:column;gap:4px}
  .cf-row{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:center;background:#fff;border:1.5px solid #F1E3E7;border-radius:10px;padding:6px 10px;font-size:13.5px}
  .cf-row.off{background:#FAF7F8;color:#B9A9AE;padding:4px 10px;font-size:12.5px} .cf-row > b{min-width:62px}
  .cf-row .sh{color:#7a6468} .cf-row .fr b{color:#1f9d6b} .cf-row .bk{color:#9C8B8F;font-size:12.5px} .cf-row .rc-open{padding:3px 10px;font-size:12.5px}
</style>`);

/* ---------- 📱 スマホで入れた予約は「仮入力」：PCで開いたら、キャストに送ったかを確かめるチェックが必須。保存すると取り入れる ---------- */
function IS_PHONE(){ return matchMedia("(max-width:640px)").matches || /iPhone|Android.+Mobile/i.test(navigator.userAgent); }
function draftBoxPaint(){
  let box = $("f_draftBox");
  if(!box){ box = document.createElement("div"); box.id = "f_draftBox"; const d = $("formBg").querySelector(".drawer"); d.insertBefore(box, d.querySelector("h2") ? d.querySelector("h2").nextSibling : d.children[1]); }
  if(!(editing && editing.phone_draft)){ box.innerHTML = ""; box.style.display = "none"; return; }
  const who = [editing.phone_draft_by, editing.phone_draft_at ? new Date(editing.phone_draft_at).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""].filter(Boolean).join(" ");
  box.style.display = "";
  box.innerHTML = IS_PHONE()
    ? `<div class="draftbox">📱 スマホの仮入力です（${esc(who)}）。事務所のPCで確かめて取り入れます。</div>`
    : `<div class="draftbox">📱 <b>スマホで仮入力された予約です</b>（${esc(who)}）。内容を確かめてから保存すると取り入れます。
        <label style="display:flex;gap:8px;align-items:center;margin-top:6px;font-size:14.5px;cursor:pointer"><input type="checkbox" id="f_draftOk" style="width:auto;transform:scale(1.3)"> ✅ キャストに予約を送ったか、もう一度確かめた<span class="req">必須</span></label></div>`;
}
function draftAlertPaint(){
  let el = $("draftAlert");
  if(!el){ el = document.createElement("div"); el.id = "draftAlert"; $("callAlerts").parentNode.insertBefore(el, $("callAlerts")); }
  const ds = IS_PHONE() ? [] : rows.filter(r => r.phone_draft);
  el.innerHTML = ds.length ? `<div class="draftbox" style="margin:8px 0">📱 <b>スマホの仮入力が ${ds.length}件あります。</b>開いて、内容とキャストに送ったかを確かめて保存してください。
    <div style="margin-top:4px">${ds.map(r => `<button type="button" class="rc-open" style="margin:2px" onclick="openForm(${r.id})">${hm(r.start_at)} ${esc(castName(r.cast_id))}${r.dummy_name ? "（🎭" + esc(r.dummy_name) + "）" : ""}</button>`).join("")}</div></div>` : "";
}
const __openFormDraft = openForm;
openForm = function(){ const r = __openFormDraft.apply(this, arguments); draftBoxPaint(); return r; };
const __loadDayDraft = loadDay;
loadDay = async function(){ const r = await __loadDayDraft.apply(this, arguments); draftAlertPaint(); return r; };
const __renderListDraft = renderList;   // 最初の読みこみ（この上書きより前に始まる）や、一覧を描きなおしたときにも
renderList = function(){ const r = __renderListDraft.apply(this, arguments); try{ draftAlertPaint(); }catch(e){} return r; };
const __saveResDraft = saveRes;
saveRes = async function(){ const wasOpen = $("formBg").classList.contains("show"); const r = await __saveResDraft.apply(this, arguments);
  return r; };   // スマホでもそのまま本予約（仮入力のお知らせは出さない）

/* ---------- 📱 スマホ（外出中・車の中で少しだけ使う）：上に「よく使う4つ」・はみ出しを直す・長い説明はしまう ---------- */
function spGo(w){
  if(w === "add"){ openForm(null); return; }
  const top = el => { if(!el) return; const y = el.getBoundingClientRect().top + window.scrollY - (($("spBar") && $("spBar").offsetHeight) || 0) - 6; window.scrollTo({ top: y, behavior: "smooth" }); };
  if(w === "list"){ showView("list"); top($("tabs")); }
  if(w === "tl"){ showView("tl"); top($("tabs")); }
}
document.head.insertAdjacentHTML("beforeend", `<style>
  .spbar{display:none}
  .custhist{background:#fff;border:1.5px solid #E8D8F0;border-radius:12px;padding:8px 10px;margin-top:8px;font-size:14px;color:var(--ink)}
  .custhist .ch-head{font-weight:800;font-size:13.5px;color:#5c3d7a;margin-bottom:4px}
  .custhist .ch-row{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center;padding:5px 2px;border-top:1px dashed #EEE3F3}
  .custhist .ch-row .d{font-weight:800;min-width:42px} .custhist .ch-row .s{color:#7a6468;font-size:13px} .custhist .ch-row .k{color:#7a6468;font-size:13px}
  .custhist .ch-row .c b{font-size:15px} .custhist .ch-row .dn{background:#EFE6FA;color:#5c3d7a;border-radius:99px;padding:1px 8px;font-weight:800;font-size:13px}
  .custhist .ch-row.dm{background:#FAF6FE} .custhist .ch-row.chx{opacity:.55} .custhist .ch-row .xx{color:#d9534f;font-weight:800;font-size:12.5px} .custhist .ch-row .frv{background:#E3F1FF;color:#2f5f8f;border-radius:99px;padding:0 8px;font-size:12px;font-weight:900;margin-left:4px} #finalSummary .splitl{font-size:17px;margin-top:4px} #finalSummary .splitl small{font-size:12px;color:var(--sub);margin-left:6px}
  .custhist .ch-foot{border-top:1px solid #EEE3F3;margin-top:4px;padding-top:5px;font-size:13px;color:#7a6468} .custhist .ch-foot b{color:var(--ink)}
  #dmModeChips .chip.on{background:#8a6fd1;border-color:#8a6fd1;color:#fff}
  #dmModeChips .dmgrp{background:#fff;border-radius:10px;padding:5px 8px;margin-bottom:5px} #dmModeChips .dmgl{font-size:12px;font-weight:800;color:#5c3d7a;margin-bottom:3px}
  /* 🔒 18・極門で電話番号を調べるまでのロック：ロック中の欄はグレーに（電話番号と売上店舗は目立たせる） */
  #formBg.dmlocked [data-dmlock]{background:#E9E6E8 !important;color:#AFA6AA !important;border-color:#DDD6D9 !important;opacity:.7;cursor:not-allowed;box-shadow:none !important}
  #formBg.dmlocked .f:has([data-dmlock]) > label{color:#C2B9BD}
  #formBg.dmlocked #f_phone,#formBg.dmlocked #f_store{outline:3px solid #FFB547;outline-offset:1px;background:#FFFBEF}
  .draftbox{background:#FFF8E1;border:2px solid #FFB547;border-radius:12px;padding:8px 12px;margin:0 0 10px;font-size:13.5px;color:#7a4a00;line-height:1.6}
  .rc-draft{background:#FFB547;color:#fff;border-radius:99px;padding:1px 8px;font-size:12px;font-weight:800;white-space:nowrap}
  @media (max-width:640px){
    .spbar{display:flex;position:sticky;top:0;z-index:60;gap:4px;background:var(--bg);padding:6px 0;margin:-4px 0 6px;box-shadow:0 6px 10px -8px rgba(0,0,0,.25)}
    .spbar button,.spbar a{flex:1;display:flex;flex-direction:column;align-items:center;gap:1px;border:1.5px solid #FFC2D1;background:#fff;border-radius:12px;padding:6px 2px;font-family:inherit;font-size:17px;color:#E5638C;text-decoration:none;cursor:pointer}
    .spbar button:first-child{background:linear-gradient(135deg,#FF8FAB,#FF6B9D);color:#fff;border-color:transparent}
    .spbar b{font-size:11px;font-weight:800}
    header.kbh{gap:6px;margin-bottom:6px} header.kbh h1{font-size:16px} header.kbh .navinhead{min-width:0;flex-basis:100%}
    body:has(.modal-bg.show) .spbar{display:none}
    header.kbh .navinhead .kbnav{flex-wrap:nowrap;overflow-x:auto;gap:4px;padding-bottom:2px} header.kbh .navinhead .kbnav a{padding:5px 10px;font-size:12px;white-space:nowrap}
    .stickybar{position:static;box-shadow:none}
    #viewBoard{display:none}   /* 今どこに誰がはスマホでは出さない（外に出る前に、状態を完璧にしておく前提） */
    details.fold > summary small{display:none}
    #formBg .row2 > .f > div{flex-wrap:wrap}
    body:has(#formBg.show) a[title="ポータルに戻る"]{display:none !important}
  }
</style>`);

/* ---------- ⏰ この状態の時刻（SQL 182）：確認電話を1.5時間前に・ホテル入室待ちは何時 など
   ・予約カードでは状態のすぐ右に、黄色い「⏰ 時刻」でくっつけて出す（開始時刻とまちがえないように）
   ・確認電話・確認メールの赤い帯は、時刻が入っていればその時刻で出す。ほかの状態も、時刻をすぎたら帯に出す
   ・状態を変えたら、時刻は消える ---------- */
const ST_DONE = ["done", "cancel", "tobi", "flowed", "working"];
function statusAtIso(bd, st, v){
  if(!v) return null;
  let [h, m] = v.split(":").map(Number);
  const base = /^pre_/.test(st) ? addDays(bd, -1) : bd;   // 前日確認は前日の時刻
  const late = h >= 24; if(late) h -= 24;   // 「25:00」などの書き方も、次の日の1時として読む
  const d = new Date(`${base}T${String(h).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}:00+09:00`);
  if(late || h < 6) d.setTime(d.getTime() + 24 * 3600 * 1000);   // 朝6時より前は次の日（営業日の考え方）
  return d.toISOString();
}
const sameTime = (a, b) => (a ? Date.parse(a) : 0) === (b ? Date.parse(b) : 0);
function formStatusAtPatch(){
  const v = $("f_status_at") ? $("f_status_at").value : "";
  const hasCol = rows.some(x => "status_at" in x) || (editing && "status_at" in editing);
  if(!hasCol && !v) return {};
  const iso = statusAtIso(($("f_day") && $("f_day").value) || day, $("f_status").value, v);
  const prev = editing ? editing.status_at : null;
  return Object.assign({ status_at: iso }, sameTime(iso, prev) ? {} : { alert_hour_at: null, alert_pre_at: null });   // 時刻を変えたら、通知はその時刻で出しなおす
}
function statusAtChip(r, ed){
  if(!("status_at" in r) || ST_DONE.includes(r.status)) return "";
  if(!r.status_at) return ed ? `<button type="button" class="statadd" title="この状態の時刻を入れる（例：確認電話を1.5時間前に）" onclick="statAdd(this,${r.id})">⏰</button>` : "";
  const over = Date.now() >= Date.parse(r.status_at);
  return ed ? `<label class="statchip ${over ? "over" : ""}" title="この状態の時刻（空にすると消える）">⏰<input type="time" step="300" value="${hmIn(r.status_at)}" onchange="qStatusAt(${r.id},this.value)"></label>`
    : `<span class="statchip ${over ? "over" : ""}">⏰ ${hm(r.status_at)}</span>`;
}
function statAdd(btn, id){
  btn.outerHTML = `<label class="statchip">⏰<input type="time" step="300" id="statNew${id}" onchange="qStatusAt(${id},this.value)" onblur="if(!this.value)renderList()"></label>`;
  const i = $("statNew" + id); if(i){ i.focus(); try{ i.showPicker(); }catch(e){} }
}
async function qStatusAt(id, v){
  const r = rows.find(x => x.id === id); if(!r || !KB.CAN_EDIT) return;
  const iso = statusAtIso(r.biz_date, r.status, v);
  if(sameTime(iso, r.status_at)) return;
  if(await pushLog(id, `⏰ 「${STATUS[r.status] || r.status}」の時刻 → ${v || "（なし）"}`, { status_at: iso, alert_hour_at: null, alert_pre_at: null })){ toast("時刻を保存しました"); renderList(); loadCallAlerts(); }
}
(function(){
  const css = document.createElement("style");
  css.textContent = `.stbox{display:inline-flex;align-items:center;gap:4px;padding-right:12px;margin-right:2px;border-right:2px dotted #E8D3DA}
  .rc-lbl{font-size:11px;font-weight:800;color:var(--sub);margin-right:-4px}
  .statchip{display:inline-flex;align-items:center;gap:2px;height:32px;box-sizing:border-box;background:#FFF1C9;border:1.5px solid #F2B705;color:#7a5600;border-radius:8px;padding:0 4px 0 7px;font-weight:800;font-size:13px;white-space:nowrap}
  .statchip input{border:none;background:transparent;font-family:inherit;font-weight:800;font-size:13px;color:#7a5600;padding:0;width:78px}
  .statchip.over{background:#FFE1E6;border-color:#E5486C;color:#B0213F;animation:livePulse 1.6s ease-in-out infinite} .statchip.over input{color:#B0213F}
  .statadd{height:32px;width:32px;border:1.5px dashed #E6CF8A;background:#fff;border-radius:8px;cursor:pointer;font-size:14px;opacity:.55;padding:0} .statadd:hover{opacity:1;background:#FFF8E1}`;
  document.head.appendChild(css);
  const __openFormSA = openForm;
  openForm = function(id){ const r = __openFormSA.apply(this, arguments); Promise.resolve(r).then(() => { if($("f_status_at")) $("f_status_at").value = editing && editing.status_at ? hm(editing.status_at) : ""; if($("f_castnote")) $("f_castnote").value = (editing && editing.cast_note) || ""; if(editing && editing.cast_note){ try{ recalc(); }catch(e){} } }); return r; };
})();

/* ---------- 内勤の日払いを読んだら・直したら、「今日の店落ち」も描きなおす（日払いを引くので） ---------- */
{ const __paintSPToday = paintStaffPay; paintStaffPay = function(){ const r = __paintSPToday.apply(this, arguments); try{ renderToday(); }catch(e){} try{ renderOwner(); }catch(e){} return r; }; }

/* ---------- 🗺 地図のURLを開く（入っていなければ、登録されているホテルの地図） ---------- */
function openMapUrl(){
  const m = $("f_map") ? $("f_map").value.trim() : "";
  const u = /^https?:\/\//i.test(m) ? m : (typeof hotelMapUrl === "function" ? hotelMapUrl() : "");
  if(!u){ toast("地図のURLが入っていません"); return; }
  window.open(u, "_blank", "noopener");
}

/* ---------- 👥 いっしょに使う（kb_live.js）：だれかが保存したら読みなおす・だれがどの予約を入力中か ---------- */
let liveTimer = null;
function liveBusy(){
  if(document.querySelector(".modal-bg.show") || document.getElementById("ccalBg")) return true;   // 予約・勤怠などの窓を開いている間は待つ
  const a = document.activeElement;   // 一覧の欄（振込の額など）に打っている間も待つ
  return !!(a && a !== document.body && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
}
async function liveReload(){
  clearTimeout(liveTimer);
  if(liveBusy()){ liveTimer = setTimeout(liveReload, 3000); return; }
  try{ await loadDay(); }catch(e){}
}
function livePaint(){
  const list = window.KBLive ? KBLive.others().filter(p => p.rid) : [];
  document.querySelectorAll(".rc-live").forEach(e => e.remove());
  list.forEach(p => {
    const btn = document.querySelector("#rc-" + p.rid + " .rc-open");
    if(btn) btn.insertAdjacentHTML("beforebegin", `<span class="rc-live">✏️ ${esc(p.by)}さん入力中</span>`);
  });
  // 何を入力中か：相手の画面の「店・時間・キャスト・お客さんの名前」（p.info）があればそれを出す
  const label = p => { const head = p.rid === "new" ? "新しい予約" : (r => r ? hm(r.start_at) + " " + castName(r.cast_id) : "予約")(rows.find(x => String(x.id) === p.rid)); return p.info ? head + "：" + p.info : head; };
  let bar = $("liveBar");
  if(!bar){ bar = document.createElement("div"); bar.id = "liveBar"; document.body.appendChild(bar); }
  // 押すと、その予約のカードへとぶ（新しい予約は、まだカードがないので中身だけ）
  bar.innerHTML = list.length ? "✏️ 入力中：" + list.map(p => `<span class="lb-item" ${p.rid !== "new" ? `onclick="jumpToRes(${Number(p.rid)},day)" title="押すとこの予約へとぶ"` : ""}><b>${esc(p.by)}</b>（${esc(label(p))}）</span>`).join("、") : "";
  bar.style.display = list.length ? "" : "none";
  const w = $("liveWarn");
  if(w){
    const same = editing ? list.filter(p => p.rid === String(editing.id)) : [];
    w.innerHTML = same.length ? `⚠️ <b>${same.map(p => esc(p.by)).join("・")}</b>さんも、この予約を開いています。同時に保存すると、あとから保存したほうで上書きされます` : "";
    w.style.display = same.length ? "" : "none";
  }
}
(function(){
  const css = document.createElement("style");
  css.textContent = `.rc-live{background:#FFF1C9;border:1.5px solid #F2B705;color:#7a5600;border-radius:99px;padding:3px 10px;font-size:12.5px;font-weight:800;white-space:nowrap;animation:livePulse 1.6s ease-in-out infinite}
  @keyframes livePulse{50%{opacity:.55}}
  #liveBar{position:fixed;right:12px;bottom:12px;z-index:950;background:#FFF8E1;border:2px solid #F2B705;color:#5a4000;border-radius:99px;padding:7px 14px;font-size:13px;font-weight:700;box-shadow:0 4px 14px rgba(0,0,0,.12);max-width:60vw}
  #liveBar .lb-item[onclick]{cursor:pointer;text-decoration:underline dotted;}
  #liveWarn{background:#FFF1C9;border:2px solid #F2B705;color:#7a5600;border-radius:12px;padding:8px 12px;margin:0 0 10px;font-weight:800;font-size:13.5px}`;
  document.head.appendChild(css);
  const t = $("formTitle"); if(t) t.insertAdjacentHTML("afterend", `<div id="liveWarn" style="display:none"></div>`);
  if(!window.KBLive) return;
  KBLive.onChanged(() => { clearTimeout(liveTimer); liveTimer = setTimeout(liveReload, 800); });
  KBLive.onPresence(livePaint);
  const __openFormLive = openForm;
  openForm = function(id){ const r = __openFormLive.apply(this, arguments); Promise.resolve(r).then(() => { KBLive.setEditing(editing ? editing.id : "new"); livePaint(); }); return r; };
  // 閉じたら「入力中」を消す（×・キャンセル・外を押す・保存、どれで閉じても）
  new MutationObserver(() => { if(!$("formBg").classList.contains("show")) KBLive.setEditing(null); }).observe($("formBg"), { attributes: true, attributeFilter: ["class"] });
  // 念のため：受付が閉じているのに「入力中」のままなら消す（30秒ごと。2026/11/6 消えのこり対策）
  setInterval(() => { if(KBLive.isEditing && KBLive.isEditing() && !$("formBg").classList.contains("show")) KBLive.setEditing(null); }, 30 * 1000);
  // 入力中の中身（店・時間・キャスト・お客さんの名前）をほかの人の右下に出す。電話番号は出さない
  const selText = id => { const s = $(id); return s && s.selectedIndex > 0 ? (s.options[s.selectedIndex].text || "").replace(/（.*$/, "").trim() : ""; };
  // お客さんの名前は送らない（入力中の合図に、お客さんの情報は入れない。2026/11/6 社長の指摘）
  const formInfo = () => [selText("f_store"), ($("f_start") || {}).value || "", selText("f_cast")].filter(Boolean).join("・");
  const sendInfo = () => { if($("formBg").classList.contains("show") && KBLive.setInfo) KBLive.setInfo(formInfo()); };
  $("formBg").addEventListener("input", sendInfo); $("formBg").addEventListener("change", sendInfo);
  const __renderListLive = renderList;
  renderList = function(){ const r = __renderListLive.apply(this, arguments); livePaint(); return r; };
})();

/* ---------- ✏️ コース・料金を直す（だれでも。kb_prices：店舗×コース→基本額）2026/11/4 ---------- */
function refreshCourses(){
  const store = $("f_store").value, keep = $("f_course").value, list = M.prices.filter(p=>p.store_key === store);
  $("f_course").innerHTML = `<option value="">（コースを選ぶ）</option>` + list.map(p=>`<option value="${esc(p.course)}">${esc(p.course)}${/^\d+$/.test(p.course)?"分" + (Number(p.course) >= 60 ? "（" + (Math.round(Number(p.course) / 6) / 10) + "時間）" : ""):""}　${yen(p.price)}${p.note?"（"+esc(p.note)+"）":""}</option>`).join("");
  if(keep && list.some(p=>p.course === keep)) $("f_course").value = keep;
}
function openPriceEdit(store){
  if(!KB.CAN_EDIT) return;
  store = store || $("f_store").value || (M.stores[0] || {}).key;
  let bg = $("priceBg");
  if(!bg){ bg = document.createElement("div"); bg.id = "priceBg"; bg.className = "modal-bg"; document.body.appendChild(bg); KB.closeOnBackdrop(bg, () => bg.classList.remove("show")); }
  const list = M.prices.filter(p=>p.store_key === store);
  const row = p => `<tr data-old="${esc(p ? p.course : "")}">
    <td><input class="pe-c" value="${esc(p ? p.course : "")}" placeholder="例：90 / 女レ80 / 泊21-5" style="width:120px"></td>
    <td><input class="pe-p" type="number" min="0" step="500" value="${p ? p.price : ""}" placeholder="13000" style="width:100px"></td>
    <td><input class="pe-n" value="${esc(p ? p.note : "")}" placeholder="例：90分（終了時刻に使う）" style="width:180px"></td>
    <td style="white-space:nowrap"><button type="button" class="btn btn-primary btn-sm" onclick="savePriceRow(this,'${esc(store)}')">${p ? "保存" : "＋ 足す"}</button>
      ${p ? `<button type="button" class="btn btn-ghost btn-sm" onclick="delPriceRow(this,'${esc(store)}')">消す</button>` : ""}</td></tr>`;
  bg.innerHTML = `<div class="modal" style="max-width:640px"><button class="x" onclick="$('priceBg').classList.remove('show')">×</button>
    <h2>✏️ コース・料金を直す</h2>
    <div class="f" style="margin:8px 0"><label>お店</label><select id="pe_store" onchange="openPriceEdit(this.value)">${M.stores.map(s=>`<option value="${s.key}" ${s.key === store ? "selected" : ""}>${esc(s.label)}</option>`).join("")}</select></div>
    <p style="font-size:12.5px;color:var(--sub);line-height:1.6;margin:0 0 8px">コースは分だけなら数字（例：90）。<b>専用コースなど名前に時間がないときは、名前か説明に「90分」のように書くと、終了時刻が自動になります。</b>料金は基本額（指名料・延長・オプションは別）。<br>新しいコースは、キャストのバックがまだないので、はじめの受付で「キャストの報酬」にバックを入れてください（次から自動）。</p>
    <div style="overflow-x:auto"><table class="list"><tr><th>コース</th><th>料金（円）</th><th>説明</th><th></th></tr>${list.map(p => row(p)).join("")}${row(null)}</table></div></div>`;
  bg.classList.add("show");
}
async function savePriceRow(btn, store){
  const tr = btn.closest("tr"), old = tr.dataset.old, course = tr.querySelector(".pe-c").value.trim().normalize("NFKC"), price = Number(tr.querySelector(".pe-p").value), note = tr.querySelector(".pe-n").value.trim();
  if(!course){ toast("コースを入れてください"); return; }
  if(tr.querySelector(".pe-p").value === "" || !(price >= 0)){ toast("料金を入れてください"); return; }
  if(course !== old && M.prices.some(p=>p.store_key === store && p.course === course)){ toast("そのコースはもうあります"); return; }
  try{
    q(await sb.from("kb_prices").upsert({ store_key: store, course, price, note }, { onConflict: "store_key,course" }));
    if(old && old !== course) q(await sb.from("kb_prices").delete().eq("store_key", store).eq("course", old));   // 名前を変えたら、前の名前は消す
    M.prices = M.prices.filter(p=>!(p.store_key === store && (p.course === old || p.course === course)));
    M.prices.push({ store_key: store, course, price, note });
    toast("保存しました（" + course + "・" + yen(price) + "）"); refreshCourses(); openPriceEdit(store); if($("f_store").value) recalc();
  }catch(e){ toast("保存できませんでした：" + (e.message || e)); }
}
async function delPriceRow(btn, store){
  const old = btn.closest("tr").dataset.old; if(!old) return;
  if(!confirm("コース「" + old + "」を消しますか？（前の予約は消えません）")) return;
  try{
    q(await sb.from("kb_prices").delete().eq("store_key", store).eq("course", old));
    M.prices = M.prices.filter(p=>!(p.store_key === store && p.course === old));
    toast("消しました"); refreshCourses(); openPriceEdit(store);
  }catch(e){ toast("消せませんでした：" + (e.message || e)); }
}

/* ---------- 📞 電話番号不明（00）で受けた予約：状態を変えるたびに「番号を入れて」と出す（2026/11/4） ---------- */
function noPhoneRes(r){ return !!r && digits(((r.kb_customers) || {}).phone || "").length < 6; }
function phoneWarn(r){
  let el = $("phoneWarn");
  if(!el){ el = document.createElement("div"); el.id = "phoneWarn"; document.body.appendChild(el); }
  const c = (r && r.kb_customers) || {};
  el.innerHTML = `<div>📞 <b>電話番号がまだです</b>：${r && r.start_at ? hm(r.start_at) : ""} ${esc(r && r.cast_id ? castName(r.cast_id) : "")} ${esc(c.name || "")}様<br><small>わかったら、予約を開いて電話番号を入れてください</small></div>
    ${r ? `<button type="button" onclick="$('phoneWarn').remove();openForm(${r.id})">開く</button>` : ""}<button type="button" onclick="$('phoneWarn').remove()">✕</button>`;
  clearTimeout(phoneWarn.t); phoneWarn.t = setTimeout(() => { const e = $("phoneWarn"); if(e) e.remove(); }, 15000);
}
document.head.insertAdjacentHTML("beforeend", `<style>
  #phoneWarn{position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:9500;background:#FFE8EC;border:2.5px solid #E5486C;color:#B0213F;border-radius:14px;padding:10px 14px;font-size:14.5px;box-shadow:0 6px 20px rgba(0,0,0,.18);display:flex;gap:10px;align-items:center;max-width:92vw}
  #phoneWarn button{font-family:inherit;font-weight:800;border:1.5px solid #F09AAA;background:#fff;color:#B0213F;border-radius:10px;padding:5px 10px;cursor:pointer}
  .rc-nophone{background:#FFE8EC;color:#B0213F;border:1.5px solid #F09AAA;border-radius:99px;padding:1px 8px;font-size:12px;font-weight:800;animation:livePulse 1.6s ease-in-out infinite}
</style>`);
{ const __quickStatusP = quickStatus;
  quickStatus = async function(id, st){ const r0 = await __quickStatusP.apply(this, arguments); const r = rows.find(x => x.id === id); if(noPhoneRes(r)) phoneWarn(r); return r0; }; }
$("f_status").addEventListener("change", () => { if(digits($("f_phone").value).length < 6) phoneWarn(editing ? rows.find(x => x.id === editing.id) : null); });

/* ---------- 🎨 本日のキャスト一覧：キャストごとの枠を2色で交互に（見分けやすく。2026/11/4） ---------- */
document.head.insertAdjacentHTML("beforeend", `<style>
  /* やわらかい色（原色はやめる。2026/11/4 きゃ）：さくらピンクと、ラベンダー */
  #list > .cblock.cb-a{border:4px solid #F4A3BE;background:#FFF2F6;}
  #list > .cblock.cb-b{border:4px solid #F4A3BE;background:#FFF2F6;}   /* 2026/11/5：色ちがいはチカチカするので、全部ピンクに */
  /* お茶＝こい緑・欠勤＝こい赤：交互の色より強く（2026/11/11 名前が見えなかった） */
  #list > .cblock.tea, #list > .cblock.tea.cb-a, #list > .cblock.tea.cb-b{background:#43A047;border-color:#2E7D32;}
  #list > .cblock.absent, #list > .cblock.absent.cb-a, #list > .cblock.absent.cb-b{background:#E02424;border-color:#A81414;}
  /* 予約①〜⑥の色（カードの左の線と番号の札）：さくら・ピーチ・ミント・そら・ラベンダー・レモン */
  .rescard.rcn1{border-left:6px solid #F4A3BE;} .rescard.rcn1 .rc-no{background:#FDE3EC;color:#B2456B;border-color:#F4A3BE;}
  .rescard.rcn2{border-left:6px solid #F7BE95;} .rescard.rcn2 .rc-no{background:#FDEBDD;color:#A35A22;border-color:#F7BE95;}
  .rescard.rcn3{border-left:6px solid #9DD9BC;} .rescard.rcn3 .rc-no{background:#E3F6EC;color:#2F7A55;border-color:#9DD9BC;}
  .rescard.rcn4{border-left:6px solid #A6CDF0;} .rescard.rcn4 .rc-no{background:#E4F0FB;color:#2F6699;border-color:#A6CDF0;}
  .rescard.rcn5{border-left:6px solid #C5B5F0;} .rescard.rcn5 .rc-no{background:#EEE9FC;color:#6650A8;border-color:#C5B5F0;}
  .rescard.rcn6{border-left:6px solid #EFD98A;} .rescard.rcn6 .rc-no{background:#FCF5D8;color:#8A6D12;border-color:#EFD98A;}
  /* ①〜⑥：予約の状態の色（2026/11/5） */
  .rescard.rcs{border-left:6px solid #ddd;} .rescard .rc-no.st{border-color:rgba(0,0,0,.12);}
  .rescard.rs-wait_cast_reply{border-left-color:#8DB8F2;} .rescard.rs-wait_guest_reply,.rescard.rs-wait_foreign_call{border-left-color:#A9D98A;}
  .rescard.rs-pre_call,.rescard.rs-pre_mail{border-left-color:#F2D24B;} .rescard.rs-hour_call,.rescard.rs-hour_mail{border-left-color:#F08BB0;}
  .rescard.rs-wait_guest,.rescard.rs-wait_cast{border-left-color:#cfc7ca;} .rescard.rs-working{border-left-color:#B99BEB;} .rescard.rs-moving{border-left-color:#7FCCD6;}
  .rescard.rs-arrive_call{border-left-color:#8CCFA5;} .rescard.rs-done{border-left-color:#C9C5C7;} .rescard.rs-cancel{border-left-color:#F5B37A;} .rescard.rs-tobi{border-left-color:#F08A8A;}
  .cardamt{display:inline-block;background:#E4F0FB;border:1.5px solid #A6CDF0;color:#2F6699;border-radius:99px;padding:1px 9px;font-size:12px;font-weight:800;margin-right:4px}
  .part2chip{background:#FFF4E5;border:1.5px solid #FFB547;color:#8a4b00;border-radius:99px;padding:1px 9px;font-size:12px;font-weight:800;margin-left:6px;animation:livePulse 1.6s ease-in-out infinite}
  .rc-no{font-weight:900;font-size:12.5px;border-radius:99px;padding:1px 9px;border:1.5px solid;white-space:nowrap;align-self:center;}
  /* 今どこに誰が：横の線をはっきり（行の区切り） */
  table.board tr > th, table.board tr > td{border-bottom:3px solid #D9C7CF !important;}
  table.board tr > th:first-child{border-right:3px solid #D9C7CF !important;}
</style>`);
{ const __renderListAlt = renderList;
  renderList = function(){ const r = __renderListAlt.apply(this, arguments);
    document.querySelectorAll("#list > .cblock").forEach((el, i) => { el.classList.toggle("cb-a", i % 2 === 0); el.classList.toggle("cb-b", i % 2 === 1); });
    return r; }; }

/* ---------- ⏳ 登録するを二重に押さない：登録中は画面のまんなかに「登録しています…」、終わるまでほかを押せない（2026/11/4 二重登録があった） ---------- */
{ const __saveResLock = saveRes; let saving = false;
  saveRes = async function(){
    if(saving){ toast("⏳ 今、登録しています。終わるまで待ってください"); return; }
    saving = true; KB.busy(true, "登録しています…（閉じたり、もう一度押したりしないでください）");
    try{ return await __saveResLock.apply(this, arguments); }
    catch(e){ KB.errBox("登録できませんでした：" + (e && e.message || e)); }
    finally{ saving = false; KB.busy(false); }
  }; }


/* ---------- 本日のキャスト：お茶・欠勤の子は、あいうえお順（ほかの並び順も）から外して、いちばん下の別枠へ ---------- */
// ✅ 精算済（ふえた予約もない）の子も、グレーにして下の別枠へ（2026/11/4 店長の希望）
const settledDone = x => !!(x.c && x.cd && x.cd.settled && !["待機中", "仕事中"].includes(x.cd.status) && !(typeof kbPendingAfterSettle === "function" && kbPendingAfterSettle(x.cd, rows.filter(r=>r.cast_id === x.c.id)).length));
const __sortRowsTea = sortRows;
sortRows = function(list){
  const out = __sortRowsTea(list);
  const off = x => !!goneKind(x.cd, x), sd = x => !off(x) && settledDone(x);
  return out.filter(x=>!off(x) && !sd(x)).concat(out.filter(sd), out.filter(off));
};
const __renderListTea = renderListTable;
renderListTable = function(){
  __renderListTea.apply(this, arguments);
  tlRows().filter(x => !goneKind(x.cd, x) && settledDone(x)).forEach(x => { const el = $("cb-" + x.c.id); if(el && el.parentElement && el.parentElement.id === "list") el.classList.add("sdone"); });
  // 見出しは2つに分ける：✅ 精算済（うすい緑）→ その下に お茶・欠勤（2026/11/11 店長）。精算済でも「待機中・仕事中」の子は、ふつうの並びのまま（settledDone）
  const n = k => document.querySelectorAll("#list > .cblock." + k).length, head = (txt, bg, bd, fg) => `<div class="teahead" style="margin:18px 0 6px;padding:6px 12px;border-radius:12px;background:${bg};border:1.5px dashed ${bd};font-weight:900;color:${fg}">${txt}</div>`;
  const sd = document.querySelector("#list > .cblock.sdone");
  if(sd) sd.insertAdjacentHTML("beforebegin", head("✅ 精算済（" + n("sdone") + "名）", "#D6EFD7", "#7FC583", "#1E7A3C"));
  const off = document.querySelector("#list > .cblock.tea, #list > .cblock.absent");
  if(off) off.insertAdjacentHTML("beforebegin", head("🟩 お茶・🟥 欠勤（" + (n("tea") + n("absent")) + "名）", "#F3F3F3", "#CFCFCF", "#444"));
};
document.head.insertAdjacentHTML("beforeend", `<style>#list > .cblock.sdone{background:#D6EFD7 !important;border-color:#7FC583 !important;position:relative}</style>`);

/* ---------- ✏️ この場だけ直す：キャストへの予約連絡・お客さまへの返信の文を、その場で書きかえる（テンプレは変えない）2026/11/5
   書きかえている間は、受付の内容を変えても文は自動で作りなおさない。「↺ 自動の文にもどす」でもとにもどる。受付を開きなおすと自動にもどる ---------- */
const msgManual = { msg: null, netReply: null };
function msgEdit(id){
  const ta = $(id), btn = $(id + "EditBtn"); if(!ta) return;
  if(msgManual[id] == null){
    msgManual[id] = ta.value; ta.readOnly = false; ta.classList.add("msgedit"); ta.focus();
    ta.oninput = () => { msgManual[id] = ta.value; };
    if(btn) btn.textContent = "↺ 自動の文にもどす";
    toast("✏️ 文を直せます（この予約のこの場だけ。テンプレは変わりません）");
  } else {
    msgManual[id] = null; ta.readOnly = true; ta.classList.remove("msgedit"); ta.oninput = null;
    if(btn) btn.textContent = "✏️ この場だけ直す";
    recalc();
  }
}
// 受付を開きなおしたら、自動の文にもどす（作りなおしは、開いたときの計算で）
function msgManualReset(){ ["msg", "netReply"].forEach(id => { msgManual[id] = null; const ta = $(id), btn = $(id + "EditBtn"); if(ta){ ta.readOnly = true; ta.classList.remove("msgedit"); ta.oninput = null; } if(btn) btn.textContent = "✏️ この場だけ直す"; }); }
{ const __rcMan = recalc; recalc = function(){ const r = __rcMan.apply(this, arguments);
    ["msg", "netReply"].forEach(id => { if(msgManual[id] != null && $(id)) $(id).value = msgManual[id]; });   // 書きかえている文は、そのまま
    return r; }; }
{ const __ofMan = openForm; openForm = function(){ msgManualReset(); const r = __ofMan.apply(this, arguments); setTimeout(paintReqBar, 400); return r; }; }
/* ---------- 🔎 受付の中で探す（2026/11/9 店長：受付を開いたまま、時間・キャスト・希望プレイで探して、そのまま登録まで）
   受付の「日付」の日のシフトと予約から、対応できるキャストを一覧に。「この子にする」でキャストと開始時刻を受付に入れる（受付は閉じない）
   外の 🔎 フィルター（一覧を絞る）は今までどおり。中の項目・計算・保存は変えない ---------- */
const fsCasts = new Set(), fsPlay = new Set();
let fsSeq = 0;
function fsClear(){ $("fs_time").value = ""; fsCasts.clear(); fsPlay.clear(); fsPaint(); }
function fsToggleCast(id){ if(fsCasts.has(id)) fsCasts.delete(id); else fsCasts.add(id); fsPaint(); }
function fsTogglePlay(k){ if(fsPlay.has(k)) fsPlay.delete(k); else fsPlay.add(k); fsPaint(); }
async function fsPaint(){
  const box = $("fsBox"), out = $("fsOut"); if(!box || !out || !box.open) return;
  const seq = ++fsSeq, bd = ($("f_day") && $("f_day").value) || day;
  if(!$("fs_time").value && $("f_start").value) $("fs_time").value = $("f_start").value;   // 受付の開始時刻があれば、それで探す
  if($("f_course").value && !box.dataset.minTouched){ const m = minutesOf($("f_course").value); if([60, 90, 120, 150, 180, 240].includes(m)) $("fs_min").value = String(m); }
  out.innerHTML = `<div class="hint2" style="font-size:12.5px;color:var(--sub);margin-top:6px">探しています…</div>`;
  let shifts, rs;
  try{
    [shifts] = await Promise.all([loadShifts(bd), fsPlay.size ? loadProfs() : Promise.resolve(null)]);
    rs = bd === day ? rows : (q(await sb.from("kb_reservations").select("id,cast_id,start_at,end_at,status,biz_date").eq("biz_date", bd).eq("deleted", false)) || []);
  }catch(e){ out.innerHTML = `<div class="warn">探せませんでした：${esc(e.message || e)}</div>`; return; }
  if(seq !== fsSeq) return;
  // その日に出勤するキャスト（受付ずみのシフト）
  const list = Object.keys(shifts || {}).map(nm => { const c = M.casts.find(x => x.shift_name === nm || x.official_name === nm); return c ? { c, sh: shifts[nm] } : null; })
    .filter(x => x && x.c.status !== "left");
  $("fs_castChips").innerHTML = list.slice().sort((a, b) => a.sh.start - b.sh.start).map(x => `<button type="button" class="chip ${fsCasts.has(x.c.id) ? "on" : ""}" onclick="fsToggleCast('${x.c.id}')">${esc(castName(x.c.id))}</button>`).join("") || `<span class="hint2">この日のシフトがありません</span>`;
  $("fs_castN").textContent = fsCasts.size ? `（${fsCasts.size}人）` : "";
  $("fs_playChips").innerHTML = PLAYS.map(([k, l]) => `<button type="button" class="chip ${fsPlay.has(k) ? "on" : ""}" onclick="fsTogglePlay('${k}')">${esc(l)}</button>`).join("");
  $("fs_playN").textContent = fsPlay.size ? `（${[...fsPlay].map(k => (PLAYS.find(p => p[0] === k) || [k, k])[1]).join("・")}）` : "";
  // 時間：何時から・何分
  const st = $("fs_time").value, len = (Number($("fs_min").value) || 90) / 60;
  let s = null; if(st){ const [h, mi] = st.split(":").map(Number); s = h + mi / 60; if(s < 8) s += 24; }
  const busyOf = c => rs.filter(r => r.cast_id === c.id && (!editing || r.id !== editing.id) && !["cancel", "tobi", "flowed"].includes(r.status) && r.start_at && r.end_at)
    .map(r => { const a = hourOf(r.start_at); let b = hourOf(r.end_at); if(b < a) b += 24; return [a, b]; }).sort((a, b) => a[0] - b[0]);
  const freeOf = (c, sh) => { const g = (c.interval_min || 0) / 60, o2 = []; let t = sh.start;
    busyOf(c).forEach(([a, b]) => { if(a - g > t + 0.01) o2.push([t, Math.min(a - g, sh.end)]); t = Math.max(t, b + g); });
    if(t < sh.end - 0.01) o2.push([t, sh.end]); return o2.filter(([a, b]) => b - a >= 0.5); };
  const okMarks = $("fs_tri").checked ? ["◎", "○", "△"] : ["◎", "○"];
  const cds = bd === day ? castDays : {};
  const L = list.filter(x => !fsCasts.size || fsCasts.has(x.c.id)).map(x => {
    const cd = cds[x.c.id] || {}, fr = freeOf(x.c, x.sh);
    let ok = true, why = "";
    if(cd.status === "欠勤"){ ok = false; why = "欠勤"; }
    else if(cd.full_at){ ok = false; why = "🈵 満了"; }
    else if(s != null){
      if(s < x.sh.start || s + len > x.sh.end){ ok = false; why = "出勤の時間外"; }
      else if(!fr.some(([a, b]) => a <= s + 0.001 && s + len <= b + 0.001)){ ok = false; const nx = fr.find(([a, b]) => a >= s && b - a >= len); why = "この時間は予約あり" + (nx ? `（${fmtHour(nx[0])}から空き）` : ""); }
    } else if(!fr.length){ ok = false; why = "空きなし"; }
    let marks = "";
    if(fsPlay.size){
      const o = profOpts(x.c);
      if(!o){ ok = false; why = why || "プロフとつながっていない"; marks = "プロフなし"; }
      else { marks = [...fsPlay].map(k => (PLAYS.find(p => p[0] === k) || [k, k])[1] + (o[k] || "？")).join(" ");
        if(![...fsPlay].every(k => okMarks.includes(o[k]))){ ok = false; why = why || "希望プレイが×・△・空欄"; } }
    }
    return { x, ok, why, fr, marks };
  });
  const onlyOk = $("fs_ok").checked, okL = L.filter(r => r.ok), ngL = L.filter(r => !r.ok);
  okL.sort((a, b) => a.x.sh.start - b.x.sh.start);
  const cur = $("f_cast").value;
  const row = r => `<div class="fsrow ${r.ok ? "ok" : "ng"} ${r.x.c.id === cur ? "cur" : ""}"><b>${r.ok ? "✅" : "✖"} ${esc(castName(r.x.c.id))}</b>
      <small>${fmtHour(r.x.sh.start)}〜${fmtHour(r.x.sh.end)}　${r.ok ? (s != null ? `${fmtHour(s)}から行ける` : `空き：${r.fr.map(([a, b]) => fmtHour(a) + "〜" + fmtHour(b)).join("・")}`) : esc(r.why)}${r.marks ? "　" + esc(r.marks) : ""}</small>
      ${r.ok ? (r.x.c.id === cur ? `<span class="fscur">✔ この子にしています</span>` : `<button type="button" class="btn btn-primary btn-sm" onclick="fsPick('${r.x.c.id}')">この子にする</button>`) : ""}</div>`;
  out.innerHTML = `<div class="fshead">${bd !== day ? `📅 ${esc(bd.slice(5).replace("-", "/"))} の` : ""}${s != null ? `${fmtHour(s)}〜${fmtHour(s + len)} に` : ""}対応できるキャスト <b>${okL.length}人</b></div>`
    + (okL.map(row).join("") || `<div class="warn" style="margin-top:4px">条件に合うキャストがいません</div>`)
    + (ngL.length ? (onlyOk ? `<details style="margin-top:6px;font-size:12.5px;color:var(--sub)"><summary>対応できないキャスト（${ngL.length}）</summary>${ngL.map(row).join("")}</details>` : ngL.map(row).join("")) : "")
    + (fsCasts.size && !okL.length ? `<div style="margin-top:6px"><button type="button" class="btn btn-ghost btn-sm" onclick="fsOtherDays()">🗓 選んだ子の、ほかの出勤日を見る</button><div id="fsDays"></div></div>` : "");
}
function fsPick(cid){
  const t = $("fs_time").value;
  if(![...$("f_cast").options].some(o => o.value === cid) && $("f_castAll")){ $("f_castAll").checked = true; fillCastSel(); }
  $("f_cast").value = cid; onCast();
  if(t){ $("f_start").value = t; }
  recalc(); fsPaint();
  toast(`✅ ${castName(cid)}${t ? "・" + t + "から" : ""} にしました`);
}
// 🗓 選んだ子の、この先2週間の出勤日（押すと受付の日付をその日に）
async function fsOtherDays(){
  const el = $("fsDays"); if(!el) return;
  el.innerHTML = `<div class="hint2" style="font-size:12.5px;color:var(--sub)">探しています…</div>`;
  const from = ($("f_day") && $("f_day").value) || day, out = [];
  for(let i = 1; i <= 14; i++){
    const d = addDays(from, i); let sh = {};
    try{ sh = await loadShifts(d); }catch(e){}
    [...fsCasts].forEach(cid => { const c = M.casts.find(x => x.id === cid); const s2 = c && (sh[c.shift_name] || sh[c.official_name]); if(s2) out.push({ d, cid, s: s2 }); });
  }
  const dl = d => { const x = new Date(d + "T12:00:00Z"); return `${x.getUTCMonth() + 1}/${x.getUTCDate()}(${DOW[x.getUTCDay()]})`; };
  el.innerHTML = out.length ? `<div class="tm-dms" style="margin-top:6px">${out.map(o => `<button type="button" class="tm-dm" onclick="fsGoDay('${o.d}')">${esc(dl(o.d))}<small>${esc(castName(o.cid))} ${fmtHour(o.s.start)}〜${fmtHour(o.s.end)}</small></button>`).join("")}</div>`
    : `<div class="hint2" style="font-size:12.5px;color:var(--sub)">この先2週間、選んだ子の出勤（受付ずみのシフト）はありません</div>`;
}
function fsGoDay(d){
  if(!$("f_day")){ toast("受付の日付の欄が見つかりません"); return; }
  $("f_day").value = d; try{ $("f_day").dispatchEvent(new Event("change", { bubbles: true })); }catch(e){}
  recalc(); fsPaint(); toast("📅 受付の日付を " + d.slice(5).replace("-", "/") + " にしました");
}
// 受付を開いたら、探すの中身を空に（前の受付の絞りを残さない）
{ const __ofFs = openForm; openForm = function(){ const r = __ofFs.apply(this, arguments); try{ fsCasts.clear(); fsPlay.clear(); if($("fs_time")) $("fs_time").value = ""; const b = $("fsBox"); if(b){ b.open = false; delete b.dataset.minTouched; } }catch(e){} return r; }; }
document.addEventListener("change", e => { if(e.target && e.target.id === "fs_min"){ const b = $("fsBox"); if(b) b.dataset.minTouched = "1"; } }, true);
document.head.insertAdjacentHTML("beforeend", `<style>
  .fsbox{border:2px solid #CFE0F6;border-radius:16px;background:#F5F9FF;padding:8px 12px;margin:0 0 12px}
  .fsbox > summary{cursor:pointer;font-weight:900;font-size:15px;color:#2E6BB0} .fsbox > summary small{font-weight:700;color:#6b8db5;margin-left:6px;font-size:12px}
  .fsctl{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:8px 0;font-size:13.5px;font-weight:800}
  .fsctl input[type=time]{width:auto !important} .fsctl select{width:auto !important}
  .fssub{margin:4px 0} .fssub > summary{cursor:pointer;font-weight:800;font-size:13.5px;color:#5C4B4F}
  .fshead{font-weight:900;margin:8px 0 4px;color:#2E6BB0}
  .fsrow{display:flex;gap:8px;align-items:center;flex-wrap:wrap;background:#fff;border:1.5px solid #DCE8F6;border-radius:12px;padding:6px 10px;margin:4px 0}
  .fsrow small{flex:1;color:#6b5a5f;font-weight:700} .fsrow.ng{opacity:.6} .fsrow.cur{border-color:#3FA96A;background:#F2FBF5}
  .fscur{font-size:12.5px;font-weight:900;color:#2e8b57}
</style>`);
/* ---------- 🎨 受付の見た目（2026/11/7 店長：見やすく）
   中身（項目・id・自動の計算・検索・保存）は1つも変えない。見た目（色・丸み・余白）と、パソコンの左の目次・入力の進捗を足すだけ
   ①〜⑥ の箱ごとに色の見出し。必須（赤い「必須」・赤い枠）は今のまま ---------- */
const STEP_COLOR = ["pink", "blue", "yellow", "green", "lav", "peach"];
function stepNavInit(){
  const dr = document.querySelector("#formBg .drawer"); if(!dr) return;
  const steps = [...dr.querySelectorAll(":scope > .step")];
  steps.forEach((s, i) => { s.classList.add("sc-" + (STEP_COLOR[i] || "pink")); s.dataset.sn = i + 1; });
  if(!$("stepNav")){
    const title = s => { const h = s.querySelector("h3"); return h ? h.textContent.replace(/^\s*\d+\s*/, "").replace(/（.*$/, "").trim() : ""; };
    $("formBg").insertAdjacentHTML("beforeend", `<nav id="stepNav"><div class="sn-list">${steps.map((s, i) => `<button type="button" class="sn-it" data-i="${i}" onclick="stepGo(${i})"><span class="sn-n">${i + 1}</span><span class="sn-t">${esc(title(s))}</span></button>`).join("")}</div>
      <div class="sn-prog"><b>入力の進捗</b><div class="sn-bar"><i id="snBar"></i></div><span id="snTxt"></span></div></nav>`);
    $("formBg").addEventListener("scroll", stepNavCur, { passive: true });
  }
}
function stepGo(i){ const s = document.querySelectorAll("#formBg .drawer > .step")[i]; if(s) s.scrollIntoView({ block: "start", behavior: "smooth" }); }
function stepNavCur(){
  const steps = [...document.querySelectorAll("#formBg .drawer > .step")]; let cur = 0;
  steps.forEach((s, i) => { if(s.getBoundingClientRect().top < 160) cur = i; });
  document.querySelectorAll("#stepNav .sn-it").forEach((b, i) => b.classList.toggle("cur", i === cur));
}
function stepNavPaint(){
  if(!$("stepNav")) return;
  const steps = [...document.querySelectorAll("#formBg .drawer > .step")];
  let miss = []; try{ const sv = ($("f_status") || {}).value; miss = sv === "flowed" ? tentativeMissing() : ["cancel", "tobi"].includes(sv) ? [] : missingRequired(true); }catch(e){}
  const missStep = new Set(miss.map(([, id]) => { const el = $(id); const s = el && el.closest(".step"); return s ? steps.indexOf(s) : -1; }));
  const hasReq = steps.map(s => !!s.querySelector(".req"));
  document.querySelectorAll("#stepNav .sn-it").forEach((b, i) => { b.classList.toggle("ok", hasReq[i] && !missStep.has(i)); b.classList.toggle("ng", missStep.has(i)); });
  const total = 12, done = Math.max(0, total - miss.length);
  $("snBar").style.width = Math.round(done / total * 100) + "%"; $("snTxt").textContent = miss.length ? `必須のこり ${miss.length}` : "✅ 必須はぜんぶ入っています";
  stepNavCur();
}
{ const __prbNav = paintReqBar; paintReqBar = function(){ const r = __prbNav.apply(this, arguments); try{ stepNavInit(); stepNavPaint(); }catch(e){} return r; }; }
document.head.insertAdjacentHTML("beforeend", `<style>
  /* 箱：色の見出し・丸み・影 */
  #formBg .drawer > .step{padding:0 16px 14px;border:1.5px solid #F1E3E7;border-radius:18px;box-shadow:0 2px 10px rgba(92,75,79,.06);overflow:visible;margin-bottom:16px;background:#fff}
  #formBg .drawer > .step > h3{margin:0 -16px 12px;padding:12px 16px;border-radius:17px 17px 0 0;font-size:16.5px;font-weight:900;border-bottom:1.5px solid rgba(0,0,0,.04)}
  #formBg .drawer > .step > h3 .n{width:32px;height:32px;font-size:16px;box-shadow:0 2px 6px rgba(0,0,0,.12)}
  #formBg .step.sc-pink > h3{background:linear-gradient(90deg,#FFE3EC,#FFF5F8);color:#D94A7A} #formBg .step.sc-pink > h3 .n{background:#E5638C}
  #formBg .step.sc-blue > h3{background:linear-gradient(90deg,#E1EEFC,#F4F9FF);color:#2E6BB0} #formBg .step.sc-blue > h3 .n{background:#4A86D0}
  #formBg .step.sc-yellow > h3{background:linear-gradient(90deg,#FFF0D6,#FFFAF0);color:#C26A00} #formBg .step.sc-yellow > h3 .n{background:#F0A030}
  #formBg .step.sc-green > h3{background:linear-gradient(90deg,#DFF3E5,#F4FBF6);color:#2E8B57} #formBg .step.sc-green > h3 .n{background:#3FA96A}
  #formBg .step.sc-lav > h3{background:linear-gradient(90deg,#ECE4FA,#F8F5FE);color:#6A4FB0} #formBg .step.sc-lav > h3 .n{background:#8A6FD1}
  #formBg .step.sc-peach > h3{background:linear-gradient(90deg,#FFE6DC,#FFF6F2);color:#C2552F} #formBg .step.sc-peach > h3 .n{background:#E8794F}
  #formBg .step.sc-blue{border-color:#DCE8F6} #formBg .step.sc-yellow{border-color:#F6E6CB} #formBg .step.sc-green{border-color:#D3EBDC} #formBg .step.sc-lav{border-color:#E3DAF5} #formBg .step.sc-peach{border-color:#F6DDD3}
  /* 項目名・入れる欄・ボタン */
  #formBg .drawer .f > label{font-size:13.5px;color:#5C4B4F;font-weight:900;margin-bottom:6px}
  #formBg .drawer .f + .f, #formBg .drawer .row1 + .row1{margin-top:10px}
  #formBg .drawer .row2 > .f + .f, #formBg .drawer .row3 > .f + .f{margin-top:0}   /* 横に並んだ欄は、上をそろえる（エリアとホテル・自宅が段ちがいになっていた）*/
  #formBg .drawer .row2 > .f > label, #formBg .drawer .row3 > .f > label{min-height:22px;display:flex;align-items:center;flex-wrap:wrap;gap:0 2px}
  #formBg .drawer input[type=text], #formBg .drawer input:not([type]), #formBg .drawer input[type=tel], #formBg .drawer input[type=email], #formBg .drawer input[type=time], #formBg .drawer input[type=date], #formBg .drawer input[type=number], #formBg .drawer select, #formBg .drawer textarea{border:1.5px solid #E6D7DC;border-radius:12px;background:#FFFEFE;box-shadow:inset 0 1px 2px rgba(0,0,0,.03)}
  #formBg .drawer input:focus, #formBg .drawer select:focus, #formBg .drawer textarea:focus{outline:none;border-color:#E5638C;box-shadow:0 0 0 3px rgba(229,99,140,.15)}
  #formBg .drawer .chip{padding:9px 18px;font-size:14.5px;border-color:#E6D7DC;box-shadow:0 1px 3px rgba(92,75,79,.06);transition:background .12s,border-color .12s}
  #formBg .drawer .chip:hover{border-color:#E5638C}
  #formBg .drawer .chip.on{box-shadow:0 3px 8px rgba(229,99,140,.3)}
  #formBg .drawer .chip.on::before{content:"✓ ";font-weight:900}
  /* 左の目次・入力の進捗（パソコンの広い画面だけ） */
  #stepNav{display:none}
  @media (min-width:1180px){
    #formBg .drawer{max-width:980px;padding-left:232px}
    #stepNav{display:block;position:fixed;top:84px;left:calc(50vw - 490px + 16px);width:196px;z-index:5}
    #stepNav .sn-list{background:#fff;border:1.5px solid #F1E3E7;border-radius:16px;padding:8px;box-shadow:0 2px 10px rgba(92,75,79,.06)}
    #stepNav .sn-it{display:flex;align-items:center;gap:8px;width:100%;font-family:inherit;font-size:13.5px;font-weight:800;color:#6b5a5f;background:none;border:0;border-radius:12px;padding:8px;cursor:pointer;text-align:left}
    #stepNav .sn-it:hover{background:#FFF3F7}
    #stepNav .sn-it.cur{background:#FFE3EC;color:#D94A7A}
    #stepNav .sn-n{flex:none;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:99px;background:#E9E1E4;color:#fff;font-size:12.5px;font-weight:900}
    #stepNav .sn-it.cur .sn-n{background:#E5638C} #stepNav .sn-it.ok .sn-n{background:#3FA96A} #stepNav .sn-it.ok .sn-n::after{content:""} #stepNav .sn-it.ng .sn-n{background:#E5486C}
    #stepNav .sn-t{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #stepNav .sn-prog{margin-top:10px;background:#fff;border:1.5px solid #F1E3E7;border-radius:16px;padding:10px 12px;font-size:12.5px;box-shadow:0 2px 10px rgba(92,75,79,.06)}
    #stepNav .sn-bar{height:9px;border-radius:99px;background:#F1E9EC;margin:6px 0;overflow:hidden} #stepNav .sn-bar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#F59AB8,#E5638C);transition:width .3s}
  }
</style>`);
document.head.insertAdjacentHTML("beforeend", `<style>textarea.msg.msgedit{background:#FFFBEA !important;border:2px solid #F2B705 !important}</style>`);

// 🖼 受付でキャストを選んだら、写真（公式HPのサムネ。18・極門の本物のキャストも）2026/11/11 店長
{ const __onCastFace = onCast; onCast = function(){
  const r = __onCastFace.apply(this, arguments);
  // 写真は専用の場所（#castFace）に：キャストの情報（#castInfo）は、あとからプロフを読んで書きなおされるため
  const info = $("castInfo"); if(!info) return r;
  let el = $("castFace"); if(!el){ el = document.createElement("div"); el.id = "castFace"; info.parentNode.insertBefore(el, info); }
  const c = M.casts.find(x => x.id === $("f_cast").value);
  el.innerHTML = c && typeof KBF !== "undefined" ? `<div class="castface" style="display:flex;gap:8px;align-items:flex-end;margin:4px 0 6px">${KBF.img(c, 90, $("f_store").value)}<div><b style="font-size:15px">${esc(c.official_name || c.temp_name || "")}</b>${isDummyStore($("f_store").value) ? `<br><small style="color:var(--sub)">⭐ 本物のキャスト</small>` : ""}</div></div>` : "";
  return r;
}; }

// 🖼 受付のキャストを「写真の一覧」で選ぶ（2026/11/11 店長：ビジュアルでわかるように）。プルダウンもそのまま使える
//   その日の出勤の子を、出勤が早い順に写真のカードで。押すとその子を選ぶ（プルダウンを変えたのと同じ）
function paintCastGrid(){
  const sel = $("f_cast"); if(!sel || typeof KBF === "undefined") return;
  let box = $("castGrid");
  // 売上店舗の下の余白まで横に広く（1行に6〜7人）2026/11/12 店長：売上店舗・キャストの段の下に、横いっぱいで出す
  const row = sel.closest(".row2") || sel;
  if(!box){ box = document.createElement("div"); box.id = "castGrid"; }
  if(box.previousElementSibling !== row) row.insertAdjacentElement("afterend", box);
  const opts = [...sel.querySelectorAll("option")].filter(o => o.value);
  if(!opts.length){ box.innerHTML = ""; return; }
  const cur = sel.value, store = $("f_store") ? $("f_store").value : "";
  box.innerHTML = opts.map(o => {
    const c = M.casts.find(x => x.id === o.value); if(!c) return "";
    const tm = (o.textContent.split("　")[1] || "").trim();   // 「名前　12:00〜22:00」の時間
    const off = o.parentElement && /シフトにない/.test(o.parentElement.label || "");
    return `<button type="button" class="cg-c ${o.value === cur ? "on" : ""} ${off ? "off" : ""}" onclick="pickCastGrid('${o.value}')" title="${esc(o.textContent)}">${KBF.img(c, 48, store)}<span class="cg-n">${esc(c.official_name || c.temp_name || "")}</span>${tm ? `<span class="cg-t">${esc(tm)}</span>` : ""}${cgJobs(c.id)}</button>`;
  }).join("");
}
// 🖼 写真の一覧に、その子のその日の予約（時間）・🈵満了・予約なし（2026/11/12 店長）
// 「鶯谷12-19」「池袋1245-21」のように、場所と開始・終了を短く（2026/11/12 店長）
function cgShort(r){
  const t = iso => { if(!iso) return "?"; const s = String(hm(iso) || ""), m = s.match(/^(\d{1,2}):(\d{2})$/); return m ? String(Number(m[1])) + (m[2] === "00" ? "" : m[2]) : s; };
  return String(r.area || "").replace(/^出張（(.*)）$/, "$1").slice(0, 4) + t(r.start_at) + "-" + t(r.end_at);
}
function cgJobs(cid){
  const bd = ($("f_day") && $("f_day").value) || day;
  const src = bd === day ? rows : (typeof otherDay !== "undefined" && otherDay[bd] ? otherDay[bd].rows : null);
  if(!src) return "";
  const list = src.filter(r => r.cast_id === cid && r.start_at && !["cancel", "tobi", "flowed"].includes(r.status) && !(editing && r.id === editing.id))
    .sort((a, b) => String(a.start_at).localeCompare(String(b.start_at)));
  const full = bd === day && (castDays[cid] || {}).full_at;
  return `<span class="cg-jobs">${full ? `<b class="cg-full">🈵満了</b>` : ""}${list.length ? list.slice(0, 3).map(r => `<i title="${esc((r.area || "") + " " + hm(r.start_at) + "〜" + hm(r.end_at))}">${esc(cgShort(r))}</i>`).join("") + (list.length > 3 ? `<i>＋${list.length - 3}</i>` : "") : `<i class="cg-none">予約なし</i>`}</span>`;
}
function pickCastGrid(id){
  const sel = $("f_cast"); if(!sel || sel.value === id) return;
  sel.value = id; sel.dispatchEvent(new Event("change", { bubbles: true }));
  if(typeof formDirty !== "undefined") formDirty = true;
  paintCastGrid();
}
{ const __fillCastSelG = fillCastSel; fillCastSel = function(){ const r = __fillCastSelG.apply(this, arguments); paintCastGrid(); return r; }; }
{ const __onCastG = onCast; onCast = function(){ const r = __onCastG.apply(this, arguments); document.querySelectorAll("#castGrid .cg-c").forEach(b => b.classList.toggle("on", (b.getAttribute("onclick") || "").includes("'" + $("f_cast").value + "'"))); return r; }; }
document.head.insertAdjacentHTML("beforeend", `<style>
  #castGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:6px;margin-top:6px;max-height:380px;overflow:auto;padding:2px;width:100%;box-sizing:border-box}   /* 右の余白が出ないように、1人ずつの幅を広げてならべる（2026/11/12） */   /* 横いっぱい（1行に6〜7人）2026/11/12 */
  #castGrid .cg-jobs{display:flex;flex-wrap:wrap;justify-content:center;gap:2px;font-size:10.5px;font-weight:800;line-height:1.3} #castGrid .cg-jobs i{font-style:normal;background:#EEF4FF;color:#2b5aa8;border-radius:6px;padding:0 3px} #castGrid .cg-jobs i.cg-none{background:#F1F8F1;color:#2e8b57} #castGrid .cg-full{background:#E02424;color:#fff;border-radius:6px;padding:0 4px}
  #castGrid .cg-c{font-family:inherit;display:flex;flex-direction:column;align-items:center;gap:2px;width:auto;padding:5px 3px 6px;border:2px solid var(--line);border-radius:12px;background:#fff;cursor:pointer}
  #castGrid .cg-c .kbface{margin:0}
  #castGrid .cg-c:hover{border-color:#F2A7C3}
  #castGrid .cg-c.on{border-color:#E5638C;background:#FFE8EF;box-shadow:0 0 0 3px #F8BBD0}
  #castGrid .cg-c.off{opacity:.55}
  #castGrid .cg-n{font-size:12px;font-weight:900;line-height:1.2;text-align:center;word-break:break-all}
  #castGrid .cg-t{font-size:10.5px;color:var(--sub);font-weight:700}
</style>`);

/* ---------- 🏨 ホテルのメモ（2026/11/11 店長）：記録簿に出す「お店のメモ」と「キャストごとのメモ」
   kb_settings 'hotel_memos' = { ホテルのid: { shop: "お店のメモ", casts: { キャストのid: "メモ" }, by, at } }
   受付で、ホテル一覧にあるホテルを入れると出る（キャストを選ぶと、その子のメモも） ---------- */
function hotelMemos(){ const v = M.set.hotel_memos; return v && typeof v === "object" && !Array.isArray(v) ? v : {}; }
function curHotel(){
  const area = $("f_area").value.trim(), addr = $("f_address").value.replace(/\s/g, "");
  if(!addr) return null;
  const list = (M.hotels || []).filter(h => !area || h.area === area).sort((a, b) => String(b.hotel_name).length - String(a.hotel_name).length);
  return list.find(x => x.hotel_name && addr.includes(String(x.hotel_name).replace(/\s/g, ""))) || null;
}
function paintHotelMemo(){
  const el = $("hotelMemoBox"); if(!el) return;
  const h = curHotel(); if(!h){ el.innerHTML = ""; el.dataset.hid = ""; return; }
  const cid = $("f_cast").value, key = h.hotel_id + "|" + cid;
  if(el.dataset.hid === key && el.querySelector(".hmemo")) return;   // 書いている途中で消さない
  el.dataset.hid = key;
  const m = hotelMemos()[h.hotel_id] || {}, casts = m.casts || {}, ed = KB.CAN_EDIT;
  const others = Object.entries(casts).filter(([k, v]) => k !== cid && String(v || "").trim());
  const box = (id, v, ph) => ed ? `<textarea id="${id}" rows="2" maxlength="400" placeholder="${ph}">${esc(v || "")}</textarea>` : `<div class="hmtxt">${esc(v || "（なし）")}</div>`;
  el.innerHTML = `<div class="hmemo"><div class="hmh">🏨 ${esc(h.hotel_name)} のメモ${m.at ? `<small>（${KBF.staffTag(m.by)} ${esc(String(m.at).slice(5, 10).replace("-", "/"))}）</small>` : ""}</div>
    <div class="hmrow"><b>🏪 お店のメモ</b>${box("hm_shop", m.shop, "例：フロントで「〇〇」と言う・駐車場なし など（内勤みんなに出ます）")}</div>
    ${cid ? `<div class="hmrow"><b>👤 ${esc(castName(cid))}のメモ</b>${box("hm_cast", casts[cid], "例：この子はここのフロントが苦手 など")}</div>` : `<div class="hmtxt" style="color:var(--sub)">キャストを選ぶと、その子のメモも書けます</div>`}
    ${others.length ? `<details class="hmo"><summary>ほかのキャストのメモ（${others.length}人）</summary>${others.map(([k, v]) => `<div><b>${esc(castName(k))}</b>：${esc(v)}</div>`).join("")}</details>` : ""}
    ${ed ? `<button type="button" class="btn btn-ghost btn-sm" onclick="saveHotelMemo()">💾 ホテルのメモを保存</button>` : ""}</div>`;
}
async function saveHotelMemo(){
  if(!KB.CAN_EDIT) return;
  const h = curHotel(); if(!h){ toast("ホテルが見つかりません"); return; }
  const cid = $("f_cast").value;
  try{
    const r = await sb.from("kb_settings").select("value").eq("key", "hotel_memos").maybeSingle();   // ほかの人が書いた分を消さないように、読みなおしてから
    if(r && r.error) throw r.error;
    const all = Object.assign({}, (r && r.data && r.data.value) || {});
    const m = Object.assign({ casts: {} }, all[h.hotel_id] || {}); m.casts = Object.assign({}, m.casts || {});
    if($("hm_shop")) m.shop = $("hm_shop").value.trim();
    if(cid && $("hm_cast")){ const v = $("hm_cast").value.trim(); if(v) m.casts[cid] = v; else delete m.casts[cid]; }
    m.by = KB.operatorName(); m.at = new Date().toISOString();
    all[h.hotel_id] = m;
    q(await sb.from("kb_settings").upsert({ key: "hotel_memos", value: all, note: "🏨 ホテルのメモ（お店のメモ・キャストごとのメモ。受付のホテルの下）" }));
    M.set.hotel_memos = all; $("hotelMemoBox").dataset.hid = ""; paintHotelMemo();
    toast("🏨 ホテルのメモを保存しました");
  }catch(e){ toast("保存できませんでした：" + (e.message || e)); }
}
{ const __pnhM = paintNewHotel; paintNewHotel = function(){ const r = __pnhM.apply(this, arguments); try{ paintHotelMemo(); }catch(e){} return r; };
  const __onCastHM = onCast; onCast = function(){ const r = __onCastHM.apply(this, arguments); try{ paintHotelMemo(); }catch(e){} return r; };
  const __openFormHM = openForm; openForm = function(){ const r = __openFormHM.apply(this, arguments); try{ const el = $("hotelMemoBox"); if(el){ el.dataset.hid = ""; el.innerHTML = ""; } paintHotelMemo(); }catch(e){} return r; }; }
document.head.insertAdjacentHTML("beforeend", `<style>.hmemo{background:#F4F1FF;border:1.5px solid #CBBEF2;border-radius:12px;padding:8px 10px;margin:6px 0}
  .hmh{font-weight:900;color:#5b3fa6;margin-bottom:4px} .hmh small{font-weight:600;color:var(--sub);margin-left:6px}
  .hmrow{display:flex;flex-direction:column;gap:2px;margin-bottom:6px;font-size:13px} .hmrow textarea{width:100%;font-family:inherit;font-size:13.5px;border:1.5px solid #D9CFF5;border-radius:8px;padding:4px 8px}
  .hmtxt{font-size:13.5px;white-space:pre-wrap} .hmo{font-size:12.5px;margin-bottom:6px}</style>`);

/* ---------- 📌 仮予約のお知らせ（2026/11/12 店長）：1日4回（13時・17時・21時・深夜1時）声つきで知らせる。ふつうに登録して仮予約の印が消えたら止まる ---------- */
const KARI_SLOTS = ["13:00", "17:00", "21:00", "1:00"];
let kariList = [], kariLoadedAt = 0;
async function loadKari(){
  if(!HAS_KARI) return;
  try{ kariList = (q(await sb.from("kb_reservations").select("id,biz_date,kari_at,kari_by,cast_id,start_at,store_key,deleted").not("kari_at", "is", null)) || []).filter(r => !r.deleted); }catch(e){}
}
function kariAll(){   // 開いている日の予約（いちばん新しい）＋ほかの日の仮予約
  const m = new Map();
  kariList.forEach(r => m.set(r.id, r));
  (rows || []).forEach(r => { if(r.kari_at && !r.deleted) m.set(r.id, r); else m.delete(r.id); });
  return [...m.values()];
}
function kariMsg(r){
  const d = String(r.biz_date || "");
  // 読み上げ：「11月12日予約　あすかさんの仮予約がまだです」（2026/11/12 店長）
  return `${d ? Number(d.slice(5, 7)) + "月" + Number(d.slice(8)) + "日予約　" : ""}${r.cast_id ? castName(r.cast_id) + "さん" : "キャスト未定"}の仮予約がまだです`;
}
function checkKari(){
  if(!M.casts || KB.PRACTICE || !HAS_KARI) return;
  if(Date.now() - kariLoadedAt > 5 * 60000){ kariLoadedAt = Date.now(); loadKari(); }
  const bd = KB.bizDateOf(), now = Date.now(), fired = lsGet("kbFired");
  kariAll().forEach(r => KARI_SLOTS.forEach(t => {
    const due = customDue({ time: t }, bd), key = bd + "|kari" + r.id + "|" + t;
    if(due == null || fired[key] || now < due || now > due + 10 * 60000) return;
    fired[key] = 1;
    notify("alarm", { 時間: "📌 仮予約", 内容: kariMsg(r), 名前: r.kari_by || "" }, `jumpToRes(${Number(r.id)},'${String(r.biz_date || "").replace(/[^0-9-]/g, "")}')`);
  }));
  lsSet("kbFired", fired);
}
setInterval(checkKari, 20000);
document.head.insertAdjacentHTML("beforeend", `<style>.rc-kari{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:6px 10px;background:#FFF7FB;font-size:12.5px;font-weight:700}</style>`);

/* ---------- 🎨 受付の項目ごとの絵文字（2026/11/12 店長）：ラベルの頭に絵文字（もう絵文字がついている項目はそのまま） ---------- */
const LABEL_ICON = [[/^電話番号/, "📞"], [/^お客さんの名前/, "👤"], [/^メールアドレス/, "✉️"], [/^種別/, "🏷️"], [/^指名する/, "⭐"], [/^売上店舗/, "🏪"],
  [/^キャスト（/, "💃"], [/^日付・開始時刻/, "🕒"], [/^終了時刻/, "⏰"], [/^コース/, "⏳"], [/^割引/, "🎟️"], [/^エリア/, "📍"], [/^ホテル・自宅/, "🏨"], [/^交通費/, "🚕"],
  [/^支払い方法/, "💳"], [/^媒体/, "📣"], [/^状態/, "🚦"], [/^店NG・キャストNG/, "🚫"], [/^NGの理由/, "🗒️"], [/^お客様のこと/, "🙋"], [/^希望プレイ/, "💗"],
  [/^身長/, "📏"], [/^体重/, "⚖️"], [/^ウィッグ/, "💇"], [/^洋服/, "👗"], [/^スタイルブック/, "📖"]];
function paintLabelIcons(){
  document.querySelectorAll("#formBg label").forEach(l => {
    if(l.querySelector(".lbic")) return;
    const t = (l.textContent || "").trim();
    if(!t || /^[\p{Extended_Pictographic}]/u.test(t) || l.querySelector("input,select,textarea")) return;   // もう絵文字がある・チェックボックスの文字は、そのまま
    const hit = LABEL_ICON.find(([re]) => re.test(t)); if(!hit) return;
    l.insertAdjacentHTML("afterbegin", `<span class="lbic">${hit[1]}</span>`);
  });
}
paintLabelIcons();
document.head.insertAdjacentHTML("beforeend", `<style>.lbic{margin-right:4px;font-size:1.05em}</style>`);

/* ---------- 🔔 前の営業日の予約で「終了」になっていないもの：次の営業日の12:15に声でお知らせ（2026/11/12 店長：みすずが「キャストホテル入室待ち」のままだった） ---------- */
async function checkUnfinished(){
  if(!M.casts || KB.PRACTICE) return;
  const bd = KB.bizDateOf(), now = Date.now(), due = customDue({ time: "12:15" }, bd), key = bd + "|unfin";
  const fired = lsGet("kbFired");
  if(due == null || fired[key] || now < due || now > due + 30 * 60000) return;   // 12:15〜12:45 に開いていれば1回
  fired[key] = 1; lsSet("kbFired", fired);
  const prev = addDays(bd, -1);
  let list = [];
  try{ list = (q(await sb.from("kb_reservations").select("id,cast_id,start_at,status,biz_date").eq("biz_date", prev).eq("deleted", false)) || []).filter(r => !["done", "cancel", "tobi", "flowed"].includes(r.status)); }catch(e){ return; }
  if(!list.length) return;
  const d = new Date(prev + "T12:00:00Z"), who = list.slice(0, 3).map(r => (r.cast_id ? castName(r.cast_id) : "キャスト未定") + "さん").join("・") + (list.length > 3 ? "ほか" : "");
  notify("alarm", { 時間: "12:15", 内容: `${d.getUTCMonth() + 1}月${d.getUTCDate()}日の予約で、終了になっていないものが${list.length}件あります（${who}）`, 名前: "" }, `jumpToRes(${Number(list[0].id)},'${prev}')`);
}
setInterval(checkUnfinished, 60000);

/* ---------- 🏨 ホテル（2026/11/12 店長）
   ・別の呼び方（NOX・ノックス・ノクス）：ホテル一覧の tags に「別名:ノクス」。別名で入れても、受付はいつも正式名にかえる
   ・一覧にない名前を入れたら「どのホテルの別の呼び方？」を選んで登録できる
   ・店NG（×）・遠い（△）のホテル、このキャストの×△を、ホテルの欄の下にはっきり出す ---------- */
const hNorm = s => String(s || "").normalize("NFKC").toLowerCase().replace(/[\s　・\-‐ー－.]/g, "").replace(/[ぁ-ゖ]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 0x60)).replace(/^(ホテル|hotel)/, "");
const hAliases = h => (h.tags || []).filter(t => String(t).startsWith("別名:")).map(t => String(t).slice(3).trim()).filter(Boolean);
const hAreaOk = (h, area) => !area || !h.area || h.area === area || area.includes(h.area) || h.area.includes(area);
// 名前（または別名）がぴったり同じホテル（「ホテル」「HOTEL」・空白・カタカナひらがなのちがいは同じとみる）
function hotelByName(name, area){
  const k = hNorm(name); if(!k) return null;
  const list = (M.hotels || []).filter(h => hAreaOk(h, area));
  return list.find(h => hNorm(h.hotel_name) === k) || list.find(h => hAliases(h).some(a => hNorm(a) === k)) || null;
}
// 受付のホテル：正式名でも別名でも見つける
{ const __curHotelA = curHotel; curHotel = function(){
    const h = __curHotelA(); if(h) return h;
    const addr = $("f_address") ? $("f_address").value : ""; if(!addr.trim()) return null;
    return hotelByName(hotelNameFromAddr(addr), $("f_area").value.trim());
  }; }
// 別名で入れたら、正式名にかえる（部屋番号はそのまま）
function hotelToOfficial(quiet){
  const el = $("f_address"); if(!el || !el.value.trim()) return false;
  const name = hotelNameFromAddr(el.value), h = hotelByName(name, $("f_area").value.trim());
  if(!h || name === h.hotel_name) return false;
  const rest = el.value.trim().slice(el.value.trim().indexOf(name) + name.length);
  el.value = h.hotel_name + rest;
  if(!quiet) toast(`🏨「${name}」→ 正式な名前「${h.hotel_name}」にしました`);
  try{ recalc(); }catch(e){}
  return true;
}
document.addEventListener("change", e => { if(e.target && e.target.id === "f_address" && hotelToOfficial()){ try{ checkNewHotel(); }catch(x){} } }, true);
// 一覧にない名前：別の呼び方として登録できるように（似た名前を先に）
{ const __pnhAlias = paintNewHotel; paintNewHotel = function(){
    if($("f_address") && hotelByName(hotelNameFromAddr($("f_address").value), $("f_area").value.trim())){ hotelToOfficial(); }
    const r = __pnhAlias.apply(this, arguments);
    const box = $("newHotelBox"), nh = box && box.querySelector(".newhotel");
    if(nh && KB.CAN_EDIT){
      const name = hotelNameFromAddr($("f_address").value), area = $("f_area").value.trim(), k = hNorm(name);
      const inArea = (M.hotels || []).filter(h => hAreaOk(h, area));
      const sim = inArea.filter(h => { const a = hNorm(h.hotel_name); return k.length >= 2 && (a.includes(k) || k.includes(a) || hAliases(h).some(x => hNorm(x).includes(k))); });
      const rest = inArea.filter(h => !sim.includes(h)).sort((a, b) => String(a.hotel_name).localeCompare(String(b.hotel_name), "ja"));
      const opt = h => `<option value="${esc(h.hotel_id)}">${h.store_status === "ng" ? "🚫" : h.store_status === "far" ? "△" : ""}${esc(h.hotel_name)}${h.area ? "（" + esc(h.area) + "）" : ""}</option>`;
      nh.insertAdjacentHTML("afterbegin", `<div class="halias">🔁 <b>${esc(name)}</b> は、一覧のホテルの別の呼び方ですか？
        <select id="nh_alias"><option value="">（どのホテルの呼び方？）</option>${sim.length ? `<optgroup label="似た名前">${sim.map(opt).join("")}</optgroup>` : ""}<optgroup label="${esc(area || "ぜんぶ")}のホテル">${rest.map(opt).join("")}</optgroup></select>
        <button type="button" class="btn btn-primary btn-sm" onclick="addHotelAlias()">この別の呼び方として登録</button>
        <div class="hint">登録すると、次から「${esc(name)}」と入れても正式な名前になります（店NG・メモもそのホテルのものが出ます）</div></div>`);
    }
    try{ paintHotelStatus(); }catch(e){}
    return r;
  }; }
async function addHotelAlias(){
  const id = $("nh_alias") && $("nh_alias").value, h = (M.hotels || []).find(x => x.hotel_id === id);
  if(!h){ toast("どのホテルの呼び方か選んでください"); return; }
  const name = hotelNameFromAddr($("f_address").value).trim(); if(!name){ return; }
  if(!confirm(`「${name}」を「${h.hotel_name}」の別の呼び方として登録しますか？`)) return;
  const tags = (Array.isArray(h.tags) ? h.tags : []).filter(t => String(t) !== "別名:" + name).concat(["別名:" + name]);
  try{
    q(await sb.from("prof_hotels").update({ tags }).eq("hotel_id", h.hotel_id));
    h.tags = tags; hotelToOfficial(true); checkNewHotel();
    toast(`🔁「${name}」を「${h.hotel_name}」の別の呼び方にしました`);
  }catch(e){ toast("登録できませんでした：" + (e.message || e)); }
}
// 🚫 店NG・△、このキャストの×△（入れたホテル）＋ そのエリアの店NG・△のホテル
function paintHotelStatus(){
  const el = $("hotelStatusBox"); if(!el) return;
  const area = $("f_area") ? $("f_area").value.trim() : "", h = curHotel();
  const c = M.casts.find(x => x.id === $("f_cast").value), p = c && c.prof_id && typeof profById !== "undefined" && profById ? profById[c.prof_id] : null, hp = (p && p.hotelPrefs) || {};
  const out = [];
  if(h){
    if(h.store_status === "ng") out.push(`<div class="hst ng">🚫 「${esc(h.hotel_name)}」は<b>店としてNG</b>のホテルです${h.note ? "：" + esc(h.note) : ""}</div>`);
    else if(h.store_status === "far") out.push(`<div class="hst far">△ 「${esc(h.hotel_name)}」は店として<b>△（遠いから微妙）</b>${h.note ? "：" + esc(h.note) : ""}</div>`);
    if(c && (hp.ng || []).includes(h.hotel_id)) out.push(`<div class="hst ng">🙅 ${esc(castName(c.id))}さんは「${esc(h.hotel_name)}」が <b>×（NG）</b>${(hp.memo || {})[h.hotel_id] ? "：" + esc(hp.memo[h.hotel_id]) : ""}</div>`);
    else if(c && (hp.conditional || []).includes(h.hotel_id)) out.push(`<div class="hst far">△ ${esc(castName(c.id))}さんは「${esc(h.hotel_name)}」が △${(hp.memo || {})[h.hotel_id] ? "：" + esc(hp.memo[h.hotel_id]) : "（条件つき）"}</div>`);
  }
  const bad = area ? (M.hotels || []).filter(x => hAreaOk(x, area) && x.area && (x.store_status === "ng" || x.store_status === "far")) : [];
  if(bad.length) out.push(`<details class="hst list"><summary>🏨 ${esc(area)}の 店NG・△ のホテル（${bad.length}）</summary>${bad.map(x => `<div>${x.store_status === "ng" ? "🚫" : "△"} <b>${esc(x.hotel_name)}</b>${hAliases(x).length ? `<small>（${esc(hAliases(x).join("・"))}）</small>` : ""}${x.note ? "：" + esc(x.note) : ""}</div>`).join("")}</details>`);
  el.innerHTML = out.join("");
}
["change", "input"].forEach(ev => document.addEventListener(ev, e => { const id = e.target && e.target.id; if(["f_areaSel", "f_area", "f_address", "f_cast", "f_place"].includes(id)){ clearTimeout(paintHotelStatus.t); paintHotelStatus.t = setTimeout(() => { try{ paintHotelStatus(); }catch(x){} }, 300); } }, true));
{ const __openFormHS = openForm; openForm = function(){ const r = __openFormHS.apply(this, arguments); try{ paintHotelStatus(); }catch(e){} return r; }; }
document.head.insertAdjacentHTML("beforeend", `<style>.halias{background:#F2F7FF;border:1.5px solid #B9CDF2;border-radius:10px;padding:6px 10px;margin-bottom:8px;font-size:13px}.halias select{max-width:260px}
  .hst{border-radius:10px;padding:6px 10px;margin:6px 0;font-size:13.5px;font-weight:700} .hst.ng{background:#FFE8EC;border:2px solid #E02424;color:#B0213F} .hst.far{background:#FFF6CC;border:2px solid #F2C200;color:#7a5a00}
  .hst.list{background:#FAF7F8;border:1.5px solid #E5D9DE;color:#5C4B4F;font-weight:600} .hst.list summary{cursor:pointer;font-weight:800}</style>`);

/* ---------- 👛 内勤の日払い：「金額」と「どこから」は両方いる（2026/11/12 店長）
   ・片方だけ入れたら、もう片方がピカピカ
   ・片方だけのまま保存した日があれば、次の営業日から、その内勤が記録簿を開いたときに声でお知らせ（直すまで毎日1回） ---------- */
document.head.insertAdjacentHTML("beforeend", `<style>@keyframes spneed{0%,100%{box-shadow:0 0 0 0 rgba(255,107,157,0)}50%{box-shadow:0 0 0 4px rgba(255,107,157,.7)}} .sp-need{animation:spneed 1.1s ease-in-out infinite;border-color:#FF6B9D !important}</style>`);
const SP_ME = () => ({ "きゃ": "kya", "すや": "suya", "らん": "ran", "かみ": "kami", "わか": "waka" })[KB.operatorName()] || "";
const spMissing = w => (Number(w.day_paid) > 0) !== !!String(w.pay_source || "");   // 金額とどこからの、片方だけ
async function checkStaffPayMissing(){
  if(!M.casts || KB.PRACTICE) return;
  const me = SP_ME(); if(!me) return;
  const bd = KB.bizDateOf(), key = bd + "|spmiss|" + me, fired = lsGet("kbFired");
  if(fired[key]) return;
  let list = [];
  try{ list = (q(await sb.from("kb_staff_work").select("biz_date,day_paid,pay_source").eq("staff_id", me).lt("biz_date", bd).gte("biz_date", addDays(bd, -31))) || []).filter(spMissing); }catch(e){ return; }
  fired[key] = 1; lsSet("kbFired", fired);
  if(!list.length) return;
  const md = d => Number(String(d).slice(5, 7)) + "月" + Number(String(d).slice(8)) + "日";
  const what = list.map(w => md(w.biz_date) + (Number(w.day_paid) > 0 ? "（どこから払ったか）" : "（金額）")).join("・");
  notify("alarm", { 時間: "👛 日払い", 内容: `${KB.operatorName()}さん、日払いの入れ忘れがあります：${what}。記録簿のその日の「内勤の日払い」で入れてください`, 名前: "" }, `$('day').value='${list[0].biz_date}';loadDay()`);
}
setTimeout(checkStaffPayMissing, 5000); setInterval(checkStaffPayMissing, 60000);   // 読みこみが終わるのを待って（1日1回だけ出す）

// ▶ 起動（2026/11/10 ファイルを分けたので、ぜんぶ読みこんだあとのここで）
init();
