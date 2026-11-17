/* ---------- 🤔 探す：お客様の希望をどんどん足して、マッチ率とおすすめを出す（2026/11/18 店長）
   ・「お客様が聞きたいこと」→ 答えを押すと、条件として足されていく（Pサイズ大きい・身長低い・胸ない・タイプ…）。× で外す
   ・カードに 条件ごとの ○△×？ と マッチ率。マッチ率の高い順に並んで、いちばん上に 👑 おすすめ
   ・🎯 希望プレイ（◎○＝○、△＝△）もマッチ率に入る
   ・📅 日付も選べる（受付の日付が変わる）
   ・📅 日にち未定：好みのタイプから、合う子と この先2週間の出勤日を出す（押すとその日・その子で探す）
   ・⭐ キープした子どうしでくらべる：キープの列もマッチ率の高い順・👑
   ○＝1、△＝0.5、×・？（プロフに書いていない）＝0 で、条件の数で割る ---------- */
const FS_Q = [
  ["type", "👗 タイプ", [["ニューハーフ", "ニューハーフ"], ["男の娘", "男の娘"], ["女装子", "女装子"]]],
  ["psize", "📐 Pサイズ", [["big", "大きい"], ["small", "小さい"]]],
  ["p", "🍆 Pの状態", [["zuru", "ずるむけ"], ["kasei", "仮性"], ["tama", "玉あり"], ["notama", "玉なし"]]],
  ["height", "📏 身長", [["low", "低い"], ["high", "高い"]]],
  ["cup", "🍒 胸", [["big", "大きい"], ["none", "ない・小さい"]]],
  ["age", "🎂 年齢", [["young", "若い"], ["adult", "大人"]]],
  ["hair", "💇 髪", [["ji", "地毛"], ["wig", "ウィッグ"]]],
  ["tabako", "🚬 たばこ", [["no", "吸わない"], ["yes", "吸う"]]],
  ["play", "🎯 希望プレイ", []],
];
// 数字の条件の目安（○ と △ の線）
const FS_LINE = {
  "psize.big": [v => v >= 16, v => v >= 15, "16cm以上○・15cm△"], "psize.small": [v => v <= 13, v => v <= 14, "13cm以下○・14cm△"],
  "height.low": [v => v <= 160, v => v <= 164, "160cm以下○・164cm△"], "height.high": [v => v >= 172, v => v >= 169, "172cm以上○・169cm△"],
  "cup.big": [v => v >= 5, v => v === 4, "E以上○・D△"], "cup.none": [v => v <= 2, v => v === 3, "B以下○・C△"],
  "age.young": [v => v <= 22, v => v <= 25, "22歳以下○・25歳△"], "age.adult": [v => v >= 30, v => v >= 27, "30歳以上○・27歳△"],
};
let FS_CONDS = [], fsQOpen = "";
const fsLab = (q, s) => { const q0 = FS_Q.find(x => x[0] === q), s0 = q0 && q0[2].find(x => x[0] === s); return (q0 ? q0[1] : q) + "：" + (s0 ? s0[1] : s); };
function fsTypeOf(d){
  const vals = [d && d.castType].concat(Object.values((d && d.storeProfiles) || {}).map(x => x && x.castType));
  const v = String(vals.find(x => x && String(x).trim()) || "").trim();
  return v.replace(/^NH$/i, "ニューハーフ").replace(/^女装$/, "女装子");
}
// 1人の、条件ごとの答え：mark ＝ ok / tri / ng / unk、t ＝ カードに出す文
function fsGrade(c, q, s){
  const d = c && c.prof_id && profById ? profById[c.prof_id] : null;
  if(!d) return { mark: "unk", t: "プロフなし" };
  if(q === "type"){ const t = fsTypeOf(d); return t ? { mark: t === s ? "ok" : "ng", t: "👗 " + t } : { mark: "unk", t: "👗 タイプ未入力" }; }
  const inf = fsAskInfo(c, q);
  if(!inf) return { mark: "unk", t: (FS_Q.find(x => x[0] === q) || [q, q])[1] + " 書いていない" };
  const ln = FS_LINE[q + "." + s];
  if(ln) return { mark: ln[0](inf.v) ? "ok" : ln[1](inf.v) ? "tri" : "ng", t: inf.t };
  return { mark: (inf.tags || []).includes(s) ? "ok" : "ng", t: inf.t };
}
function fsPlayGrade(c, k){
  const o = profOpts(c), l = (PLAYS.find(p => p[0] === k) || [k, k])[1];
  if(!o) return { mark: "unk", t: "🎯 " + l + "？" };
  const v = o[k] || "";
  return { mark: ["◎", "○"].includes(v) ? "ok" : v === "△" ? "tri" : "ng", t: "🎯 " + l + (v || "？") };
}
// マッチ率（条件がないときは null）
function fsScore(c){
  const parts = FS_CONDS.map(x => Object.assign({ lab: fsLab(x.q, x.s) }, fsGrade(c, x.q, x.s)))
    .concat([...fsPlay].map(k => Object.assign({ lab: "🎯 " + (PLAYS.find(p => p[0] === k) || [k, k])[1] }, fsPlayGrade(c, k))));
  if(!parts.length) return { rate: null, parts };
  const pt = parts.reduce((a, p) => a + (p.mark === "ok" ? 1 : p.mark === "tri" ? 0.5 : 0), 0);
  return { rate: Math.round(pt / parts.length * 100), parts };
}
const fsMarkIcon = m => ({ ok: "○", tri: "△", ng: "×", unk: "？" })[m];
const fsPartsHtml = parts => `<div class="fsparts">${parts.map(p => `<i class="${p.mark}" title="${esc(p.lab)}">${fsMarkIcon(p.mark)} ${esc(p.t)}</i>`).join("")}</div>`;

// ---------- 条件をえらぶところ ----------
fsAskPaint = function(){
  const el = $("fsAsk"); if(!el) return;
  const q0 = FS_Q.find(x => x[0] === fsQOpen);
  const cur = q0 ? (FS_CONDS.find(x => x.q === q0[0]) || {}).s : "";
  el.innerHTML = `<div class="fsask"><b>🤔 お客様の希望（押すと条件が足されていきます）</b>
    <div class="chips">${FS_Q.map(([k, l]) => `<button type="button" class="chip ${fsQOpen === k ? "on" : ""} ${FS_CONDS.some(x => x.q === k) || (k === "play" && fsPlay.size) ? "has" : ""}" onclick="fsAskPick('${k}')">${l}</button>`).join("")}</div>
    ${q0 && q0[2].length ? `<div class="chips fsasks">${q0[2].map(([k, l]) => `<button type="button" class="chip ${cur === k ? "on" : ""}" onclick="fsAskSub('${k}')">${l}</button>`).join("")}
      ${FS_LINE[q0[0] + "." + (cur || q0[2][0][0])] ? `<span class="hint2 fsline">目安：${esc(FS_LINE[q0[0] + "." + (cur || q0[2][0][0])][2])}</span>` : ""}</div>` : ""}
    ${FS_CONDS.length || fsPlay.size ? `<div class="fsconds">${FS_CONDS.map((x, i) => `<span class="fscond">${esc(fsLab(x.q, x.s))}<button type="button" onclick="fsCondDel(${i})" aria-label="外す">×</button></span>`).join("")}${[...fsPlay].map(k => `<span class="fscond play">🎯 ${esc((PLAYS.find(p => p[0] === k) || [k, k])[1])}<button type="button" onclick="fsTogglePlay('${k}')" aria-label="外す">×</button></span>`).join("")}</div>` : ""}</div>`;
};
fsAskPick = function(k){
  fsQOpen = fsQOpen === k ? "" : k;
  if(k === "play"){ const d = $("fs_playChips") && $("fs_playChips").closest("details"); if(d) d.open = fsQOpen === "play"; }
  fsAskPaint();
};
fsAskSub = function(s){
  const q = fsQOpen; if(!q) return;
  const i = FS_CONDS.findIndex(x => x.q === q);
  if(i >= 0 && FS_CONDS[i].s === s) FS_CONDS.splice(i, 1);          // もう一度押すと外す
  else if(i >= 0) FS_CONDS[i].s = s; else FS_CONDS.push({ q, s });  // 同じ質問は1つ（答えを入れかえ）
  fsAskPaint(); fsAskApply();
};
function fsCondDel(i){ FS_CONDS.splice(i, 1); fsAskPaint(); fsAskApply(); }

// ---------- カードにマッチ率をつけて、高い順に ----------
fsAskApply = function(){
  const out = $("fsOut"); if(!out) return;
  if(!profById && (FS_CONDS.length || fsPlay.size)){ loadProfs().then(fsAskApply).catch(() => {}); return; }
  if($("fs_nodate") && $("fs_nodate").checked) return;   // 日にち未定は、べつの一覧
  out.querySelectorAll(".fsask-l,.fsgh,.fsask-n,.fsparts,.fsrate2,.fsbest").forEach(x => x.remove());
  const has = FS_CONDS.length || fsPlay.size;
  out.querySelectorAll(".fsgrid").forEach((g, gi) => {
    const cards = [...g.querySelectorAll(".fscard[data-cid]")].map((el, i) => { el.style.display = ""; const c = M.casts.find(x => x.id === el.dataset.cid); return { el, i, sc: has ? fsScore(c) : null }; });
    if(!has) return;
    cards.forEach(x => {
      const n = x.el.querySelector(".fsc-n"); if(n) n.insertAdjacentHTML("beforeend", `<span class="fsrate2 ${x.sc.rate >= 80 ? "hi" : x.sc.rate < 50 ? "lo" : ""}">マッチ ${x.sc.rate}%</span>`);
      const top = x.el.querySelector(".fsc-top"); if(top) top.insertAdjacentHTML("afterend", fsPartsHtml(x.sc.parts));
    });
    cards.sort((a, b) => b.sc.rate - a.sc.rate || a.i - b.i).forEach(x => g.appendChild(x.el));
    if(gi === 0 && cards.length && cards[0].el.classList.contains("ok") && cards[0].sc.rate > 0) cards[0].el.insertAdjacentHTML("afterbegin", `<span class="fsbest">👑 おすすめ</span>`);
  });
  const head = out.querySelector(".fshead");
  if(head && has) head.insertAdjacentHTML("beforeend", ` <span class="fsask-n">条件 ${FS_CONDS.length + fsPlay.size}こ・マッチ率の高い順</span>`);
};

// ---------- ⭐ キープした子どうしでくらべる ----------
fsKeepPaint = function(){
  const out = $("fsOut"); if(!out) return;
  out.querySelectorAll(".fscard[data-cid]").forEach(el => {
    let b = el.querySelector(".fskeepbtn");
    if(!b){ const top = el.querySelector(".fsc-top") || el; top.insertAdjacentHTML("beforeend", `<button type="button" class="fskeepbtn" onclick="event.stopPropagation();fsKeepToggle('${el.dataset.cid}')"></button>`); b = el.querySelector(".fskeepbtn"); }
    const on = FS_KEEP.includes(el.dataset.cid); b.classList.toggle("on", on); b.textContent = on ? "⭐ キープ中" : "☆ キープ"; el.classList.toggle("fskept", on);
  });
  let box = $("fsKeep");
  if(!FS_KEEP.length){ if(box) box.remove(); return; }
  if(!box){ const head = out.querySelector(".fshead"); (head || out).insertAdjacentHTML(head ? "afterend" : "afterbegin", `<div id="fsKeep" class="fskeep"></div>`); box = $("fsKeep"); }
  const has = FS_CONDS.length || fsPlay.size;
  const L = FS_KEEP.map((cid, i) => { const c = M.casts.find(x => x.id === cid); return c ? { c, i, sc: profById ? fsScore(c) : { rate: null, parts: [] } } : null; }).filter(Boolean)
    .sort((a, b) => (b.sc.rate ?? -1) - (a.sc.rate ?? -1) || a.i - b.i);
  const best = has && L.length > 1 && L[0].sc.rate > (L[1].sc.rate ?? -1) ? L[0].c.id : "";
  box.innerHTML = `<div class="fskeep-h">⭐ キープ ${L.length}人で くらべる<small>${has ? "（条件 " + (FS_CONDS.length + fsPlay.size) + "こ・マッチ率の高い順）" : "（お客様の希望を足すと、マッチ率が出ます）"}</small></div>
    <div class="fskeep-l">${L.map(x => `<div class="fskc ${x.c.id === best ? "best" : x.sc.rate != null && x.sc.rate < 50 ? "low" : ""}">${x.c.id === best ? "👑" : ""}${typeof KBF !== "undefined" ? KBF.img(x.c.id, 28) : ""}<b>${esc(castName(x.c.id))}</b>
      ${x.sc.rate != null ? `<span class="fsrate">${x.sc.rate}%</span>` : ""}
      <span class="fsres">${x.sc.parts.map(p => `<i class="${p.mark === "ok" ? "ok" : p.mark === "tri" ? "num" : p.mark === "unk" ? "unk" : "ng"}">${fsMarkIcon(p.mark)}${esc(p.t)}</i>`).join("")}</span>
      <button type="button" class="fskx" onclick="fsKeepToggle('${x.c.id}')" aria-label="キープをはずす">×</button></div>`).join("")}</div>`;
};

// ---------- 📅 日付・日にち未定 ----------
function fsCtlAdd(){
  const ctl = document.querySelector("#fsBox .fsctl"); if(!ctl || $("fs_date")) return;
  ctl.insertAdjacentHTML("afterbegin", `<label>📅 日付 <input type="date" id="fs_date" onchange="fsDateSet(this.value)"></label>`);
  ctl.insertAdjacentHTML("beforeend", `<label class="fsnodate"><input type="checkbox" id="fs_nodate" onchange="fsPaint()" style="width:auto"> 日にち未定（タイプから出勤日をさがす）</label>`);
}
function fsDateSet(d){ if(!d) return; if($("fs_nodate")) $("fs_nodate").checked = false; fsGoDay(d); }
let fsNdSeq = 0;
async function fsNoDatePaint(){
  const out = $("fsOut"); if(!out) return;
  const seq = ++fsNdSeq;
  out.innerHTML = `<div class="hint2" style="font-size:12.5px;color:var(--sub);margin-top:6px">好みに合う子と、この先2週間の出勤を探しています…</div>`;
  if(!profById) await loadProfs().catch(() => {});
  const from = KB.bizDateOf(), days = [];
  for(let i = 0; i < 14; i++){ const d = addDays(from, i); let sh = {}; try{ sh = await loadShifts(d) || {}; }catch(e){} days.push({ d, sh }); }
  if(seq !== fsNdSeq) return;
  const has = FS_CONDS.length || fsPlay.size;
  const dl = d => { const x = new Date(d + "T12:00:00Z"); return `${x.getUTCMonth() + 1}/${x.getUTCDate()}(${DOW[x.getUTCDay()]})`; };
  const store = $("f_store") ? $("f_store").value : "";
  const L = M.casts.filter(c => c.status !== "left").map(c => {
    const ds = days.map(x => ({ d: x.d, s: x.sh[c.shift_name] || x.sh[c.official_name] })).filter(x => x.s);
    return { c, ds, sc: fsScore(c) };
  }).filter(x => x.ds.length).sort((a, b) => (b.sc.rate ?? 0) - (a.sc.rate ?? 0) || a.ds[0].d.localeCompare(b.ds[0].d));
  const top = has ? L.filter(x => x.sc.rate > 0).slice(0, 30) : L.slice(0, 30);
  out.innerHTML = `<div class="fshead">📅 日にち未定：${has ? "希望に合う子" : "この先2週間に出勤がある子"} <b>${top.length}人</b>${has ? ` <span class="fsask-n">条件 ${FS_CONDS.length + fsPlay.size}こ・マッチ率の高い順</span>` : `<span class="hint2">（上でお客様の希望を足すと、合う子にしぼれます）</span>`}</div>`
    + (top.length ? `<div class="fsgrid">${top.map((x, i) => `<div class="fsrow fscard ok" data-cid="${esc(x.c.id)}">${i === 0 && has ? `<span class="fsbest">👑 おすすめ</span>` : ""}
      <div class="fsc-top">${typeof KBF !== "undefined" ? KBF.img(x.c, 52, store) : ""}<div class="fsc-n"><b>${esc(castName(x.c.id))}</b>${x.sc.rate != null ? `<span class="fsrate2 ${x.sc.rate >= 80 ? "hi" : x.sc.rate < 50 ? "lo" : ""}">マッチ ${x.sc.rate}%</span>` : ""}</div></div>
      ${x.sc.parts.length ? fsPartsHtml(x.sc.parts) : ""}
      <div class="tm-dms fsnd-days">${x.ds.map(o => `<button type="button" class="tm-dm" onclick="fsNdGo('${o.d}','${x.c.id}')">${esc(dl(o.d))}<small>${fmtHour(o.s.start)}〜${fmtHour(o.s.end)}</small></button>`).join("")}</div></div>`).join("")}</div>`
      : `<div class="warn" style="margin-top:4px">合う子の出勤が、この先2週間にありません</div>`);
  fsKeepPaint();
}
// 日にち未定 → 出勤日を押す：その日・その子で探す
function fsNdGo(d, cid){
  if($("fs_nodate")) $("fs_nodate").checked = false;
  fsCasts.clear(); fsCasts.add(cid);
  fsGoDay(d);
}
{ const __fsPaintM = fsPaint; fsPaint = async function(){
  fsCtlAdd();
  if($("fs_date")) $("fs_date").value = ($("f_day") && $("f_day").value) || day;
  if($("fs_nodate") && $("fs_nodate").checked){ const box = $("fsBox"); if(!box || !box.open) return;
    if($("fs_playChips")) $("fs_playChips").innerHTML = PLAYS.map(([k, l]) => `<button type="button" class="chip ${fsPlay.has(k) ? "on" : ""}" onclick="fsTogglePlay('${k}')">${esc(l)}</button>`).join("");
    fsAskPaint(); return fsNoDatePaint(); }
  return __fsPaintM.apply(this, arguments);
}; }
{ const __fsClearM = fsClear; fsClear = function(){ FS_CONDS = []; fsQOpen = ""; if($("fs_nodate")) $("fs_nodate").checked = false; return __fsClearM.apply(this, arguments); }; }
{ const __ofM = openForm; openForm = function(){ FS_CONDS = []; fsQOpen = ""; try{ FS_KEEP = []; }catch(e){} if($("fs_nodate")) $("fs_nodate").checked = false; return __ofM.apply(this, arguments); }; }
document.head.insertAdjacentHTML("beforeend", `<style>
  .fsask .chip.has{box-shadow:inset 0 -3px 0 #6E5BD6}
  .fsline{margin-left:6px;font-size:12px}
  .fsconds{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}
  .fscond{display:inline-flex;align-items:center;gap:2px;background:#6E5BD6;color:#fff;font-weight:800;font-size:12.5px;border-radius:99px;padding:2px 4px 2px 10px}
  .fscond.play{background:#C2185B}
  .fscond button{border:none;background:rgba(255,255,255,.25);color:#fff;font-weight:900;border-radius:99px;width:20px;height:20px;cursor:pointer;line-height:1;padding:0}
  .fsparts{display:flex;flex-wrap:wrap;gap:3px;margin:3px 0}
  .fsparts i{font-style:normal;font-weight:800;font-size:11.5px;border-radius:99px;padding:1px 7px}
  .fsparts i.ok{background:#E5F6EC;color:#1E7A3C} .fsparts i.tri{background:#FFF4D6;color:#8A6100} .fsparts i.ng{background:#FFE8EC;color:#c0392b} .fsparts i.unk{background:#F1EEF0;color:#7a6a70}
  .fsrate2{display:inline-block;font-weight:900;font-size:13px;background:#EEEBFF;color:#2E2770;border-radius:99px;padding:0 8px;margin-top:2px}
  .fsrate2.hi{background:#2E9E4A;color:#fff} .fsrate2.lo{background:#FFE8EC;color:#c0392b}
  .fscard{position:relative} .fsbest{position:absolute;top:-9px;left:8px;background:#F2C94C;color:#3a2a00;font-weight:900;font-size:12px;border-radius:99px;padding:1px 9px;z-index:1}
  .fsnodate{font-weight:800}
  .fsnd-days{margin-top:4px}
</style>`);
