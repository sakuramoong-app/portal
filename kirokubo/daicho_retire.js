/* 🚪 退店にしたら、公式HPの掲載も外す（2026/11/22 店長）
   ・台帳の在籍店舗に「公式HPの番号」がある店だけ（18・極門のダミーは外さない：ほかの子も使う名前なので）
   ・ロボット cast_save に hide:true → 管理画面の「掲載」のチェックを外して保存 → 「更新」でホームページに出す（publish）
   ・外す前に「外しますか？」と聞く。外れたかは、ロボットが読みなおして確かめる */
function rtTargets(c){
  const DUMMY = ["eighteen", "gokumon"];
  return Object.entries((c && c.stores) || {}).filter(([mk, s]) => !DUMMY.includes(mk) && s && Number(s.siteNo) > 0)
    .map(([mk, s]) => ({ mk, no: Number(s.siteNo), label: ((typeof stores !== "undefined" ? stores : []).find(x => x.key === mk) || {}).label || mk }));
}
async function rtHideHp(c){
  const list = rtTargets(c);
  if(!list.length) return;
  if(!confirm(`公式HPの掲載も外しますか？\n\n${list.map(x => `・${x.label}（${x.no}番）`).join("\n")}\n\n（管理画面の「掲載」のチェックを外して、ホームページを更新します。写真や紹介文は消しません）`)) return;
  const ok = [], ng = [];
  for(const x of list){
    toast(`公式HPの掲載を外しています… ${x.label}`);
    try{
      const r = await hpFn({ action: "cast_save", store: x.mk, no: x.no, set: {}, hide: true, dry: false, publish: true });
      if(r && r.ok && !("hide" in r)) ng.push(`${x.label}：ロボットがまだ古いです（Supabase の hp-shift-sync を新しくしてください）`);
      else if(r && r.ok && r.hide) ok.push(x.label);
      else if(r && r.ok && r.saved === false && r.canShow) ok.push(x.label + "（もう外れていました）");
      else ng.push(`${x.label}：${(r && (r.error || r.note)) || "外せませんでした"}`);
    }catch(e){ ng.push(`${x.label}：${e.message || e}`); }
  }
  const msg = (ok.length ? `🚪 公式HPの掲載を外しました：${ok.join("・")}` : "") + (ng.length ? `\n⚠ 外せなかったお店（管理画面で手で外してください）：\n${ng.join("\n")}` : "");
  if(ng.length) alert(msg); else toast(msg);
}
{ const __r = confirmRetire; confirmRetire = async function(){
  const c = pf && pf.c;
  const r = await __r.apply(this, arguments);
  // 🔒 退店にしたら、シフトアプリ（キャストのアプリ）のログインをすぐ消す（2026/11/23 店長。送ってもらったメモ・シフトの記録は残る）
  try{ if(c && $("e_status") && $("e_status").value === "left"){ const n = q(await sb.rpc("cast_login_delete", { p_cast_id: c.id })); toast(n ? "🔒 キャストのアプリのログインを消しました（もう入れません）" : "🔒 キャストのアプリのログインはありませんでした"); } }catch(e){ alert("⚠ キャストのアプリのログインを消せませんでした：" + (e.message || e) + "（SQL 955 は実行ずみ？）"); }
  try{ if(c && $("e_status") && $("e_status").value === "left") await rtHideHp(casts.find(x => x.id === c.id) || c); }catch(e){ toast("公式HPの掲載を外せませんでした：" + (e.message || e)); }
  // 🗑 媒体からも消す（2026/11/27 店長）
  try{ if(c && $("e_status") && $("e_status").value === "left" && typeof mdOpen === "function") await mdOpen(casts.find(x => x.id === c.id) || c); }catch(e){ toast("媒体から消す画面を出せませんでした：" + (e.message || e)); }
  return r;
}; }
