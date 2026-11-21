/* 🎭 18・極門のダミー名：キャスト台帳だけで済むように（2026/11/21 店長）
   ・名前を足すと、公式HPの在籍（hp_casts）から番号をさがして、プロフ（年齢・サイズ・AFなど）を自動で読む
   ・📥 公式HPからプロフを読む（番号を入れなおしたとき）
   ・🖼 イメージキャスト：イメージした子（何人でも。行くのはこの子でなくてもいい）→ 受付に出す・マッチ率で上に
   ・🗓 シフトを使う子：公式HP・シフトアプリに出すシフトを、どの子のシフトにするか（SQL 937 のあと） */
let dmImgTmp = null;   // 直している最中のイメージキャスト
const dmActiveCasts = () => (typeof casts !== "undefined" ? casts : []).filter(c => c.status !== "left").sort((a, b) => String(a.kana || a.official_name || "").localeCompare(String(b.kana || b.official_name || ""), "ja"));
const dmCastName = id => { const c = (typeof casts !== "undefined" ? casts : []).find(x => x.id === id); return c ? (c.official_name || c.temp_name || id) : id; };
function dmImgChips(){
  return (dmImgTmp || []).map(id => `<span class="dmimg">${esc(dmCastName(id))}<a href="javascript:void 0" onclick="dmImgTmp=dmImgTmp.filter(x=>x!=='${id}');document.getElementById('dm_img').innerHTML=dmImgChips()">✕</a></span>`).join("") || `<small style="color:var(--sub)">まだいません</small>`;
}
function dmImgAdd(id){ if(!id) return; dmImgTmp = dmImgTmp || []; if(!dmImgTmp.includes(id)) dmImgTmp.push(id); $("dm_img").innerHTML = dmImgChips(); }
{ const __f = dmForm; dmForm = function(d){
  const base = __f.apply(this, arguments);
  if(!("image_cast_ids" in d)) return base.replace('<div class="f" style="margin-top:6px"><label>メモ', `<div class="hint" style="margin-top:6px">🖼 イメージキャスト・🗓 シフトを使う子は、SQL 937 のあとで入れられます</div><div class="f" style="margin-top:6px"><label>メモ`);
  dmImgTmp = (d.image_cast_ids || []).slice();
  const cs = dmActiveCasts();
  const real = "real_cast_id" in d ? `<div class="f" style="margin-top:8px"><label>👤 本物（サクラ在籍の同じ子。いれば）</label>
      <select id="dm_real" onchange="if(this.value&&document.getElementById('dm_shift'))document.getElementById('dm_shift').value=this.value"><option value="">（いない・ダミーだけ）</option>${cs.map(c => `<option value="${c.id}" ${d.real_cast_id === c.id ? "selected" : ""}>${esc(c.official_name || c.temp_name)}</option>`).join("")}</select>
      <small style="color:var(--sub)">えらぶと、シフトもこの子のものになります。受付のマッチ率は100%</small></div>` : `<div class="hint" style="margin-top:8px">👤 本物の子とのリンクは、SQL 938 のあとで入れられます</div>`;
  const extra = real + `<div style="display:flex;gap:6px;align-items:center;margin-top:8px"><button type="button" class="btn btn-ghost btn-sm" onclick="dmReadHp(${d.id})">📥 公式HPからプロフを読む</button><small style="color:var(--sub)">番号を入れてから押す。年齢・サイズ・AFなどが上に入ります（見てから 💾 保存）</small></div>
    <div class="f" style="margin-top:8px"><label>🖼 イメージキャスト（何人でも。行くのはこの子でなくてもOK）</label>
      <div id="dm_img" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:4px">${dmImgChips()}</div>
      <select onchange="dmImgAdd(this.value);this.value=''"><option value="">＋ イメージキャストを足す</option>${cs.map(c => `<option value="${c.id}">${esc(c.official_name || c.temp_name)}</option>`).join("")}</select></div>
    <div class="f" style="margin-top:8px"><label>🗓 シフトを使う子（この子のシフトが、ダミーの公式HPに入ります。シフトアプリのキャスト管理のダミー名にも自動で入ります）</label>
      <select id="dm_shift"><option value="">（なし）</option>${cs.map(c => `<option value="${c.id}" ${dmShiftOf(d) === c.id ? "selected" : ""}>${esc(c.official_name || c.temp_name)}</option>`).join("")}</select></div>`;
  return base.replace('<div class="f" style="margin-top:6px"><label>メモ', extra + '<div class="f" style="margin-top:6px"><label>メモ');
}; }
{ const __s = dmSave; dmSave = async function(id){
  const d = dmList.find(x => x.id === id);
  if(d && "image_cast_ids" in d && $("dm_shift")){
    const u = { image_cast_ids: (dmImgTmp || []).slice(), shift_cast_id: $("dm_shift").value || null };
    if($("dm_real")){ u.real_cast_id = $("dm_real").value || null; if(u.real_cast_id) u.shift_cast_id = u.real_cast_id; }   // 本物がいれば、シフトも本物の（SQL 938）
    try{ q(await sb.from("kb_dummy_names").update(u).eq("id", id)); Object.assign(d, u); }catch(e){ toast("イメージキャスト・シフトが保存できませんでした：" + (e.message || e)); return; }
  }
  return __s.apply(this, arguments);
}; }
// 公式HPのプロフ（ロボット cast_profiles の1人分）→ ダミーの欄 {age,height,cup,weight,psize,af,rev_af,shasei}
function dmParseProf(p){
  const o = {}, N = s => { const m = String(s || "").normalize("NFKC").match(/\d+(\.\d+)?/); return m ? Number(m[0]) : null; };
  const sz = String(p.size || "").normalize("NFKC");
  if(N(p.age)) o.age = N(p.age);
  const t = sz.match(/T\s*(\d{3})/i); if(t) o.height = Number(t[1]);
  const cup = sz.match(/B\s*\d+\s*[\(（]?\s*([A-K])\s*[\)）]?/i) || sz.match(/([A-K])\s*カップ/i); if(cup) o.cup = cup[1].toUpperCase();
  const w = sz.match(/(\d{2,3})\s*kg/i); if(w) o.weight = Number(w[1]);
  if(N(p.psize)) o.psize = N(p.psize);
  const O = p.options || {}, pick = re => { const k = Object.keys(O).find(x => re.test(x.normalize("NFKC"))); return k ? O[k] : null; };
  const mk = v => v == null ? null : ({ "◎": "◎", "○": "○", "△": "△", "×": "×" })[v] || null;
  const raf = mk(pick(/逆\s*(AF|アナル)/i)), af = mk(pick(/^(?!.*逆).*(AF|アナル)/i)), sh = mk(pick(/射精/));
  if(raf) o.rev_af = raf; if(af) o.af = af; if(sh) o.shasei = sh;
  return o;
}
// 📥 公式HPの管理画面から、そのダミーのプロフを読む（ロボット cast_profiles）
async function dmReadHp(id, quiet){
  const d = dmList.find(x => x.id === id); if(!d) return;
  const no = Number(($("dm_hp_no") && $("dm_hp_no").value) || d.hp_no); if(!no){ toast("公式HPの番号を入れてください"); return; }
  if(!quiet) toast("公式HPから読んでいます…");
  let p;
  try{ const r = await hpFn({ action: "cast_profiles", store: d.store_key, nos: [no] }); p = r && r.ok && r.profiles && r.profiles[0]; if(!p || p.error) throw new Error((p && p.error) || (r && r.error) || "読めませんでした"); }
  catch(e){ toast("読めませんでした：" + (e.message || e)); return; }
  const set = (k, v) => { const el = $("dm_" + k); if(el && v != null && v !== "") el.value = v; };
  set("hp_no", no); Object.entries(dmParseProf(p)).forEach(([k, v]) => set(k, v));
  try{ q(await sb.from("kb_dummy_names").update({ hp_read_at: new Date().toISOString() }).eq("id", id)); }catch(e){}
  toast(`📥 ${p.name || d.name}（${no}番）のプロフを読みました。見てから「💾 保存」を押してください` + (p.name && p.name !== d.name ? `（公式HPの名前は「${p.name}」）` : ""));
}
// 📥 全部まとめて読む：今のお店で、番号があってプロフが空いている子だけ。空いている欄だけ入れて保存する
const DM_PF = ["age", "height", "cup", "weight", "psize", "af", "rev_af", "shasei"];
const dmEmpty = (d, k) => d[k] == null || d[k] === "";
// 年齢か身長が空で、まだ公式HPから読んでいない子だけ（カップは公式HPに無い子もいるので見ない 11/22）
const dmNeedsRead = d => d.active !== false && d.hp_no && !d.hp_read_at && ["age", "height"].some(k => dmEmpty(d, k));
async function dmReadAll(){
  let list = dmList.filter(d => d.store_key === dmStore && dmNeedsRead(d));
  if(!list.length){   // 空いている子がいなくても、押したら読みなおせるように（11/22 反応しない）
    const all = dmList.filter(d => d.store_key === dmStore && d.active !== false && d.hp_no);
    const noNo = dmList.filter(d => d.store_key === dmStore && d.active !== false && !d.hp_no).map(d => d.name);
    if(!all.length){ toast("番号が入っている子がいません。「✏️ 直す」で番号を入れてください"); return; }
    if(!confirm(`年齢・身長が空いている子はいません。\n番号がある${all.length}人を、公式HPから読みなおしますか？（空いている欄だけ入れます。入っている欄は変えません）` + (noNo.length ? `\n\n番号がない子：${noNo.join("・")}（「✏️ 直す」で番号を入れてください）` : ""))) return;
    list = all;
  } else if(!confirm(`${list.length}人のプロフを公式HPから読んで、空いている欄だけ入れます。いいですか？`)) return;
  let ok = 0; const errs = [], same = [];
  for(let i = 0; i < list.length; i += 8){
    const part = list.slice(i, i + 8);
    toast(`公式HPを読んでいます… ${i + 1}〜${i + part.length}人目／${list.length}人`);
    let r; try{ r = await hpFn({ action: "cast_profiles", store: dmStore, nos: part.map(x => Number(x.hp_no)) }); }catch(e){ r = { ok: false, error: e.message || e }; }
    if(!r || !r.ok){ errs.push((r && r.error) || "読めませんでした"); continue; }
    for(const p of (r.profiles || [])){
      const d = part.find(y => Number(y.hp_no) === Number(p.no)); if(!d) continue;
      if(p.error){ errs.push(d.name + "：" + p.error); continue; }
      const got = dmParseProf(p), u = {};
      DM_PF.forEach(k => { if(got[k] != null && dmEmpty(d, k)) u[k] = got[k]; });
      const at = { hp_read_at: new Date().toISOString() };
      if(!Object.keys(u).length){ try{ q(await sb.from("kb_dummy_names").update(at).eq("id", d.id)); Object.assign(d, at); }catch(e){} same.push(d.name); continue; }
      try{ q(await sb.from("kb_dummy_names").update(Object.assign(at, u)).eq("id", d.id)); Object.assign(d, u, at); ok++; }
      catch(e){ errs.push(d.name + "：" + (e.message || e)); }
    }
  }
  dmPaint();
  toast(`📥 ${ok}人のプロフを入れました` + (same.length ? `。${same.join("・")}は、公式HPにも足りない欄がないので、そのままです` : "") + (errs.length ? `（読めなかった子：${errs.join("、")}）` : ""));
}
// ＋ 足したら：公式HPの在籍（hp_casts）から同じ名前の番号をさがして、プロフも読む
{ const __a = dmAdd; dmAdd = async function(){
  const name = ($("dm_new") && $("dm_new").value.trim()) || "";
  await __a.apply(this, arguments);
  const d = dmList.find(x => x.store_key === dmStore && x.name === name); if(!d) return;
  try{
    const h = q(await sb.from("hp_casts").select("hp_no,name").eq("store_key", dmStore).eq("gone", false)) || [];
    const key = s => String(s || "").normalize("NFKC").replace(/[\s　]/g, "");
    const hit = h.filter(x => key(x.name) === key(name));
    if(hit.length === 1){ const el = $("dm_hp_no"); if(el) el.value = hit[0].hp_no; await dmReadHp(d.id, true); }
    else toast("公式HPの在籍に同じ名前が見つかりませんでした。番号を入れて「📥 公式HPからプロフを読む」を押してください");
  }catch(e){}
}; }
// 一覧のカードに、イメージキャスト・シフトの子を出す
{ const __p = dmPaint; dmPaint = function(){
  const r = __p.apply(this, arguments);
  try{
    document.querySelectorAll('#dmBody button[onclick^="dmEditId="]').forEach(b => {
      const id = Number((b.getAttribute("onclick").match(/dmEditId=(\d+)/) || [])[1]); const d = dmList.find(x => x.id === id); if(!d) return;
      const info = b.previousElementSibling; if(!info) return;
      const img = (d.image_cast_ids || []).map(dmCastName), sh = dmShiftOf(d) ? dmCastName(dmShiftOf(d)) : "";
      if(d.real_cast_id) info.insertAdjacentHTML("beforeend", `<br><small>👤 本物：<b>${esc(dmCastName(d.real_cast_id))}</b></small>`);
      if(img.length || sh) info.insertAdjacentHTML("beforeend", `<br><small>${img.length ? `🖼 イメージ：<b>${esc(img.join("・"))}</b>` : ""}${sh ? `${img.length ? "　" : ""}🗓 シフト：<b>${esc(sh)}</b>${dmLinkMark(d)}` : ""}</small>`);
    });
    const nr = dmList.filter(d => d.store_key === dmStore && dmNeedsRead(d)).length;
    if(CAN_EDIT) $("dmBody").insertAdjacentHTML("afterbegin", `<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px"><button type="button" class="btn btn-ghost btn-sm" id="dmReadAllBtn" onclick="dmReadAll()">📥 全部まとめて読む（${nr}人）</button><small style="color:var(--sub)">番号があってプロフが空いている子だけ、公式HPから入れます</small></div>`);
  }catch(e){}
  return r;
}; }
document.head.insertAdjacentHTML("beforeend", `<style>.dmimg{display:inline-flex;gap:4px;align-items:center;background:#F1ECFF;color:#4B3A8A;border-radius:99px;padding:2px 9px;font-size:12.5px;font-weight:800} .dmimg a{color:#9C8B8F;text-decoration:none}</style>`);
// ===== 🗓 シフトアプリとつなぐ（11/22）=====
// シフトアプリの「キャスト管理」の ダミー名（castAliases[シフト名]["18"|"極門"]）と、管理画面の番号（hp_dummy_map）を、台帳から入れる。
// → 受理したときに、その子のシフトがダミーの公式HP（エイティーン・極門）にも入る（今までの hp_sync.js のしくみ）
const DM_SHOP = { eighteen: "18", gokumon: "極門" };
let dmAliases = null;   // シフトアプリの castAliases（一覧で「だれのシフトか」を出すため）
const dmShiftName = id => { const c = (typeof casts !== "undefined" ? casts : []).find(x => x.id === id); return (c && c.shift_name) || ""; };
// シフトアプリで、このダミー名を使っている子（台帳でまだ選んでいなくても）
function dmShiftOf(d){
  if(d.shift_cast_id) return d.shift_cast_id;
  const shop = DM_SHOP[d.store_key]; if(!shop || !dmAliases) return null;
  const n = Object.keys(dmAliases).find(k => (dmAliases[k] || {})[shop] === d.name); if(!n) return null;
  const c = (typeof casts !== "undefined" ? casts : []).find(x => x.shift_name === n); return c ? c.id : null;
}
async function dmLoadAliases(){
  try{ const r = q(await sb.from("shift_master").select("data").eq("id", 1).maybeSingle()); dmAliases = (r && r.data && r.data.castAliases) || {}; }catch(e){ dmAliases = null; }
}
// 返り値：false＝やめた／文字＝お知らせ
async function dmLinkShift(d, newId, oldId){
  const shop = DM_SHOP[d.store_key]; if(!shop || (newId || null) === (oldId || null)) return "";
  const r = q(await sb.from("shift_master").select("data").eq("id", 1).maybeSingle());
  const m = r && r.data; if(!m || !m.castList) throw new Error("シフトアプリの名簿が読めません");
  m.castAliases = m.castAliases || {}; m.castStores = m.castStores || {};
  const inList = n => (m.castList || []).some(c => c && c.name === n);
  const newN = newId ? dmShiftName(newId) : "", oldN = oldId ? dmShiftName(oldId) : "";
  if(newId && (!newN || !inList(newN))) return `（${dmCastName(newId)}はシフトアプリにいないので、シフトはつなげませんでした）`;
  let other = "";
  if(newN){
    other = (m.castAliases[newN] || {})[shop] || "";
    if(other && other !== d.name && !confirm(`${dmCastName(newId)}は、シフトアプリで ${shop} の「${other}」のシフトになっています。\n「${d.name}」に変えますか？（1人の子は、1つのお店で1つのダミー名だけです）`)) return false;
  }
  // 前の子のつなぎを外す（このダミー名だったときだけ）
  if(oldN && (m.castAliases[oldN] || {})[shop] === d.name){
    delete m.castAliases[oldN][shop];
    m.castStores[oldN] = (m.castStores[oldN] || []).filter(x => x !== shop);
    try{ await sb.from("hp_dummy_map").delete().eq("store_key", d.store_key).eq("cast_name", oldN); }catch(e){}
  }
  if(newN){
    m.castAliases[newN] = Object.assign({}, m.castAliases[newN], { [shop]: d.name });
    if(!(m.castStores[newN] || []).includes(shop)) m.castStores[newN] = (m.castStores[newN] || []).concat(shop);
    if(d.hp_no) q(await sb.from("hp_dummy_map").upsert({ store_key: d.store_key, cast_name: newN, no: Number(d.hp_no), by_name: operatorName(), updated_at: new Date().toISOString() }, { onConflict: "store_key,cast_name" }));
    else { try{ await sb.from("hp_dummy_map").delete().eq("store_key", d.store_key).eq("cast_name", newN); }catch(e){} }
  }
  q(await sb.from("shift_master").upsert({ id: 1, data: m }));
  dmAliases = m.castAliases;
  // 前に「その子のシフト」にしていたほかのダミーは、外す
  if(newId && other && other !== d.name){
    const o = dmList.find(x => x.store_key === d.store_key && x.name === other);
    if(o && o.shift_cast_id === newId){ try{ q(await sb.from("kb_dummy_names").update({ shift_cast_id: null }).eq("id", o.id)); o.shift_cast_id = null; }catch(e){} }
  }
  return newN ? `🗓 シフトアプリにもつなぎました（${dmCastName(newId)}のシフトが ${shop}「${d.name}」に入ります）` : `🗓 シフトアプリのつなぎを外しました`;
}
// 💾 保存のときに、シフトアプリにも入れる（dmSave のいちばん外側）
{ const __s2 = dmSave; dmSave = async function(id){
  const d = dmList.find(x => x.id === id);
  if(!d || !("shift_cast_id" in d) || !$("dm_shift")) return __s2.apply(this, arguments);
  const oldId = dmShiftOf(d);
  let newId = $("dm_shift").value || null; if($("dm_real") && $("dm_real").value) newId = $("dm_real").value;
  let msg = "";
  try{ msg = await dmLinkShift(d, newId, oldId); }catch(e){ msg = "（シフトアプリにはつなげませんでした：" + (e.message || e) + "）"; }
  if(msg === false){ $("dm_shift").value = oldId || ""; if($("dm_real") && $("dm_real").value === newId) $("dm_real").value = d.real_cast_id || ""; return; }
  const r = await __s2.apply(this, arguments);
  if(msg) setTimeout(() => toast(msg), 1200);
  return r;
}; }
// 開いたときに、シフトアプリのダミー名も読む
{ const __o = dmOpen; dmOpen = async function(){ await Promise.all([__o.apply(this, arguments), dmLoadAliases()]); try{ if($("dmBg").classList.contains("show") && dmList.length) dmPaint(); }catch(e){} }; }
// 一覧：シフトアプリにつながっているか（✅／⚠ もう一度 💾 保存）
function dmLinkMark(d){
  const shop = DM_SHOP[d.store_key], id = dmShiftOf(d); if(!shop || !id || !dmAliases) return "";
  const n = dmShiftName(id);
  return n && (dmAliases[n] || {})[shop] === d.name ? ` <span style="color:#2E8B57;font-weight:800">✅ シフトアプリOK</span>`
    : ` <span style="color:#C0392B;font-weight:800">⚠ シフトアプリにまだつながっていません（「✏️ 直す」→「💾 保存」）</span>`;
}
