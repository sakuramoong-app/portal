/* 🩷 ヘブン 即ヒメ 連動（2026/11/18 店長）
   記録簿の「今どこに誰が」に合わせて、シティヘブンの即ヒメ登録（サクラムーン池袋・ラナ鶯谷）を自動で変える
   ・⏳ 待機中 → ヘブン「待機中」
   ・💼 仕事中 → ヘブン「接客中」（次回 終わりの時刻＋インターバル〜）
   ・▶️ 予約スタート・📞 出勤前連絡・🈵 満了 → 「接客中」（次回＝最初の予約の終わり＋インターバル／出勤時刻／退勤時刻）
   ・今いない（お茶・欠勤・不在・精算済・直帰・まだ来ていない）→ 待機中・接客中を解除
   ・⏹ 仕事終了（振り分け待ち）→ さわらない
   ・変わったときだけ送る（その日・このPCで最後に送った形をおぼえておく）。ヘブンの画面にいない子（その日の出勤なし）はさわらない
   ・ON/OFF は内勤みんな共通（kb_settings 'heaven_sokuhime' = { on }）。今日のページで、編集できる人の画面からだけ送る
*/
const HV_SK_STORES = { sakuramoon: "サクラ", lana_uguisu: "ラナ鶯谷" };
let HV_SK_BUSY = false, HV_SK_TIMER = 0, HV_SK_LAST = "", HV_SK_ERR = "", HV_SK_BACKOFF = 0;
const hvSkOn = () => !!(M.set && M.set.heaven_sokuhime && M.set.heaven_sokuhime.on);
const hvSkMemKey = () => "hvSk:" + day;
function hvSkMem(){ try{ return JSON.parse(localStorage.getItem(hvSkMemKey()) || "{}") || {}; }catch(e){ return {}; } }
function hvSkMemSet(o){ try{ localStorage.setItem(hvSkMemKey(), JSON.stringify(o)); }catch(e){} }
// 1人分：この子をヘブンでどうしたいか（null ＝ さわらない）
// 次回の時刻（2026/11/18 店長）：
//   ・💼 仕事中 → 予約の終わり ＋ その子のインターバル（台帳。ない子は15分）
//   ・▶️ 予約スタート → 最初の予約の終わり ＋ インターバル
//   ・📞 出勤前連絡 → 出勤の時刻
//   ・🈵 満了 → 退勤の時刻（ヘブンで受付終了になる）
const hvSkGap = c => Number(c && c.interval_min) > 0 ? Number(c.interval_min) : 15;
const hvSkLive = x => x.bks.filter(b => !["done", "cancel", "tobi", "flowed"].includes(b.r.status)).sort((a, b) => a.s - b.s);
function hvSkWant(x){
  if(!x.c) return null;
  const st = boardState(x), cd = x.cd || {}, sh = x.shift, gap = hvSkGap(x.c) / 60;
  if(st === "gone") return { state: "off" };
  if(cd.full_at && sh && sh.end != null) return { state: "work", end: fromHour(Number(sh.end)), why: "満了" };
  if(st === "wait") return { state: "wait" };
  if(st === "work"){
    const aw = autoWork(x);
    const r = (aw && aw.r) || (x.bks.find(b => b.r.status === "working") || {}).r;
    const b = r && x.bks.find(z => z.r === r);
    return b ? { state: "work", end: fromHour(b.e + gap) } : null;   // 予約がわからない（手で仕事中にしただけ）ときは、さわらない
  }
  if(st === "start"){ const b = hvSkLive(x)[0]; return b ? { state: "work", end: fromHour(b.e + gap), why: "予約スタート" } : null; }
  if(st === "precall") return sh && sh.start != null ? { state: "work", end: fromHour(Number(sh.start)), why: "出勤前連絡" } : null;
  return null;
}
const hvSkSig = w => w.state + (w.end ? "@" + w.end : "");
// お店ごとに、送るもの（前に送った形とちがうものだけ。all ＝ ぜんぶ）
function hvSkPlan(all){
  const mem = all ? {} : hvSkMem(), plan = {};
  tlRows().forEach(x => {
    const w = hvSkWant(x); if(!w) return;
    Object.keys(HV_SK_STORES).forEach(k => {
      if(!(x.c.stores && x.c.stores[k])) return;
      const key = k + "|" + x.c.id; if(mem[key] === hvSkSig(w)) return;
      const nm = [x.c.official_name, x.c.temp_name, x.c.stores[k] && x.c.stores[k].name].map(s => String(s || "").trim()).filter(Boolean);
      if(!nm.length) return;
      (plan[k] = plan[k] || []).push({ key, sig: hvSkSig(w), names: [...new Set(nm)], state: w.state, end: w.end || "" });
    });
  });
  return plan;
}
async function hvSkSync(all, dry){
  if(HV_SK_BUSY) return;
  const plan = hvSkPlan(all);
  if(!Object.keys(plan).length){ if(dry || all) hvSkShow("変えるところはありません"); return; }
  HV_SK_BUSY = true; hvSkPaint();
  const mem = hvSkMem(), lines = [];
  let err = "";
  for(const [k, list] of Object.entries(plan)){
    try{
      const { data, error } = await sb.functions.invoke("hp-shift-sync", { body: { action: "heaven_sokuhime", store: k, dry: !!dry, by: KB.operatorName(), want: list.map(w => ({ names: w.names, state: w.state, end: w.end })) } });
      if(error || !data) throw new Error((data && data.error) || (error && error.message) || "つながりませんでした");
      if(data.error) throw new Error(data.error);
      (data.results || []).forEach((r, i) => {
        const w = list.find(z => z.names[0] === r.name) || list[i];
        if(!dry && w && r.ok) mem[w.key] = w.sig;   // うまくいった・ヘブンにいない子は、おぼえる（もう送らない）
        if(r.did && r.did.length) lines.push(`${HV_SK_STORES[k]} ${r.heaven}：${r.before} → ${dry ? "（ためし）" + r.did.join("・") : (r.after || r.did.join("・"))}${r.ok ? "" : " ⚠️うまくいかなかった"}`);
        else if(dry) lines.push(`${HV_SK_STORES[k]} ${r.heaven || r.name}：${r.why || "そのまま（" + r.before + "）"}`);
      });
      if(dry && data.girls) lines.push(`（${HV_SK_STORES[k]}のヘブンの即ヒメ画面：${data.girls.length}人・ヘブンのお店の記号 ${data.shopdir || "?"}）`);
    }catch(e){ err += `${HV_SK_STORES[k]}：${e.message || e}　`; }
  }
  if(!dry) hvSkMemSet(mem);
  HV_SK_BUSY = false;
  HV_SK_ERR = err; HV_SK_BACKOFF = err ? Date.now() + 3 * 60000 : 0;   // エラーのときは3分あけてから
  HV_SK_LAST = new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  if(lines.length && !dry) toast("🩷 ヘブン即ヒメ：" + lines.length + "件 変えました");
  if(dry || all) hvSkShow((lines.join("\n") || "変えるところはありません") + (err ? "\n⚠️ " + err : ""));
  hvSkPaint();
}
function hvSkShow(t){ const el = $("hvSkOut"); if(el){ el.textContent = t; el.style.display = "block"; } }
async function hvSkToggle(){
  const v = { on: !hvSkOn() };
  if(v.on && !confirm("ヘブンの即ヒメ（サクラ・ラナ鶯谷）を、記録簿の「今どこに誰が」に合わせて自動で変えます。\nはじめる前に「🔍 ためし」で、何が変わるか見てください。\nONにしますか？")) return;
  try{ q(await sb.from("kb_settings").upsert({ key: "heaven_sokuhime", value: v, note: "🩷 ヘブン即ヒメ連動（記録簿の今どこに誰が → 待機中／接客中）" })); M.set.heaven_sokuhime = v; toast(v.on ? "🩷 ヘブン即ヒメ連動を ON にしました" : "ヘブン即ヒメ連動を OFF にしました"); }
  catch(e){ toast("保存できませんでした：" + (e.message || e)); }
  hvSkPaint(); if(v.on) hvSkSync(false, false);
}
function hvSkPaint(){
  const g = $("boardGrid"); if(!g) return;
  let bar = $("hvSkBar");
  const wrap = g.closest(".wrapx") || g;
  if(!bar){ wrap.insertAdjacentHTML("beforebegin", `<div id="hvSkBar" class="hvskbar"></div><pre id="hvSkOut" class="hvskout" style="display:none"></pre>`); bar = $("hvSkBar"); }
  const isToday = day === KB.bizDateOf();
  if(!isToday){ bar.style.display = "none"; return; }
  bar.style.display = "";
  const on = hvSkOn();
  bar.innerHTML = `<span class="hvsk-t">🩷 ヘブン即ヒメ連動 <b class="${on ? "on" : "off"}">${on ? "ON" : "OFF"}</b></span>`
    + (KB.CAN_EDIT ? `<button class="btn btn-sm" onclick="hvSkToggle()">${on ? "OFFにする" : "ONにする"}</button>
       <button class="btn btn-sm" onclick="hvSkSync(true, true)">🔍 ためし（読むだけ）</button>`
       + (on ? `<button class="btn btn-sm" onclick="hvSkSync(true, false)">🔁 今すぐ全員あわせる</button>` : "") : "")
    + (HV_SK_BUSY ? `<span class="hint2">ヘブンに送っています…</span>` : HV_SK_LAST ? `<span class="hint2">最後に見た ${esc(HV_SK_LAST)}</span>` : "")
    + (HV_SK_ERR ? `<span class="hvsk-err">⚠️ ${esc(HV_SK_ERR)}</span>` : "");
}
// 札が動くたびに（描きなおすたびに）5秒まとめてから、変わった子だけ送る
{ const __rbHv = renderBoard; renderBoard = function(){
  const r = __rbHv.apply(this, arguments);
  try{
    hvSkPaint();
    if(hvSkOn() && KB.CAN_EDIT && day === KB.bizDateOf() && Date.now() > HV_SK_BACKOFF){
      clearTimeout(HV_SK_TIMER); HV_SK_TIMER = setTimeout(() => { if(Object.keys(hvSkPlan(false)).length) hvSkSync(false, false); }, 5000);
    }
  }catch(e){ console.warn("hvSk", e); }
  return r;
}; }
document.head.insertAdjacentHTML("beforeend", `<style>
  .hvskbar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:4px 0 8px;font-size:13px}
  .hvskbar .hvsk-t{font-weight:800}
  .hvskbar b.on{color:#fff;background:#e0457b;border-radius:8px;padding:1px 8px}
  .hvskbar b.off{color:#666;background:#eee;border-radius:8px;padding:1px 8px}
  .hvskbar .hvsk-err{color:#c00;font-weight:700}
  .hvskout{white-space:pre-wrap;font-family:inherit;font-size:13px;background:#fff6fa;border:1px solid #f3c2d6;border-radius:10px;padding:8px 10px;margin:0 0 8px}
</style>`);
