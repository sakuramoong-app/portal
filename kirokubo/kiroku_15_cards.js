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
  fold.querySelector("summary").textContent = c ? `📸 キャスト一覧（今：${c.official_name || c.temp_name || ""}）・押すと開いて選びなおせます` : "📸 キャスト一覧（写真を押して選ぶ）";
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
const REQ_ICON = [[/^名前を聞いた/, "👤"], [/^種別/, "🏷️"], [/^指名する/, "⭐"], [/^売上店舗/, "🏪"], [/^キャスト/, "💃"], [/^開始時刻/, "🕒"], [/^コース/, "⏳"], [/^エリア/, "📍"],
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
const FS_SIZES = { s: "90%", m: "100%", l: "115%" };
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
  bar.innerHTML = `<span>文字</span>` + [["s", "小"], ["m", "中"], ["l", "大"]].map(([k, l]) => `<button type="button" data-k="${k}" onclick="fsSet('${k}')">${l}</button>`).join("");
  document.body.appendChild(bar);
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
