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
  // 🏪 お店の色（どの画面でも同じ色。2026/11/11 店長：ビジュアルでわかるように）
  const STORE_COLOR = { sakuramoon: "#E5638C", lana_uguisu: "#8E5BD6", lana_kinshi: "#5C6BC0", dressgarden: "#00897B", peachmoon: "#F57C4A",
    gyakuanal: "#B71C1C", cutie: "#E6A700", eighteen: "#1E88E5", gokumon: "#37474F" };
  const STORE_SHORT = { sakuramoon: "サクラムーン", lana_uguisu: "ラナ鶯谷", lana_kinshi: "ラナ錦糸町", dressgarden: "ドレスガーデン", peachmoon: "ピーチムーン",
    gyakuanal: "逆AF倶楽部", cutie: "キューティー", eighteen: "18", gokumon: "極門" };
  const storeColor = k => STORE_COLOR[k] || "#9C8B8F";
  // お店の札（色の帯＋名前）。label を渡さなければ短い名前
  const storeChip = (k, label) => k ? `<span class="kbstore" style="background:${storeColor(k)}">${esc(label || STORE_SHORT[k] || k)}</span>` : "";
  const storeDot = k => k ? `<span class="kbsdot" style="background:${storeColor(k)}" title="${esc(STORE_SHORT[k] || k)}"></span>` : "";
  // 🎨 オプションのアイコン（名前の言葉で自動。上から先に当たったもの）2026/11/11
  const OP_ICON = [[/逆AF|逆ＡＦ/, "🔄"], [/AF|ＡＦ|アナル/, "🍑"], [/射精|発射|ザーメン/, "👨"], [/コスプレ|衣装|制服|ナース|セーラー|メイド|バニー/, "👗"],
    [/パンスト|ストッキング|網タイツ|タイツ/, "🦵"], [/ランジェリー|下着|ブラ|ショーツ/, "👙"], [/SM|ＳＭ|拘束|ロープ|縄|手錠|ボンデージ|ムチ|鞭/, "⛓️"],
    [/おもちゃ|バイブ|ローター|ディルド|ペニバン|電マ/, "🪄"], [/撮影|ポラ|写真|動画/, "📷"], [/聖水|おしっこ|放尿/, "🚿"], [/キス|ディープ/, "💋"],
    [/女装|女レ|メイク/, "💄"], [/3P|4P|３Ｐ|４Ｐ/, "👥"], [/延長/, "⏱️"], [/泊|お泊/, "🌙"], [/マッサージ|オイル|ローション/, "🧴"], [/足|脚|フェチ/, "🦶"]];
  const opIcon = label => { const t = String(label || ""); for(const [re, ic] of OP_ICON) if(re.test(t)) return ic; return "✨"; };
  const st = document.createElement("style");
  st.textContent = `.kbface{display:inline-block;flex:none;vertical-align:middle;object-fit:cover;object-position:center top;border-radius:8px;border:1.5px solid #F3D3DD;background:#FFF2F6;box-shadow:0 1px 3px rgba(92,75,79,.12);margin-right:6px}
    .kbface-ini{display:inline-flex;align-items:center;justify-content:center;font-weight:900;color:#C2185B;background:linear-gradient(160deg,#FFE3EC,#FFF7FA)}
    .kbstore{display:inline-block;color:#fff;font-weight:900;font-size:12px;border-radius:99px;padding:2px 10px;white-space:nowrap;vertical-align:middle;box-shadow:0 1px 2px rgba(0,0,0,.15)}
    .kbsdot{display:inline-block;width:10px;height:10px;border-radius:50%;vertical-align:middle;margin-right:4px;box-shadow:0 0 0 1.5px #fff}
    .opic{display:inline-block;font-size:17px;margin-right:4px;vertical-align:-2px}`;
  (document.head || document.documentElement).appendChild(st);
  window.KBF = { SITE, ORDER, byId, src, img, ini, broken, STORE_COLOR, STORE_SHORT, storeColor, storeChip, storeDot, OP_ICON, opIcon };
})();
