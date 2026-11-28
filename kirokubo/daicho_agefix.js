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
