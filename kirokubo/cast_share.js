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
    // 一覧を読む前にカードが出ていたら、描きなおす（ボタンが LINE 用のままにならないように）
    if(CS.pilot.size){
      if(typeof refreshCastSettle === "function") CS.pilot.forEach(id => { try{ refreshCastSettle(id); }catch(e){} });
      else if(typeof render === "function" && /settle.html/.test(location.pathname)) try{ render(); }catch(e){}
    }
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
// 精算済／直帰／未精算（今の状態）
function csState(id){
  const cd = (typeof unsCD === "function" ? unsCD()[id] : (typeof castDays !== "undefined" ? castDays[id] : null)) || {};
  return cd.settled ? "settled" : cd.direct_home ? "home" : "unsettled";
}
// LINE で送っていた画像と同じもの（領収書があるときの一言も同じように入れる）
function csImage(id){
  return new Promise((ok, ng) => {
    let NOTE = "", had = true;
    try{
      if(typeof rcptListOf === "function" && typeof MEMO_NOTE !== "undefined"){
        const a = rcptListOf(id);
        if(a.length){ NOTE = `※領収書（${rcptText(a)}）も必ずいっしょに投函・お渡しください`; had = MEMO_NOTE.includes(NOTE); if(!had) MEMO_NOTE.push(NOTE); }
      }
      const cv = settleCanvas(id);
      cv.toBlob(b => b ? ok(b) : ng(new Error("画像が作れませんでした")), "image/png");
    }catch(e){ ng(e); }
    finally{ if(NOTE && !had){ const i = MEMO_NOTE.indexOf(NOTE); if(i >= 0) MEMO_NOTE.splice(i, 1); } }
  });
}
async function csSend(id){
  const x = castShareLines(id), st = csState(id), path = `${id}/${day}.png`;
  let img = "";
  try{
    const b = await csImage(id);
    const up = await sb.storage.from("cast-settle").upload(path, b, { upsert: true, contentType: "image/png" });
    if(up.error) throw up.error;
    img = path;
  }catch(e){ console.warn("精算の画像を送れませんでした（文だけ送ります）", e); }
  q(await sb.from("kb_cast_settle_share").upsert({ cast_id: id, biz_date: day, lines: x.lines, take_home: x.takeHome, state: st, img_path: img,
    uns: typeof unsOpen === "function" ? unsOpen(id).map(u => ({ date: u.date, what: u.what, amount: u.amount })) : [],   // 📒 未精算リスト（内勤の画面と同じ）
    shared_at: new Date().toISOString(), shared_by: (KB.operatorName && KB.operatorName()) || "" }, { onConflict: "cast_id,biz_date" }));
  CS.shared[id + "|" + day] = true;
  return st;
}
const CS_STATE = { settled: "精算済", home: "直帰", unsettled: "未精算" };
async function castShareSend(id){
  if(!csIsPilot(id)) return;
  const x = castShareLines(id);
  if(!confirm(`${castName(id)}さんの ${day} の精算（${CS_STATE[csState(id)]}）を、アプリに送りますか？\n\n${x.lines.join("\n")}\n\n（LINE で送っていた画像と同じものが届きます。送りなおすと上書き）`)) return;
  try{
    await csSend(id);
    toast("📲 アプリに送りました（キャストのアプリの「報酬」で見られます）");
    const b = document.getElementById("csb-" + id); if(b) b.textContent = "📲 送りなおす（確定ずみ）";
  }catch(e){ alert("送れませんでした：" + (e.message || e) + "\n（SQL 958 は実行ずみ？）"); }
}
// 精算済・直帰・もどす を押したら、テストのキャストは自動でアプリにも送る（状態が変わったときだけ）
window.addEventListener("load", () => {
  ["settle", "unsettle", "setDirectHome"].forEach(fn => {
    let orig; try{ orig = eval(fn); }catch(e){ return; }   // ページの中の関数（let でない、ふつうの関数）
    if(typeof orig !== "function") return;
    const wrap = async function(id){
      const before = csIsPilot(id) ? csState(id) : null;
      const r = await orig.apply(this, arguments);
      try{
        if(before != null && csState(id) !== before){ const st = await csSend(id); toast(`📲 アプリにも送りました（${CS_STATE[st]}）`); }
      }catch(e){ console.warn("アプリに送れませんでした", e); }
      return r;
    };
    try{ eval(fn + " = wrap"); }catch(e){}
  });
});
// 精算カードのボタン：テストのキャストは「確定してアプリに送る」、ほかは今までどおり LINE 用
function castShareActs(id){
  if(!csIsPilot(id)) return `<button class="btn btn-ghost btn-sm" onclick="copyDetail('${id}')">📋 精算明細をコピー（LINE用）</button>
      <button class="btn btn-ghost btn-sm" onclick="copyDetailImg('${id}')">🖼 画像でコピー</button>`;
  // アプリでうまくいかなかったとき用に、LINE 用のコピーも小さく残す（2026/11/23 店長）
  return `<button class="btn btn-primary btn-sm" id="csb-${id}" onclick="castShareSend('${id}')">${CS.shared[id + "|" + day] ? "📲 送りなおす（確定ずみ）" : "📲 確定してアプリに送る"}</button>
      <button class="btn btn-ghost btn-sm" onclick="copyDetailImg('${id}')" title="アプリでうまくいかなかったとき用">🖼 LINE用に画像コピー</button>
      <button class="btn btn-ghost btn-sm" onclick="copyDetail('${id}')" title="アプリでうまくいかなかったとき用">📋 LINE用に文をコピー</button>`;
}
