/* ============================================================
   🖼 キャストの写真アイコン（2026/11/11 店長：キャスト名が出る所に、公式HPのサムネくらいの写真を）
   ・写真は公式HPのプロフ写真（一覧用 gal180x240-在籍番号.jpg）。新しく撮ったりアップしたりしなくていい
   ・お店の順（サクラムーン → ラナ鶯谷 → …）で、在籍番号があるお店の写真を使う
   ・写真がない・読めないときは、名前の1文字目の四角
   使い方：KBF.img(キャスト or キャストのid, 横の大きさpx)
   ============================================================ */
(function(){
  const SITE = { sakuramoon: "sakura-moon", lana_uguisu: "josou-lana", lana_kinshi: "lana-kinshicho", dressgarden: "dress-garden-shibuya", peachmoon: "peach-m",
    gyakuanal: "gyaku-anal-club", cutie: "cutie-josou", eighteen: "18-josokko-gakuen", gokumon: "gokumon-sm" };
  const ORDER = ["sakuramoon", "lana_uguisu", "lana_kinshi", "dressgarden", "peachmoon", "gyakuanal", "cutie", "eighteen", "gokumon"];
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  // キャストのid → キャスト（記録簿・精算は M.casts、キャスト台帳は casts）
  function byId(id){
    // M・casts は let で作られているので window.M では読めない → 名前のまま読む（2026/11/11 写真が出なかった）
    const lists = [typeof M !== "undefined" && M ? M.casts : null, typeof casts !== "undefined" ? casts : null, window.KBF_CASTS].filter(Array.isArray);   // KBF_CASTS：回収明細・顧客台帳など、キャストの一覧の名前がちがうページ
    for(const l of lists){ const c = l.find(x => x && x.id === id); if(c) return c; }
    return null;
  }
  // 写真の場所（在籍番号のあるいちばん前のお店）。store を渡すと、そのお店を先に
  function src(c, store){
    if(!c || !c.stores) return "";
    const keys = store ? [store].concat(ORDER.filter(k => k !== store)) : ORDER;
    for(const k of keys){ const s = c.stores[k], no = s && Number(s.siteNo); if(no && SITE[k]) return `https://www.${SITE[k]}.com/galpic/gal180x240-${no}.jpg`; }
    return "";
  }
  const nameOf = c => (c && (c.official_name || c.temp_name || c.shift_name)) || "";
  // 写真がないときの四角（名前の1文字目）
  function ini(c, w){
    const h = Math.round(w * 4 / 3), ch = (nameOf(c).replace(/^[【\s]+/, "")[0]) || "？";
    return `<span class="kbface kbface-ini" style="width:${w}px;height:${h}px;font-size:${Math.round(w * .5)}px">${esc(ch)}</span>`;
  }
  // 写真（縦長＝公式HPのサムネと同じ 3:4。顔が見えるように上のほうを出す）
  function img(cOrId, w, store){
    const c = typeof cOrId === "string" ? byId(cOrId) : cOrId; w = w || 40;
    let u = src(c, store); if(!u) return ini(c, w);
    if(window.KBF_TEST) u = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACw=#" + u;   // テストのときだけ：ネットの写真を読まない（本番は使わない）
    const h = Math.round(w * 4 / 3);
    return `<img class="kbface" src="${esc(u)}" alt="" loading="lazy" width="${w}" height="${h}" style="width:${w}px;height:${h}px" data-ini="${esc((nameOf(c).replace(/^[【\s]+/, "")[0]) || "？")}" onerror="KBF.broken(this)">`;
  }
  function broken(el){
    const w = Number(el.getAttribute("width")) || 40, h = Number(el.getAttribute("height")) || 53;
    const s = document.createElement("span"); s.className = "kbface kbface-ini"; s.style.cssText = `width:${w}px;height:${h}px;font-size:${Math.round(w * .5)}px`; s.textContent = el.dataset.ini || "？";
    el.replaceWith(s);
  }
  const st = document.createElement("style");
  st.textContent = `.kbface{display:inline-block;flex:none;vertical-align:middle;object-fit:cover;object-position:center top;border-radius:8px;border:1.5px solid #F3D3DD;background:#FFF2F6;box-shadow:0 1px 3px rgba(92,75,79,.12);margin-right:6px}
    .kbface-ini{display:inline-flex;align-items:center;justify-content:center;font-weight:900;color:#C2185B;background:linear-gradient(160deg,#FFE3EC,#FFF7FA)}`;
  (document.head || document.documentElement).appendChild(st);
  window.KBF = { SITE, ORDER, byId, src, img, ini, broken };
})();
