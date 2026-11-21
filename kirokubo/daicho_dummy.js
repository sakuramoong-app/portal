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
  const extra = `<div style="display:flex;gap:6px;align-items:center;margin-top:8px"><button type="button" class="btn btn-ghost btn-sm" onclick="dmReadHp(${d.id})">📥 公式HPからプロフを読む</button><small style="color:var(--sub)">番号を入れてから押す。年齢・サイズ・AFなどが上に入ります（見てから 💾 保存）</small></div>
    <div class="f" style="margin-top:8px"><label>🖼 イメージキャスト（何人でも。行くのはこの子でなくてもOK）</label>
      <div id="dm_img" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:4px">${dmImgChips()}</div>
      <select onchange="dmImgAdd(this.value);this.value=''"><option value="">＋ イメージキャストを足す</option>${cs.map(c => `<option value="${c.id}">${esc(c.official_name || c.temp_name)}</option>`).join("")}</select></div>
    <div class="f" style="margin-top:8px"><label>🗓 シフトを使う子（公式HP・シフトアプリに、この子のシフトを出す）</label>
      <select id="dm_shift"><option value="">（なし）</option>${cs.map(c => `<option value="${c.id}" ${d.shift_cast_id === c.id ? "selected" : ""}>${esc(c.official_name || c.temp_name)}</option>`).join("")}</select></div>`;
  return base.replace('<div class="f" style="margin-top:6px"><label>メモ', extra + '<div class="f" style="margin-top:6px"><label>メモ');
}; }
{ const __s = dmSave; dmSave = async function(id){
  const d = dmList.find(x => x.id === id);
  if(d && "image_cast_ids" in d && $("dm_shift")){
    const u = { image_cast_ids: (dmImgTmp || []).slice(), shift_cast_id: $("dm_shift").value || null };
    try{ q(await sb.from("kb_dummy_names").update(u).eq("id", id)); Object.assign(d, u); }catch(e){ toast("イメージキャスト・シフトが保存できませんでした：" + (e.message || e)); return; }
  }
  return __s.apply(this, arguments);
}; }
// 📥 公式HPの管理画面から、そのダミーのプロフを読む（ロボット cast_profiles）
async function dmReadHp(id, quiet){
  const d = dmList.find(x => x.id === id); if(!d) return;
  const no = Number(($("dm_hp_no") && $("dm_hp_no").value) || d.hp_no); if(!no){ toast("公式HPの番号を入れてください"); return; }
  if(!quiet) toast("公式HPから読んでいます…");
  let p;
  try{ const r = await hpFn({ action: "cast_profiles", store: d.store_key, nos: [no] }); p = r && r.ok && r.profiles && r.profiles[0]; if(!p || p.error) throw new Error((p && p.error) || (r && r.error) || "読めませんでした"); }
  catch(e){ toast("読めませんでした：" + (e.message || e)); return; }
  const set = (k, v) => { const el = $("dm_" + k); if(el && v != null && v !== "") el.value = v; };
  const N = s => { const m = String(s || "").normalize("NFKC").match(/\d+(\.\d+)?/); return m ? Number(m[0]) : null; };
  const sz = String(p.size || "").normalize("NFKC");
  set("hp_no", no); set("age", N(p.age));
  const t = sz.match(/T\s*(\d{3})/i); if(t) set("height", Number(t[1]));
  const cup = sz.match(/B\s*\d+\s*[\(（]?\s*([A-K])\s*[\)）]?/i) || sz.match(/([A-K])\s*カップ/i); if(cup) set("cup", cup[1].toUpperCase());
  const w = sz.match(/(\d{2,3})\s*kg/i); if(w) set("weight", Number(w[1]));
  if(N(p.psize)) set("psize", N(p.psize));
  const O = p.options || {}, pick = re => { const k = Object.keys(O).find(x => re.test(x.normalize("NFKC"))); return k ? O[k] : null; };
  const mk = v => v == null ? null : ({ "◎": "◎", "○": "○", "△": "△", "×": "×" })[v] || null;
  const raf = mk(pick(/逆\s*(AF|アナル)/i)), af = mk(pick(/^(?!.*逆).*(AF|アナル)/i)), sh = mk(pick(/射精/));
  if(raf) set("rev_af", raf); if(af) set("af", af); if(sh) set("shasei", sh);
  try{ q(await sb.from("kb_dummy_names").update({ hp_read_at: new Date().toISOString() }).eq("id", id)); }catch(e){}
  toast(`📥 ${p.name || d.name}（${no}番）のプロフを読みました。見てから「💾 保存」を押してください` + (p.name && p.name !== d.name ? `（公式HPの名前は「${p.name}」）` : ""));
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
      const img = (d.image_cast_ids || []).map(dmCastName), sh = d.shift_cast_id ? dmCastName(d.shift_cast_id) : "";
      if(img.length || sh) info.insertAdjacentHTML("beforeend", `<br><small>${img.length ? `🖼 イメージ：<b>${esc(img.join("・"))}</b>` : ""}${sh ? `${img.length ? "　" : ""}🗓 シフト：<b>${esc(sh)}</b>` : ""}</small>`);
    });
  }catch(e){}
  return r;
}; }
document.head.insertAdjacentHTML("beforeend", `<style>.dmimg{display:inline-flex;gap:4px;align-items:center;background:#F1ECFF;color:#4B3A8A;border-radius:99px;padding:2px 9px;font-size:12.5px;font-weight:800} .dmimg a{color:#9C8B8F;text-decoration:none}</style>`);
