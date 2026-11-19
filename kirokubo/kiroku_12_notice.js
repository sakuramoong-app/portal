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
