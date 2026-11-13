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
  // 👤 内勤さんのアイコン（サインの名前の前に。色つきの丸＋絵文字）2026/11/11 店長
  //   名前はポータルの担当者名。記録簿の日払いの名前（蘭子・上川・若林）も同じ人に。知らない名前は1文字目
  //   キャストプロフ・内勤カレンダーと同じ絵文字と色（index.html の STAFF_MARKS）
  const STAFF_ICON = { "きゃ": ["🧡", "#e8590c"], "すや": ["💗", "#d6579e"], "らん": ["💙", "#4d96d9"], "かみ": ["🌙", "#3b5bdb"], "わか": ["🦉", "#8a6fd1"] };
  const STAFF_ALIAS = { "蘭子": "らん", "上川": "かみ", "若林": "わか", "店長": "きゃ" };
  // ✏️ 自分で変えられる（kb_settings の staff_icons：{ 名前: { e: 絵文字, c: 色, p: Googleの写真 } }）。変えた人のぶんだけ上書き
  const LS_KEY = "kbf_staff_icons", okCol = c => /^#[0-9a-fA-F]{3,8}$/.test(String(c || "")), okPic = p => /^https:\/\/[^\s"'<>]+$/.test(String(p || ""));
  let MINE = {};
  try{ const v = JSON.parse(localStorage.getItem(LS_KEY) || "{}"); if(v && typeof v === "object") MINE = v; }catch(e){}
  const keyOf = name => { const base = String(name || "").trim().replace(/（.*$|\(.*$/, "").trim(); return STAFF_ALIAS[base] || base; };
  function iconOf(key){
    const m = (MINE && MINE[key]) || {}, d = STAFF_ICON[key];
    return { e: m.e || (d && d[0]) || "", c: okCol(m.c) ? m.c : (d && d[1]) || "#9C8B8F", p: okPic(m.p) ? m.p : "" };
  }
  const iconInner = (ic, key) => ic.p ? `<img src="${esc(ic.p)}" alt="" referrerpolicy="no-referrer">` : esc(ic.e || String(key || "？")[0] || "？");
  function staffTag(name, noName){
    const raw = String(name || "").trim(); if(!raw) return "";
    const key = keyOf(raw), ic = iconOf(key);
    return `<span class="kbstaff" data-k="${esc(key)}" title="${esc(raw)}"><i style="background:${ic.c}">${iconInner(ic, key)}</i>${noName ? "" : esc(raw)}</span>`;
  }
  // 読みこんだら、もう出ているアイコンも描きなおす
  function repaintStaff(){
    document.querySelectorAll(".kbstaff[data-k]").forEach(el => { const k = el.getAttribute("data-k"), ic = iconOf(k), i = el.querySelector("i"); if(i){ i.style.background = ic.c; i.innerHTML = iconInner(ic, k); } });
  }
  function setStaffIcons(v){
    MINE = v && typeof v === "object" && !Array.isArray(v) ? v : {};
    try{ localStorage.setItem(LS_KEY, JSON.stringify(MINE)); }catch(e){}
    repaintStaff();
  }
  async function readIcons(){
    const r = await window.KB.sb.from("kb_settings").select("value").eq("key", "staff_icons").maybeSingle();
    if(r && r.error) throw r.error;
    return (r && r.data && r.data.value) || {};
  }
  async function loadStaff(){ try{ if(!(window.KB && KB.sb) || window.KBF_TEST) return; setStaffIcons(await readIcons()); }catch(e){} }
  // 👤 自分のアイコンを変える小窓（変えられるのは自分のだけ）
  const EMO = ["🧡", "💗", "💙", "💚", "💜", "💛", "🖤", "🤍", "🌙", "⭐", "🌸", "🌷", "🌻", "🍀", "🦉", "🐱", "🐶", "🐰", "🐻", "🐼", "🦊", "🐧", "🐣", "🐬", "🍓", "🍑", "🍒", "🍰", "☕", "🎀", "👑", "💎", "🔥", "⚡", "🌈", "🎵"];
  const COL = ["#e8590c", "#d6579e", "#4d96d9", "#3b5bdb", "#8a6fd1", "#E53935", "#2E7D32", "#00897B", "#F2B705", "#795548", "#546E7A", "#212121"];
  let ED = null;
  const firstChar = s => { s = String(s || "").trim(); if(!s) return ""; try{ if(window.Intl && Intl.Segmenter) return [...new Intl.Segmenter("ja", { granularity: "grapheme" }).segment(s)][0].segment; }catch(e){} return Array.from(s)[0]; };
  function edPaint(){
    const w = document.getElementById("kbfEd"); if(!w || !ED) return;
    const ic = { e: ED.e, c: ED.c, p: ED.p };
    w.querySelector(".kbfprev").innerHTML = `<span class="kbstaff big"><i style="background:${okCol(ic.c) ? ic.c : "#9C8B8F"}">${iconInner(ic, ED.key)}</i>${esc(ED.me)}</span>`;
    w.querySelectorAll("[data-e]").forEach(b => b.classList.toggle("on", !ED.p && b.getAttribute("data-e") === ED.e));
    w.querySelectorAll("[data-c]").forEach(b => b.classList.toggle("on", b.getAttribute("data-c") === ED.c));
    const g = w.querySelector(".kbfpic"); if(g) g.classList.toggle("on", !!ED.p);
  }
  function edSet(k, v){ if(!ED) return; if(k === "e"){ const c = firstChar(v); if(!c) return; ED.e = c; ED.p = ""; } else if(k === "c"){ if(okCol(v)) ED.c = v; } else if(k === "p"){ ED.p = ED.p ? "" : (ED.photo || ""); } edPaint(); }
  function edClose(){ const w = document.getElementById("kbfEd"); if(w) w.remove(); ED = null; }
  async function staffEditor(){
    const me = (window.KB && KB.operatorName && KB.operatorName()) || "";
    if(!me){ alert("ポータルで自分の名前を選んでから開いてください"); return; }
    const key = keyOf(me), cur = iconOf(key);
    let photo = "";
    try{ const { data } = await KB.sb.auth.getSession(); const md = (data && data.session && data.session.user && data.session.user.user_metadata) || {}; photo = okPic(md.avatar_url) ? md.avatar_url : okPic(md.picture) ? md.picture : ""; }catch(e){}
    edClose(); ED = { me, key, e: cur.e || firstChar(key), c: cur.c, p: cur.p, photo };
    const w = document.createElement("div"); w.id = "kbfEd"; w.className = "kbfbg";
    w.innerHTML = `<div class="kbfbox"><div class="kbfh">👤 自分のアイコン<button type="button" class="kbfx" onclick="KBF.edClose()">✖</button></div>
      <div class="kbfprev"></div>
      <div class="kbfl">絵文字</div><div class="kbfgrid">${EMO.map(e => `<button type="button" data-e="${e}" onclick="KBF.edSet('e',this.dataset.e)">${e}</button>`).join("")}</div>
      <div class="kbfrow">ほかの絵文字：<input id="kbfEmo" maxlength="12" placeholder="ここに1つ入れる" style="width:120px"><button type="button" class="btn btn-ghost btn-sm" onclick="KBF.edSet('e',document.getElementById('kbfEmo').value)">使う</button></div>
      <div class="kbfl">丸の色</div><div class="kbfcols">${COL.map(c => `<button type="button" data-c="${c}" style="background:${c}" onclick="KBF.edSet('c',this.dataset.c)"></button>`).join("")}<input type="color" value="${okCol(ED.c) && ED.c.length === 7 ? ED.c : "#9C8B8F"}" oninput="KBF.edSet('c',this.value)" title="好きな色"></div>
      ${photo ? `<div class="kbfrow"><button type="button" class="kbfpic btn btn-ghost btn-sm" onclick="KBF.edSet('p')"><img src="${esc(photo)}" alt="" referrerpolicy="no-referrer"> Googleの写真を使う</button></div>` : `<div class="kbfrow" style="color:#9C8B8F;font-size:12px">Googleで入ると、Googleの写真も選べます</div>`}
      <div class="kbfrow" style="justify-content:space-between;margin-top:12px"><button type="button" class="btn btn-ghost btn-sm" onclick="KBF.staffSave(true)">はじめのアイコンにもどす</button><button type="button" class="btn btn-primary" onclick="KBF.staffSave()">💾 保存（みんなの画面も変わる）</button></div></div>`;
    w.addEventListener("click", ev => { if(ev.target === w) edClose(); });
    document.body.appendChild(w); edPaint();
  }
  async function staffSave(reset){
    if(!ED) return;
    try{
      const all = Object.assign({}, await readIcons());
      if(reset) delete all[ED.key]; else all[ED.key] = Object.assign({ e: ED.e, c: ED.c }, ED.p ? { p: ED.p } : {});
      const r = await KB.sb.from("kb_settings").upsert({ key: "staff_icons", value: all, note: "👤 内勤のアイコン（各自が 👤 自分のアイコン で変える）" });
      if(r && r.error) throw r.error;
      setStaffIcons(all); edClose();
      if(KB.toast) KB.toast(reset ? "はじめのアイコンにもどしました" : "アイコンを保存しました");
    }catch(e){ alert("保存できませんでした：" + (e.message || e)); }
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", loadStaff); else setTimeout(loadStaff, 0);
  window.addEventListener("staff-icons", () => { if(window.StaffIcons) setStaffIcons(StaffIcons.read()); });   // ほかのページ（session_guard.js）で新しいのを読んだとき
  const st = document.createElement("style");
  st.textContent = `.kbface{display:inline-block;flex:none;vertical-align:middle;object-fit:cover;object-position:center top;border-radius:8px;border:1.5px solid #F3D3DD;background:#FFF2F6;box-shadow:0 1px 3px rgba(92,75,79,.12);margin-right:6px}
    .kbface-ini{display:inline-flex;align-items:center;justify-content:center;font-weight:900;color:#C2185B;background:linear-gradient(160deg,#FFE3EC,#FFF7FA)}
    .kbstore{display:inline-block;color:#fff;font-weight:900;font-size:12px;border-radius:99px;padding:2px 10px;white-space:nowrap;vertical-align:middle;box-shadow:0 1px 2px rgba(0,0,0,.15)}
    .kbsdot{display:inline-block;width:10px;height:10px;border-radius:50%;vertical-align:middle;margin-right:4px;box-shadow:0 0 0 1.5px #fff}
    .opic{display:inline-block;font-size:17px;margin-right:4px;vertical-align:-2px}
    .kbstaff{display:inline-flex;align-items:center;gap:3px;font-weight:800;white-space:nowrap;vertical-align:middle;color:#222 !important}   /* 名前は黒で固定（背景と同じ色になって読めなかった 2026/11/14）*/
    .kbstaff i{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;font-style:normal;font-size:12px;color:#fff;box-shadow:0 0 0 1.5px #fff,0 1px 3px rgba(0,0,0,.2);overflow:hidden;flex:none}
    .kbstaff i img{width:100%;height:100%;object-fit:cover}
    .kbstaff.big{font-size:18px;gap:8px} .kbstaff.big i{width:44px;height:44px;font-size:24px}
    .kbfbg{position:fixed;inset:0;background:rgba(40,25,30,.35);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px}
    .kbfbox{background:#fff;border-radius:16px;padding:14px 16px;max-width:440px;width:100%;max-height:90vh;overflow:auto;box-shadow:0 8px 30px rgba(0,0,0,.2)}
    .kbfh{display:flex;justify-content:space-between;align-items:center;font-weight:900;font-size:16px;margin-bottom:8px}
    .kbfx{border:0;background:none;font-size:18px;cursor:pointer}
    .kbfprev{text-align:center;padding:10px;background:#FFF7FA;border-radius:12px;margin-bottom:8px}
    .kbfl{font-weight:800;font-size:13px;margin:8px 0 4px}
    .kbfgrid{display:grid;grid-template-columns:repeat(9,1fr);gap:4px}
    .kbfgrid button{font-size:20px;border:1.5px solid #F3E6EA;background:#fff;border-radius:8px;padding:3px 0;cursor:pointer}
    .kbfgrid button.on{border-color:#E5638C;background:#FCE4EC}
    .kbfcols{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
    .kbfcols button{width:28px;height:28px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px #ddd;cursor:pointer}
    .kbfcols button.on{box-shadow:0 0 0 3px #5C4B4F}
    .kbfcols input[type=color]{width:34px;height:30px;border:0;padding:0;background:none}
    .kbfrow{display:flex;gap:6px;align-items:center;margin-top:8px;flex-wrap:wrap}
    .kbfpic img{width:22px;height:22px;border-radius:50%;vertical-align:middle;margin-right:4px}
    .kbfpic.on{outline:3px solid #E5638C}`;
  (document.head || document.documentElement).appendChild(st);
  window.KBF = { SITE, ORDER, byId, src, img, ini, broken, STORE_COLOR, STORE_SHORT, storeColor, storeChip, storeDot, OP_ICON, opIcon, STAFF_ICON, STAFF_ALIAS, staffTag, iconOf, setStaffIcons, loadStaff, staffEditor, staffSave, edSet, edClose };
})();

/* ⬆ マウスのホイール（まん中のボタン）を2回つづけて押すと、いちばん上へ（2026/11/12 店長）
   ・そのとき見ている枠（受付の小窓など）も、ページも、いちばん上に */
(function(){
  if(window.__kbTopDbl) return; window.__kbTopDbl = true;
  let last = 0;
  window.KBF_toTop = function(target){
    for(let el = target; el && el !== document.body && el !== document.documentElement; el = el.parentElement){
      if(el.scrollTop > 0 && el.scrollHeight > el.clientHeight + 4){ el.scrollTop = 0; }
    }
    window.scrollTo(0, 0);
  };
  document.addEventListener("mousedown", e => {
    if(e.button !== 1) return;
    if(!(e.target.closest && e.target.closest("a[href]"))) e.preventDefault();   // 1回目でChromeの「自動スクロール」が始まると2回目が届かない（3回いる）→ 自動スクロールは使わない（リンクのまん中押しはそのまま）
    const now = Date.now();
    if(now - last < 450){ e.preventDefault(); last = 0; window.KBF_toTop(e.target); }
    else last = now;
  }, true);
})();
