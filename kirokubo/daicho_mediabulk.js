/* 📷 全員の写真を、えらんだ媒体（お店）にまとめて入れる（2026/11/27 店長：画像を全媒体ロゴ入りにそろえたい）
   ・写真は、そのお店の公式HPのプロフ用 ①〜（ロゴ入り）。撮影準備中はよける（1人ずつの「📷 写真も公式HPと同じにする」と同じロボット）
   ・えらぶ：媒体（お店）を1つ → そのお店に在籍していて公式HPの番号がある子
   ・「🔍 まず見る」（全員分・何も変えない）→ 一覧を見てから「📷 入れかえる」。とちゅうで止められる */
let mb = null;   // { key, media, mk, label, rows:[{ c, on, pv, res }], busy, stop }
function mbTargets(){
  const out = [];
  MP_MEDIA.filter(m => MP_PHOTO_MEDIA.includes(m.media)).forEach(m => m.stores.forEach(mk => out.push({ key: m.media + ":" + mk, media: m.media, mk, label: `${m.label}（${PROF_STORE_OF[mk] || mk}）` })));
  return out;
}
function mbCastsOf(mk){
  const sk = PROF_STORE_OF[mk];
  return casts.filter(c => !["left", "interview"].includes(c.status) && c.stores && c.stores[mk])
    .map(c => ({ c, no: hpNoOf(c, sk).no }))
    .sort((a, b) => (a.no || 9999) - (b.no || 9999));
}
function mbOpen(){ mb = { key: "", rows: [] }; mbPaint(); }
function mbPick(key){
  if(mb.busy) return;
  const t = mbTargets().find(x => x.key === key); if(!t) return;
  mb = Object.assign({ rows: mbCastsOf(t.mk).map(r => ({ c: r.c, no: r.no, on: !!r.no, pv: null, res: null })) }, t);
  mbPaint();
}
function mbFrom(r){ return { site: HP_SITE_OF[mb.mk], no: r.no }; }
function mbState(r){
  if(!r.no) return ["skip", "公式HPの番号がないので、とばします"];
  if(r.res) return r.res.ok ? ["ok", `✅ 入れかえました（${(((r.res.plan || {}).use) || []).map(n => PF_SLOT_LABEL[n]).join("・")}・${r.res.after}枚）`] : ["ng", "⚠️ " + (r.res.error || "入れられませんでした")];
  if(r.pv) return r.pv.error ? ["ng", "⚠️ " + r.pv.error] : ["ready", `公式HPの ${(((r.pv.plan || {}).use) || []).map(n => PF_SLOT_LABEL[n]).join("・")} を入れます（今 ${r.pv.now ?? "?"}枚）${(((r.pv.plan || {}).skip) || []).length ? "・撮影準備中はよける" : ""}`];
  return ["", ""];
}
function mbPaint(){
  let bg = $("mbBg"); if(!bg){ bg = document.createElement("div"); bg.id = "mbBg"; bg.style.cssText = "position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.4);display:flex;align-items:flex-start;justify-content:center;padding:14px;overflow:auto"; document.body.appendChild(bg); bg.addEventListener("click", e => { if(e.target === bg && !mb.busy) bg.remove(); }); }
  const picks = mbTargets().map(t => `<button class="btn btn-sm ${mb.key === t.key ? "btn-primary" : "btn-ghost"}" ${mb.busy ? "disabled" : ""} onclick="mbPick('${t.key}')">${esc(t.label)}</button>`).join("");
  let body = "";
  if(mb.key){
    const rows = mb.rows, on = rows.filter(r => r.on && r.no);
    const toLook = on.filter(r => !r.pv && !r.res), toGo = on.filter(r => r.pv && !r.pv.error && !r.res);
    const done = rows.filter(r => r.res && r.res.ok).length, ng = rows.filter(r => (r.res && !r.res.ok) || (r.pv && r.pv.error)).length;
    const next = toGo.length ? "go" : toLook.length ? "look" : "";
    const B = mb.busy;
    body = `<div class="mpBar" style="margin-top:8px">${esc(mb.label)}：${rows.length}人（公式HPの番号あり ${rows.filter(r => r.no).length}人）<span style="flex:1"></span>
        ${B ? "" : `<button class="btn btn-ghost btn-sm" onclick="mbAll(true)">✅ 全部チェック</button><button class="btn btn-ghost btn-sm" onclick="mbAll(false)">☐ 全部外す</button>`}</div>
      ${(done || ng) && !B ? `<div class="hint" style="margin-top:6px">✅ 入れかえた ${done}人　⚠️ できなかった ${ng}人</div>` : ""}
      <div class="mbList">${rows.map((r, i) => { const [st, msg] = mbState(r), now = B && B.cur === r;
        return `<div class="mbRow${now ? " mpNow" : ""} mb-${st}" ${now ? 'id="mbNowRow"' : ""}><label><input type="checkbox" ${r.on ? "checked" : ""} ${!r.no || B ? "disabled" : ""} onchange="mb.rows[${i}].on=this.checked;mbPaint()"> <b>${esc(nameOf(r.c))}</b> <small>${r.no ? r.no + "番" : "番号なし"}</small></label>
          ${now ? `<span class="mpBusyI">⏳ 読み込み中</span>` : msg ? `<span class="mbMsg">${esc(msg)}</span>` : ""}</div>`; }).join("")}</div>
      ${B ? `<div class="mpProg"><div><b>⏳ ロボットが${esc(B.label)}… ${B.done} ／ ${B.total} 人 終わりました</b>${B.total - B.done ? `　あと${B.total - B.done}人（およそ${Math.max(1, Math.round((B.total - B.done) * B.min))}分）` : ""}</div>
          <div class="mpBarO"><div class="mpBarI" style="width:${Math.round(B.done / Math.max(1, B.total) * 100)}%"></div></div>
          <div class="hint">今読み込み中：${esc(B.cur ? nameOf(B.cur.c) : "")}　／　この画面は閉じずにお待ちください　<button class="btn btn-ghost btn-sm" onclick="mb.stop=true;this.disabled=true;this.textContent='止めています…'">⏹ ここで止める</button></div></div>`
      : `<div class="btns" style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:10px">
        ${toLook.length ? `<button class="btn ${next === "look" ? "btn-primary mpNext" : "btn-ghost"}" onclick="mbRun(true)">🔍 まず見る（${toLook.length}人・何も変えません）</button>` : ""}
        ${toGo.length ? `<button class="btn btn-primary${next === "go" ? " mpNext" : ""}" onclick="mbRun(false)">📷 この${toGo.length}人の写真を入れかえる</button>` : ""}</div>`}`;
  }
  bg.innerHTML = `<div class="mpBox"><h3>📷 全員の写真をまとめて媒体へ</h3>
    <div class="hint">そのお店の<b>公式HPの写真（ロゴ入り）</b>を、えらんだ媒体の写真と入れかえます（今の媒体の写真は消えます）。撮影準備中の写真はよけます。<br>
    ① 媒体（お店）をえらぶ → ② 🔍 まず見る（全員分・何も変えない）→ ③ 📷 入れかえる。1人およそ1〜2分です。</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${picks}</div>${body}
    <div style="text-align:right;margin-top:8px">${mb.busy ? "" : `<button class="btn btn-ghost" onclick="$('mbBg').remove()">閉じる</button>`}</div></div>`;
}
function mbAll(on){ mb.rows.forEach(r => { if(r.no) r.on = on; }); mbPaint(); }
async function mbRun(dry){
  if(!mb || mb.busy) return;
  const list = mb.rows.filter(r => r.on && r.no && !r.res && (dry ? !r.pv : (r.pv && !r.pv.error)));
  if(!list.length) return;
  if(!dry && !confirm(`${mb.label}の写真を、${list.length}人分まとめて公式HPの写真と入れかえますか？\n（今の${mb.label}の写真は消えます。およそ${Math.round(list.length * 1.5)}分かかります）`)) return;
  mb.stop = false;
  mb.busy = { label: dry ? "公式HPの写真と媒体を見ています" : "写真を入れかえています", min: dry ? 0.5 : 1.5, done: 0, total: list.length, cur: null };
  try{
    for(const r of list){
      if(mb.stop) break;
      mb.busy.cur = r; mbPaint(); try{ const el = $("mbNowRow"); if(el) el.scrollIntoView({ block: "nearest", behavior: "smooth" }); }catch(e){}
      let x;
      try{ x = await hpFn({ action: "media_photo", media: mb.media, store: mb.mk, names: mpNames(r.c, mb.mk), from: mbFrom(r), dry, by: operatorName() }); }
      catch(e){ x = { ok: false, error: String(e.message || e) }; }
      if(dry) r.pv = x && x.ok !== false ? x : { error: (x && x.error) || "読めませんでした" };
      else r.res = x || { ok: false, error: "返事がありません" };
      mb.busy.done++;
    }
  }finally{ mb.busy = null; mbPaint(); }
  if(mb.stop) toast("止めました（続きは、もう一度ボタンを押すと、まだの子から始まります）");
}
(function(){ const s = document.createElement("style"); s.textContent = `.mbList{margin-top:8px;max-height:55vh;overflow:auto;border:1.5px solid #E5D9F2;border-radius:12px;padding:4px 8px}
  .mbRow{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:5px 2px;border-bottom:1px dashed #EEE6F6;font-size:13px} .mbRow:last-child{border-bottom:0} .mbRow small{color:#9C8B8F}
  .mbMsg{font-size:12.5px;font-weight:700} .mb-ok .mbMsg{color:#1E7B46} .mb-ng .mbMsg{color:#B45309} .mb-skip .mbMsg{color:#9C8B8F} .mb-ready .mbMsg{color:#1f5d99}`; document.head.appendChild(s); })();
