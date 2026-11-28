/* 🧹 公式HPの年齢から「歳」「才」をとる（2026/11/28 店長：年齢は数字だけでそろえる）
   ・全部のお店の公式HPを読んで（1店1〜2分）、年齢が「22歳」のようになっている子を出す → 「直す」で数字だけにして保存
   ・ほかの欄はさわらない（cast_save に年齢だけ渡す）。キャストプロフの中の年齢は SQL 980 で直す */
let agefx = null;
function afxOpen(){
  let bg = document.getElementById("afxBg");
  if(!bg){ bg = document.createElement("div"); bg.id = "afxBg"; bg.style.cssText = "position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.4);display:flex;align-items:flex-start;justify-content:center;padding:14px;overflow:auto"; document.body.appendChild(bg); bg.addEventListener("click", e => { if(e.target === bg && !(agefx && agefx.busy)) bg.remove(); }); }
  agefx = { list: [], log: [], busy: false, read: false, stop: false };
  afxPaint();
}
const afxDigits = v => String(v || "").normalize("NFKC").replace(/\s*(歳|才)\s*$/, "").trim();
function afxPaint(){
  const bg = document.getElementById("afxBg"); if(!bg || !agefx) return;
  const a = agefx, todo = a.list.filter(x => x.state !== "ok");
  bg.innerHTML = `<div style="background:#fff;border-radius:16px;max-width:720px;width:100%;padding:16px 18px;box-shadow:0 10px 30px rgba(0,0,0,.2)">
    <h3 style="margin:0 0 6px">🧹 公式HPの年齢から「歳」をとる</h3>
    <div style="font-size:12.5px;color:#7A6670;margin-bottom:10px">全部のお店の公式HPを読んで、年齢が「22歳」のようになっている子をさがします（読むだけ。1店1〜2分）。「直す」で数字だけにして保存します（ほかの欄はさわりません）。</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
      <button class="btn btn-ghost" ${a.busy ? "disabled" : ""} onclick="afxRead()">🔎 さがす（読むだけ）</button>
      ${a.read && todo.length ? `<button class="btn btn-primary" ${a.busy ? "disabled" : ""} onclick="afxFix()">🧹 ${todo.length}人を直す</button>` : ""}
      ${a.busy ? `<button class="btn btn-ghost" onclick="agefx.stop=true">⏹ 止める</button>` : `<button class="btn btn-ghost" onclick="document.getElementById('afxBg').remove()">閉じる</button>`}
    </div>
    ${a.log.length ? `<div style="font-size:12.5px;color:#5C4B4F;margin-bottom:8px">${a.log.map(esc).join("<br>")}</div>` : ""}
    ${a.read ? (a.list.length ? `<table class="list" style="width:100%;font-size:13px"><tr><th>お店</th><th>番号</th><th>名前</th><th>今</th><th>直したあと</th><th></th></tr>${a.list.map(x => `<tr><td>${esc(x.label)}</td><td>${x.no}</td><td>${esc(x.name)}</td><td>${esc(x.age)}</td><td><b>${esc(x.to)}</b></td><td>${x.state === "ok" ? "✅" : x.state === "ng" ? "❌ " + esc(x.msg || "") : x.state === "run" ? "…" : ""}</td></tr>`).join("")}</table>`
      : `<div style="font-weight:800;color:#2e8b57">✅ 「歳」がついている子はいません</div>`) : ""}
  </div>`;
}
async function afxRead(){
  const a = agefx; a.busy = true; a.stop = false; a.list = []; a.log = []; a.read = false; afxPaint();
  for(const s of stores.filter(x => HP_SITE_OF[x.key])){
    if(a.stop) break;
    a.log.push(`${s.label}：読んでいます…`); afxPaint();
    const r = await hpFn({ action: "cast_list", store: s.key });
    if(!r || !r.ok){ a.log[a.log.length - 1] = `${s.label}：❌ 読めませんでした（${(r && r.error) || "?"}）`; afxPaint(); continue; }
    const nos = r.nos || []; let n = 0;
    for(let i = 0; i < nos.length && !a.stop; i += 8){
      const p = await hpFn({ action: "cast_profiles", store: s.key, nos: nos.slice(i, i + 8) });
      for(const x of ((p && p.profiles) || [])){
        if(x.error || !x.name) continue;
        if(/(歳|才)\s*$/.test(String(x.age || ""))){ a.list.push({ sk: s.key, label: s.label, no: x.no, name: x.name, age: x.age, to: afxDigits(x.age), state: "" }); n++; }
      }
      a.log[a.log.length - 1] = `${s.label}：${Math.min(i + 8, nos.length)}／${nos.length}人 読みました（歳つき ${n}人）`; afxPaint();
    }
  }
  a.busy = false; a.read = true; afxPaint();
}
async function afxFix(){
  const a = agefx, todo = a.list.filter(x => x.state !== "ok");
  if(!todo.length || !confirm(`${todo.length}人の公式HPの年齢を、数字だけにして保存します。いいですか？`)) return;
  a.busy = true; a.stop = false; afxPaint();
  for(const x of todo){
    if(a.stop) break;
    x.state = "run"; afxPaint();
    try{
      const r = await hpFn({ action: "cast_save", store: x.sk, no: x.no, set: { age: x.to }, dry: false, publish: true });
      if(r && r.ok){ x.state = "ok"; } else { x.state = "ng"; x.msg = (r && r.error) || ((r && r.failed) || []).join("・") || "保存できませんでした"; }
    }catch(e){ x.state = "ng"; x.msg = e.message || String(e); }
    afxPaint();
  }
  a.busy = false; afxPaint();
  const ng = a.list.filter(x => x.state === "ng").length;
  toast(ng ? `🧹 直しました（できなかった子 ${ng}人）` : "🧹 公式HPの年齢を数字だけにしました");
}
/* 📡 媒体の年齢もそろえる（2026/11/28 店長：公式HPで歳をとった子の、媒体の年齢も）
   ・直した子は、この端末に覚えておく（kbAgeFixed）→ あとで開いても「📡 媒体にも入れる」ができる
   ・ロボットには年齢だけ渡す（ageOnly：タグ・タイプなどの自動の追加はしない）。媒体の年齢がもう同じなら何もしない
   ・18・極門（ダミーの年齢）は入れない */
function afxSaved(){ try{ return JSON.parse(localStorage.getItem("kbAgeFixed") || "[]"); }catch(e){ return []; } }
function afxSave(list){ try{ localStorage.setItem("kbAgeFixed", JSON.stringify(list)); }catch(e){} }
{ const __fx = afxFix; afxFix = async function(){ const r = await __fx.apply(this, arguments); const ok = agefx.list.filter(x => x.state === "ok").map(x => ({ sk: x.sk, no: x.no, name: x.name, to: x.to })); if(ok.length){ const old = afxSaved().filter(o => !ok.some(n => n.sk === o.sk && n.no === o.no)); afxSave(old.concat(ok)); } afxPaint(); return r; }; }
// 媒体に入れる先：その子が入っているお店 × そのお店の媒体（📡 の選びで外していないもの）
async function afxTargets(rows){
  let set = {}; try{ const r = await sb.from("kb_settings").select("value").eq("key", "media_prof_targets").maybeSingle(); set = (r && r.data && r.data.value) || {}; }catch(e){}
  const out = [];
  for(const x of rows){
    if(PROF_DUMMY.includes(PROF_STORE_OF[x.sk])) continue;
    const c = casts.find(k => k.stores && k.stores[x.sk] && String(k.stores[x.sk].siteNo || "") === String(x.no)) || casts.find(k => k.stores && k.stores[x.sk] && nameOf(k) === x.name);
    if(!c){ out.push({ x, err: "台帳でこの子が見つかりません（在籍番号を入れてください）" }); continue; }
    MP_MEDIA.forEach(m => { if(m.stores.includes(x.sk) && set[m.media + ":" + x.sk] !== false) out.push({ x, c, media: m.media, label: `${m.label}（${PROF_STORE_OF[x.sk]}）`, state: "" }); });
  }
  return out;
}
async function afxMedia(){
  const rows = afxSaved(); if(!rows.length){ toast("公式HPで歳をとった子の記録がありません"); return; }
  const a = agefx; a.media = await afxTargets(rows);
  const n = a.media.filter(t => t.media).length;
  if(!n || !confirm(`${rows.length}人の年齢を、媒体（${n}か所）にも入れます。年齢だけで、ほかの欄はさわりません。1か所20秒ほどかかります。いいですか？`)) { afxPaint(); return; }
  a.busy = true; a.stop = false; afxPaint();
  for(const t of a.media){
    if(a.stop) break; if(!t.media){ continue; }
    t.state = "run"; afxPaint();
    try{
      const r = await hpFn({ action: "media_prof", media: t.media, store: t.x.sk, names: mpNames(t.c, t.x.sk), prof: { age: t.x.to, ageOnly: "1" }, dry: false, by: operatorName() });
      const age = r && (r.plan || []).find(p => /年齢/.test(p.label));
      if(r && r.ok){ t.state = "ok"; t.msg = age && age.change ? `${age.before || "（空）"} → ${age.after}` : "もう同じ"; }
      else { t.state = "ng"; t.msg = (r && r.error) || "入れられませんでした"; }
    }catch(e){ t.state = "ng"; t.msg = e.message || String(e); }
    afxPaint();
  }
  a.busy = false;
  if(!a.stop && a.media.every(t => !t.media || t.state === "ok")) afxSave([]);   // 全部入ったら記録を消す
  afxPaint();
}
{ const __pt = afxPaint; afxPaint = function(){
  __pt.apply(this, arguments);
  const bg = document.getElementById("afxBg"), box = bg && bg.firstElementChild; if(!box || !agefx) return;
  const saved = afxSaved(), m = agefx.media || [];
  const h = `<div style="margin-top:12px;border-top:1.5px dashed #F1E3E7;padding-top:10px">
    <b>📡 媒体の年齢</b><div style="font-size:12.5px;color:#7A6670;margin:2px 0 6px">公式HPで歳をとった子（${saved.length}人）の年齢を、媒体にも入れます（年齢だけ）。</div>
    ${saved.length ? `<button class="btn btn-primary btn-sm" ${agefx.busy ? "disabled" : ""} onclick="afxMedia()">📡 ${saved.length}人の年齢を媒体にも入れる</button>` : `<small>（まだ直した子はいません）</small>`}
    ${m.length ? `<table class="list" style="width:100%;font-size:12.5px;margin-top:6px">${m.map(t => `<tr><td>${esc(t.x.name)}</td><td>${esc(t.label || "")}</td><td>${t.err ? "⚠️ " + esc(t.err) : t.state === "ok" ? "✅ " + esc(t.msg || "") : t.state === "ng" ? "❌ " + esc(t.msg || "") : t.state === "run" ? "…" : ""}</td></tr>`).join("")}</table>` : ""}
  </div>`;
  box.insertAdjacentHTML("beforeend", h);
}; }
// 🔎 公式HPはもう直したあと（記録がない）でも：台帳のプロフ（prof_casts）の年齢に歳がついている子 → その子の入っているお店（在籍番号があるところ）
//   ※ SQL 980（プロフの歳をとる）より前に押す
async function afxFromProf(){
  let profs = [];
  try{ profs = q(await sb.from("prof_casts").select("id,name,data").eq("deleted", false)) || []; }catch(e){ toast("プロフが読めませんでした：" + (e.message || e)); return; }
  const rows = [];
  for(const p of profs){
    const d = p.data || {}, c = casts.find(k => k.prof_id === p.id); if(!c || !c.stores) continue;
    for(const sk of Object.keys(c.stores)){
      const sn = PROF_STORE_OF[sk]; if(!sn || PROF_DUMMY.includes(sn) || !c.stores[sk] || !c.stores[sk].siteNo) continue;
      const raw = String(profGet(d, sn, "age") || d.age || "");
      if(/(歳|才)\s*$/.test(raw)) rows.push({ sk, no: c.stores[sk].siteNo, name: nameOf(c), to: afxDigits(raw) });
    }
  }
  const old = afxSaved().filter(o => !rows.some(n => n.sk === o.sk && String(n.no) === String(o.no)));
  afxSave(old.concat(rows));
  toast(rows.length ? `🔎 プロフに歳がついていた子：${new Set(rows.map(r => r.name)).size}人（${rows.length}店ぶん）` : "プロフに歳がついている子はいませんでした");
  afxPaint();
}
{ const __pt2 = afxPaint; afxPaint = function(){
  __pt2.apply(this, arguments);
  const bg = document.getElementById("afxBg"), box = bg && bg.firstElementChild; if(!box || !agefx || agefx.busy) return;
  box.insertAdjacentHTML("beforeend", `<div style="margin-top:6px;font-size:12.5px"><button class="btn btn-ghost btn-sm" onclick="afxFromProf()">🔎 公式HPはもう直した：台帳のプロフで歳がついている子から探す</button> <small style="color:#9C8B8F">（SQL 980 の前に押す）</small></div>`);
}; }
