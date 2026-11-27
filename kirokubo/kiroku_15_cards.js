/* ---------- 🗂 キャストごとの予約カード（2026/11/27 店長 修正2）
   ・キャンセル・トビ・流れた は、そのキャストの枠のいちばん下にまとめて、たたんでおく（押すと開く）
   ・終わった予約（終了）のカードはグレーに
   ・予約カードの並び順を選べる（開始が早い順／遅い順。この端末に覚える） ---------- */
function cardSortGet(){ try{ return localStorage.getItem("kbCardSort") || "early"; }catch(e){ return "early"; } }
function cardSortSet(v){ try{ localStorage.setItem("kbCardSort", v); }catch(e){} renderListTable(); }
function cardsTidy(){
  const sel = $("s_cardsort"); if(sel && sel.value !== cardSortGet()) sel.value = cardSortGet();
  const late = cardSortGet() === "late", rowOf = id => rows.find(r => String(r.id) === String(id));
  document.querySelectorAll("#list > .cblock:not(.cxbox)").forEach(b => {
    const cards = [...b.querySelectorAll(":scope > .rescard")];
    if(!cards.length) return;
    const live = cards.filter(c => !c.classList.contains("cx")), cx = cards.filter(c => c.classList.contains("cx"));
    // 並び順：開始の時刻で
    const at = c => { const r = rowOf(String(c.id).replace(/^rc-/, "")); return String((r && r.start_at) || ""); };
    if(live.length > 1){ const mk = document.createComment("cards"); live[0].before(mk); live.slice().sort((a, z) => late ? at(z).localeCompare(at(a)) : at(a).localeCompare(at(z))).forEach(c => mk.before(c)); mk.remove(); }
    // 終わった予約はグレー
    live.forEach(c => { const r = rowOf(String(c.id).replace(/^rc-/, "")); c.classList.toggle("rcdone", !!(r && r.status === "done")); });
    // キャンセル・トビ・流れた → いちばん下にたたんで
    if(cx.length){
      const n = s => cx.filter(c => { const r = rowOf(String(c.id).replace(/^rc-/, "")); return r && r.status === s; }).length;
      const d = document.createElement("details"); d.className = "cxfold";
      d.innerHTML = `<summary>🚫 キャンセル・トビ・流れた（${[n("cancel") ? "キャンセル " + n("cancel") : "", n("tobi") ? "トビ " + n("tobi") : "", n("flowed") ? "流れた " + n("flowed") : ""].filter(Boolean).join("・")}）</summary>`;
      cx.forEach(c => d.appendChild(c));
      b.appendChild(d);
    }
  });
}
{ const __rlCards = renderListTable; renderListTable = function(){ const r = __rlCards.apply(this, arguments); try{ cardsTidy(); }catch(e){ console.warn("cardsTidy", e); } return r; }; }
document.head.insertAdjacentHTML("beforeend", `<style>
  .rescard.rcdone{opacity:.55;filter:grayscale(.85)} .rescard.rcdone:hover{opacity:.85}
  details.cxfold{margin:6px 0 2px;border:1.5px dashed #E5A0B0;border-radius:10px;background:#FFF8FA}
  details.cxfold > summary{cursor:pointer;font-size:12.5px;font-weight:800;color:#B0506A;padding:4px 10px}
  details.cxfold > .rescard{margin:4px 6px}
</style>`);
/* ---------- 📝 備考を書く：文字数の制限なし・何行でも（前は1行の小窓）2026/11/27 店長 修正2 ---------- */
addLogPrompt = function(id){
  if(!KB.CAN_EDIT) return;
  const old = $("logBg"); if(old) old.remove();
  const bg = document.createElement("div"); bg.id = "logBg";
  bg.style.cssText = "position:fixed;inset:0;z-index:400;background:rgba(0,0,0,.4);display:flex;align-items:flex-start;justify-content:center;padding:40px 14px;overflow:auto";
  bg.innerHTML = `<div style="background:#fff;border-radius:16px;padding:14px 16px;max-width:560px;width:100%">
    <h3 style="margin:0 0 6px">📝 備考を書く</h3>
    <textarea id="logText" rows="6" style="width:100%;font-size:15px;line-height:1.55;border:1.5px solid #E5D9F2;border-radius:10px;padding:8px;box-sizing:border-box" placeholder="例：お客様に折り返し済み／キャストに場所変更を連絡（長くても大丈夫です）"></textarea>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
      <button type="button" class="btn btn-ghost" onclick="$('logBg').remove()">やめる</button>
      <button type="button" class="btn btn-primary" id="logSave">💾 書く</button></div></div>`;
  document.body.appendChild(bg);
  bg.addEventListener("click", e => { if(e.target === bg) bg.remove(); });
  const ta = $("logText"); ta.focus();
  $("logSave").onclick = async () => {
    const t = ta.value.trim(); if(!t) return;
    $("logSave").disabled = true;
    if(await pushLog(id, t)){ bg.remove(); toast("📝 備考に書きました"); renderList(); if(typeof editing !== "undefined" && editing && editing.id === id && typeof renderFormLog === "function") renderFormLog(); }
    else $("logSave").disabled = false;
  };
};
/* ---------- 🎨 状態のプルダウンを開いたときも、予約カードと同じ色に（2026/11/27 店長 修正3） ---------- */
function stOptColor(sel){
  if(!sel || !sel.options) return;
  [...sel.options].forEach(o => { const k = o.value; o.className = k && typeof STATUS !== "undefined" && STATUS[k] ? "st " + k : "stnone"; });
}
["mousedown", "focusin", "keydown"].forEach(ev => document.addEventListener(ev, e => { const s = e.target && e.target.closest && e.target.closest("select.stsel"); if(s) stOptColor(s); }, true));
document.head.insertAdjacentHTML("beforeend", `<style>select.stsel option{font-weight:800} select.stsel option.stnone{background:#fff;color:#333} select.stsel optgroup{background:#fff;color:#333}</style>`);

/* ---------- 💃 受付のキャスト：写真の一覧で選ぶので、下のプルダウンはかくす（PC）。写真の一覧は、選んだら自動でたたむ（2026/11/27 店長 修正3） ---------- */
document.head.insertAdjacentHTML("beforeend", `<style>body:not(.mob) #f_cast{display:none !important}
  details#cgFold{margin-top:6px;border:1.5px solid #E5D9F2;border-radius:12px;padding:2px 8px;background:#FCFAFF;width:100%;box-sizing:border-box}
  details#cgFold > summary{cursor:pointer;font-weight:800;font-size:13.5px;color:#6b4fa0;padding:4px 2px}</style>`);
function cgFoldWrap(){
  const box = $("castGrid"); if(!box) return null;
  let fold = $("cgFold");
  if(!fold){ fold = document.createElement("details"); fold.id = "cgFold"; fold.open = true; fold.innerHTML = `<summary></summary>`; }
  if(box.parentElement !== fold){ box.insertAdjacentElement("beforebegin", fold); fold.appendChild(box); }
  const c = M.casts.find(x => x.id === ($("f_cast") || {}).value);
  // 11/28 店長：選んでいるキャストの写真も出す（たたんでいても見える）
  const store = ($("f_store") || {}).value || "";
  fold.querySelector("summary").innerHTML = c ? `<span class="cgsel">${typeof KBF !== "undefined" ? KBF.img(c, 56, store) : ""}<span><b>💃 ${esc(c.official_name || c.temp_name || "")}</b><small>を選んでいます・押すと一覧を開いて選びなおせます</small></span></span>` : "📸 キャスト一覧（写真を押して選ぶ）";
  return fold;
}
{ const __pcgF = paintCastGrid; paintCastGrid = function(){ const r = __pcgF.apply(this, arguments); try{ const f = cgFoldWrap(); if(f && !($("f_cast") || {}).value) f.open = true; }catch(e){} return r; }; }
{ const __pickCgF = pickCastGrid; pickCastGrid = function(id){ const r = __pickCgF.apply(this, arguments); try{ const f = cgFoldWrap(); if(f) f.open = false; }catch(e){} return r; }; }
{ const __ofCg = openForm; openForm = function(){ const r = __ofCg.apply(this, arguments); setTimeout(() => { try{ const f = cgFoldWrap(); if(f) f.open = !($("f_cast") || {}).value; }catch(e){} }, 300); return r; }; }
/* ---------- 🏠 待機場所ボーナス（2026/11/27 店長：りぃ）
   台帳の条件「待機場所ボーナス」（交通費バックの出勤日ごと・params.daily）がある子が、その待機場所（例：鶯谷）で「待機中」か「仕事中」になったら、
   ボタンを押さなくても自動で、その日のプラス（報酬に足す）に入れる。1日1回（もう入っていれば入れない）。今日の営業日だけ ---------- */
const SB_BONUS_LABEL = "待機場所ボーナス";
const SB_DONE = l => (l || []).some(i => i && (i.label === SB_BONUS_LABEL || i.label === TB_DAILY_LABEL));
tbDailyRule = function(castId, cd){
  const r = (rulesOn(castId) || []).find(x => x.kind === "transport_back" && x.params && Number(x.params.daily) > 0);
  if(!r) return null;
  const want = String(r.params.standby || "").replace(/待機$/, ""), now = String((cd && cd.standby) || "");
  return !want || now === want || now.includes(want) ? r : null;   // 「鶯谷」「鶯谷待機」どちらでも
};
tbDailyAdd = async function(castId, auto){
  const r = tbDailyRule(castId, castDays[castId]); if(!r) return false;
  const l = curItems(castId, "plus"); if(SB_DONE(l)) return false;
  l.push({ label: SB_BONUS_LABEL, amount: Number(r.params.daily) });
  await saveDay(castId, { plus_items: l });
  toast(`🏠 ${typeof castName === "function" ? castName(castId) : ""}：${r.params.standby || "待機場所"}に来たので ${yen(Number(r.params.daily))} を報酬に足しました${auto ? "（自動）" : ""}`);
  return true;
};
tbDailyHtml = function(castId){
  const cd = castDays[castId] || {}, r = (rulesOn(castId) || []).find(x => x.kind === "transport_back" && x.params && Number(x.params.daily) > 0);
  if(!r) return "";
  const amt = Number(r.params.daily);
  if(SB_DONE(curItems(castId, "plus"))) return `<div class="tbdaily done">🏠 ${SB_BONUS_LABEL} ${yen(amt)} は報酬に足してあります（精算のプラス）</div>`;
  return `<div class="tbdaily wait">🏠 ${esc(r.params.standby || "待機場所")}で待機中・仕事中になったら、${SB_BONUS_LABEL} ${yen(amt)} を自動で報酬に足します</div>`;
};
let sbAutoBusy = false;
async function sbAuto(){
  if(sbAutoBusy || !KB.CAN_EDIT || typeof tlRows !== "function") return;
  if(typeof day !== "undefined" && day !== KB.bizDateOf()) return;
  sbAutoBusy = true;
  try{
    for(const x of tlRows()){
      if(!x.c) continue;
      const id = x.c.id, cd = castDays[id] || {};
      if(!tbDailyRule(id, cd) || SB_DONE(curItems(id, "plus"))) continue;
      const st = boardState(x);
      if(!["wait", "work"].includes(st) && !["待機中", "仕事中"].includes(cd.status)) continue;
      await tbDailyAdd(id, true);
    }
  }catch(e){ console.warn("sbAuto", e); }
  finally{ sbAutoBusy = false; }
}
{ const __rbSb = renderBoard; renderBoard = function(){ const r = __rbSb.apply(this, arguments); setTimeout(sbAuto, 500); return r; }; }
/* ---------- ⚠️ 必須でまだ：項目に絵文字・キャストが決まっていなければ「💃 キャスト」も出す（2026/11/27 店長 修正3） ---------- */
const REQ_ICON = [[/^名前を聞いた/, "👤"], [/^電話番号/, "📞"], [/^お客さんの名前/, "👤"], [/^種別/, "🏷️"], [/^指名する/, "⭐"], [/^売上店舗/, "🏪"], [/^キャスト/, "💃"], [/^開始時刻/, "🕒"], [/^コース/, "⏳"], [/^エリア/, "📍"],
  [/^ラブホ|^ホテル/, "🏨"], [/^AF/, "🍑"], [/^支払い/, "💳"], [/^媒体/, "📣"], [/^スマホの仮入力/, "📱"], [/^報酬を手で直した/, "💴"], [/^状態/, "🚦"]];
{ const __prb = paintReqBar; paintReqBar = function(){
  const r = __prb.apply(this, arguments);
  try{
    const bar = $("reqBar"); if(!bar) return r;
    const cancelLike = ["cancel", "tobi", "flowed"].includes(($("f_status") || {}).value);
    if(!cancelLike && $("f_cast") && !$("f_cast").value && !bar.querySelector(".rq-cast")){
      const b = `<button type="button" class="rq-cast" onclick="const f=$('cgFold')||$('castGrid')||$('f_cast');if(f){if(f.tagName==='DETAILS')f.open=true;f.scrollIntoView({block:'center',behavior:'smooth'});}">キャスト</button>`;
      if(bar.classList.contains("ok")){ bar.className = "reqbar ng"; bar.innerHTML = `<span class="rqlbl">⚠️ 必須でまだ：</span>` + b; }
      else { const lbl = bar.querySelector(".rqlbl"); if(lbl) lbl.insertAdjacentHTML("afterend", b); }
    }
    bar.querySelectorAll("button").forEach(btn => { if(btn.dataset.ic) return; const t = btn.textContent.trim(), ic = (REQ_ICON.find(([re]) => re.test(t)) || [])[1]; if(ic){ btn.textContent = ic + " " + t; } btn.dataset.ic = "1"; });
  }catch(e){}
  return r;
}; }

/* ---------- 🗺 今どこに誰が：上の「すべて・待機中・仕事中…今いない」の札はなくす（2026/11/27 店長 修正3） ---------- */
document.head.insertAdjacentHTML("beforeend", `<style>#boardGrid .bfbar{display:none !important}</style>`);
try{ boardFilter = ""; }catch(e){}

/* ---------- あかさたな…のジャンプ：日付を変えたら「全員」にもどす（2026/11/27 店長 修正3） ---------- */
{ let kanaDay = null; const __ldKana = loadDay; loadDay = async function(){
  const want = $("day") ? $("day").value : "";
  if(kanaDay !== null && want !== kanaDay){ try{ kanaSel = ""; }catch(e){} }
  kanaDay = want;
  return __ldKana.apply(this, arguments);
}; }

/* ---------- 🔠 文字の大きさ：小・中・大（この端末に覚える）2026/11/27 店長 修正3 ---------- */
const FS_SIZES = { s: "90%", m: "100%", l: "135%" };
function fsGet(){ try{ return localStorage.getItem("kbFontSize") || "m"; }catch(e){ return "m"; } }
function fsSet(k){ try{ localStorage.setItem("kbFontSize", k); }catch(e){} fsApply(); }
function fsApply(){
  const k = FS_SIZES[fsGet()] ? fsGet() : "m";
  document.documentElement.style.zoom = "";
  document.body.style.zoom = k === "m" ? "" : FS_SIZES[k];
  const bar = $("fsBar"); if(bar) bar.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.k === k));
}
(function(){
  const bar = document.createElement("div"); bar.id = "fsBar";
  bar.innerHTML = `<span>文字の大きさ</span>` + [["s", "小"], ["m", "中"], ["l", "大"]].map(([k, l]) => `<button type="button" data-k="${k}" onclick="fsSet('${k}')">${l}</button>`).join("");
  // 11/28 店長：左下はポータルのボタンと重なって見えない → 「予約カード」の並びの右に置く
  const cs = $("s_cardsort"), lab = cs && cs.closest("label");
  if(lab){ bar.classList.add("inbar"); lab.insertAdjacentElement("afterend", bar); } else document.body.appendChild(bar);
  document.head.insertAdjacentHTML("beforeend", `<style>#fsBar.inbar{position:static;box-shadow:none;left:auto;bottom:auto;z-index:auto;padding:3px 8px}</style>`);
  document.head.insertAdjacentHTML("beforeend", `<style>#fsBar{position:fixed;left:10px;bottom:10px;z-index:250;display:flex;gap:3px;align-items:center;background:#fff;border:1.5px solid #E5D9F2;border-radius:99px;padding:3px 6px;box-shadow:0 2px 8px rgba(0,0,0,.1);font-size:12px;font-weight:800;color:#6b5a5f}
    #fsBar button{border:1.5px solid #E5D9F2;background:#fff;border-radius:99px;padding:1px 9px;font-weight:900;cursor:pointer;font-family:inherit} #fsBar button.on{background:#E5638C;border-color:#E5638C;color:#fff}
    #fsBar button[data-k=s]{font-size:11px} #fsBar button[data-k=m]{font-size:13px} #fsBar button[data-k=l]{font-size:15px}</style>`);
  fsApply();
})();

/* ---------- ↕ 札をつまんだまま画面の上・下のはしに持っていくと、自動でスクロール（2026/11/27 店長 修正3） ---------- */
(function(){
  let dragging = false, y = 0, raf = 0;
  const EDGE = 90;
  function tick(){
    if(!dragging){ raf = 0; return; }
    const h = window.innerHeight;
    if(y < EDGE) window.scrollBy(0, -Math.ceil((EDGE - y) / 4));
    else if(y > h - EDGE) window.scrollBy(0, Math.ceil((y - (h - EDGE)) / 4));
    raf = requestAnimationFrame(tick);
  }
  document.addEventListener("pointermove", e => {
    dragging = !!document.querySelector("#boardGrid .chipc.dragging, .chipc.ghost, .dragging");
    y = e.clientY;
    if(dragging && !raf) raf = requestAnimationFrame(tick);
  }, true);
  const stop = () => { dragging = false; };
  document.addEventListener("pointerup", stop, true); document.addEventListener("pointercancel", stop, true);
  document.addEventListener("dragover", e => { y = e.clientY; dragging = true; if(!raf) raf = requestAnimationFrame(tick); }, true);
  document.addEventListener("dragend", stop, true); document.addEventListener("drop", stop, true);
})();
/* ---------- 📞 予約カード：確認電話で読みあげる並び（2026/11/28 店長）。幅は決まった大きさ（画面の幅・文字の大きさで並びが変わらない） ---------- */
document.head.insertAdjacentHTML("beforeend", `<style>
  .rescard{width:1180px;max-width:none;box-sizing:border-box}   /* 11/28 店長：横長でよい・縦を短く（3列） */
  .rescard .rc-call{display:grid;grid-template-columns:470px 290px 1fr;grid-template-areas:"l r b";column-gap:16px;padding:8px 10px;align-items:start}
  .rescard .rc-cl{grid-area:l;min-width:0} .rescard .rc-cr{grid-area:r;min-width:0;border-left:1.5px dashed #F1E3E7;padding-left:12px} .rescard .rc-cb{grid-area:b;min-width:0;border-left:1.5px dashed #F1E3E7;padding-left:12px}
  .rescard .rc-cr .rc-f{grid-template-columns:70px 1fr;margin-bottom:4px} .rescard .rc-cb .memos, .rescard .rc-cb > div{max-height:none}
  #list .cblock{overflow-x:auto}
  .rescard .rc-f{display:grid;grid-template-columns:92px 1fr;align-items:start;gap:6px;padding:4px 0;border-bottom:1px dotted #EEE6E9;font-size:14.5px}
  .rescard .rc-f:last-child{border-bottom:0}
  .rescard .rc-fl{font-weight:900;color:#8a6b74;font-size:13px;white-space:nowrap;padding-top:2px}
  .rescard .rc-fv{min-width:0;line-height:1.6;word-break:break-word} .rescard .rc-fv b{font-size:15.5px}
  .rescard .rc-fv select, .rescard .rc-fv input{font-family:inherit;font-size:14px}
  .rescard .rc-place .inl input{display:none} .rescard .rc-place .inl{display:inline-flex;margin-left:4px}
  .rescard .rc-fv .inl{display:inline-flex;gap:4px;flex-wrap:wrap;margin-left:4px}
  .rescard .rc-h{font-weight:900;color:#8a6b74;font-size:13px;margin-bottom:2px}
  .rescard .rc-fv .tel{margin-left:6px}
</style>`);
/* ---------- 📝 何行でも書ける入力の窓（備考を書く・直す）。長さの制限なし（2026/11/28 店長） ---------- */
function kbTextPrompt(title, init){
  return new Promise(res => {
    const old = $("logBg"); if(old) old.remove();
    const bg = document.createElement("div"); bg.id = "logBg";
    bg.style.cssText = "position:fixed;inset:0;z-index:400;background:rgba(0,0,0,.4);display:flex;align-items:flex-start;justify-content:center;padding:40px 14px;overflow:auto";
    bg.innerHTML = `<div style="background:#fff;border-radius:16px;padding:14px 16px;max-width:600px;width:100%">
      <h3 style="margin:0 0 6px">${esc(title)}</h3>
      <textarea id="logText" rows="7" style="width:100%;font-size:15px;line-height:1.55;border:1.5px solid #E5D9F2;border-radius:10px;padding:8px;box-sizing:border-box" placeholder="長くても大丈夫です（改行もできます）"></textarea>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
        <button type="button" class="btn btn-ghost" id="logCancel">やめる</button>
        <button type="button" class="btn btn-primary" id="logSave">💾 決める</button></div></div>`;
    document.body.appendChild(bg);
    const ta = $("logText"); ta.value = init || ""; ta.focus();
    const done = v => { bg.remove(); res(v); };
    $("logCancel").onclick = () => done(null);
    bg.addEventListener("click", e => { if(e.target === bg) done(null); });
    $("logSave").onclick = () => done(ta.value);
  });
}
addLogPrompt = async function(id){
  if(!KB.CAN_EDIT) return;
  const t = await kbTextPrompt("📝 備考を書く", "");
  if(!t || !t.trim()) return;
  if(await pushLog(id, t.trim())){ toast("📝 備考に書きました"); renderList(); if(typeof editing !== "undefined" && editing && editing.id === id && typeof renderFormLog === "function") renderFormLog(); }
};

/* ---------- 📝 予約カードの備考は、左の列（お客さん〜OP・希望）の高さまで。あふれたら「▼ 全部見る」で開く（2026/11/28 店長） ---------- */
const rcMemoOpen = new Set();
function rcFitMemos(){
  document.querySelectorAll(".rescard .rc-call").forEach(call => {
    const cl = call.querySelector(".rc-cl"), cb = call.querySelector(".rc-cb"), box = cb && cb.querySelector(".bikobox"); if(!cl || !box) return;
    const id = (call.closest(".rescard") || {}).id || "";
    const old = cb.querySelector(".rc-mmore"); if(old) old.remove();
    box.classList.remove("rc-clip");
    if(rcMemoOpen.has(id)){ box.style.maxHeight = "none"; cb.insertAdjacentHTML("beforeend", `<button type="button" class="rc-mmore" onclick="rcMemoOpen.delete('${id}');rcFitMemos()">▲ 備考をたたむ</button>`); return; }
    const head = (cb.querySelector(".rc-h") || {}).offsetHeight || 0, add = (cb.querySelector(".addbiko") || {}).offsetHeight || 0;
    const room = Math.max(90, cl.offsetHeight - head - add - 14);
    box.style.maxHeight = room + "px";
    if(box.scrollHeight > room + 4){
      box.classList.add("rc-clip");
      const n = box.querySelectorAll(".bk1").length;
      cb.insertAdjacentHTML("beforeend", `<button type="button" class="rc-mmore" onclick="rcMemoOpen.add('${id}');rcFitMemos()">▼ 備考を全部見る（${n}件）</button>`);
    }
  });
}
{ const __rlFit = renderListTable; renderListTable = function(){ const r = __rlFit.apply(this, arguments); requestAnimationFrame(() => { try{ rcFitMemos(); }catch(e){} }); return r; }; }
window.addEventListener("resize", () => { try{ rcFitMemos(); }catch(e){} });
document.head.insertAdjacentHTML("beforeend", `<style>
  .rescard .rc-cb .bikobox{overflow:hidden;position:relative}
  .rescard .rc-cb .bikobox.rc-clip{cursor:pointer;-webkit-mask-image:linear-gradient(#000 75%,transparent);mask-image:linear-gradient(#000 75%,transparent)}
  .rescard .rc-cb .rc-mmore{display:block;width:100%;margin:4px 0;border:1.5px dashed #E5C97A;background:#FFFBEA;border-radius:10px;padding:3px 8px;font-family:inherit;font-weight:800;font-size:12.5px;color:#8A6100;cursor:pointer}
</style>`);
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest(".rescard .bikobox.rc-clip"); if(!b || e.target.closest("a,button")) return; const id = (b.closest(".rescard") || {}).id; if(id){ rcMemoOpen.add(id); rcFitMemos(); } });
{ const __fsFit = fsApply; fsApply = function(){ const r = __fsFit.apply(this, arguments); setTimeout(() => { try{ rcFitMemos(); }catch(e){} }, 50); return r; }; }
document.head.insertAdjacentHTML("beforeend", `<style>details#cgFold > summary .cgsel{display:inline-flex;align-items:center;gap:10px;vertical-align:middle} details#cgFold > summary .cgsel b{font-size:16px;color:#5C4B4F} details#cgFold > summary .cgsel small{display:block;font-size:11.5px;color:#9C8B8F;font-weight:700}</style>`);
// キャストを選びなおしたとき（プルダウン・写真）に、たたんだ見出しの写真も変える
{ const __onCastSel = onCast; onCast = function(){ const r = __onCastSel.apply(this, arguments); try{ cgFoldWrap(); }catch(e){} return r; }; }
/* ---------- 🙅 予約カードから「キャストNGにする」（このお客さん × この予約のキャスト）2026/11/28 店長
   ・店NGのとなりにボタン。押すと理由を書いて、キャストNG（kb_cust_cast_ng）に入れる。もうNGなら「キャストNGを外す」
   ・備考にも残す ---------- */
{ const __custCellNg = custCell; custCell = function(r){
  const h = __custCellNg(r);
  if(!r || !r.customer_id || !r.cast_id || !KB.CAN_EDIT) return h;
  const on = castNgPairs.has(r.customer_id + "|" + r.cast_id), nm = esc(typeof castName === "function" ? castName(r.cast_id) : "");
  const b = `<button type="button" class="mini ${on ? "ng" : ""}" onclick="event.stopPropagation();castNgFromCard(${r.id})">${on ? "🙅 " + nm + "のNG（押すと外す）" : "🙅 " + nm + "のNGにする"}</button>`;
  const i = h.lastIndexOf("</div>");
  return i >= 0 ? h.slice(0, i) + b + h.slice(i) : h + b;
}; }
async function castNgFromCard(id){
  const r = rows.find(x => x.id === id); if(!r || !r.customer_id || !r.cast_id || !KB.CAN_EDIT) return;
  const cn = typeof castName === "function" ? castName(r.cast_id) : "", cu = (r.kb_customers || {}).name || "お客さん", by = KB.operatorName() || "（担当者なし）";
  const key = r.customer_id + "|" + r.cast_id;
  try{
    if(castNgPairs.has(key)){
      if(!confirm(`${cu} を ${cn} のキャストNGから外しますか？`)) return;
      q(await sb.from("kb_cust_cast_ng").delete().eq("customer_id", r.customer_id).eq("cast_id", r.cast_id));
      castNgPairs.delete(key);
      await pushLog(id, `🙅 キャストNGを外した（${cn}）`);
      toast(`🙅 ${cn} のキャストNGから外しました`);
    } else {
      const why = await kbTextPrompt(`🙅 ${cu} を ${cn} のキャストNGにする：理由`, "");
      if(why == null) return;
      const has = await sb.from("kb_cust_cast_ng").select("id").eq("customer_id", r.customer_id).eq("cast_id", r.cast_id).limit(1);
      if(!(has.data || []).length) q(await sb.from("kb_cust_cast_ng").insert({ customer_id: r.customer_id, cast_id: r.cast_id, cast_name: cn, reason: why.trim(), source: "manual", by_name: by }));
      castNgPairs.add(key);
      await pushLog(id, `🙅 キャストNGにした（${cn}）${why.trim() ? "：" + why.trim() : ""}`);
      toast(`🙅 ${cu} を ${cn} のキャストNGにしました`);
    }
    renderList();
  }catch(e){ toast("キャストNGを保存できませんでした：" + (e.message || e)); }
}
/* ---------- 📞 予約カード 11/28 店長（2回目）：
   ・お客さんの下に「🚫 店NG」「🙅 まほNG」を横並び（rcNgRow）／電話番号の横にコピー（rcCopyTel）
   ・「この場所の次回の交通費」は場所の下（rcFeeBtn）／時刻は状態の左・お店はお客さんの上（kiroku_6_1020.js の resCard） ---------- */
function rcNgRow(r){
  const c = r.kb_customers || {}, reason = (typeof kbClean === "function" ? kbClean(c.ng_reason) : c.ng_reason) || "理由なし";
  if(!r.customer_id || !KB.CAN_EDIT) return c.ng ? `<div class="rc-ngrow"><span class="mini ng">⚠️ 店NG：${esc(reason)}</span></div>` : "";
  const shop = `<button type="button" class="mini ${c.ng ? "ng" : ""}" title="${c.ng ? "押すと理由を直す・外す" : "このお客さんを店NGにする"}" onclick="custNg(${r.id})">${c.ng ? "⚠️ 店NG：" + esc(reason) : "🚫 店NG"}</button>`;
  let cast = "";
  if(r.cast_id){
    const on = castNgPairs.has(r.customer_id + "|" + r.cast_id), nm = esc(typeof castName === "function" ? castName(r.cast_id) : "");
    cast = `<button type="button" class="mini ${on ? "ng" : ""}" title="${on ? "このキャストのNGに入っています（押すと外す）" : "このお客さんを " + nm + " のキャストNGにする"}" onclick="castNgFromCard(${r.id})">🙅 ${nm}NG${on ? "中" : ""}</button>`;
  }
  return `<div class="rc-ngrow" onclick="event.stopPropagation()">${shop}${cast}</div>`;
}
function rcFeeBtn(r){
  if(!r.customer_id || !KB.CAN_EDIT) return "";
  const p = typeof placeOf === "function" ? placeOf(r) : null;
  return `<div class="rc-feerow" onclick="event.stopPropagation()"><button type="button" class="mini" onclick="custNextFee(${r.id})">🚕 この場所の次回の交通費${p && p.next_transport != null ? "：" + yen(p.next_transport) + (p.next_note ? "<small>（" + esc(p.next_note) + "）</small>" : "") : ""}</button></div>`;
}
function rcCopyTel(id){
  const r = rows.find(x => x.id === id), t = ((r && r.kb_customers) || {}).phone; if(!t) return;
  navigator.clipboard.writeText(String(t)).then(() => toast("📋 電話番号「" + t + "」をコピーしました"));
}
document.head.insertAdjacentHTML("beforeend", `<style>
  .rescard .rc-ngrow,.rescard .rc-feerow{display:flex;gap:6px;flex-wrap:wrap;margin-top:3px}
  .rescard .rc-tt{display:inline-flex;align-items:center;gap:2px;font-weight:900;white-space:nowrap} .rescard .rc-tt .rc-time{font-size:15px;font-weight:900;font-family:inherit} .rescard .rc-tt .rc-end{font-size:15px}
  .rescard .rc-telcopy{margin-left:4px}
</style>`);
/* ---------- 🚧 受付の「必須でまだ」：キープアウトのテープみたいに（2026/11/28 店長）
   上下に黄色と黒のしましま・まん中に下線つき「必須項目リスト」・その下に項目・いちばん下に仮予約の案内 ---------- */
{ const __prbTape = paintReqBar; paintReqBar = function(){
  const r = __prbTape.apply(this, arguments);
  try{
    const bar = $("reqBar"); if(!bar || !bar.classList.contains("ng") || bar.querySelector(".rq-tape")) return r;
    const btns = [...bar.querySelectorAll("button")], help = !!bar.querySelector(".rqhelp");
    bar.innerHTML = `<div class="rq-tape"></div><div class="rq-title rqlbl"><span>必須項目リスト</span></div><div class="rq-items"></div>`
      + (help ? `<div class="rq-kari rqhelp">未確定で登録したい場合「📌 仮予約で登録」（最低項目：電話番号、名前）</div>` : "") + `<div class="rq-tape"></div>`;
    const it = bar.querySelector(".rq-items"); btns.forEach(b => it.appendChild(b));
  }catch(e){}
  return r;
}; }
document.head.insertAdjacentHTML("beforeend", `<style>
  .reqbar.ng{background:#FFFBE6;border:0;padding:0 0 0;color:#3a2a00;overflow:hidden}
  .reqbar .rq-tape{height:7px;background:repeating-linear-gradient(-45deg,#1b1b1b 0 12px,#FFD400 12px 24px)}
  .reqbar .rq-title{text-align:center;margin:6px 0 4px} .reqbar .rq-title span{font-size:15px;font-weight:900;text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:4px;color:#1b1b1b}
  .reqbar .rq-items{display:flex;flex-wrap:wrap;justify-content:center;gap:2px;padding:0 10px 4px}
  .reqbar.ng .rq-items button{background:#fff;border:2px solid #1b1b1b;color:#1b1b1b}
  .reqbar .rq-kari{text-align:center;font-size:12.5px;font-weight:800;padding:2px 10px 6px;color:#5a4300}
</style>`);
/* ---------- 🧭 上の帯の並び（2026/11/28 店長）
   1行目：＋ 受付を開く（左から右まで全部）
   2行目：日付・今日（営業日）・あかさたな…ジャンプ
   3行目：📞 電話番号・クリア ／ 右に キャスト枠・予約カード のプルダウン
   4行目：テンプレ・通知の履歴・通知の設定・文字の大きさ（「出勤・退勤の通知」ボタンはなくす。出勤・退勤のお知らせの ⚙️ から開ける） ---------- */
function vbTools(){
  return `<button type="button" onclick="openTplBox()">📝 テンプレ（送る文）</button><button type="button" onclick="ntfTab='';renderNtfBox(true)">🔔 通知の履歴</button><button type="button" onclick="openSoundSet()">🔊 通知の設定（文・音・声）</button>`;
}
function vbLayout(){
  const vb = document.querySelector(".stickybar .viewbar"); if(!vb || vb.classList.contains("vb4")) return;
  const open = $("openNoCast"), day = vb.querySelector(".daybar"), kana = $("kanaBar"), tel = $("nf_tel"), tr = $("telResult"),
        s1 = $("s_sort") && $("s_sort").closest("label"), s2 = $("s_cardsort") && $("s_cardsort").closest("label"), fsb = $("fsBar");
  if(!open || !day || !kana || !s1 || !s2) return;
  const row = cls => { const d = document.createElement("div"); d.className = "vrow " + cls; return d; };
  const r1 = row("vr1"), r2 = row("vr2"), r3 = row("vr3"), r4 = row("vr4");
  r1.appendChild(open); r2.append(day, kana);
  if(tel) r3.appendChild(tel);
  const sp = document.createElement("span"); sp.className = "vsp"; r3.append(sp, s1, s2);
  const tools = document.createElement("span"); tools.className = "snsetonly vtools"; tools.innerHTML = vbTools(); r4.appendChild(tools);
  if(fsb) r4.appendChild(fsb);
  vb.innerHTML = ""; vb.classList.add("vb4"); vb.append(r1, r2, r3);
  if(tr){ tr.classList.add("tr-out"); vb.appendChild(tr); }
  vb.appendChild(r4);
}
// 下の出勤・退勤のお知らせの上に毎回出していたボタンの行は、帯の4行目に移したので出さない
{ const __rsnV = renderShiftNotices; renderShiftNotices = function(){ const r = __rsnV.apply(this, arguments); try{ const el = $("shiftAlerts"); if(el && document.querySelector(".viewbar.vb4")) el.querySelectorAll(":scope > .snsetonly").forEach(x => x.remove()); }catch(e){} return r; }; }
try{ vbLayout(); }catch(e){ console.warn("vbLayout", e); }
document.head.insertAdjacentHTML("beforeend", `<style>
  .viewbar.vb4{display:block !important}
  .viewbar.vb4 .vrow{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:3px 0}
  .viewbar.vb4 .vr1 #openNoCast{flex:1 1 100% !important;margin-left:0 !important;justify-content:center;text-align:center;font-size:15px;padding:7px 12px}
  .viewbar.vb4 .vr3 #nf_tel.teltop{margin:0}
  .viewbar.vb4 .vsp{flex:1}
  .viewbar.vb4 .vr4{justify-content:flex-end}
  .viewbar.vb4 .vtools{text-align:right;margin:0} .viewbar.vb4 .vtools button{margin-left:6px}
  #telResult.tr-out{max-height:34vh;overflow:auto} #telResult.tr-out:empty{display:none}
</style>`);
/* ---------- 予約カード：お店は背景なし（文字だけ）・項目の罫線を少し濃く（2026/11/28 店長） ---------- */
document.head.insertAdjacentHTML("beforeend", `<style>
  .rescard .rc-call .kbstore{background:none !important;color:#5C4B4F !important;padding:0 !important;font-size:15.5px;font-weight:900;box-shadow:none !important;border:0 !important}
  .rescard .rc-f{border-bottom-color:#D9C4CC !important}
  .rescard .rc-cr,.rescard .rc-cb{border-left-color:#E2CBD3 !important}
</style>`);
