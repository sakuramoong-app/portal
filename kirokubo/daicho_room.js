/* 🚪 在籍作成ルーム ⇄ キャスト台帳 をつなぐ（2026/11/18 店長）
   ・在籍ルームの「📋 台帳で開く」→ index.html?room=ルームID（&name=名前）→ つながっている子を開く。つながっていなければ、つなぐ子をえらぶ窓
   ・台帳の上の「🚪 在籍ルームとつなぐ」：つながっていないルームの一覧。同じ名前の子があれば候補に出す → 「つなぐ」
   ・つなぐ＝その子の room_ids にルームIDを足すだけ（ほかの欄はさわらない） */
const drNorm = s => String(s || "").normalize("NFKC").replace(/[\s　]+/g, "").toLowerCase();
const drCastOfRoom = rid => casts.find(c => (c.room_ids || []).includes(rid));
function drCands(name){
  const n = drNorm(name); if(!n) return [];
  return casts.filter(c => [c.official_name, c.temp_name, c.shift_name, ...(c.aliases || [])].some(x => x && (drNorm(x) === n || drNorm(x).endsWith(n) || n.endsWith(drNorm(x)))));
}
async function drLink(cid, rid){
  const c = casts.find(x => x.id === cid); if(!c || !rid || !CAN_EDIT) return false;
  if((c.room_ids || []).includes(rid)) return true;
  const other = drCastOfRoom(rid); if(other && !confirm(`このルームは ${other.official_name || other.temp_name} とつながっています。${c.official_name || c.temp_name} につなぎなおしますか？`)) return false;
  try{
    if(other){ const ids = (other.room_ids || []).filter(x => x !== rid); const s0 = q(await sb.from("master_casts").update({ room_ids: ids }).eq("id", other.id).select().single()); casts = casts.map(x => x.id === other.id ? s0 : x); }
    const saved = q(await sb.from("master_casts").update({ room_ids: [...(c.room_ids || []), rid] }).eq("id", cid).select().single());
    casts = casts.map(x => x.id === cid ? saved : x);
    toast("🚪 在籍ルームとつなぎました"); try{ render(); }catch(e){}
    if(typeof daichoNote === "function") daichoNote(cid, saved.official_name || saved.temp_name, "🚪 在籍作成ルームとつないだ");
    return true;
  }catch(e){ toast("つなげませんでした：" + (e.message || e)); return false; }
}
function drModal(html){
  let bg = document.getElementById("drBg");
  if(!bg){ bg = document.createElement("div"); bg.id = "drBg"; bg.style.cssText = "position:fixed;inset:0;z-index:340;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:14px"; document.body.appendChild(bg);
    bg.addEventListener("click", e => { if(e.target === bg) bg.remove(); }); }
  bg.innerHTML = `<div style="background:#fff;border-radius:16px;padding:16px;max-width:720px;width:100%;max-height:88vh;overflow:auto;font-size:14px">${html}</div>`;
  return bg;
}
// ?room= で開いたとき
async function drOpenRoom(rid, name){
  const c = drCastOfRoom(rid); if(c){ openEdit(c.id); return; }
  const cands = drCands(name);
  drModal(`<b style="font-size:16px">🚪 この在籍ルーム（${esc(name || rid)}）は、まだ台帳とつながっていません</b>
    <div class="hint" style="margin:6px 0 10px">つなぐキャストをえらんでください。つなぐと、在籍ルームから台帳のその子を開けるようになります。</div>
    ${cands.length ? `<div style="font-weight:800;margin-bottom:4px">同じ名前の子</div>${cands.map(x => `<button class="btn btn-primary btn-sm" style="margin:0 6px 6px 0" onclick="drLinkOpen('${x.id}','${esc(rid)}')">${esc(x.official_name || x.temp_name)}（${esc(x.id)}）につなぐ</button>`).join("")}` : `<div class="hint">同じ名前の子はいません</div>`}
    <div style="margin-top:10px;font-weight:800">ほかの子をえらぶ</div>
    <input id="dr_q" placeholder="名前で探す" oninput="drPaintPick('${esc(rid)}')" style="width:100%;margin:4px 0"><div id="dr_pick"></div>
    <div style="text-align:right;margin-top:10px"><button class="btn btn-ghost btn-sm" onclick="document.getElementById('drBg').remove()">閉じる</button></div>`);
  drPaintPick(rid);
}
function drPaintPick(rid){
  const el = document.getElementById("dr_pick"); if(!el) return;
  const qv = drNorm((document.getElementById("dr_q") || {}).value || "");
  const L = casts.filter(c => c.status !== "left" && (!qv || drNorm([c.official_name, c.temp_name, c.kana].join(" ")).includes(qv))).slice(0, 30);
  el.innerHTML = L.map(x => `<button class="btn btn-ghost btn-sm" style="margin:0 6px 6px 0" onclick="drLinkOpen('${x.id}','${esc(rid)}')">${esc(x.official_name || x.temp_name)}${(x.room_ids || []).length ? " 🚪" : ""}</button>`).join("") || `<div class="hint">いません</div>`;
}
async function drLinkOpen(cid, rid){ if(await drLink(cid, rid)){ const b = document.getElementById("drBg"); if(b) b.remove(); openEdit(cid); } }
// 🚪 在籍ルームとつなぐ（つながっていないルームの一覧）
async function drOpenList(){
  const bg = drModal(`<b style="font-size:16px">🚪 在籍作成ルームと台帳をつなぐ</b><div class="hint" style="margin:6px 0">読んでいます…</div>`);
  let rooms = [];
  try{ rooms = q(await sb.from("room_rooms").select("room_id,cast_name,created_at").order("created_at", { ascending: false }).limit(300)) || []; }catch(e){ bg.querySelector("div").innerHTML += `<div class="warn">読めませんでした：${esc(e.message || e)}</div>`; return; }
  const free = rooms.filter(r => r.room_id && !drCastOfRoom(r.room_id));
  const md = s => { const d = new Date(s); return isNaN(d) ? "" : (d.getMonth() + 1) + "/" + d.getDate(); };
  bg.querySelector("div").innerHTML = `<b style="font-size:16px">🚪 在籍作成ルームと台帳をつなぐ</b>
    <div class="hint" style="margin:6px 0 10px">台帳とつながっていないルーム：<b>${free.length}こ</b>（全部で ${rooms.length}こ）。同じ名前の子がいれば「つなぐ」を押すだけです。</div>
    ${free.map(r => { const cs = drCands(r.cast_name);
      return `<div class="drrow"><div><b>${esc(r.cast_name || "（名前なし）")}</b> <small>${md(r.created_at)}</small></div>
        <div>${cs.map(x => `<button class="btn btn-primary btn-sm" onclick="drLinkRow(this,'${x.id}','${esc(r.room_id)}')">${esc(x.official_name || x.temp_name)} につなぐ</button>`).join(" ") || `<span class="hint">同じ名前の子がいない</span>`}
        <button class="btn btn-ghost btn-sm" onclick="drOpenRoom('${esc(r.room_id)}','${esc(r.cast_name || "")}')">ほかの子をえらぶ</button></div></div>`; }).join("") || `<div class="hint">つながっていないルームはありません 🎉</div>`}
    <div style="text-align:right;margin-top:10px"><button class="btn btn-ghost btn-sm" onclick="document.getElementById('drBg').remove()">閉じる</button></div>`;
  if(!document.getElementById("drCss")) document.head.insertAdjacentHTML("beforeend", `<style id="drCss">.drrow{display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;border-bottom:1px solid #F3D6E0;padding:6px 0}.drrow .btn{margin:2px}</style>`);
}
async function drLinkRow(btn, cid, rid){ if(await drLink(cid, rid)){ const row = btn.closest(".drrow"); if(row){ row.style.opacity = ".45"; row.querySelectorAll("button").forEach(b => b.disabled = true); row.insertAdjacentHTML("beforeend", `<b style="color:#1E8E5A">✅ つなぎました</b>`); } } }
// 読みこみが終わったら ?room= を見る
(function drBoot(){
  const p = new URLSearchParams(location.search), rid = p.get("room");
  const tryOpen = n => { if(typeof casts !== "undefined" && casts.length){ if(rid) drOpenRoom(rid, p.get("name") || ""); return; } if(n < 40) setTimeout(() => tryOpen(n + 1), 300); };
  if(rid) tryOpen(0);
})();
