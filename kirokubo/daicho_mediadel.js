/* 🗑 退店したら、媒体からも消す（2026/11/27 店長）
   ・退店にして保存 → 公式HPの掲載を外したあと「媒体からも消しますか？」
   ・まず全部の媒体（在籍していたお店）で、その子をさがすだけ（何も消さない）→ 一覧を見てから「🗑 消す」
   ・ロボットは名前がぴったり同じ子が1人だけのときだけ消す。消したあと一覧を読みなおして確かめる
   ・ロボットで消せない媒体（ヘブン・口コミ情報局・スナイパー）は「管理画面で消してください」と出す */
const MD_MEDIA = ["ekichika", "manzoku", "nhf", "pure", "fuja", "delija"];
let mdel = null;   // { c, items:[{ media, mk, label, auto, look, res }], busy, step }
function mdItems(c){
  const out = [];
  MP_MEDIA.forEach(m => m.stores.forEach(mk => { if(c.stores && c.stores[mk]) out.push({ media: m.media, mk, label: `${m.label}（${PROF_STORE_OF[mk] || mk}）`, auto: MD_MEDIA.includes(m.media), look: null, res: null }); }));
  return out;
}
async function mdOpen(c){
  if(!c) return;
  const items = mdItems(c);
  if(!items.length) return;
  if(!confirm(`「${nameOf(c)}」を媒体からも消しますか？\n\nまず、どの媒体にいるかをさがします（まだ何も消しません）。`)) return;
  mdel = { c, items, busy: null };
  mdPaint();
  await mdRun(true);
}
function mdPaint(){
  let bg = $("mdBg"); if(!bg){ bg = document.createElement("div"); bg.id = "mdBg"; bg.style.cssText = "position:fixed;inset:0;z-index:320;background:rgba(0,0,0,.45);display:flex;align-items:flex-start;justify-content:center;padding:14px;overflow:auto"; document.body.appendChild(bg); }
  const it = mdel.items, B = mdel.busy;
  const row = x => {
    const now = B && B.cur === x;
    let msg = "";
    if(!x.auto) msg = `<span class="mdM mdHand">✋ ロボットではまだ消せません → ${esc(x.label.replace(/（.*/, ""))}の管理画面で消してください</span>`;
    else if(now) msg = `<span class="mpBusyI">⏳ ${esc(B.label)}</span>`;
    else if(x.res) msg = x.res.ok ? (x.res.none ? `<span class="mdM mdNone">いませんでした（消すものなし）</span>` : `<span class="mdM mdOk">🗑 消しました（「${esc(x.res.name || "")}」・一覧から消えたのを確かめました）</span>`) : `<span class="mdM mdNg">⚠️ ${esc(x.res.error || "消せませんでした")}</span>`;
    else if(x.look) msg = x.look.error ? `<span class="mdM mdNg">⚠️ ${esc(x.look.error)}</span>` : x.look.none ? `<span class="mdM mdNone">いません（消すものなし）</span>` : `<span class="mdM mdGo">「${esc(x.look.name)}」がいます → 消します</span>`;
    return `<div class="mdRow"><b>${esc(x.label)}</b> ${msg}</div>`;
  };
  const toDel = it.filter(x => x.auto && x.look && !x.look.error && !x.look.none && !x.res);
  const done = it.filter(x => x.res && x.res.ok && !x.res.none).length;
  bg.innerHTML = `<div class="mpBox"><h3>🗑 「${esc(nameOf(mdel.c))}」を媒体から消す</h3>
    <div class="hint">名前がぴったり同じ子が1人だけのときだけ消します（似た名前の子は消しません）。消したあと、一覧から消えたかを確かめます。</div>
    <div class="mdList">${it.map(row).join("")}</div>
    ${B ? `<div class="mpProg"><b>⏳ ロボットが${esc(B.label)}… ${B.done} ／ ${B.total} か所 終わりました</b>
        <div class="mpBarO"><div class="mpBarI" style="width:${Math.round(B.done / Math.max(1, B.total) * 100)}%"></div></div><div class="hint">この画面は閉じずにお待ちください</div></div>`
      : `<div class="btns" style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:10px">
        <button class="btn btn-ghost" onclick="$('mdBg').remove()">${done ? "閉じる" : "消さずに閉じる"}</button>
        ${toDel.length ? `<button class="btn btn-primary mpNext" style="background:#C2410C;border-color:#C2410C" onclick="mdRun(false)">🗑 この${toDel.length}か所から消す</button>` : ""}</div>`}</div>`;
}
async function mdRun(dry){
  if(!mdel || mdel.busy) return;
  const list = mdel.items.filter(x => x.auto && (dry ? !x.look : (x.look && !x.look.error && !x.look.none && !x.res)));
  if(!list.length) return;
  if(!dry && !confirm(`${list.map(x => x.label).join("\n")}\n\nから「${nameOf(mdel.c)}」を消しますか？（元にもどすのは、各媒体の管理画面で）`)) return;
  mdel.busy = { label: dry ? "さがしています" : "消しています", done: 0, total: list.length, cur: null };
  try{
    for(const x of list){
      mdel.busy.cur = x; mdPaint();
      let r;
      try{ r = await hpFn({ action: "media_delete", media: x.media, store: x.mk, names: mpNames(mdel.c, x.mk), dry, by: operatorName() }); }
      catch(e){ r = { ok: false, error: String(e.message || e) }; }
      if(dry) x.look = r && r.ok !== false ? r : { error: (r && r.error) || "さがせませんでした" };
      else x.res = r || { ok: false, error: "返事がありません" };
      mdel.busy.done++;
    }
  }finally{ mdel.busy = null; mdPaint(); }
}
(function(){ const s = document.createElement("style"); s.textContent = `.mdList{margin-top:8px;border:1.5px solid #E5D9F2;border-radius:12px;padding:4px 10px}
  .mdRow{padding:6px 0;border-bottom:1px dashed #EEE6F6;font-size:13.5px} .mdRow:last-child{border-bottom:0}
  .mdM{display:inline-block;font-size:12.5px;font-weight:800;margin-left:4px} .mdOk{color:#1E7B46} .mdNg{color:#B45309} .mdNone{color:#9C8B8F} .mdGo{color:#C2410C} .mdHand{color:#6B4E00}`; document.head.appendChild(s); })();
