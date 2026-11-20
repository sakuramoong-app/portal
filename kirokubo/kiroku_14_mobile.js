/* ============================================================
   📱 スマホの記録簿（2026/11/20 店長 OK：見本「予約（タイムライン）」）
   ・せまい画面（700px まで）のときだけ。PC の画面は今までどおり
   ・上：タブ（タイムライン／リスト／未確定／店落ち）・日付（‹ 今日 ›）・並び・表示する時間
   ・まん中：キャストごとのタイムライン（今の時刻の線・予約の箱をタップで開く）
   ・下：＋ 予約を追加・下のメニュー（予約／出勤・シフト／キャスト／全体を見る／その他）
   ・消す機能はつけない（予約を開いた画面は今までどおり）
   ・中身（予約・計算・保存）は今までのものを使う。ここは見せ方だけ
   ============================================================ */
const MOB_Q = window.matchMedia ? window.matchMedia("(max-width:700px)") : { matches: false, addEventListener(){} };
let mobTab = "tl", mobRange = "auto", mobPage = "res";
const mobLs = (k, d) => { try{ const v = localStorage.getItem(k); return v == null ? d : v; }catch(e){ return d; } };
const mobLsSet = (k, v) => { try{ localStorage.setItem(k, v); }catch(e){} };
const mobOn = () => (MOB_Q.matches || window.__mobForce) && mobLs("kbMobPC", "") !== "1";   // __mobForce：テスト用
const MOB_PPH = 72;   // 1時間の幅（px）

function mobApply(){
  const on = mobOn();
  document.body.classList.toggle("mob", on);
  let pcBack = document.getElementById("mobBackBtn");
  if((MOB_Q.matches || window.__mobForce) && !on){
    if(!pcBack){ pcBack = document.createElement("button"); pcBack.id = "mobBackBtn"; pcBack.type = "button"; pcBack.textContent = "📱 スマホの画面にもどる"; pcBack.onclick = () => { mobLsSet("kbMobPC", ""); mobApply(); }; document.body.appendChild(pcBack); }
  } else if(pcBack) pcBack.remove();
  if(on) mobRender();
  // 🌙 ダークモードのボタンは、スマホでは上（前の 🔍 のところ）に（2026/11/20 店長）
  mobDark(on);
}
function mobDark(on){
  const dk = document.getElementById("kbDarkBtn"), hd = document.querySelector("#mob .mhead");
  if(dk){ if(on && hd && dk.parentNode !== hd) hd.insertBefore(dk, hd.querySelector(".mbtn")); else if(!on && dk.parentNode !== document.body) document.body.appendChild(dk); }
}
function mobShell(){
  let m = document.getElementById("mob");
  if(m) return m;
  m = document.createElement("div"); m.id = "mob";
  m.innerHTML = `
    <div class="mtop">
      <div class="mhead"><span class="mic">📅</span><b>予約</b><small>（タイムライン）</small><span style="flex:1"></span>
        <a class="mcust" href="customers.html" target="_blank" rel="opener">👥 顧客台帳</a>
        <button type="button" class="mbtn" onclick="mobBell()" title="お知らせ">🔔<i id="mobBellN"></i></button></div>
      <div class="mtabs" id="mobTabs"></div>
      <div class="mday"><button type="button" onclick="moveDay(-1,this)">‹</button>
        <button type="button" class="mdate" onclick="openCuteCal()"><span>📅</span><b id="mobDay"></b></button>
        <button type="button" class="mtoday" onclick="goToday()">今日</button><button type="button" onclick="moveDay(1,this)">›</button></div>
      <div class="mopts" id="mobOpts"></div>
    </div>
    <div id="mobBody"></div>
    `;
  document.body.appendChild(m);
  return m;
}
const mobLive = r => !["cancel", "tobi", "flowed"].includes(r.status);
const mobKari = () => (typeof rows !== "undefined" ? rows : []).filter(r => mobLive(r) && (r.kari_at || !r.cast_id || !r.start_at));
function mobRender(){
  if(!mobOn() || typeof rows === "undefined" || !M || !M.casts) return;
  mobShell();
  const bd = KB.bizDateOf(), dl = $("dayLabel") ? $("dayLabel").textContent : day;
  $("mobDay").textContent = (dl || day) + (day === bd ? "【営業日】" : "");
  const nK = mobKari().length;
  $("mobTabs").innerHTML = [["tl", "🗓 タイムライン"], ["list", "📋 リスト"], ["kari", "未確定" + (nK ? `<i>${nK}</i>` : "")]]
    .map(([k, l]) => `<button type="button" class="${mobTab === k && mobPage === "res" ? "on" : ""}" onclick="mobGo('res','${k}')">${l}</button>`).join("");
  const sortSel = $("s_sort");
  $("mobOpts").innerHTML = mobPage === "res" && mobTab === "tl" ? `
    <label class="msel">並び：<select onchange="$('s_sort').value=this.value;setSort(this.value);mobRender()">${sortSel ? [...sortSel.options].map(o => `<option value="${o.value}" ${o.value === sortSel.value ? "selected" : ""}>${esc(o.textContent)}</option>`).join("") : ""}</select></label>
    <label class="msel">表示：<select onchange="mobRange=this.value;mobRender()">${[["auto", "今から"], ["all", "ぜんぶ"], ["day", "12:00〜20:00"], ["night", "18:00〜翌5:00"]].map(([k, l]) => `<option value="${k}" ${mobRange === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>`
    : "";
  const ntfN = (typeof ntfLog !== "undefined" ? ntfLog.filter(n => !n.st).length : 0);
  $("mobBellN").textContent = ntfN ? (ntfN > 99 ? "99+" : ntfN) : "";
  const body = $("mobBody");
  let html;
  if(mobTab === "list") html = mobListHtml(rows.filter(r => r.start_at).slice().sort((a, b) => String(a.start_at).localeCompare(String(b.start_at))), "この日の予約はありません");
  else if(mobTab === "kari") html = mobListHtml(mobKari(), "未確定の予約はありません") + `<div class="mhint">📌 仮予約・キャストや時間がまだの予約です。開いて、ぜんぶ入れて「💾 登録する」を押すと消えます</div>`;
  else html = mobTlHtml();
  html += KB.CAN_EDIT ? `<button type="button" class="madd" onclick="openForm()">＋ 予約を追加</button>` : "";
  // 中身が変わったときだけ描きなおす（描きなおしでスクロールが動くと「さわった」になって、1分のロックがかからなくなるので）
  if(body.dataset.h !== html){ const sl = $("mobTl") ? $("mobTl").scrollLeft : 0; body.innerHTML = html; body.dataset.h = html; if(sl && $("mobTl")) $("mobTl").scrollLeft = sl; }
  mobNowPaint(); mobDark(true);
}
function mobGo(page, tab){ mobPage = "res"; if(tab) mobTab = tab; mobRender(); window.scrollTo(0, 0); }
function mobBell(){ const b = document.querySelector("#ntfBox .ntfopen"); if(b) b.click(); else { const box = $("ntfBox"); if(box) box.scrollIntoView(); } }
// ---------- タイムライン ----------
function mobHours(list){
  const now = nowHour();
  let a = 12, b = 29;
  const ss = list.filter(x => x.shift).map(x => x.shift.start), ee = list.filter(x => x.shift).map(x => x.shift.end);
  list.forEach(x => x.bks.forEach(k => { ss.push(k.s); ee.push(k.e); }));
  if(ss.length){ a = Math.floor(Math.min(...ss)); b = Math.ceil(Math.max(...ee)); }
  if(mobRange === "day"){ a = 12; b = 20; }
  else if(mobRange === "night"){ a = 18; b = 29; }
  else if(mobRange === "auto" && day === KB.bizDateOf()){ a = Math.max(a, Math.floor(now) - 1); if(b - a < 6) b = a + 6; }
  if(b <= a) b = a + 6;
  return [a, b];
}
function mobTlHtml(){
  let list = sortRows(tlRows()).filter(x => x.shift || x.bks.length);
  if(!list.length) return `<div class="mempty">${shiftCache[day] ? "この日の出勤はありません" : "シフトを読み込み中…"}</div>`;
  const [h0, h1] = mobHours(list), W = (h1 - h0) * MOB_PPH, now = nowHour(), isToday = day === KB.bizDateOf();
  const X = h => Math.round((h - h0) * MOB_PPH);
  const hrs = []; for(let h = h0; h <= h1; h++) hrs.push(h);
  const head = `<div class="mrow mhd"><div class="mname">キャスト<small>（出勤時間）</small></div><div class="mtrack" style="width:${W}px">
    ${hrs.map(h => `<span class="mhr" style="left:${X(h)}px">${h >= 24 ? "翌" + (h - 24) : h}:00</span>`).join("")}
    ${isToday ? `<span class="mnowlab" data-h0="${h0}" data-h1="${h1}"></span>` : ""}</div></div>`;
  const body = list.map(x => {
    const cd = x.cd || {}, off = ["お茶", "欠勤"].includes(cd.status), g = gapOf(x);
    const sh = x.shift ? `${tlLabel(x.shift.start)}〜${tlLabel(x.shift.end)}${x.shift.confirmed ? "" : "（未確定）"}` : "シフトなし";
    let tr = "";
    // 出勤外（グレー）：シフトの前と後
    if(off) tr += `<div class="mout" style="left:0;width:${W}px"></div>`;
    else if(x.shift){ if(x.shift.start > h0) tr += `<div class="mout" style="left:0;width:${X(Math.min(x.shift.start, h1))}px"></div>`; if(x.shift.end < h1) tr += `<div class="mout" style="left:${X(Math.max(x.shift.end, h0))}px;width:${W - X(Math.max(x.shift.end, h0))}px"></div>`; }
    else tr += `<div class="mout" style="left:0;width:${W}px"></div>`;
    x.bks.forEach(k => {
      const r = k.r, s = Math.max(k.s, h0), e = Math.min(k.e, h1); if(e <= s) return;
      if(g && k.e < h1) tr += `<div class="mgap" style="left:${X(k.e)}px;width:${Math.max(2, X(Math.min(k.e + g, h1)) - X(k.e))}px" title="インターバル"></div>`;
      const kari = !!r.kari_at, done = ["done", "working"].includes(r.status);
      const cu = (r.kb_customers || {}).name || "", area = r.area || "";
      tr += `<button type="button" class="mbk ${kari ? "kari" : done ? "done" : ""}" style="left:${X(s)}px;width:${Math.max(28, X(e) - X(s))}px" onclick="mobResPop(${Number(r.id)})">
        <b>${tlLabel(k.s)} - ${tlLabel(k.e)}</b><span>${esc([area, cu ? cu + "様" : ""].filter(Boolean).join("／") || (kari ? "📌 仮予約" : ""))}</span></button>`;
    });
    if(isToday) tr += `<div class="mnow" data-h0="${h0}" data-h1="${h1}"></div>`;   // 位置は mobNowPaint（毎分、描きなおさずに動かす）
    return `<div class="mrow ${off ? "off" : ""}"><div class="mname" onclick="${x.c ? `openCast('${x.c.id}')` : ""}">${x.c && typeof KBF !== "undefined" ? KBF.img(x.c, 36) : ""}<div><b>${esc(castLabel(x))}</b>${off ? `<em>${esc(cd.status)}</em>` : ""}<small>${esc(sh)}${g ? `<br>（間${x.c.interval_min}分）` : ""}</small></div></div>
      <div class="mtrack" ${x.c ? `data-cid="${x.c.id}" data-h0="${h0}"` : ""} style="width:${W}px">${hrs.map(h => `<i class="mgl" style="left:${X(h)}px"></i>`).join("")}${tr}</div></div>`;
  }).join("");
  return `<div class="mleg"><span><i class="lg-r"></i>予約</span><span><i class="lg-k"></i>確認待ち（仮予約）</span><span><i class="lg-b"></i>インターバル</span><span><i class="lg-o"></i>出勤外</span></div>
    <div class="mtl" id="mobTl">${head}${body}</div>`;
}
// ---------- リスト・未確定 ----------
function mobListHtml(list, none){
  if(!list.length) return `<div class="mempty">${none}</div>`;
  return `<div class="mlist">${list.map(r => {
    const cx = !mobLive(r), c = r.cast_id ? M.casts.find(x => x.id === r.cast_id) : null, cu = (r.kb_customers || {}).name || "名前なし";
    const t = r.start_at ? hm(r.start_at) + (r.end_at ? "〜" + hm(r.end_at) : "") : "時間まだ";
    return `<button type="button" class="mli ${cx ? "cx" : ""} ${r.kari_at ? "kari" : ""}" onclick="mobResPop(${Number(r.id)})">
      <span class="mt">${esc(t)}</span><span class="mc">${c && typeof KBF !== "undefined" ? KBF.img(c, 28) : ""}<b>${esc(c ? (c.official_name || c.temp_name) : "キャスト未定")}</b></span>
      <span class="mu">${r.kari_at ? "📌 仮予約　" : ""}${esc(cu)}様${r.course ? "・" + esc(r.course) : ""}${r.area ? "・" + esc(r.area) : ""}${cx ? `<em>${({ cancel: "キャンセル", tobi: "トビ", flowed: "流れた" })[r.status] || r.status}</em>` : ""}</span>
      ${r.total ? `<span class="my">${yen(r.total)}</span>` : ""}</button>`;
  }).join("")}</div>`;
}
// ---------- つなぐ ----------
{ const __ld = loadDay; loadDay = async function(){ const r = await __ld.apply(this, arguments); try{ mobRender(); }catch(e){ console.warn("mob", e); } return r; }; }
{ const __rl = renderList; renderList = function(){ const r = __rl.apply(this, arguments); try{ mobRender(); }catch(e){} return r; }; }
if(MOB_Q.addEventListener) MOB_Q.addEventListener("change", mobApply);
setInterval(() => { try{ if(mobOn()) mobNowPaint(); }catch(e){} }, 60000);
setTimeout(mobApply, 0);
document.head.insertAdjacentHTML("beforeend", `<style>
  #mob{display:none}
  body.mob #mob{display:block;padding:0 10px 24px}
  body.mob #spBar, body.mob #main{display:none !important}   /* 上の「記録簿・精算・キャスト台帳」は前のまま出す */
  body.mob #ntfBox{bottom:84px} body.mob #dcBox{bottom:84px}
  body.mob a[title="ポータルに戻る"]{display:none}
  #mobBackBtn{position:fixed;right:10px;bottom:10px;z-index:960;font-family:inherit;font-weight:900;font-size:13px;background:#E5638C;color:#fff;border:none;border-radius:99px;padding:9px 14px;box-shadow:0 4px 14px rgba(0,0,0,.2)}
  #mob .mtop{position:sticky;top:0;z-index:50;background:var(--bg,#FFF7FA);padding:8px 0 4px}
  #mob .mhead{display:flex;align-items:center;gap:6px;font-size:21px;color:#5C4B4F} #mob .mhead small{font-size:13px;font-weight:800} #mob .mic{font-size:22px}
  #mob .mbtn{position:relative;font-size:20px;background:none;border:none;text-decoration:none;padding:4px 6px;cursor:pointer}
  #mob .mbtn i{position:absolute;top:-4px;right:-4px;background:#E5486C;color:#fff;border-radius:99px;font-size:10.5px;font-style:normal;font-weight:900;padding:0 5px} #mob .mbtn i:empty{display:none}
  #mob .mtabs{display:flex;gap:6px;overflow-x:auto;margin:6px 0} #mob .mtabs button{flex:1 0 auto;font-family:inherit;font-weight:800;font-size:13.5px;border:1.5px solid #F3D3DE;background:#fff;color:#5C4B4F;border-radius:14px;padding:8px 10px;white-space:nowrap}
  #mob .mtabs button.on{background:linear-gradient(135deg,#FF8FAB,#E5638C);color:#fff;border-color:transparent} #mob .mtabs i{font-style:normal;background:#E5486C;color:#fff;border-radius:99px;padding:0 6px;margin-left:4px;font-size:11px}
  #mob .mday{display:flex;gap:6px;align-items:center} #mob .mday button{font-family:inherit;font-weight:800;border:1.5px solid #F3D3DE;background:#fff;border-radius:99px;padding:7px 12px;color:#5C4B4F;font-size:14px}
  #mob .mday .mdate{flex:1;display:flex;gap:6px;justify-content:center;align-items:center} #mob .mday .mdate b{font-size:14.5px}
  #mob .mopts{display:flex;gap:6px;margin-top:6px} #mob .msel{flex:1;white-space:nowrap;display:flex;align-items:center;gap:2px;font-size:12.5px;font-weight:800;border:1.5px solid #F3D3DE;background:#fff;border-radius:99px;padding:3px 8px}
  #mob .msel select{border:none;background:none;font-family:inherit;font-weight:800;font-size:12.5px;padding:3px 0;width:100%;min-width:0}
  #mob .mleg{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:11.5px;font-weight:700;color:#7a6468;margin:6px 0} #mob .mleg i{display:inline-block;width:20px;height:10px;border-radius:3px;margin-right:4px;vertical-align:middle}
  .lg-r{background:#FFD1DE} .lg-k{background:#FFF0B3} .lg-b{background:repeating-linear-gradient(45deg,#ddd 0 3px,#fff 3px 6px)} .lg-o{background:#ECE9EA}
  #mob .mtl{overflow-x:auto;background:#fff;border:1.5px solid #F3D3DE;border-radius:14px;-webkit-overflow-scrolling:touch}
  #mob .mrow{display:flex;width:max-content;min-width:100%;border-bottom:1px solid #F3E6EB;min-height:66px} #mob .mrow.mhd{min-height:40px;position:sticky;top:0}
  #mob .mname{position:sticky;left:0;z-index:3;flex:0 0 112px;background:#fff;border-right:1px solid #F3E6EB;display:flex;gap:6px;align-items:center;padding:6px;font-size:13px;cursor:pointer}
  #mob .mname small{display:block;font-size:10.5px;color:#7a6468;font-weight:700;line-height:1.3} #mob .mname b{font-size:14px} #mob .mname em{font-style:normal;font-size:10.5px;background:#ECE9EA;border-radius:99px;padding:0 6px;margin-left:3px}
  #mob .mname img{border-radius:50%;flex:none}
  #mob .mtrack{position:relative;flex:none}
  #mob .mhr{position:absolute;top:22px;transform:translateX(-50%);font-size:11.5px;font-weight:800;color:#5C4B4F;white-space:nowrap}
  #mob .mnowlab{position:absolute;top:0;transform:translateX(-50%);background:#E5486C;color:#fff;border-radius:99px;font-size:9.5px;font-weight:900;padding:1px 7px;text-align:center;line-height:1.15;z-index:2}
  #mob .mgl{position:absolute;top:0;bottom:0;width:1px;background:#F3E6EB}
  #mob .mout{position:absolute;top:6px;bottom:6px;background:#ECE9EA;border-radius:6px}
  #mob .mgap{position:absolute;top:8px;bottom:8px;background:repeating-linear-gradient(45deg,#ddd 0 3px,#fff 3px 6px);border-radius:5px}
  #mob .mbk{position:absolute;top:6px;bottom:6px;border:1.5px solid #FF9DB8;background:#FFE3EC;border-radius:9px;padding:2px 5px;text-align:left;font-family:inherit;overflow:hidden;cursor:pointer;z-index:1}
  #mob .mbk b{display:block;font-size:11px;color:#B0213F;white-space:nowrap} #mob .mbk span{display:block;font-size:10.5px;font-weight:700;color:#5C4B4F;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #mob .mbk.kari{background:#FFF6CC;border-color:#F2C94C} #mob .mbk.kari b{color:#8A6100}
  #mob .mbk.done{background:#E5F6EC;border-color:#8FD3A0} #mob .mbk.done b{color:#1E7A3C}
  #mob .mnow{position:absolute;top:0;bottom:0;width:0;border-left:2px dashed #E5486C;z-index:2}
  #mob .mrow.off .mtrack{opacity:.6}
  #mob .madd{display:block;width:100%;margin:12px 0;font-family:inherit;font-weight:900;font-size:17px;color:#E5638C;background:#fff;border:2px solid #FFC2D1;border-radius:99px;padding:12px;box-shadow:0 4px 14px rgba(229,99,140,.15)}
  #mob .mempty{text-align:center;color:#9C8B8F;font-weight:800;padding:30px 0}
  #mob .mhint{font-size:12px;color:#7a6468;margin:8px 4px}
  #mob .mlist{display:flex;flex-direction:column;gap:6px;margin-top:6px}
  #mob .mli{display:grid;grid-template-columns:auto 1fr auto;grid-template-areas:"t c y" "u u u";gap:2px 8px;text-align:left;font-family:inherit;background:#fff;border:1.5px solid #F3D3DE;border-radius:12px;padding:8px 10px;cursor:pointer;color:#5C4B4F}
  #mob .mli .mt{grid-area:t;font-weight:900;font-size:13.5px;color:#B0213F;white-space:nowrap} #mob .mli .mc{grid-area:c;display:flex;gap:5px;align-items:center;font-size:14px} #mob .mli .mc img{border-radius:50%}
  #mob .mli .my{grid-area:y;font-weight:800;font-size:12.5px;white-space:nowrap} #mob .mli .mu{grid-area:u;font-size:12.5px;color:#7a6468} #mob .mli em{font-style:normal;background:#ECE9EA;border-radius:99px;padding:0 6px;margin-left:4px}
  #mob .mli.cx{opacity:.55} #mob .mli.kari{background:#FFFBEA;border-color:#F2C94C}
  #mob .mdrop .todaygrid,#mob .mdrop{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px} #mob .mdrop > *{min-width:0}
  #mob .mlink{display:block;text-align:center;margin:10px 0;font-weight:800;color:#E5638C}
</style>`);
// 今の時刻の線・札：描きなおさずに位置だけ動かす（2026/11/20）
function mobNowPaint(){
  const now = nowHour();
  document.querySelectorAll("#mob .mnow, #mob .mnowlab").forEach(el => {
    const h0 = Number(el.dataset.h0), h1 = Number(el.dataset.h1), inR = now >= h0 && now <= h1;
    el.style.display = inR ? "" : "none"; if(!inR) return;
    el.style.left = Math.round((now - h0) * MOB_PPH) + "px";
    if(el.classList.contains("mnowlab")) el.innerHTML = "現在<br>" + tlLabel(now);
  });
}
/* タイムラインの空いているところ：タップ＝「○○:○○から」を出す／長押し＝その子・その時刻で新しい受付（前の「全体を見たい」と同じ。2026/11/20 店長） */
(function(){
  let tm = null, fired = false, sx = 0, sy = 0;
  const trackOf = e => { const t = e.target; if(!t.closest || !t.closest("#mob") || t.closest(".mbk")) return null; const k = t.closest(".mtrack[data-cid]"); return k; };
  const hourAt = (k, x) => { const r = k.getBoundingClientRect(), h = Number(k.dataset.h0) + Math.max(0, x - r.left) / MOB_PPH; return Math.floor(h * 6) / 6; };   // 10分きざみ
  document.addEventListener("pointerdown", e => {
    const k = trackOf(e); if(!k) return;
    fired = false; sx = e.clientX; sy = e.clientY; clearTimeout(tm);
    const h = hourAt(k, e.clientX);
    tm = setTimeout(() => { fired = true; tm = null; if(navigator.vibrate) navigator.vibrate(30); tlCell(k.dataset.cid, h); }, 500);
  }, true);
  document.addEventListener("pointermove", e => { if(tm && Math.hypot(e.clientX - sx, e.clientY - sy) > 10){ clearTimeout(tm); tm = null; } }, true);
  ["pointerup", "pointercancel"].forEach(ev => document.addEventListener(ev, () => { clearTimeout(tm); tm = null; }, true));
  document.addEventListener("contextmenu", e => { if(trackOf(e)) e.preventDefault(); }, true);
  document.addEventListener("click", e => {
    const k = trackOf(e); if(!k) return;
    if(fired){ fired = false; return; }
    document.querySelectorAll("#mob .mtap").forEach(x => x.remove());
    const h = hourAt(k, e.clientX), r = k.getBoundingClientRect();
    const t = document.createElement("span"); t.className = "mtap"; t.style.left = Math.round(e.clientX - r.left) + "px"; t.textContent = tlLabel(h) + " から（長押しで受付）";
    k.appendChild(t); setTimeout(() => t.remove(), 3000);
  }, true);
})();
document.head.insertAdjacentHTML("beforeend", `<style>
  #mob .mtrack{-webkit-touch-callout:none;user-select:none;-webkit-user-select:none}
  #mob .mtap{position:absolute;top:4px;z-index:6;background:#E5638C;color:#fff;font-size:11.5px;font-weight:800;border-radius:6px;padding:2px 7px;white-space:nowrap;pointer-events:none;transform:translateX(-10%)}
</style>`);
/* 予約をタップ → 小窓で予約のまとめ（見るだけ）。右上の「✏️ 編集」を押して、はじめて受付（編集）を開く（2026/11/20 店長） */
function mobResPop(id){
  const r = rows.find(x => x.id === id); if(!r) return;
  const c = r.kb_customers || {}, cx = ["cancel", "tobi", "flowed"].includes(r.status);
  const ops = (r.options || []).filter(o => !["af", "gyakuaf"].includes(o.code)).map(o => o.label + (o.qty > 1 ? "×" + o.qty : "")).join("・");
  const afw = [r.af_wish === "yes" ? "AF" : "", r.rev_af_wish === "yes" ? "逆AF" : ""].filter(Boolean).join("・");
  const st = typeof STATUS !== "undefined" ? (STATUS[r.status] || r.status) : r.status;
  const pay = typeof PAY_LABEL !== "undefined" ? (PAY_LABEL[r.payment] || r.payment || "") : (r.payment || "");
  const vk = typeof VISIT !== "undefined" ? ((VISIT.find(v => v[0] === r.visit_kind) || [])[1] || "") : "";
  const logs = (typeof logOf === "function" ? logOf(r) : []).filter(x => x.text && String(x.text).trim()).slice(-3).reverse();
  const row = (k, v) => v ? `<div class="mprow"><span>${k}</span><b>${v}</b></div>` : "";
  let bg = document.getElementById("mobPop"); if(!bg){ bg = document.createElement("div"); bg.id = "mobPop"; document.body.appendChild(bg); }
  bg.innerHTML = `<div class="mpbg" onclick="mobPopClose()"></div><div class="mpbox">
    <div class="mphd"><b>${r.start_at ? esc(hm(r.start_at)) + (r.end_at ? "〜" + esc(hm(r.end_at)) : "") : "時間まだ"}</b><span class="mpst ${cx ? "cx" : ""}">${esc(st)}</span>
      <span style="flex:1"></span>${KB.CAN_EDIT ? `<button type="button" class="mpedit" onclick="mobPopClose();openForm(${Number(r.id)})">✏️ 編集</button>` : ""}<button type="button" class="mpx" onclick="mobPopClose()">✕</button></div>
    ${r.kari_at ? `<div class="mpkari">📌 仮予約（まだぜんぶ入っていません）</div>` : ""}
    ${row("キャスト", r.cast_id ? esc(castName(r.cast_id)) : "未定")}
    ${row("お店", typeof KBF !== "undefined" && r.store_key ? KBF.storeChip(r.store_key) : esc(r.store_key || ""))}
    ${row("お客さん", (c.ng ? "⚠️ " : "") + esc(c.name || "名前なし") + (vk ? `<small>（${esc(vk)}）</small>` : ""))}
    ${row("コース", esc(r.course || "") + (/^\d+$/.test(r.course || "") ? "分" : "") + (r.extension_count ? "＋延長" + r.extension_count : ""))}
    ${row("場所", esc([r.area, r.address].filter(Boolean).join("　")))}
    ${row("総額", r.total ? yen(r.total) + `<small>（${esc(pay)}）</small>` : "")}
    ${row("OP", esc(ops))}${row("希望", esc(afw))}${row("キャストへ", esc(r.cast_note || ""))}
    ${logs.length ? `<div class="mplog">${logs.map(l => `<div>📝 ${esc(String(l.text).trim())}<small> ${esc(l.by || "")} ${typeof whenShort === "function" ? esc(whenShort(l.at)) : ""}</small></div>`).join("")}</div>` : ""}
  </div>`;
}
function mobPopClose(){ const bg = document.getElementById("mobPop"); if(bg) bg.innerHTML = ""; }
document.head.insertAdjacentHTML("beforeend", `<style>
  #mobPop .mpbg{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:980}
  #mobPop .mpbox{position:fixed;left:10px;right:10px;top:12vh;max-height:76vh;overflow:auto;z-index:981;background:#fff;border-radius:18px;padding:12px 14px;box-shadow:0 10px 30px rgba(0,0,0,.25);color:#5C4B4F;font-size:14px}
  #mobPop .mphd{display:flex;align-items:center;gap:8px;margin-bottom:6px} #mobPop .mphd b{font-size:18px;color:#B0213F}
  #mobPop .mpst{font-size:12px;font-weight:800;background:#FFE3EC;border-radius:99px;padding:2px 9px} #mobPop .mpst.cx{background:#ECE9EA}
  #mobPop .mpedit{font-family:inherit;font-weight:900;font-size:14px;background:linear-gradient(135deg,#FF8FAB,#E5638C);color:#fff;border:none;border-radius:99px;padding:7px 14px}
  #mobPop .mpx{font-family:inherit;font-size:16px;background:#F4EEF0;border:none;border-radius:99px;width:34px;height:34px}
  #mobPop .mprow{display:flex;gap:10px;padding:6px 0;border-bottom:1px dashed #F3E6EB} #mobPop .mprow span{flex:0 0 72px;font-size:12.5px;color:#9C8B8F;font-weight:800} #mobPop .mprow b{font-weight:800} #mobPop .mprow small{color:#9C8B8F;margin-left:4px}
  #mobPop .mpkari{background:#FFF6CC;border-radius:10px;padding:5px 9px;font-weight:800;font-size:13px;margin-bottom:4px}
  #mobPop .mplog{margin-top:8px;font-size:13px;display:flex;flex-direction:column;gap:3px} #mobPop .mplog small{color:#9C8B8F}
</style>`);
document.head.insertAdjacentHTML("beforeend", `<style>
  /* 左下の 🔔 は出さない（上の 🔔 で開く。開いたときだけ出す）・受付などの小窓を開いたら、スマホの上の固定の欄はかくす（2026/11/20 店長） */
  body.mob #ntfBox:not(.open){display:none !important}
  body.mob:has(.modal-bg.show) #mob{display:none}
  #mob .mhead #kbDarkBtn{position:static;width:36px;height:36px;box-shadow:none;font-size:18px}
</style>`);
document.head.insertAdjacentHTML("beforeend", `<style>#mob .mcust{font-size:13px;font-weight:900;color:#E5638C;text-decoration:none;border:1.5px solid #FFC2D1;background:#fff;border-radius:99px;padding:6px 11px;white-space:nowrap}</style>`);
/* 📱 スマホの受付：入れる欄が見えるように小さく（2026/11/20 店長）
   ・上の「必須でまだ」は項目のボタンだけ（「⚠️ 必須でまだ：」と「まだ決まっていない…」の説明はかくす）
   ・キャストのタイムラインの「予約○件・予約○時間・空き○時間」はかくす */
document.head.insertAdjacentHTML("beforeend", `<style>@media (max-width:700px){
  .rqlbl, .rqhelp{display:none !important}
  .tl2s{display:none !important}
}</style>`);
