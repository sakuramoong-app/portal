/* 📲 キャストアプリへ精算明細を送る（2026/11/23 店長：テストのキャスト〈ムム〉だけ、LINE用コピーのかわりに「確定してアプリに送る」）
   ・テストのキャストは kb_settings の cast_app_pilot（キャストの ID の一覧。SQL 955）
   ・送った中身は kb_cast_settle_share（キャストは自分の分だけ、アプリで見られる）。送りなおすと上書き
   ・記録簿の受付（kiroku.html ＋ kiroku_3_seisan.js）と精算ページ（settle.html）の両方で使う
   このファイルの外にあるもの：sb q toast yen calcCast castName hm storeLabel backOf day DOW KB */
const CS = { pilot: new Set(), shared: {} };
(async () => {
  try{
    const r = await sb.from("kb_settings").select("value").eq("key", "cast_app_pilot").maybeSingle();
    const v = r && r.data && r.data.value;
    if(Array.isArray(v)) v.forEach(id => CS.pilot.add(String(id)));
  }catch(e){ /* SQL 955 の前は、ふつうどおり */ }
})();
function csIsPilot(id){ return CS.pilot.has(String(id)); }
// 精算の行（LINE用コピーと同じ中身。投函のしかたのURLは入れない）
function castShareLines(id){
  const c = calcCast(id), d = new Date(day + "T12:00:00Z");
  const L = [`【精算】${d.getUTCMonth() + 1}/${d.getUTCDate()}(${DOW[d.getUTCDay()]})`];
  c.all.forEach(r => {
    const off = r.status === "cancel" || r.status === "tobi" || r.status === "flowed";
    L.push(`・${hm(r.start_at)} ${storeLabel(r.store_key)} ${r.course}${/^\d+$/.test(r.course) ? "分" : ""}${r.extension_count ? " 延長" + r.extension_count : ""}　${off ? (r.status === "cancel" ? "キャンセル" : r.status === "flowed" ? "流れた" : "トビ") : "報酬 " + yen(backOf(r))}`);
  });
  L.push("", `報酬　${yen(c.reward)}`);
  if(c.option) L.push(`OP　${yen(c.option)}`);
  if(c.transportBack) L.push(`交通費バック　＋${yen(c.transportBack)}`);
  c.plusItems.forEach(x => { if(Number(x.amount)) L.push(`${x.label || "プラス"}　＋${yen(x.amount)}`); });
  L.push(`雑費　−${yen(c.zappi)}`);
  c.minusItems.forEach(x => { if(Number(x.amount)) L.push(`${x.label || "マイナス"}　−${yen(x.amount)}`); });
  L.push("", `本日のお給料　${yen(c.takeHome)}`);
  if(c.drop >= 0) L.push(`投函額　${yen(c.drop)}`);
  else L.push(`（カード決済のため、お店から ${yen(-c.drop)} お渡しします）`);
  return { lines: L, takeHome: Math.round(Number(c.takeHome) || 0) };
}
async function castShareSend(id){
  if(!csIsPilot(id)) return;
  const x = castShareLines(id);
  if(!confirm(`${castName(id)}さんの ${day} の精算を確定して、アプリに送りますか？\n\n${x.lines.join("\n")}\n\n（送りなおすと、上書きされます）`)) return;
  try{
    q(await sb.from("kb_cast_settle_share").upsert({ cast_id: id, biz_date: day, lines: x.lines, take_home: x.takeHome,
      shared_at: new Date().toISOString(), shared_by: (KB.operatorName && KB.operatorName()) || "" }, { onConflict: "cast_id,biz_date" }));
    CS.shared[id + "|" + day] = true;
    toast("📲 アプリに送りました（キャストのアプリの「報酬」で見られます）");
    const b = document.getElementById("csb-" + id); if(b) b.textContent = "📲 送りなおす（確定ずみ）";
  }catch(e){ alert("送れませんでした：" + (e.message || e) + "\n（SQL 955 は実行ずみ？）"); }
}
// 精算カードのボタン：テストのキャストは「確定してアプリに送る」、ほかは今までどおり LINE 用
function castShareActs(id){
  if(!csIsPilot(id)) return `<button class="btn btn-ghost btn-sm" onclick="copyDetail('${id}')">📋 精算明細をコピー（LINE用）</button>
      <button class="btn btn-ghost btn-sm" onclick="copyDetailImg('${id}')">🖼 画像でコピー</button>`;
  return `<button class="btn btn-primary btn-sm" id="csb-${id}" onclick="castShareSend('${id}')">${CS.shared[id + "|" + day] ? "📲 送りなおす（確定ずみ）" : "📲 確定してアプリに送る"}</button>`;
}
