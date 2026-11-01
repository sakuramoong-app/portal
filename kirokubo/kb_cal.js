/* ============================================================
   kb_cal.js — 📅 日付のカレンダー（大きく・かわいく）。記録簿・精算 共通
   上の日付（.datebox）を押すと開く。選んだら document.getElementById("day") に入れて loadDay()
   ============================================================ */
(function(){
  const css = document.createElement("style");
  css.textContent = `
  .ccal-bg{position:fixed;inset:0;z-index:1200;background:rgba(80,20,45,.28);display:flex;align-items:flex-start;justify-content:center;padding:70px 16px 16px;}
  .ccal{width:100%;max-width:440px;background:linear-gradient(180deg,#FFF0F5 0,#fff 90px);border:2px solid #FFC2D1;border-radius:24px;box-shadow:0 14px 40px rgba(229,99,140,.35);padding:14px 16px 16px;font-family:inherit;}
  .ccal-h{display:flex;align-items:center;gap:8px;margin-bottom:10px;}
  .ccal-h b{flex:1;text-align:center;font-size:21px;color:#B0124F;letter-spacing:.04em;}
  .ccal-nav{font-family:inherit;font-size:20px;font-weight:900;width:44px;height:44px;border-radius:50%;border:2px solid #FFC2D1;background:#fff;color:#e5638c;cursor:pointer;}
  .ccal-nav:hover{background:#FFE4EC;}
  .ccal-g{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;}
  .ccal-w{text-align:center;font-size:13px;font-weight:900;color:#9a7080;padding:2px 0;}
  .ccal-w.sun{color:#E0245E;} .ccal-w.sat{color:#1E6FD9;}
  .ccal-d{font-family:inherit;aspect-ratio:1/1;min-height:46px;font-size:18px;font-weight:800;border:1.5px solid #FFE0EA;border-radius:14px;background:#fff;color:#4a2a36;cursor:pointer;position:relative;transition:transform .08s;}
  .ccal-d:hover{background:#FFE4EC;transform:scale(1.06);}
  .ccal-d.sun{color:#E0245E;} .ccal-d.sat{color:#1E6FD9;}
  .ccal-d.other{opacity:.35;}
  .ccal-d.today{border:2.5px solid #e5638c;}
  .ccal-d.today::after{content:"きょう";position:absolute;left:0;right:0;bottom:2px;font-size:9.5px;color:#e5638c;font-weight:900;}
  .ccal-d.sel{background:linear-gradient(135deg,#FF8FB1,#e5638c);color:#fff;border-color:#e5638c;box-shadow:0 4px 10px rgba(229,99,140,.4);}
  .ccal-d.sel::before{content:"🌸";position:absolute;top:-8px;right:-6px;font-size:15px;}
  .ccal-d.sel.today::after{color:#fff;}
  .ccal-f{display:flex;gap:8px;margin-top:12px;}
  .ccal-f button{flex:1;font-family:inherit;font-size:15px;font-weight:800;padding:10px;border-radius:99px;border:2px solid #FFC2D1;background:#fff;color:#e5638c;cursor:pointer;}
  .ccal-f button.pri{background:#e5638c;border-color:#e5638c;color:#fff;}`;
  document.head.appendChild(css);
  let ym = null;
  const iso = d => d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0");
  function paint(){
    const box = document.getElementById("ccalBox"); if(!box) return;
    const [y, m] = ym, first = new Date(Date.UTC(y, m - 1, 1)), start = new Date(first); start.setUTCDate(1 - first.getUTCDay());
    const sel = document.getElementById("day").value, today = KB.bizDateOf();
    let cells = "";
    for(let i = 0; i < 42; i++){
      const d = new Date(start); d.setUTCDate(start.getUTCDate() + i);
      const s = iso(d), w = d.getUTCDay();
      if(i === 35 && d.getUTCMonth() !== m - 1) break;   // 6段目がまるごと次の月なら出さない
      cells += `<button type="button" class="ccal-d${w === 0 ? " sun" : w === 6 ? " sat" : ""}${d.getUTCMonth() !== m - 1 ? " other" : ""}${s === today ? " today" : ""}${s === sel ? " sel" : ""}" onclick="pickCuteCal('${s}')">${d.getUTCDate()}</button>`;
    }
    box.innerHTML = `<div class="ccal-h"><button type="button" class="ccal-nav" onclick="moveCuteCal(-1)">‹</button><b>🌸 ${y}年 ${m}月</b><button type="button" class="ccal-nav" onclick="moveCuteCal(1)">›</button></div>
      <div class="ccal-g">${["日", "月", "火", "水", "木", "金", "土"].map((w, i)=>`<div class="ccal-w${i === 0 ? " sun" : i === 6 ? " sat" : ""}">${w}</div>`).join("")}${cells}</div>
      <div class="ccal-f"><button type="button" onclick="closeCuteCal()">とじる</button><button type="button" class="pri" onclick="pickCuteCal('${today}')">きょうへ</button></div>`;
  }
  window.openCuteCal = function(){
    const v = document.getElementById("day").value || KB.bizDateOf();
    ym = [Number(v.slice(0, 4)), Number(v.slice(5, 7))];
    closeCuteCal();
    const bg = document.createElement("div"); bg.className = "ccal-bg"; bg.id = "ccalBg";
    bg.innerHTML = `<div class="ccal" id="ccalBox"></div>`;
    bg.addEventListener("click", e=>{ if(e.target === bg) closeCuteCal(); });
    document.body.appendChild(bg); paint();
  };
  window.closeCuteCal = function(){ const b = document.getElementById("ccalBg"); if(b) b.remove(); };
  window.moveCuteCal = function(n){ let [y, m] = ym; m += n; if(m < 1){ m = 12; y--; } if(m > 12){ m = 1; y++; } ym = [y, m]; paint(); };
  window.pickCuteCal = function(s){ closeCuteCal(); if(document.getElementById("day").value !== s){ document.getElementById("day").value = s; loadDay(); } };
  document.addEventListener("keydown", e=>{ if(e.key === "Escape") closeCuteCal(); });
})();

/* ---------- 上の日付の箱（記録簿と同じ見た目）：「11/2(日) 今日 📅」。精算ページなど、記録簿の外でも使う ---------- */
(function(){
  const css = document.createElement("style");
  css.textContent = `
  .datebox{position:relative;display:inline-flex;align-items:center;font-size:16px;font-weight:800;color:#e5638c;background:#fff;border:1.5px solid #FFC2D1;border-radius:99px;padding:3px 14px;cursor:pointer;white-space:nowrap;min-width:178px;justify-content:center;}
  .datebox input[type=date]{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;border:none;padding:0;pointer-events:none;}
  .datebox .dmd{color:#B0124F;font-size:19px;} .datebox .dwk{color:#B0124F;font-size:16px;margin-left:1px;}
  .datebox .dwk.sat{color:#1E6FD9;} .datebox .dwk.sun{color:#E0245E;}
  .datebox .dtoday{background:#e5638c;color:#fff;font-size:11.5px;border-radius:99px;padding:1px 8px;margin-left:6px;}
  .datebox .calico{margin-left:6px;font-size:17px;}`;
  document.head.appendChild(css);
})();
function paintDayLabel(){
  const el = document.getElementById("dayLabel"), v = document.getElementById("day") && document.getElementById("day").value; if(!el || !v) return;
  const d = new Date(v + "T12:00:00Z"), w = d.getUTCDay();
  el.innerHTML = `<b class="dmd">${d.getUTCMonth() + 1}/${d.getUTCDate()}</b><b class="dwk ${w === 0 ? "sun" : w === 6 ? "sat" : ""}">(${"日月火水木金土"[w]})</b>` + (v === KB.bizDateOf() ? `<span class="dtoday">今日</span>` : "");
}
// ページの最初の読みこみが、このファイルより先に終わっていたときのため
if(document.getElementById("day") && document.getElementById("day").value) paintDayLabel();
setTimeout(() => { if(document.getElementById("day") && document.getElementById("day").value) paintDayLabel(); }, 1500);
