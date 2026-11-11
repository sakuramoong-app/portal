/* ============================================================
   📒 記録簿（kiroku.html）の 3/7：精算（キャストの枠の中。計算は kb_money.js）
   ※ kiroku.html の <script src> の順番どおりに読む（順番を変えると動かなくなる。2026/11/10 1つのファイルから分けた）
   ============================================================ */
/* ============================================================
   💴 精算（キャストの枠の中）… settle.html と同じ計算。精算のページはこちらに合体
   ============================================================ */
const PLACES = ["池袋", "鶯谷", "五反田", "回収"];
function calcCast(castId){   // 💴 計算は kb_money.js（KBM.calcCast）の1か所に（2026/11/10）
  return KBM.calcCast({ all: rows.filter(r=>r.cast_id === castId), cd: castDays[castId] || {}, rules: rulesOn(castId), day, skip: typeof settleSkip !== "undefined" ? settleSkip[day + "|" + castId] : null });
}

function cardHtml(id, c){
  const cd = c.cd, done = !!cd.settled, dis = (!KB.CAN_EDIT || done) ? "disabled" : "";
  const res = c.all.map(r=>{
    const off = r.status === "cancel" || r.status === "tobi" || r.status === "flowed";
    return `<tr class="${off ? "off" : ""}"><td>${hm(r.start_at)}</td><td>${esc(storeLabel(r.store_key))}${r.dummy_name ? " 🎭" + esc(r.dummy_name) : ""}</td>
      <td>${esc(r.course)}${r.extension_count ? " 延長" + r.extension_count : ""}${off ? (r.status === "cancel" ? "（キャンセル）" : "（トビ）") : ""}</td>
      <td class="money">${yen(r.total)}${r.payment === "card_paid" ? " 💳" : ""}</td><td class="money">${off ? "－" : yen(backOf(r))}</td></tr>`;
  }).join("");
  const items = (list, kind)=> list.map((x, i)=>`<div class="it"><input class="lbl" value="${esc(x.label)}" ${dis} onchange="setItem('${id}','${kind}',${i},'label',this.value)">
      <input class="amt" type="number" value="${Number(x.amount) || 0}" ${dis} onchange="setItem('${id}','${kind}',${i},'amount',this.value)">
      ${dis ? "" : `<button class="btn btn-ghost btn-sm" onclick="delItem('${id}','${kind}',${i})">🗑</button>`}</div>`).join("");
  return `<div class="card ${done ? "done" : ""}" id="card-${id}">
    <h2>${esc(castName(id))}<span class="st">${done ? "精算済" + (cd.settle_place ? "（" + esc(cd.settle_place) + "）" : "") : "未精算"}</span>
      ${done && cd.settled_at ? `<small class="hint2">${KBF.staffTag(cd.settled_by)} ${hm(cd.settled_at)}</small>` : ""}</h2>
    <div class="sbig">
      ${c.drop >= 0
        ? `<div class="sb drop"><div class="k">💰 投函額<small>（封筒に入れて投函する額）</small></div><div class="v">${yen(c.drop)}</div><div class="s">総額 ${yen(c.total)} − 手取り ${yen(c.takeHome)}${c.cardPaid ? " − カード払分 " + yen(c.cardPaid) : ""}</div>
            ${c.deposited != null ? `<div class="s2 ${c.diff < 0 ? "ng" : "ok"}">投函した額 ${yen(c.deposited)}${c.diff === 0 ? "　ぴったり ✅" : c.diff < 0 ? "　未精算 −" + yen(-c.diff) : "　お釣り ＋" + yen(c.diff)}</div>` : ""}</div>`
        : `<div class="sb give"><div class="k">💴 お店からキャストに渡す<small>（カード決済で現金がないため）</small></div><div class="v">${yen(-c.drop)}</div><div class="s">投函はなし</div></div>`}
      <div class="sb take"><div class="k">👛 手取り（今日お渡し）</div><div class="v">${yen(c.takeHome)}</div><div class="s">本日の報酬 ${yen(c.reward + c.option - c.zappi)}（報酬${c.option ? "＋OP" : ""}−雑費）${c.transportBack + c.plus ? "＋交通費・プラス " + yen(c.transportBack + c.plus) : ""}${c.minus ? "−マイナス " + yen(c.minus) : ""}</div></div>
    </div>    ${typeof unsBoxHtml === "function" ? unsBoxHtml(id, c) : ""}
    <table class="res"><tr><th>時間</th><th>店舗</th><th>コース</th><th class="money">総額</th><th class="money">報酬</th></tr>${res}</table>
    ${c.why.length ? `<div class="note2">🧮 ${c.why.map(esc).join("<br>")}</div>` : ""}
    ${c.cardUnconfirmed ? `<div class="warn" style="margin:6px 0">⚠️ お支払いが「カード」のままの予約が ${c.cardUnconfirmed}件あります。カード決済の完了を確認して、本日のキャスト一覧のカードのプルダウンで「✅ 決済済み」にしてください。</div>` : ""}
    <div class="scalc">
      <span class="k">① 報酬</span><span class="v">${yen(c.reward)}</span>
      <span class="k">OP（バック有）</span><span class="v">${yen(c.option)}</span>
      ${c.transportBack ? `<span class="k">交通費バック（自動）</span><span class="v">＋${yen(c.transportBack)}</span>` : ""}
      ${c.plus ? `<span class="k">② プラス（手入力）</span><span class="v">＋${yen(c.plus)}</span>` : ""}
      <span class="k">③ 雑費${c.exempt ? "（この曜日はなし）" : ""}${cd.zappi_override != null ? "（手で直した" + (cd.zappi_note ? "：" + esc(cd.zappi_note) : "") + "）" : ""}</span><span class="v">−${yen(c.zappi)}</span>
      ${c.minus ? `<span class="k">マイナス（手入力）</span><span class="v">−${yen(c.minus)}</span>` : ""}
      <span class="k"><b>手取り</b></span><span class="v big">${yen(c.takeHome)}</span>
      <span class="k">カード払分</span><span class="v">${yen(c.cardPaid)}</span>
      ${c.drop >= 0
        ? `<span class="k"><b>投函額</b>（総額 ${yen(c.total)} − 手取り − カード払分）</span><span class="v big">${yen(c.drop)}</span>`
        : `<span class="k"><b>お店からキャストに渡す</b>（カードで現金がないため）</span><span class="v big" style="color:#2f7fd0">${yen(-c.drop)}</span>`}
      <span class="k">投函した額（お金を確認したあと手入力）</span><span class="v">
        <input type="number" id="dep-${id}" value="${c.deposited != null ? c.deposited : ""}" placeholder="投函した額" ${KB.CAN_EDIT ? "" : "disabled"}
          style="width:110px;text-align:right;font-family:inherit;font-size:13px;padding:4px 6px;border:1.5px solid var(--line);border-radius:8px" onchange="setDeposit('${id}',this.value)"></span>
      ${c.diff != null && c.diff !== 0 ? `<span class="k">${c.diff < 0 ? "<b style='color:#d9534f'>未精算（マイナス）</b>" : "<b style='color:#2f9e6e'>お釣り（プラス）</b>"}</span><span class="v" style="color:${c.diff < 0 ? "#d9534f" : "#2f9e6e"}">${c.diff < 0 ? "−" : "＋"}${yen(Math.abs(c.diff))}</span>` : ""}
      ${c.diff === 0 ? `<span class="k">投函した額</span><span class="v" style="color:#2f9e6e">ぴったり ✅</span>` : ""}
    </div>
    ${dis ? "" : `<div class="pmz"><div class="pmzh">✏️ プラス・マイナス・雑費を直す</div>
      <div class="hint2" style="margin-top:6px">② プラス（交通費など）</div><div class="items">${items(c.plusItems, "plus")}</div>
      <button class="btn btn-ghost btn-sm" onclick="addItem('${id}','plus')">＋ プラスを足す</button>
      <div class="hint2" style="margin-top:8px">マイナス（雑費以外）</div><div class="items">${items(c.minusItems, "minus")}</div>
      <button class="btn btn-ghost btn-sm" onclick="addItem('${id}','minus')">＋ マイナスを足す</button>
      <div class="hint2" style="margin-top:8px">雑費（自動：${yen(c.zappiAuto)}）</div>
      <div class="it" style="display:flex;gap:6px;align-items:center"><input type="number" id="zo-${id}" value="${cd.zappi_override != null ? cd.zappi_override : ""}" placeholder="空なら自動" style="width:120px"><input id="zr-${id}" value="${esc(cd.zappi_note || "")}" maxlength="100" placeholder="理由（例：体調不良で早退のため雑費なし）" style="flex:1;min-width:160px">
        <button class="btn btn-ghost btn-sm" onclick="setZappi('${id}')">雑費を直す</button></div>
    </div>`}
    <details style="margin-top:6px"><summary style="cursor:pointer;font-size:12.5px;font-weight:800;color:var(--sub)">🏪 店落ち・税務用</summary>
      <div class="scalc" style="margin-top:4px">
        <span class="k">暫定的な残額（総額 − 報酬）</span><span class="v">${yen(c.provisional)}</span>
        <span class="k"><b>店落ち</b>（総額 − 報酬 ＋ 雑費）</span><span class="v">${yen(c.shopDrop)}</span>
        <span class="k">【税務用】源泉徴収（手取りからは引かない）</span><span class="v">${yen(c.withholding)}</span>
        <span class="k">実質的な店落ち（暫定的な残額 − 源泉）</span><span class="v">${yen(c.realDrop)}</span>
      </div>
    </details>
    ${typeof settleLogHtml === "function" ? settleLogHtml(id) : ""}
    <div class="acts">
      <button class="btn btn-ghost btn-sm" onclick="copyDetail('${id}')">📋 精算明細をコピー（LINE用）</button>
      <button class="btn btn-ghost btn-sm" onclick="copyDetailImg('${id}')">🖼 画像でコピー</button>
      ${KB.CAN_EDIT ? (done
        ? `<button class="btn btn-ghost btn-sm" onclick="unsettle('${id}')">↩ 精算済をもどす</button>`
        : `<select id="pl-${id}">${PLACES.map(p=>`<option ${cd.settle_place === p ? "selected" : ""}>${p}</option>`).join("")}</select>
           <button class="btn btn-primary btn-sm" onclick="settle('${id}')">✅ 精算済にする</button>`) : ""}
    </div>
  </div>`;
}

/* ---------- 保存（kb_cast_days） ---------- */
async function saveDay(id, patch){
  const row = Object.assign({ biz_date: day, cast_id: id }, patch, { updated_at: new Date().toISOString(), updated_by: KB.operatorName() });
  try{
    const r = q(await sb.from("kb_cast_days").upsert(row, { onConflict: "biz_date,cast_id" }).select().single());
    castDays[id] = r; refreshCastSettle(id);
  }catch(e){ toast("保存できませんでした：" + (e.message || e)); }
}
function curItems(id, kind){ const cd = castDays[id] || {}; const l = cd[kind + "_items"]; return Array.isArray(l) ? l.map(x=>Object.assign({}, x)) : []; }
function addItem(id, kind){ const l = curItems(id, kind); l.push({ label: kind === "plus" ? "交通費" : "", amount: 0 }); saveDay(id, { [kind + "_items"]: l }); }
function setItem(id, kind, i, k, v){ const l = curItems(id, kind); if(!l[i]) return; l[i][k] = k === "amount" ? (Number(v) || 0) : v; saveDay(id, { [kind + "_items"]: l }); }
function delItem(id, kind, i){ const l = curItems(id, kind); l.splice(i, 1); saveDay(id, { [kind + "_items"]: l }); }
function setDeposit(id, v){ saveDay(id, { deposited: v === "" ? null : Number(v) || 0 }); }
function setZappi(id){ const v = $("zo-" + id).value, n = $("zr-" + id) ? $("zr-" + id).value.trim() : "", has = "zappi_note" in (castDays[id] || {}) || Object.values(castDays).some(d => d && "zappi_note" in d);
  saveDay(id, Object.assign({ zappi_override: v === "" ? null : Math.max(0, Number(v) || 0) }, has || n ? { zappi_note: v === "" ? "" : n } : {})); }   // 理由は SQL 183
function settle(id){
  const c = calcCast(id);
  if(!confirm(castName(id) + " を精算済にしますか？\n手取り " + yen(c.takeHome) + "／投函額 " + yen(c.drop))) return;
  const snap = { reward: c.reward, option: c.option, transportBack: c.transportBack, plus: c.plus, zappi: c.zappi, minus: c.minus,
                 takeHome: c.takeHome, total: c.total, cardPaid: c.cardPaid, drop: c.drop, withholding: c.withholding,
                 shopDrop: c.shopDrop, realDrop: c.realDrop, deposited: c.deposited, diff: c.diff, by: KB.operatorName(), at: new Date().toISOString() };
  saveDay(id, { settled: true, settled_at: new Date().toISOString(), settled_by: KB.operatorName(), settle_place: $("pl-" + id).value, settle_snapshot: snap });
}
function unsettle(id){
  if(!confirm(castName(id) + " の精算済をもどしますか？")) return;
  saveDay(id, { settled: false, settled_at: null, settle_snapshot: null });
}

document.head.insertAdjacentHTML("beforeend", `<style>
  .sbig{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;margin:8px 0}
  .sb{border-radius:14px;padding:10px 14px} .sb .k{font-size:13px;font-weight:800} .sb .k small{font-weight:600;margin-left:4px;font-size:11.5px}
  .sb .v{font-size:34px;font-weight:900;line-height:1.2;margin:2px 0} .sb .s{font-size:12px;opacity:.85} .sb .s2{font-size:13px;font-weight:800;margin-top:4px}
  .sb.drop{background:#00B0F0;border:3px solid #0A84C6;color:#08304d} .sb.drop .v{color:#E0001B;text-shadow:0 0 6px #fff,0 0 2px #fff;text-decoration:underline double;text-underline-offset:6px}
  .sb.give{background:#E3F1FF;border:3px solid #2f7fd0;color:#1f4f80} .sb.give .v{color:#2f7fd0}
  .sb.take{background:#FFE3F0;border:2px solid #F7B6CF;color:#6b3550} .sb.take .v{color:#5C4B4F}
  .sb .s2.ng{color:#d9534f} .sb .s2.ok{color:#2f9e6e}
</style>`);/* ---------- 🖼 精算明細を画像でコピー（LINE に貼りつけ）。コピーできないブラウザは画像を保存 ---------- */
function settleCanvas(id){
  const c = calcCast(id), d = new Date(day + "T12:00:00Z");
  const L = [];   // [左, 右, 種類]
  c.all.forEach(r=>{
    const off = r.status === "cancel" || r.status === "tobi" || r.status === "flowed";
    L.push([`${hm(r.start_at)} ${storeLabel(r.store_key)} ${r.course}${/^\d+$/.test(r.course) ? "分" : ""}${r.extension_count ? " 延長" + r.extension_count : ""}`, off ? (r.status === "cancel" ? "キャンセル" : r.status === "flowed" ? "流れた" : "トビ") : yen(backOf(r)), off ? "off" : "res"]);
  });
  L.push(["", "", "line"]);
  L.push(["報酬", yen(c.reward)]);
  if(c.option) L.push(["OP", yen(c.option)]);
  if(c.transportBack) L.push(["交通費バック", "＋" + yen(c.transportBack)]);
  c.plusItems.forEach(x=>{ if(Number(x.amount)) L.push([x.label || "プラス", "＋" + yen(x.amount)]); });
  L.push(["雑費", "−" + yen(c.zappi)]);
  c.minusItems.forEach(x=>{ if(Number(x.amount)) L.push([x.label || "マイナス", "−" + yen(x.amount)]); });
  L.push(["", "", "line"]);
  L.push(["本日のお給料", yen(c.takeHome), "big"]);
 const S = 2, W = 560, PAD = 28, FONT = '"Hiragino Maru Gothic ProN","M PLUS Rounded 1c","Yu Gothic","Meiryo",sans-serif';
  const hOf = k => k === "line" ? 18 : k === "big" || k === "big2" ? 44 : 34;
  const BOX = 112, H = 96 + BOX + L.reduce((a, x)=>a + hOf(x[2]), 0) + 64 + 142;
  const cv = document.createElement("canvas"); cv.width = W * S; cv.height = H * S;
  const g = cv.getContext("2d"); g.scale(S, S);
  g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, W, H);
  const grd = g.createLinearGradient(0, 0, W, 0); grd.addColorStop(0, "#ff9fb8"); grd.addColorStop(1, "#e5638c");
  g.fillStyle = grd; g.fillRect(0, 0, W, 72);
  g.fillStyle = "#fff"; g.font = `bold 15px ${FONT}`; g.fillText(`精算　${d.getUTCMonth() + 1}/${d.getUTCDate()}(${DOW[d.getUTCDay()]})`, PAD, 28);
  g.font = `bold 24px ${FONT}`; g.fillText(`${castName(id)}さん`, PAD, 58);
  // 💰 投函額（いちばん大きく。黄色の箱に赤い字）／カードで現金がないときは「お店から渡す」
  const give = c.drop < 0;
  g.fillStyle = give ? "#E3F1FF" : "#00B0F0"; g.strokeStyle = give ? "#2f7fd0" : "#0A84C6"; g.lineWidth = 3;
  g.beginPath(); g.roundRect ? g.roundRect(PAD, 88, W - PAD * 2, BOX - 8, 14) : g.rect(PAD, 88, W - PAD * 2, BOX - 8); g.fill(); g.stroke();
  g.textAlign = "left"; g.fillStyle = give ? "#1f4f80" : "#08304d"; g.font = `bold 17px ${FONT}`;
  g.fillText(give ? "💴 お店からキャストに渡す" : "💰 投函額（封筒に入れて投函）", PAD + 16, 118);
  g.textAlign = "right"; g.fillStyle = give ? "#2f7fd0" : "#E0001B"; g.font = `900 42px ${FONT}`;
  g.fillText(yen(Math.abs(c.drop)), W - PAD - 16, 178);
  let y = 96 + BOX;
  L.forEach(([l, v, k])=>{
    const h = hOf(k);
    if(k === "line"){ g.strokeStyle = "#F1C9D5"; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(PAD, y + 6); g.lineTo(W - PAD, y + 6); g.stroke(); g.setLineDash([]); y += h; return; }
    const big = k === "big" || k === "big2";
    g.font = `${big ? "bold 19px" : k === "res" || k === "off" ? "15px" : "bold 16px"} ${FONT}`;
    g.fillStyle = k === "off" ? "#B9A9AD" : "#5C4B4F"; g.textAlign = "left"; g.fillText(l, PAD, y + h / 2 + 6);
    g.font = `${big ? "bold 24px" : "bold 16px"} ${FONT}`;
    g.fillStyle = k === "big" ? "#e5638c" : k === "big2" ? "#2f7fd0" : k === "off" ? "#B9A9AD" : "#5C4B4F"; g.textAlign = "right"; g.fillText(v, W - PAD, y + h / 2 + 7);
    y += h;
  });
  // 📝 精算メモのお手本（営業日・名前・実際に入れた投函金額）
  y += 14; g.textAlign = "left"; g.fillStyle = "#5C4B4F"; g.font = `bold 15px ${FONT}`; g.fillText("📝 精算メモに書くこと（お手本）", PAD, y + 16);
  { const tx = PAD, ty = y + 28, cw = [120, 170, W - PAD * 2 - 290], rh = 36, hd = ["営業日", "名前", "金額"];
    const md = (d.getUTCMonth() + 1) + "/" + d.getUTCDate(), val = [md, castName(id), c.drop >= 0 ? "¥" + c.drop.toLocaleString("ja-JP") : "（投函なし）"];
    g.strokeStyle = "#333"; g.lineWidth = 1.5; let x = tx;
    cw.forEach((w, i) => { g.strokeRect(x, ty, w, rh); g.strokeRect(x, ty + rh, w, rh);
      g.textAlign = "center"; g.fillStyle = "#333"; g.font = `15px ${FONT}`; g.fillText(hd[i], x + w / 2, ty + 24);
      g.fillStyle = "#1a3a8a"; g.font = `bold 18px ${FONT}`; g.fillText(val[i], x + w / 2, ty + rh + 25); x += w; });
    g.textAlign = "left"; g.fillStyle = "#8a7f99"; g.font = `12px ${FONT}`; g.fillText("1枚に1営業日分・表向きで、いちばん上に文字が見えるように入れてください", tx, ty + rh * 2 + 20); }
  y += 128;  g.textAlign = "center"; g.fillStyle = "#e5638c"; g.font = `bold 15px ${FONT}`; g.fillText("お疲れさまでした🌸", W / 2, y + 34);
  return cv;
}
function copyDetailImg(id){
  const cv = settleCanvas(id), name = `精算_${day}_${castName(id)}.png`;
  cv.toBlob(async b=>{
    // スマホ：画像の共有（LINE を選べる）→ だめなら、画像を大きく出して長押しで保存・コピー
    const phone = /iPhone|iPad|Android/i.test(navigator.userAgent);
    try{
      if(phone){
        const f = new File([b], name, { type: "image/png" });
        if(navigator.canShare && navigator.canShare({ files: [f] })){ await navigator.share({ files: [f] }); return; }
        throw new Error("no share");
      }
      if(!navigator.clipboard || !window.ClipboardItem) throw new Error("no");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": b })]);
      toast("🖼 精算を画像でコピーしました（LINEに貼りつけできます）");
    }catch(e){
      if(e && e.name === "AbortError") return;   // 共有をやめた
      const u = URL.createObjectURL(b);
      const bg = document.createElement("div");
      bg.style.cssText = "position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.75);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;gap:10px";
      bg.innerHTML = `<div style="color:#fff;font-weight:800;font-size:14px;text-align:center">画像を<b>長押し</b>して「コピー」か「保存」→ LINEに貼りつけ・送信してください</div>
        <img src="${u}" style="max-width:100%;max-height:75vh;border-radius:10px;background:#fff">
        <div style="display:flex;gap:8px"><a href="${u}" download="${name}" style="background:#fff;border-radius:99px;padding:8px 16px;font-weight:800;color:#e5638c;text-decoration:none">⬇ 保存</a>
        <button type="button" style="border:none;background:#fff;border-radius:99px;padding:8px 16px;font-weight:800;font-family:inherit">とじる</button></div>`;
      bg.querySelector("button").onclick = () => { bg.remove(); URL.revokeObjectURL(u); };
      document.body.appendChild(bg);
    }
  }, "image/png");
}/* ---------- 精算明細（LINE に送る文） ---------- */
function copyDetail(id){
  const c = calcCast(id), d = new Date(day + "T12:00:00Z");
  const lines = [`【精算】${d.getUTCMonth() + 1}/${d.getUTCDate()}(${DOW[d.getUTCDay()]}) ${castName(id)}さん`, ""];
  c.all.forEach(r=>{
    const off = r.status === "cancel" || r.status === "tobi" || r.status === "flowed";
    lines.push(`・${hm(r.start_at)} ${storeLabel(r.store_key)} ${r.course}${/^\d+$/.test(r.course) ? "分" : ""}${r.extension_count ? " 延長" + r.extension_count : ""}　${off ? (r.status === "cancel" ? "キャンセル" : r.status === "flowed" ? "流れた" : "トビ") : "報酬 " + yen(backOf(r))}`);
  });
  lines.push("", `報酬　${yen(c.reward)}`);
  if(c.option) lines.push(`OP　${yen(c.option)}`);
  if(c.transportBack) lines.push(`交通費バック　＋${yen(c.transportBack)}`);
  c.plusItems.forEach(x=>{ if(Number(x.amount)) lines.push(`${x.label || "プラス"}　＋${yen(x.amount)}`); });
  lines.push(`雑費　−${yen(c.zappi)}`);
  c.minusItems.forEach(x=>{ if(Number(x.amount)) lines.push(`${x.label || "マイナス"}　−${yen(x.amount)}`); });
  lines.push("", `本日のお給料　${yen(c.takeHome)}`);
  if(c.drop >= 0) lines.push(`投函額　${yen(c.drop)}`);
  else lines.push(`（カード決済のため、お店から ${yen(-c.drop)} お渡しします）`);
  lines.push("", `📝 精算メモ（お手本）：営業日 ${d.getUTCMonth() + 1}/${d.getUTCDate()}／名前 ${castName(id)}／金額 ${c.drop >= 0 ? yen(c.drop) : "（投函なし）"}`, "📖 投函のしかた：https://sakuramoong-app.github.io/portal/kirokubo/posting.html");
  navigator.clipboard.writeText(lines.join("\n")).then(()=>toast("📋 精算明細をコピーしました"), ()=>alert(lines.join("\n")));
}


function refreshCastSettle(id){
  if(castOpen && castOpen.c && castOpen.c.id === id && $("settleBox")) $("settleBox").innerHTML = cardHtml(id, calcCast(id));
  castOpen && (castOpen.cd = castDays[id]);
  renderTL();
}

