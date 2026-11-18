/* 🔔 内勤への通知を足す（2026/11/18 店長）
   ① 📝 キャスト台帳の更新：台帳で保存されたら（kb_settings 'daicho_updates'）、記録簿の 🔔 に出す。1分ごとに見る。自分で直したものは出さない
      押すと台帳のその子を開く
   ② 💸 日払いの書きわすれ：前日〜3日前の記録簿で、内勤の日払いの「金額」か「どこから」が空なら、その内勤さんに通知（ログインしている人ごと・1日1回） */
NTF_KINDS.daicho = { label: "📝 キャスト台帳の更新", def: "up", voice: false, text: "📝 台帳：{名前}　{内容}", say: "{名前}さんの台帳が更新されました" };
NTF_KINDS.staffpay = { label: "💸 日払いの書きわすれ（前日〜3日前）", def: "triple", voice: true, text: "💸 {時間}の日払い：{内容}", say: "日払いの書きわすれがあります" };
const dcSeenKey = () => "kbDcSeen:" + (KB.operatorName() || "-");
async function dcPoll(){
  try{
    const r = q(await sb.from("kb_settings").select("value").eq("key", "daicho_updates").maybeSingle());
    const list = Array.isArray(r && r.value) ? r.value : []; if(!list.length) return;
    let seen = ""; try{ seen = localStorage.getItem(dcSeenKey()) || ""; }catch(e){}
    const top = list[0].at;
    if(!seen){ try{ localStorage.setItem(dcSeenKey(), top); }catch(e){} return; }   // はじめての端末は、今までの分は出さない
    const me = KB.operatorName() || "";
    const fresh = list.filter(x => x.at > seen && (!me || x.by !== me)).reverse();
    const hm = s => { const d = new Date(s); return (d.getMonth() + 1) + "/" + d.getDate() + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
    fresh.slice(-10).forEach(x => notify("daicho", { 名前: x.name, 内容: `${x.what}（${x.by || "?"}・${hm(x.at)}）`, 時間: hm(x.at) }, x.cid ? `window.open('index.html?cast=${encodeURIComponent(x.cid)}','_blank')` : ""));
    if(top > seen){ try{ localStorage.setItem(dcSeenKey(), top); }catch(e){} }
  }catch(e){ console.warn("dcPoll", e); }
}
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
