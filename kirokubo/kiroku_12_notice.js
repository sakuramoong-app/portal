/* 🔔 内勤への通知を足す（2026/11/18 店長）
   ① 📝 キャスト台帳の更新：台帳で保存されたら（kb_settings 'daicho_updates'）、記録簿の右下の枠に出す（🔔 とは別・読むまで消えない）。1分ごとに見る。自分で直したものは出さない
      押すと台帳のその子を開く
   ② 💸 日払いの書きわすれ：前日〜3日前の記録簿で、内勤の日払いの「金額」か「どこから」が空なら、その内勤さんに通知（ログインしている人ごと・1日1回） */
// 📝 台帳の更新は 🔔 とは別の枠に出す（2026/11/20 店長）：「✓ 読んだ」を押すまで消えない・⏰ あとで（スヌーズ）
NTF_KINDS.staffpay = { label: "💸 日払いの書きわすれ（前日〜3日前）", def: "triple", voice: true, text: "💸 {時間}の日払い：{内容}", say: "日払いの書きわすれがあります" };
const dcSeenKey = () => "kbDcSeen:" + (KB.operatorName() || "-");
const dcReadKey = () => "kbDcRead:" + (KB.operatorName() || "-");
const dcSnzKey = () => "kbDcSnooze:" + (KB.operatorName() || "-");
const dcLs = (k, d) => { try{ const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; }catch(e){ return d; } };
const dcLsSet = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
let DC_LIST = [], dcOpen = true;
const dcHm = s => { const d = new Date(s); return (d.getMonth() + 1) + "/" + d.getDate() + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
function dcUnread(){
  const base = dcLs(dcSeenKey(), ""), read = dcLs(dcReadKey(), {}), me = KB.operatorName() || "";
  return DC_LIST.filter(x => base && x.at > base && (!me || x.by !== me) && !read[x.id]);
}
function dcPaint(){
  let box = document.getElementById("dcBox");
  const un = dcUnread();
  if(!un.length){ if(box) box.remove(); return; }
  if(!box){ box = document.createElement("div"); box.id = "dcBox"; document.body.appendChild(box); }
  const snz = Number(dcLs(dcSnzKey(), 0)) || 0, sleeping = snz > Date.now();
  const until = sleeping ? (d => String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"))(new Date(snz)) : "";
  if(sleeping || !dcOpen){
    box.className = "mini";
    box.innerHTML = `<button type="button" onclick="dcWake()">📝 台帳の更新 <b>${un.length}</b>${sleeping ? `<small>⏰ ${until}まで</small>` : ""}</button>`;
    return;
  }
  box.className = "";
  box.innerHTML = `<div class="dch"><b>📝 キャスト台帳の更新（${un.length}件）</b><button type="button" class="x" title="小さくする" onclick="dcOpen=false;dcPaint()">－</button></div>
    <div class="dcl">${un.slice().reverse().map(x => `<div class="dci"><div><b>${esc(x.name || "?")}</b>　${esc(x.what || "")}<small>${esc(x.by || "?")}・${dcHm(x.at)}</small></div>
      <div class="dcb">${x.cid ? `<button type="button" onclick="window.open('index.html?cast=${encodeURIComponent(x.cid)}','_blank')">開く</button>` : ""}<button type="button" class="ok" onclick="dcRead('${x.id}')">✓ 読んだ</button></div></div>`).join("")}</div>
    <div class="dcf">${un.length > 1 ? `<button type="button" class="ok" onclick="dcRead('*')">✓ ぜんぶ読んだ</button>` : ""}
      <span>⏰ あとで：</span>${[[15, "15分"], [60, "1時間"], [180, "3時間"]].map(([m, l]) => `<button type="button" onclick="dcSnooze(${m})">${l}</button>`).join("")}</div>`;
}
function dcRead(id){
  const read = dcLs(dcReadKey(), {});
  (id === "*" ? dcUnread().map(x => x.id) : [id]).forEach(k => read[k] = 1);
  const keep = {}; DC_LIST.forEach(x => { if(read[x.id]) keep[x.id] = 1; });   // 100件より古いものは忘れる
  dcLsSet(dcReadKey(), keep); dcPaint();
}
function dcSnooze(min){ dcLsSet(dcSnzKey(), Date.now() + min * 60000); dcPaint(); }
function dcWake(){ dcLsSet(dcSnzKey(), 0); dcOpen = true; dcPaint(); }
async function dcPoll(){
  try{
    const r = q(await sb.from("kb_settings").select("value").eq("key", "daicho_updates").maybeSingle());
    DC_LIST = Array.isArray(r && r.value) ? r.value : [];
    if(DC_LIST.length && !dcLs(dcSeenKey(), "")) dcLsSet(dcSeenKey(), DC_LIST[0].at);   // はじめての端末は、今までの分は出さない
    const n = dcUnread().length, snz = Number(dcLs(dcSnzKey(), 0)) || 0;
    if(n > (dcPoll.last || 0) && snz <= Date.now()) dcOpen = true;   // 新しい更新が来たら、ひらく
    if(snz && snz <= Date.now()) dcLsSet(dcSnzKey(), 0);
    dcPoll.last = n; dcPaint();
  }catch(e){ console.warn("dcPoll", e); }
}
document.head.insertAdjacentHTML("beforeend", `<style>
  #dcBox{position:fixed;right:12px;bottom:104px;z-index:956;width:min(380px,calc(100vw - 24px));background:#fff;border:2.5px solid #F2A900;border-radius:16px;box-shadow:0 8px 24px rgba(0,0,0,.18);font-size:13.5px;color:#5C4B4F}
  #dcBox.mini{width:auto;border:none;background:none;box-shadow:none}
  #dcBox.mini button{font-family:inherit;font-weight:900;font-size:14px;background:#FFF3C4;color:#8A6100;border:2.5px solid #F2A900;border-radius:99px;padding:8px 14px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.15)}
  #dcBox.mini b{background:#E5486C;color:#fff;border-radius:99px;padding:0 7px;margin-left:4px} #dcBox.mini small{margin-left:6px;font-size:11.5px}
  #dcBox .dch{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#FFF3C4;border-radius:13px 13px 0 0}
  #dcBox .dcl{max-height:46vh;overflow:auto;padding:4px 10px}
  #dcBox .dci{display:flex;gap:8px;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px dashed #eee} #dcBox .dci small{display:block;color:#9C8B8F;font-size:11.5px}
  #dcBox .dcb{display:flex;gap:4px;flex-shrink:0} #dcBox .dcf{display:flex;flex-wrap:wrap;gap:4px;align-items:center;padding:8px 10px;border-top:1px solid #f0e6e9;font-size:12.5px;font-weight:800}
  #dcBox button{font-family:inherit;font-weight:800;font-size:12.5px;border:1.5px solid #ddd;background:#fff;border-radius:99px;padding:4px 10px;cursor:pointer;color:#5C4B4F}
  #dcBox button.ok{background:#E5F6EC;border-color:#2e8b57;color:#2e8b57} #dcBox .x{font-size:16px;padding:0 10px}
</style>`);
setTimeout(dcPoll, 4000); setInterval(dcPoll, 60000);
// ② 💸 前日〜3日前：内勤カレンダーで出勤だったのに、記録簿の「内勤の日払い」を保存していない日 → その内勤さんに（1日1回）
//    （保存したのに「金額」か「どこから」が片方だけの日は、前からある 👛 のお知らせで出る）
async function checkStaffPayUnsaved(){
  if(!M.casts || KB.PRACTICE) return;
  const me = typeof SP_ME === "function" ? SP_ME() : ""; if(!me) return;
  const bd = KB.bizDateOf(), key = bd + "|spunsaved|" + me, fired = lsGet("kbFired");
  if(fired[key]) return;
  const miss = [];
  for(let i = 1; i <= 3; i++){
    const d = addDays(bd, -i); if(typeof SP_MISS_FROM !== "undefined" && d < SP_MISS_FROM) continue;
    try{ const r = (await staffRowsOf(d)).find(x => x.id === me); if(r && r.in != null && !r.saved) miss.push(d); }catch(e){ return; }
  }
  fired[key] = 1; lsSet("kbFired", fired);
  if(!miss.length) return;
  const md = d => Number(String(d).slice(5, 7)) + "月" + Number(String(d).slice(8)) + "日";
  notify("staffpay", { 時間: miss.map(md).join("・"), 内容: `${KB.operatorName()}さん、日払いの金額・どこから払ったかがまだです。記録簿のその日の「内勤の日払い」で入れて保存してください`, 名前: KB.operatorName() },
    `$('day').value='${miss[0]}';loadDay()`);
}
setTimeout(checkStaffPayUnsaved, 7000); setInterval(checkStaffPayUnsaved, 60000);
/* ③ 👛 退勤5分前：内勤の日払い（金額・どこから）がまだなら、声つきのお知らせ＋画面の上に帯（2026/11/20 店長）
   ・片方だけのときも出す。入れて保存したら消える
   ・残業するときは「内勤カレンダーで退勤時刻を変えて、記録簿を更新（F5）」と出す */
NTF_KINDS.staffend = { label: "👛 退勤5分前の日払い", def: "triple", voice: true, text: "👛 {時間}　{内容}", say: "{名前}さん、退勤5分前です。{方法}" };
// 足りないほうで、読む文を変える（2026/11/20 店長）
const spMissSay = r => { const a = Number(r.amount) > 0, s = !!r.src; return !a && !s ? "日払いの金額と、どこから払ったかが未入力です" : !a ? "日払いの金額が未入力です" : !s ? "日払いを、どこから払ったかが未選択です" : ""; };
const spHm = h => { const x = h >= 24 ? h - 24 : h; return (h >= 24 ? "翌" : "") + Math.floor(x) + ":" + String(Math.round((x % 1) * 60)).padStart(2, "0"); };
async function checkStaffEnd(){
  try{
    if(!M.casts || KB.PRACTICE) return;
    const me = SP_ME(); if(!me){ spEndBar(""); return; }
    const bd = KB.bizDateOf(), r = (await staffRowsOf(bd)).find(x => x.id === me);
    if(!r || r.out == null || r.in == null){ spEndBar(""); return; }
    const done = Number(r.amount) > 0 && !!r.src, now = nowHour();
    if(done || now < r.out - 5 / 60 || now > r.out + 3){ spEndBar(""); return; }   // 退勤5分前から（退勤の3時間あとまで）
    const miss = !(Number(r.amount) > 0) && !r.src ? "金額・どこから払ったか" : !(Number(r.amount) > 0) ? "金額" : "どこから払ったか";
    spEndBar(`👛 ${esc(KB.operatorName())}さん、退勤（${spHm(r.out)}）5分前です。<b>${spMissSay(r)}</b>。入れて保存してください。<small>残業するときは、内勤カレンダーで退勤時刻を変えてから、記録簿を更新（F5）してください</small>`);
    const key = bd + "|spend|" + me + "|" + r.out, fired = lsGet("kbFired");
    if(fired[key]) return;
    fired[key] = 1; lsSet("kbFired", fired);
    notify("staffend", { 名前: KB.operatorName(), 時間: "退勤 " + spHm(r.out), 方法: spMissSay(r), 内容: `${spMissSay(r)}。入れて保存してください（残業するときは内勤カレンダーで退勤時刻を変えて、記録簿を更新）` }, "spEndGo()");
  }catch(e){ console.warn("checkStaffEnd", e); }
}
function spEndBar(html){
  let b = document.getElementById("spEndBar");
  if(!html){ if(b) b.remove(); return; }
  if(!b){ b = document.createElement("div"); b.id = "spEndBar"; document.body.appendChild(b); }
  b.innerHTML = `<div>${html}</div><button type="button" onclick="spEndGo()">👛 日払いを入れる</button>`;
}
function spEndGo(){
  if(day !== KB.bizDateOf()){ $("day").value = KB.bizDateOf(); loadDay(); }
  setTimeout(() => { const d = document.getElementById("staffPayBox"); if(d){ d.open = true; d.scrollIntoView({ block: "center", behavior: "smooth" }); } }, 400);
}
document.head.insertAdjacentHTML("beforeend", `<style>
  #spEndBar{position:fixed;top:0;left:0;right:0;z-index:9400;display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;background:#FFE8EC;border-bottom:3px solid #E5486C;color:#B0213F;padding:10px 14px;font-size:15px;font-weight:800;box-shadow:0 6px 18px rgba(0,0,0,.18);animation:needGlow 1.3s ease-in-out infinite}
  #spEndBar small{display:block;font-size:12.5px;color:#7a2a3a;font-weight:700;margin-top:2px}
  #spEndBar button{font-family:inherit;font-weight:900;font-size:14px;background:#E5486C;color:#fff;border:none;border-radius:99px;padding:8px 16px;cursor:pointer}
</style>`);
setTimeout(checkStaffEnd, 8000); setInterval(checkStaffEnd, 60000);
{ const __lsp = loadStaffPay; loadStaffPay = async function(){ const r = await __lsp.apply(this, arguments); try{ checkStaffEnd(); }catch(e){} return r; }; }   // 日払いを保存したら、すぐ帯を消す
/* ④ 👛 次の営業日：朝（12時までに出勤）の内勤がログインしたら、前の営業日の内勤の日払いがまだ・片方だけの人を声でお知らせ（2026/11/20 店長）
   「○○さんの日払い入力がまだです。社長への日報報告に誤差が生じる可能性があります。○○さんへ連絡をして修正後に日報報告をお願いします」（1日1回） */
NTF_KINDS.staffprev = { label: "👛 前の日の内勤の日払いがまだ（朝の内勤に）", def: "triple", voice: true, text: "👛 {時間}の日払い：{内容}", say: "{内容}" };
const SP_NICK = { kya: "きゃ", suya: "すや", ran: "らん", kami: "かみ", waka: "わか" };
async function checkStaffPrevDay(){
  try{
    if(!M.casts || KB.PRACTICE) return;
    const me = SP_ME(); if(!me) return;
    const bd = KB.bizDateOf(), key = bd + "|spprev|" + me, fired = lsGet("kbFired");
    if(fired[key]) return;
    const mine = (await staffRowsOf(bd)).find(x => x.id === me);
    if(!mine || mine.in == null || mine.in > 12){ return; }   // 朝（11:30 など、12時まで）に出勤の内勤だけ
    const prev = addDays(bd, -1);
    if(typeof SP_MISS_FROM !== "undefined" && prev < SP_MISS_FROM) return;
    const miss = (await staffRowsOf(prev)).filter(r => r.in != null && (!(Number(r.amount) > 0) || !r.src));
    fired[key] = 1; lsSet("kbFired", fired);
    if(!miss.length) return;
    const nm = r => SP_NICK[r.id] || r.name || r.id;
    const who = miss.map(nm).join("さん・");
    const detail = miss.map(r => `${nm(r)}さん：${spMissSay(r)}`).join("／");
    const md = d => Number(String(d).slice(5, 7)) + "月" + Number(String(d).slice(8)) + "日";
    notify("staffprev", { 時間: md(prev), 名前: who,
      内容: `${who}さんの日払い入力がまだです（${detail}）。社長への日報報告に誤差が生じる可能性があります。${who}さんへ連絡をして、修正後に日報報告をお願いします` },
      `$('day').value='${prev}';loadDay();setTimeout(()=>{const d=document.getElementById('staffPayBox');if(d){d.open=true;d.scrollIntoView({block:'center'});}},800)`);
  }catch(e){ console.warn("checkStaffPrevDay", e); }
}
setTimeout(checkStaffPrevDay, 9000); setInterval(checkStaffPrevDay, 60000);
