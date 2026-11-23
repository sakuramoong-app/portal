/* 受付の並び（v2・2026/11/23 店長：上下に行ったり来たりで目が回る → 練習ページで作って、11/23 本番の標準に）
   ・いつも動く。前の並びにもどしたいときは URL に「v1」
   ・新しく作るのではなく、今ある入力欄・説明・チェックを、そのまま新しい場所へ「移動」するだけ（id も動きも同じ。何も消さない）
   並び：
     上    ：📞 電話番号・お客さんの名前・新規/店リピ/本指名（まず最初に聞く）
     左    ：✅ 必須（指名・店舗・キャスト・日時・コース・エリア・ホテル・AF・支払い・媒体・状態）を1枚にぎゅっと
             → 💴 料金 → ＋ そのほか（割引・希望プレイ・OP・延長・交通費・地図・メール など、必要なときだけ）
     右    ：説明・チェック・注意をまとめて（キャストのこと・お客さんのこと・場所とホテル・探す・連絡と備考）。右だけでスクロール */
(function(){
  // 2026/11/23 店長OK → 本番の標準に。前の並び（縦1列）にもどしたいときは URL に「v1」（例：kiroku.html?v1）
  if(new URLSearchParams(location.search).has("v1")) return;
  const $ = id => document.getElementById(id);
  const fOf = id => { const e = $(id); return e ? (e.closest(".f") || e) : null; };
  const el = (tag, cls, html) => { const d = document.createElement(tag); if(cls) d.className = cls; if(html) d.innerHTML = html; return d; };
  const put = (box, ...nodes) => nodes.forEach(n => { if(n && n !== box && !n.contains(box)) box.appendChild(n); });

  document.head.insertAdjacentHTML("beforeend", `<style>
    body.v2 #formBg .drawer{max-width:1480px;width:97vw;padding:12px 16px 110px}
    body.v2 #stepNav{display:none !important}
    .v2top{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 14px;align-items:start;background:#FFF4F8;border:2px solid #F3C6D6;border-radius:16px;padding:10px 12px;margin-bottom:10px}
    .v2top .f{margin:0}
    .v2top #f_visit{margin:0}
    .v2top .v2-phone{order:1} .v2top #mailBar{order:2;margin:0} .v2top .v2-name{order:3} .v2top .v2visit{order:4} .v2top .v2-fs{order:5;grid-column:1/-1}
    .v2top>*,.v2g>*,.v2main,.v2side,.v2s,.v2card{min-width:0}
    body.v2 #formBg .drawer input,body.v2 #formBg .drawer select,body.v2 #formBg .drawer textarea{max-width:100%}
    .v2s,.v2card{overflow-x:auto}
    body.v2 .tl2s{display:none}   /* キャストの「予約0件・予約0時間・空き5時間」は出さない（店長 11/23） */
    .v2grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:12px;align-items:start}
    .v2card{background:#fff;border:2px solid var(--line,#eee);border-radius:16px;padding:10px 12px;margin-bottom:12px}
    .v2card>h3{margin:0 0 8px;font-size:15px;display:flex;align-items:center;gap:6px}
    .v2req{border-color:#e5638c}
    .v2req .v2g{display:grid;grid-template-columns:1fr 1fr;gap:8px 12px}
    .v2req .v2g>*{margin:0;min-width:0}
    .v2req .v2full{grid-column:1/-1}
    .v2req .f label{font-size:13px}
    .v2more>summary{cursor:pointer;font-weight:800;font-size:15px;padding:2px 0}
    .v2more[open]>summary{margin-bottom:8px}
    .v2side{position:sticky;top:0;max-height:calc(100vh - 130px);overflow-y:auto;padding-right:4px}
    .v2s{background:#FBFAFF;border:1.5px solid #E6E0F5;border-radius:14px;padding:8px 10px;margin-bottom:10px}
    .v2s>h4{margin:0 0 6px;font-size:14px;color:#5E35B1;display:flex;align-items:center;gap:8px}
    .v2s>h4>span{flex:1}
    .v2tog{border:1.5px solid #D9C9F5;background:#fff;color:#5E35B1;border-radius:99px;padding:3px 12px;font-size:12.5px;font-weight:800;cursor:pointer;font-family:inherit}
    .v2s.v2closed>:not(h4){display:none !important}
    .v2s.v2closed>h4{margin:0}
    .v2s.v2empty{display:none}
    .v2old{display:none}
    @keyframes v2fl{0%{box-shadow:0 0 0 0 rgba(229,99,140,.0)}30%{box-shadow:0 0 0 4px rgba(229,99,140,.55)}100%{box-shadow:0 0 0 0 rgba(229,99,140,0)}}
    .v2flash{animation:v2fl 1.6s ease-out 1;border-radius:12px}
    .v2note{font-size:12px;color:var(--sub,#888);margin:-4px 0 8px}
    @media (max-width:1000px){ .v2grid{grid-template-columns:1fr} .v2side{position:static;max-height:none} }
    @media (max-width:700px){ .v2top{grid-template-columns:1fr} .v2req .v2g{grid-template-columns:1fr} }
  </style>`);

  function build(){
    const drawer = document.querySelector("#formBg .drawer"); if(!drawer || $("v2root")) return;
    document.body.classList.add("v2");
    const firstStep = drawer.querySelector(".step");
    const root = el("div"); root.id = "v2root";
    firstStep.parentNode.insertBefore(root, firstStep);
    root.appendChild(el("div", "v2note", "左＝必須をまとめて／右＝説明・チェック・注意（右の枠は「▲ 閉じる」でたためます）"));

    // ---------- 上：電話・名前・種別 ----------
    const top = el("div", "v2top"); root.appendChild(top);
    // ①電話 ②メール予約を貼る（開いたときに電話の前に入る。並びは CSS の order で）
    // ③名前 ④種別 → その下に 🔎探す
    const ph = fOf("f_phone"), nm = fOf("f_name"), vis = fOf("f_visit"), fs = $("fsBox");
    if(ph){ ph.classList.add("v2-phone"); top.appendChild(ph); }
    if(nm){ nm.classList.add("v2-name"); top.appendChild(nm); }
    if(vis){ vis.classList.add("v2visit"); top.appendChild(vis); }
    if(fs){ fs.classList.add("v2-fs"); top.appendChild(fs); }

    const grid = el("div", "v2grid"); root.appendChild(grid);
    const main = el("div", "v2main"), side = el("div", "v2side"); grid.appendChild(main); grid.appendChild(side);

    // ---------- 左：必須 ----------
    const req = el("div", "v2card v2req", `<h3>✅ 必須（ここがそろえば登録できる）</h3>`); main.appendChild(req);
    const g = el("div", "v2g"); req.appendChild(g);
    const full = n => { if(n){ n.classList.add("v2full"); g.appendChild(n); } };
    full(fOf("f_nomiChips"));
    put(g, fOf("f_store"), fOf("f_day"));
    full(fOf("f_cast"));   // キャストは写真の一覧になるので、横いっぱい
    full($("dummyWrap"));
    put(g, fOf("f_course"), fOf("endView"));
    full(document.querySelector(".feechk"));
    put(g, fOf("f_areaSel"), fOf("f_place"));
    full($("afBox"));
    full(fOf("f_play"));   // 希望プレイは AF・逆AF のすぐ下（2026/11/23 店長）
    put(g, fOf("f_pay"));
    put(g, fOf("f_status"));
    full(fOf("f_media"));
    put(g, fOf("f_status_at"));


    // ---------- 左：そのほか（必要なときだけ） ----------
    const more = el("details", "v2card v2more", `<summary>＋ そのほか（割引・OP・延長・交通費・地図・メール・お客様のこと）</summary>`); main.appendChild(more);
    // ---------- 左：料金 ----------
    const calc = el("div", "v2card", `<h3>💴 料金</h3>`); main.appendChild(calc);
    put(calc, $("calc"), $("backDet"));
    put(more, fOf("f_discount"), $("dressWrap"), $("optDetails"));
    const tr = $("f_transport"); if(tr) put(more, tr.closest(".row2") || fOf("f_transport"));
    put(more, fOf("f_map"), fOf("f_email"), fOf("f_guest"));

    // ---------- 右：説明・チェック・注意 ----------
    // 右の枠：見出しの「▲ 閉じる／▼ 開く」でたためる（たたんだのは覚えておく。2026/11/23 店長「お客さんのことは閉じるボタンほしい」）
    const closedKey = "kbV2Closed", closed = (() => { try{ return JSON.parse(localStorage.getItem(closedKey) || "{}"); }catch(e){ return {}; } })();
    const sec = (title, ids) => { const key = title, s = el("div", "v2s" + (closed[key] ? " v2closed" : ""), `<h4><span>${title}</span><button type="button" class="v2tog">${closed[key] ? "▼ 開く" : "▲ 閉じる"}</button></h4>`);
      s.querySelector(".v2tog").onclick = () => { const c = s.classList.toggle("v2closed"); s.querySelector(".v2tog").textContent = c ? "▼ 開く" : "▲ 閉じる"; closed[key] = c; try{ localStorage.setItem(closedKey, JSON.stringify(closed)); }catch(e){} }; ids.forEach(id => { const n = typeof id === "string" ? $(id) : id; if(n) s.appendChild(n); }); side.appendChild(s); return s; };
    sec("📌 受付のルール・お知らせ", ["receptionNotes"]);
    sec("🙋 お客さんのこと", ["custInfo"]);
    sec("👤 キャストのこと", ["castInfo", "castChecks", "castTimeline", "neighborBox", "castCal"]);
    sec("🏨 場所・ホテル・コース", ["placePick", "hotelStatusBox", "p3HotelBox", "bizBox", "newHotelBox", "hotelMemoBox", "areaInfo", "nextFeeInfo", "courseInfo"]);
    const msg = $("msg"), ms = sec("📨 最終確認・キャストへの連絡", ["finalSummary"]);
    if(msg){ const lab = msg.previousElementSibling, btns = msg.nextElementSibling; put(ms, lab, msg, btns); }
    put(ms, $("netReplyWrap"));
    sec("📝 備考・NG", [fOf("formLog"), "laterBox", $("delBtn") && $("delBtn").parentNode]);

    // ---------- のこり（今までの①〜⑥の枠）：何も消さないように「そのほか」のいちばん下へ ----------
    drawer.querySelectorAll(".step").forEach(s => {
      const h = s.querySelector("h3"); if(h) h.remove();
      if(s.textContent.trim() || s.querySelector("input,select,textarea,button")){ s.classList.add("v2oldleft"); more.appendChild(s); }
      else s.classList.add("v2old");
    });

    // 中身のない説明の枠は出さない（入ったら出る）
    const tidy = () => side.querySelectorAll(".v2s").forEach(s => {
      const body = [...s.children].filter(c => c.tagName !== "H4");
      const has = body.some(c => c.style.display !== "none" && (c.textContent.trim() || c.querySelector("img,canvas,svg,input,select,textarea,button")));
      s.classList.toggle("v2empty", !has);
    });
    tidy(); setInterval(tidy, 800);

    // キャストを選んだら、画面を「種別」の所へもどす（決まった種別・「判断して」のお知らせを確かめられるように。2026/11/23 店長）。種別の枠を少し光らせる
    const cs = $("f_cast");
    if(cs) cs.addEventListener("change", () => setTimeout(() => {
      const v = fOf("f_visit"); if(!v) return;
      v.scrollIntoView({ block: "center", behavior: "smooth" });
      v.classList.remove("v2flash"); void v.offsetWidth; v.classList.add("v2flash");
    }, 250));
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
})();
