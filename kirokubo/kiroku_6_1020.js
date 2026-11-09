/* ============================================================
   📒 記録簿（kiroku.html）の 6/7：19 作りなおし：本日のキャスト一覧・通知・テンプレ・勤怠・一時保存 など
   ※ kiroku.html の <script src> の順番どおりに読む（順番を変えると動かなくなる。2026/11/10 1つのファイルから分けた）
   ============================================================ */
/* ============================================================
   2026/10/20：エリアの順番・場所の種類・リストにないホテルを足す・次回の交通費・一覧でそのまま直す
   ============================================================ */
// エリアの順番：池袋・鶯谷・五反田・渋谷・錦糸町・出張 → そのほか
const AREA_ORDER = ["池袋", "鶯谷", "五反田", "渋谷", "錦糸町", "出張"];
const __areaList = areaList;
areaList = function(){
  const rank = a=>{ const i = AREA_ORDER.findIndex(x=>String(a).includes(x)); return i < 0 ? 99 : i; };
  return __areaList().sort((a, b)=>rank(a) - rank(b) || String(a).localeCompare(String(b), "ja"));
};
const PLACE = { love: "ラブホ", biz: "ビジホ", home: "自宅" };

// 予約を開いたとき：場所の種類
const __openFormPl = openForm;
openForm = function(id){
  __openFormPl(id);
  const r = id ? rows.find(x=>x.id === id) : null;
  if($("f_place")) $("f_place").value = (r && r.place_kind) || "";
  checkNewHotel();
};

/* ---------- 📄 くわしく（予約カードの中）に「🧾 料金の内訳・報酬」も出す。「くわしくをいつも開いておく」も選べる（この端末だけ）2026/11/5
   時刻・状態・コース・延長・支払い・ホテル・メモはカードのまま直せる。OP・交通費・割引は「✏️ 開く」から（金額を計算しなおすため） ---------- */
function rcAllOpen(){ try{ return localStorage.getItem("kbRcAllOpen") === "1"; }catch(e){ return false; } }
// 「全部開く／全部閉じる」ボタン（その日の予約ぜんぶ。ひとつずつ開け閉めもそのまま）2026/11/5
function rcAllOpenToggle(on){ try{ localStorage.removeItem("kbRcAllOpen"); }catch(e){} if(on) rows.forEach(r => rcOpen.add(r.id)); else rcOpen.clear(); renderList(); }
// 📞 フィルターの電話番号：この日の予約のお客さんの番号に、入れた数字が入っていれば出す（一部でもOK）。押すとその予約へ
// 2026/11/7 店長：今日（営業日）から1週間（7日後まで）の予約も探す。見ている日の予約もいっしょに
let telSeq = 0, telTimer = null;
function telFind(){
  const el = $("telResult"); if(!el) return;
  const d = digits($("s_tel").value);
  if(d.length < 3){ el.innerHTML = d ? `<div class="hint2">3けた以上入れてください</div>` : ""; return; }
  const local = rows.filter(r => r.kb_customers && digits(r.kb_customers.phone || "").includes(d));
  paintTel(d, local, true);
  clearTimeout(telTimer);
  const seq = ++telSeq;
  telTimer = setTimeout(async () => {
    const from = KB.realBizDateOf(), to = addDays(from, 7);
    let more = [];
    try{ more = q(await sb.from("kb_reservations").select("id,biz_date,start_at,cast_id,status,kb_customers!inner(name,phone,ng)").gte("biz_date", from).lte("biz_date", to).eq("deleted", false).like("kb_customers.phone", "%" + d + "%").order("biz_date").order("start_at").limit(50)) || []; }catch(e){ more = []; }
    if(seq !== telSeq) return;
    const seen = new Set(local.map(r => r.id));
    paintTel(d, local.concat(more.filter(r => !seen.has(r.id))), false);
  }, 350);
}
function paintTel(d, hit, loading){
  const el = $("telResult"); if(!el) return;
  hit = hit.slice().sort((a, b) => String(a.biz_date).localeCompare(String(b.biz_date)) || String(a.start_at).localeCompare(String(b.start_at)));
  const dl = bd => { const x = new Date(bd + "T12:00:00Z"); return `${x.getUTCMonth() + 1}/${x.getUTCDate()}(${DOW[x.getUTCDay()]})`; };
  el.innerHTML = (hit.length ? `<div class="l4list">${hit.map(r => `<button type="button" class="l4" onclick="jumpToRes(${r.id},'${r.biz_date}')">${r.kb_customers.ng ? "⚠️" : ""}<b>${esc(r.kb_customers.name || "名前なし")}</b> <small>${esc(r.kb_customers.phone || "")}　<b>${esc(dl(r.biz_date))}</b> ${r.start_at ? hm(r.start_at) : "時間未定"} ${esc(castName(r.cast_id))}${["cancel", "tobi", "flowed"].includes(r.status) ? "（" + esc(STATUS[r.status]) + "）" : ""}</small></button>`).join("")}</div>`
    : loading ? "" : `<div class="hint2">今日から1週間の予約（と、見ている日の予約）に、${esc(d)} が入った電話番号のお客さんはいません</div>`)
    + (loading ? `<div class="hint2">🔎 今日から1週間の予約も探しています…</div>` : `<div class="hint2">今日から1週間（${esc(dl(KB.realBizDateOf()))}〜${esc(dl(addDays(KB.realBizDateOf(), 7)))}）の予約から探しました</div>`);
}
{ const __ldTel = loadDay; loadDay = async function(){ const r = await __ldTel.apply(this, arguments); telFind(); return r; }; }   // 日を変えたら探しなおす
function rcMoneyRows(r){
  const Y = n => yen(Number(n) || 0), row = (k, v) => v ? `<div class="rm-r"><span>${k}</span><b>${v}</b></div>` : "";
  const ops = (r.options || []).map(o => `${esc(o.label)}${o.qty > 1 ? "×" + o.qty : ""} ${Y(o.price * (o.qty || 1))}${o.back ? `<small>（バック ${Y(o.back * (o.qty || 1))}）</small>` : ""}`);
  const back = r.back_override != null ? Number(r.back_override) : (Number(r.course_back) || 0) + (Number(r.option_back) || 0) + (Number(r.extra_back) || 0);
  const media = (r.media || []).map(m => ((M.media || []).find(x => x.code === m) || {}).label || m).join("・");
  return `${row("基本（" + esc(r.course || "") + "）", Y(r.base_price))}${row("入会金", Number(r.admission) ? Y(r.admission) : "")}${row("指名料", Number(r.nomination_fee) ? Y(r.nomination_fee) : "")}
    ${row("延長・デート", Number(r.extension_fee) ? Y(r.extension_fee) : "")}
    ${ops.length ? `<div class="rm-r"><span>OP</span><b>${ops.join("<br>")}</b></div>` : ""}
    ${row("交通費", Number(r.transport) ? Y(r.transport) : "")}${row("割引" + (r.discount_note ? "（" + esc(r.discount_note) + "）" : ""), Number(r.discount) ? "−" + Y(r.discount) : "")}
    ${row("総額", Y(r.total))}${Number(r.card_total) ? row("うちカード", Y(r.card_total)) : ""}
    ${row("キャストの報酬", Y(back) + (r.back_override != null ? "（手で直した）" : ""))}${row("媒体", esc(media))}
    <div class="rm-hint">OP・交通費・割引を変えるときは「✏️ 開く」から</div>`;
}
document.head.insertAdjacentHTML("beforeend", `<style>.rm-r{display:flex;justify-content:space-between;gap:8px;border-bottom:1px dotted #EEE;padding:2px 0;font-size:13px} .rm-r span{color:var(--sub);white-space:nowrap} .rm-r b{text-align:right}
  .rm-hint{font-size:11.5px;color:var(--sub);margin-top:6px}</style>`);
/* ---------- 🏨 予約のカードから小窓で：ホテル名・部屋番号・地図（エリア〜交通費も見られる）。新しいホテルはリストに足せる・Googleで調べる窓（2026/11/5） ---------- */
// 📋 ホテル名と部屋番号をいっしょにコピー（2026/11/6）
function rcCopyAddr(id){ const r = rows.find(x => x.id === id); if(!r || !r.address) return; navigator.clipboard.writeText(r.address).then(() => toast("📋 「" + r.address + "」をコピーしました")); }
document.head.insertAdjacentHTML("beforeend", `<style>.rc-hcopy{font-family:inherit;font-size:12px;background:#fff;border:1.5px solid #9cc6ee;border-radius:99px;padding:2px 7px;cursor:pointer;margin-left:2px}</style>`);
function openHotelBox(id){
  const r = rows.find(x => x.id === id); if(!r) return;
  let bg = $("hbBg");
  if(!bg){ bg = document.createElement("div"); bg.id = "hbBg"; bg.className = "modal-bg"; document.body.appendChild(bg); KB.closeOnBackdrop(bg, () => bg.classList.remove("show")); }
  const area = r.area || "", addr = String(r.address || ""), m = addr.match(/^(.*?)[\s　]*([0-9０-９]+)[号室]*$/);
  const hotels = (M.hotels || []).filter(h => !area || !h.area || h.area === area);
  bg.innerHTML = `<div class="modal" style="max-width:560px"><button class="x" onclick="$('hbBg').classList.remove('show')">×</button>
    <h2>🏨 ホテル・部屋（${esc(castName(r.cast_id))}・${hm(r.start_at)}〜）</h2>
    <div class="hbinfo">📍 エリア <b>${esc(area || "なし")}</b>　🚕 交通費 <b>${yen(r.transport || 0)}</b>　総額 <b>${yen(r.total)}</b>
      <small>（エリア・交通費を変えるときは「✏️ 開く」から。料金が変わるため）</small></div>
    <div class="row2" style="margin-top:8px">
      <div class="f"><label>ホテル名</label><input id="hb_name" list="hbList" value="${esc(m ? m[1] : addr)}" oninput="hbCheck(${id})"><datalist id="hbList">${hotels.map(h => `<option value="${esc(h.hotel_name)}">`).join("")}</datalist></div>
      <div class="f"><label>部屋番号</label><input id="hb_room" inputmode="numeric" value="${esc(m ? m[2] : "")}" style="max-width:120px"></div>
    </div>
    <div id="hbMore"></div>
    <button type="button" class="btn btn-primary" style="margin-top:10px;width:100%" onclick="hbSave(${id})">保存</button></div>`;
  bg.classList.add("show"); hbCheck(id);
}
// 小窓で Google を出す（別のタブではなく、横に小さい窓）
function hbWin(url){ const w = Math.min(900, screen.availWidth - 80), h = Math.min(800, screen.availHeight - 80); window.open(url, "hbsearch", `width=${w},height=${h},left=${screen.availWidth - w - 20},top=40`); }
function hbCheck(id){
  const r = rows.find(x => x.id === id), el = $("hbMore"); if(!r || !el) return;
  const area = r.area || "", name = $("hb_name").value.trim(), key = s => String(s || "").replace(/[\s　]/g, "");
  const hit = (M.hotels || []).find(h => (!area || !h.area || h.area === area) && key(h.hotel_name) === key(name));
  const q2 = encodeURIComponent(((area || "").replace(/^出張（(.*)）$/, "$1").replace(/^出張$/, "") + " " + name).trim());
  if(!name){ el.innerHTML = ""; return; }
  el.innerHTML = hit
    ? `<div class="hbok">✅ ホテルリストにあります${hit.store_status === "ng" ? `<b style="color:#c0392b">（🚫 店としてNG）</b>` : hit.store_status === "far" ? "（△ 遠い）" : ""}　${hit.map_url ? `<a href="javascript:void 0" onclick="hbWin('${esc(hit.map_url)}')">🗺 地図を見る</a>` : `<a href="javascript:void 0" onclick="hbWin('https://www.google.com/maps/search/?api=1&query=${q2}')">🗺 Googleマップで調べる</a>`}</div>`
    : `<div class="newhotel">🆕 「<b>${esc(name)}</b>」は${area ? esc(area) + "の" : ""}ホテルリストにありません。
        <div style="margin:6px 0;display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="btn btn-ghost btn-sm" onclick="hbWin('https://www.google.com/search?q=${q2}')">🔍 Googleで調べる（小窓）</button>
          <button type="button" class="btn btn-ghost btn-sm" onclick="hbWin('https://www.google.com/maps/search/?api=1&query=${q2}')">🗺 Googleマップで調べる（小窓）</button></div>
        <div class="f"><label>地図のURL（Googleマップで「共有」→「リンクをコピー」して貼る）</label><input id="hb_map" placeholder="https://maps.app.goo.gl/…"></div>
        <label style="font-size:13px;font-weight:700"><input type="checkbox" id="hb_add" checked> 保存するときに、ホテルリストにも足す（とりあえず足しておく。OK・NGはあとで）</label></div>`;
}
async function hbSave(id){
  if(!KB.CAN_EDIT) return;
  const r = rows.find(x => x.id === id); if(!r) return;
  const name = $("hb_name").value.trim(), room = $("hb_room").value.trim().normalize("NFKC");
  const address = [name, room].filter(Boolean).join(" ");
  try{
    if($("hb_add") && $("hb_add").checked && name && r.area){
      const map = $("hb_map") ? $("hb_map").value.trim() : "";
      if(map && !/^https?:\/\//i.test(map)){ toast("地図のURLは https:// から始まるものを貼ってください"); return; }
      const row = { hotel_id: "h" + Date.now().toString(36), area: r.area, hotel_name: name, map_url: map, store_status: "", note: "記録簿の予約カードで追加（" + KB.operatorName() + "）" };
      q(await sb.from("prof_hotels").insert(row)); M.hotels.push(row);
    }
  }catch(e){ toast("ホテルリストに足せませんでした：" + (e.message || e)); }
  if(address === (r.address || "")){ $("hbBg").classList.remove("show"); return; }
  if(await pushLog(id, `🏨 ホテル・部屋 → ${address || "（なし）"}`, { address })){ $("hbBg").classList.remove("show"); toast("ホテル・部屋を保存しました"); renderList(); }
}
document.head.insertAdjacentHTML("beforeend", `<style>.rc-hotel{font-family:inherit;font-size:13px;font-weight:800;background:#F2F8FF;border:1.5px solid #9cc6ee;color:#1f5d99;border-radius:99px;padding:2px 10px;cursor:pointer}
  .hbinfo{background:#FFF8E8;border:1.5px solid #F2D49A;border-radius:12px;padding:8px 12px;font-size:13.5px} .hbinfo small{display:block;color:var(--sub);font-size:11.5px;margin-top:2px}
  .hbok{background:#EEF9F0;border:1.5px solid #9AD3A8;border-radius:12px;padding:8px 12px;margin-top:8px;font-size:13.5px;font-weight:700}</style>`);
/* ---------- リストにないホテル：店として／キャストとして OK・NG で足す（地図のURLも） ---------- */
let newHotelTimer = null;
function checkNewHotel(){ clearTimeout(newHotelTimer); newHotelTimer = setTimeout(paintNewHotel, 400); }
function hotelNameFromAddr(s){ return String(s || "").replace(/[\s　]*[0-9０-９]+[号室]*[\s　]*$/, "").trim(); }   // 「ホテル〇〇 302」→「ホテル〇〇」
function paintNewHotel(){
  const el = $("newHotelBox"); if(!el) return;
  const area = $("f_area").value.trim(), name = hotelNameFromAddr($("f_address").value);
  const kind = $("f_place") ? $("f_place").value : "";
  // 🏠 自宅：住所を Google で調べるボタンだけ（ホテルリストには足さない）
  if(kind === "home"){
    const addr = $("f_address").value.trim(), q3 = encodeURIComponent(((area || "").replace(/^出張（(.*)）$/, "$1").replace(/^出張$/, "") + " " + addr).trim());
    el.innerHTML = addr.length >= 2 ? `<div style="margin:4px 0;font-size:13px"><a href="https://www.google.com/maps/search/?api=1&query=${q3}" target="_blank" rel="noopener">🔍 この住所をGoogleマップで調べる</a>　<a href="https://www.google.com/search?q=${q3}" target="_blank" rel="noopener">🔍 Google検索</a></div>` : "";
    return;
  }
  if(!KB.CAN_EDIT || !name || name.length < 2){ el.innerHTML = ""; return; }
  const key = s=>String(s || "").replace(/[\s　]/g, "");
  // 同じエリアに、名前がぴったり同じホテルがあるときだけ「リストにある」（名前の一部が同じだけ・ほかのエリアのホテルは、新しいホテルとして聞く）
  const inArea = (M.hotels || []).filter(h=>!area || !h.area || h.area === area);
  const raw = key($("f_address").value);
  if(inArea.some(h=>key(h.hotel_name) === key(name) || (raw.startsWith(key(h.hotel_name)) && /^[0-9０-９号室]*$/.test(raw.slice(key(h.hotel_name).length))))){ el.innerHTML = ""; return; }
  const similar = inArea.filter(h=>key(h.hotel_name).includes(key(name)) || (key(h.hotel_name).length >= 3 && key(name).includes(key(h.hotel_name)))).map(h=>h.hotel_name).slice(0, 5);
  const c = M.casts.find(x=>x.id === $("f_cast").value);
  const q2 = encodeURIComponent((area || "") + " " + name);
  el.innerHTML = `<div class="newhotel">🆕 「<b>${esc(name)}</b>」は${area ? esc(area) + "の" : ""}ホテルリストにありません。リストに足しますか？
    ${similar.length ? `<div style="margin-top:4px;font-size:13px">似た名前：${similar.map(s=>`<b>${esc(s)}</b>`).join("、")}（同じホテルなら、その名前を選びなおせばOK。足さなくて大丈夫）</div>` : ""}
    <div class="row2" style="margin-top:6px">
      <div class="f"><label>ホテルの名前</label><input id="nh_name" value="${esc(name)}" maxlength="80"></div>
      <div class="f"><label>どう足す？</label><select id="nh_kind">
        <option value="">足さない</option><option value="store_ok">✅ 店としてOK</option><option value="store_ng">🚫 店としてNG</option><option value="store_far">△ 遠いから微妙</option><option value="none" selected>とりあえず足しておく（OK・NGはあとで決める）</option>
        ${c && c.prof_id ? `<option value="cast_ok">💗 ${esc(c.official_name || c.temp_name)}としてOK</option><option value="cast_ng">🙅 ${esc(c.official_name || c.temp_name)}としてNG</option>` : ""}</select></div>
    </div>
    <div class="f" style="margin-top:6px"><label>地図のURL　<a href="https://www.google.com/maps/search/?api=1&query=${q2}" target="_blank" rel="noopener">🔍 Googleマップで調べる</a>（開いたら「共有」→「リンクをコピー」して貼る）</label>
      <input id="nh_map" placeholder="https://maps.app.goo.gl/…"></div>
    <div style="text-align:right;margin-top:6px"><button type="button" class="btn btn-primary btn-sm" onclick="addHotelFromForm()">🏨 ホテルリストに足す</button></div></div>`;
}
async function addHotelFromForm(){
  const kind = $("nh_kind").value, name = $("nh_name").value.trim(), area = $("f_area").value.trim(), map = $("nh_map").value.trim();
  if(!kind){ toast("「どう足す？」を選んでください"); return; }
  if(!name){ toast("ホテルの名前を入れてください"); return; }
  if(!area){ toast("先にエリアを選んでください"); return; }
  if(map && !/^https?:\/\//i.test(map)){ toast("地図のURLは https:// から始まるものを貼ってください"); return; }
  const c = M.casts.find(x=>x.id === $("f_cast").value);
  const row = { hotel_id: "h" + Date.now().toString(36), area, hotel_name: name, map_url: map,
    store_status: kind === "store_ok" ? "ok" : kind === "store_ng" ? "ng" : kind === "store_far" ? "far" : "", note: "記録簿の受付で追加（" + KB.operatorName() + "）" };
  try{
    q(await sb.from("prof_hotels").insert(row));
    if((kind === "cast_ok" || kind === "cast_ng") && c && c.prof_id){
      q(await sb.rpc("kb_set_cast_hotel", { p_prof_id: c.prof_id, p_hotel_id: row.hotel_id, p_pref: kind === "cast_ok" ? "ok" : "ng" }));
    }
    M.hotels.push(row); $("newHotelBox").innerHTML = ""; paintAreaInfo(); recalc();
    toast("「" + name + "」をホテルリストに足しました");
  }catch(e){ toast("足せませんでした（SQL 108 は実行ずみ？）：" + (e.message || e)); }
}

/* ---------- 🚕 次回の交通費（お客さんごと）：電話番号で調べたら出して、交通費に入れる ---------- */
const __lookupCustomerT = lookupCustomer;
lookupCustomer = async function(keepName){
  await __lookupCustomerT(keepName);
  const c = curCustomer;
  if(c && c.next_transport != null){
    $("custInfo").insertAdjacentHTML("beforeend", `<div class="warn">🚕 このお客さんは<b>次回の交通費 ${yen(c.next_transport)}</b>${c.next_transport_note ? "（" + esc(c.next_transport_note) + "）" : ""}</div>`);
    if(!editing && !(+$("f_transport").value)){ $("f_transport").value = c.next_transport; recalc(); }
  }
};

/* ---------- 本日のキャスト一覧で、予約を開かずに直す（ホテル・部屋番号・場所の種類・店NG・次回の交通費） ---------- */
function placeCell(r){
  if(!KB.CAN_EDIT) return r.address ? `<br><small>${esc((PLACE[r.place_kind] ? PLACE[r.place_kind] + " " : "") + r.address)}</small>` : "";
  return `<div class="inl" onclick="event.stopPropagation()">
    <select onchange="inlineSave(${r.id},'place_kind',this.value)"><option value="">種類</option>${Object.keys(PLACE).map(k=>`<option value="${k}" ${r.place_kind === k ? "selected" : ""}>${PLACE[k]}</option>`).join("")}</select>
    <input value="${esc(r.address || "")}" placeholder="ホテル・部屋番号" onchange="inlineSave(${r.id},'address',this.value.trim())"></div>`;
}
async function inlineSave(id, field, v){
  const label = field === "address" ? "ホテル・部屋 → " + (v || "（なし）") : "場所の種類 → " + (PLACE[v] || "（なし）");
  if(await pushLog(id, label, { [field]: v })){ toast("保存しました"); renderList(); }
}
// 🏷 顧客タグ（顧客台帳の kb_customers.tags）を小さいバッジで。2026/11/6
function custTagsHtml(c){
  const t = (c && Array.isArray(c.tags)) ? c.tags : [];
  return t.length ? ` ${t.map(x => `<span class="ctag-b ${tagCls(x)}">${esc(x)}</span>`).join("")}` : "";
}
// 要確認はオレンジ・要注意人物／トビ／出禁は赤（顧客台帳と同じ）2026/11/7
function tagCls(t){ return /要確認/.test(t) ? "tg-chk" : /要注意|トビ|出禁|危険/.test(t) ? "tg-ng" : ""; }
// 🏷 受付のお客さんの欄：ついているタグ（要確認なら大きく）＋ 押してつける・外す（一覧は顧客台帳と同じ kb_settings 'cust_tags'）
let custTagEdit = false;
function custTagBox(c){
  const have = (c && c.tags) || [];
  const chk = have.some(x => /要確認/.test(x)) ? `<div class="warn" style="background:#FFF0E0;border-color:#E67E22;color:#8a4500;font-size:15px">🔎 <b>要確認のお客さんです：キャストに確認してから受けてください</b></div>` : "";
  const list = [...new Set([...(Array.isArray(M.set.cust_tags) ? M.set.cust_tags : []), ...have])];
  const ed = KB.CAN_EDIT && c && c.id;
  return chk + `<div class="ctags-in">🏷 ${have.length ? custTagsHtml(c) : `<small style="color:var(--sub);font-weight:700">タグなし</small>`}
    ${ed ? `<button type="button" class="btn btn-ghost btn-sm" style="margin-left:6px" onclick="custTagEdit=!custTagEdit;$('custTagBox').innerHTML=custTagBox(curCustomer)">${custTagEdit ? "閉じる" : "🏷 タグをつける"}</button>` : ""}</div>`
    + (ed && custTagEdit ? `<div style="display:flex;gap:5px;flex-wrap:wrap;margin:0 0 8px">${list.map((t, i) => `<button type="button" class="ctag-b ${have.includes(t) ? tagCls(t) : "off"}" style="cursor:pointer;font-size:13px;padding:2px 10px" onclick="toggleResTag(${i})">${have.includes(t) ? "✓ " : ""}${esc(t)}</button>`).join("")}
      <small style="color:var(--sub);align-self:center">（タグの一覧を足す・直す・消すのは顧客台帳で）</small></div>` : "");
}
async function toggleResTag(i){
  const c = curCustomer; if(!c || !KB.CAN_EDIT) return;
  const have = c.tags || [], list = [...new Set([...(Array.isArray(M.set.cust_tags) ? M.set.cust_tags : []), ...have])], t = list[i]; if(!t) return;
  const next = have.includes(t) ? have.filter(x => x !== t) : have.concat(t);
  try{ q(await sb.from("kb_customers").update({ tags: next, updated_by: KB.operatorName() }).eq("id", c.id)); c.tags = next; $("custTagBox").innerHTML = custTagBox(c); toast("🏷 タグを" + (have.includes(t) ? "外しました" : "つけました")); }
  catch(e){ toast("タグを保存できませんでした：" + (e.message || e)); }
}
(function(){ const s = document.createElement("style"); s.textContent = `.ctag-b{display:inline-block;background:#FFE3EC;border:1px solid #E9A3BA;color:#B0213F;border-radius:99px;padding:0 8px;margin:0 2px;font-size:11.5px;font-weight:800;line-height:1.6;vertical-align:middle}
  .ctags-in{margin:8px 0;font-weight:800;font-size:13px}.ctags-in .ctag-b{font-size:13px;padding:1px 10px} .ctag-b.tg-chk{background:#FF9F43;border-color:#E67E22;color:#fff} .ctag-b.tg-ng{background:#E0001B;border-color:#B0001B;color:#fff} .ctag-b.off{background:#fff;border-color:#ddd;color:#999}`; document.head.appendChild(s); })();
function custCell(r){
  const c = r.kb_customers || {};
  if(!r.customer_id || !KB.CAN_EDIT) return c.ng ? `<br><small style="color:#B0213F">⚠️ NG：${esc(c.ng_reason || "")}</small>` : "";
  return `<div class="inl" onclick="event.stopPropagation()">
    <button type="button" class="mini ${c.ng ? "ng" : ""}" onclick="custNg(${r.id})">${c.ng ? "⚠️ 店NG：" + esc(c.ng_reason || "理由なし") : "🚫 店NGにする"}</button>
    <button type="button" class="mini" onclick="custNextFee(${r.id})">🚕 次回の交通費${c.next_transport != null ? "：" + yen(c.next_transport) : ""}</button></div>`;
}
async function updCustomer(id, patch, msg){
  const r = rows.find(x=>x.id === id); if(!r || !r.customer_id) return;
  try{
    q(await sb.from("kb_customers").update(Object.assign({ updated_by: KB.operatorName() }, patch)).eq("id", r.customer_id));
    rows.filter(x=>x.customer_id === r.customer_id).forEach(x=>{ x.kb_customers = Object.assign({}, x.kb_customers || {}, patch); });
    await pushLog(id, msg); toast(msg); renderList();
  }catch(e){ toast("保存できませんでした（SQL 108 は実行ずみ？）：" + (e.message || e)); }
}
function custNg(id){
  const r = rows.find(x=>x.id === id), c = (r && r.kb_customers) || {};
  if(c.ng){
    const v = prompt("NGの理由を直す（空にして OK を押すと、NGを外します）", c.ng_reason || "");
    if(v === null) return;
    if(!v.trim()) updCustomer(id, { ng: false, ng_reason: "" }, "店NGを外した");
    else updCustomer(id, { ng_reason: v.trim() }, "NGの理由 → " + v.trim());
    return;
  }
  const v = prompt("このお客さんをNGにします。理由は？（例：キャストから「怖かった」と連絡）", "");
  if(v === null) return;
  updCustomer(id, { ng: true, ng_reason: v.trim() || "理由なし" }, "店NGにした：" + (v.trim() || "理由なし"));
}
function custNextFee(id){
  const r = rows.find(x=>x.id === id), c = (r && r.kb_customers) || {};
  const v = prompt("次にこのお客さんの予約を受けるときの交通費（円）。空にして OK で消します", c.next_transport != null ? c.next_transport : "");
  if(v === null) return;
  if(!String(v).trim()){ updCustomer(id, { next_transport: null, next_transport_note: "" }, "次回の交通費を消した"); return; }
  const n = Math.max(0, parseInt(String(v).replace(/[^\d]/g, ""), 10) || 0);
  const note = prompt("メモ（例：思ったより遠かった・タクシー代がかかった）", c.next_transport_note || "");
  if(note === null) return;
  updCustomer(id, { next_transport: n, next_transport_note: note.trim() }, "次回の交通費 → " + yen(n) + (note.trim() ? "（" + note.trim() + "）" : ""));
}

/* ---------- エリア：池袋・鶯谷・五反田・渋谷・錦糸町・出張 は、ホテルリストになくてもいつも出す ---------- */
areaList = function(){
  const rank = a=>{ const i = AREA_ORDER.findIndex(x=>String(a).includes(x)); return i < 0 ? 99 : i; };
  // 出張の行き先で足したホテル（エリアが「出張（新宿）」など）は、エリアの一覧では「出張」1つにまとめる
  const fromHotels = __areaList().map(a => tripDest(a) != null ? AREA_TRIP : a);
  const all = AREA_ORDER.filter(a=>!fromHotels.some(h=>String(h).includes(a))).concat(fromHotels, [AREA_TRIP]);
  return [...new Set(all)].sort((a, b)=>rank(a) - rank(b) || String(a).localeCompare(String(b), "ja"));
};

/* ---------- 移動中の札：［今いる場所の入力］→ ※移動中※ ---------- */
movingHtml = function(x){
  if(!x.c || !movingRes(x.c.id)) return "";
  const cd = x.cd || {}, now = cd.move_now || cd.move_from || "";
  return `<div class="movebox">${KB.CAN_EDIT
      ? `<input class="movenow" value="${esc(now)}" placeholder="今いる場所（例：池袋駅）" onchange="saveDayPart('${x.c.id}',{ move_now: this.value.trim() })">`
      : `📍${esc(now || "？")}`} → <b>※移動中※</b></div>`;
};

/* ---------- 🚕 次回の交通費：金額とメモを1つの小窓で ---------- */
let feeFor = null;
custNextFee = function(id){
  const r = rows.find(x=>x.id === id), c = (r && r.kb_customers) || {};
  if(!r || !r.customer_id) return;
  feeFor = id;
  $("feeTitle").textContent = "🚕 次回の交通費：" + (c.name || "お客さん") + (c.phone ? "（" + c.phone + "）" : "");
  $("fee_amt").value = c.next_transport != null ? c.next_transport : "";
  $("fee_note").value = c.next_transport_note || "";
  $("feeBg").classList.add("show");
  setTimeout(()=>$("fee_amt").focus(), 50);
};
function saveNextFee(clear){
  const id = feeFor; if(!id) return;
  $("feeBg").classList.remove("show");
  if(clear || !String($("fee_amt").value).trim()){ updCustomer(id, { next_transport: null, next_transport_note: "" }, "次回の交通費を消した"); return; }
  const n = Math.max(0, parseInt(String($("fee_amt").value).replace(/[^\d]/g, ""), 10) || 0), note = $("fee_note").value.trim();
  updCustomer(id, { next_transport: n, next_transport_note: note }, "次回の交通費 → " + yen(n) + (note ? "（" + note + "）" : ""));
}
KB.closeOnBackdrop($("feeBg"), ()=>$("feeBg").classList.remove("show"));
// 一覧のボタンに、金額とメモも出す
const __custCell = custCell;
custCell = function(r){
  const c = r.kb_customers || {};
  let h = __custCell(r);
  if(c.next_transport != null && c.next_transport_note) h = h.replace(/(🚕 次回の交通費：[^<]*)<\/button>/, `$1<small>（${esc(c.next_transport_note)}）</small></button>`);
  return h;
};
// 予約の画面：交通費の欄のそばにも出す（電話番号で調べたお客さんに「次回の交通費」があるとき）
function paintNextFee(){
  const c = curCustomer, el = $("nextFeeInfo"); if(!el) return;
  el.innerHTML = c && c.next_transport != null ? `<div class="warn">🚕 このお客さんの<b>次回の交通費 ${yen(c.next_transport)}</b>${c.next_transport_note ? "（" + esc(c.next_transport_note) + "）" : ""}</div>` : "";
}
const __lookupCustomerN = lookupCustomer;
lookupCustomer = async function(keepName){ await __lookupCustomerN(keepName); paintNextFee(); };
const __openFormN = openForm;
openForm = function(id){ __openFormN(id); paintNextFee(); };

/* ============================================================
   📍 お客さんの利用場所（kb_customer_places）：場所ごとに「次回の交通費」
   ・電話番号で調べる → 過去の場所が一覧で出る → 押すとエリア・ホテル/住所・種類・地図・交通費が入る（＋新しい場所）
   ・同じ場所を使うときだけ「この場所は次回 ○円（理由）」と案内して、交通費に入れる
   ・予約を保存すると、その場所を自動で覚える
   ============================================================ */
let custPlaces = [];      // 受付中のお客さんの場所
let placesByCust = {};    // 一覧用：customer_id → 場所
const pkey = s=>String(s || "").replace(/[\s　]/g, "");
function samePlace(p, area, addr){ return pkey(p.area) === pkey(area) && pkey(p.address) === pkey(addr); }

async function loadPlacesFor(ids){
  ids = [...new Set(ids.filter(Boolean))];
  if(!ids.length) return [];
  try{ return q(await sb.from("kb_customer_places").select("*").in("customer_id", ids).order("last_used", { ascending: false, nullsFirst: false })) || []; }
  catch(e){ return []; }
}
// 一覧のために、その日のお客さんの場所を読む
const __loadDayP = loadDay;
loadDay = async function(){
  await __loadDayP();
  const list = await loadPlacesFor(rows.map(r=>r.customer_id));
  placesByCust = {}; list.forEach(p=>{ (placesByCust[p.customer_id] = placesByCust[p.customer_id] || []).push(p); });
  renderList();
};

// 受付：電話番号で調べたら、過去の場所を出す
const __lookupCustomerP = lookupCustomer;
lookupCustomer = async function(keepName){
  await __lookupCustomerP(keepName);
  custPlaces = curCustomer && curCustomer.id ? await loadPlacesFor([curCustomer.id]) : [];
  renderPlacePick(); paintNextFee();
};
const __openFormPP = openForm;
openForm = function(id){
  custPlaces = [];
  __openFormPP(id);
  if($("f_map")) $("f_map").value = "";
  renderPlacePick();
};
function placeLabel(p){ return [p.area, (PLACE[p.place_kind] ? "（" + PLACE[p.place_kind] + "）" : "") + (p.address || "")].filter(Boolean).join(" "); }
function renderPlacePick(){
  const el = $("placePick"); if(!el) return;
  if(!custPlaces.length){ el.innerHTML = ""; return; }
  const area = $("f_area").value, addr = $("f_address").value;
  el.innerHTML = `<div class="placepick"><div style="font-weight:800;font-size:13.5px;margin-bottom:4px">📍 このお客さんの過去の場所（押すと入ります）</div>
    ${custPlaces.map((p, i)=>`<button type="button" class="pp ${samePlace(p, area, addr) ? "on" : ""}" onclick="pickPlace(${i})">${esc(placeLabel(p) || "（場所なし）")}
      ${p.next_transport != null ? `<b class="fee">🚕 次回 ${yen(p.next_transport)}</b>` : ""}<small>${p.last_used ? String(p.last_used).slice(5).replace("-", "/") + "・" : ""}${p.use_count || 0}回</small></button>`).join("")}
    <button type="button" class="pp new" onclick="pickPlace(-1)">＋ 新しい場所</button></div>`;
}
function pickPlace(i){
  if(i < 0){ fillAreaSel(""); $("f_address").value = ""; if($("f_place")) $("f_place").value = ""; if($("f_map")) $("f_map").value = ""; $("f_transport").value = 0; }
  else{
    const p = custPlaces[i];
    fillAreaSel(p.area || ""); $("f_address").value = p.address || "";
    if($("f_place")) $("f_place").value = p.place_kind || "";
    if($("f_map")) $("f_map").value = p.map_url || "";
    if(p.next_transport != null) $("f_transport").value = p.next_transport;
  }
  renderPlacePick(); paintNextFee(); checkNewHotel(); recalc();
}
// 「同じ場所なら次回 ○円」の案内（場所が決まっていなければ、お客さん全体の次回の交通費を出す）
paintNextFee = function(){
  const el = $("nextFeeInfo"); if(!el) return;
  const area = $("f_area") ? $("f_area").value : "", addr = $("f_address") ? $("f_address").value : "";
  const p = custPlaces.find(x=>x.next_transport != null && samePlace(x, area, addr));
  const c = curCustomer;
  if(p) el.innerHTML = `<div class="warn">🚕 この場所（${esc(placeLabel(p))}）は<b>次回の交通費 ${yen(p.next_transport)}</b>${p.next_note ? "：" + esc(p.next_note) : ""}</div>`;
  else if(c && c.next_transport != null) el.innerHTML = `<div class="warn">🚕 このお客さんの次回の交通費 ${yen(c.next_transport)}${c.next_transport_note ? "（" + esc(c.next_transport_note) + "）" : ""}　※場所は決まっていません</div>`;
  else el.innerHTML = "";
};
// 場所を打ちかえたら、案内も出しなおす
const __recalcP = recalc;
recalc = function(){ const o = __recalcP.apply(this, arguments); if(custPlaces.length){ paintNextFee(); renderPlacePickLite(); } return o; };
function renderPlacePickLite(){ document.querySelectorAll("#placePick .pp").forEach((b, i)=>{ const p = custPlaces[i]; if(p) b.classList.toggle("on", samePlace(p, $("f_area").value, $("f_address").value)); }); }
// キャストへの連絡の地図：地図のURLが入っていればそれ
const __hotelMapUrl = hotelMapUrl;
hotelMapUrl = function(){ const m = $("f_map") ? $("f_map").value.trim() : ""; return /^https?:\/\//i.test(m) ? m : __hotelMapUrl(); };

// 予約を保存したら、その場所をお客さんの場所として覚える
const __saveResP = saveRes;
saveRes = async function(){
  const phone = phoneNorm($("f_phone").value), area = $("f_area").value.trim(), address = $("f_address").value.trim();
  const kind = $("f_place") ? $("f_place").value : "", map = $("f_map") ? $("f_map").value.trim() : "", st = $("f_status").value;
  await __saveResP();
  if($("formBg").classList.contains("show")) return;   // 保存できなかった
  if(!phone || (!area && !address) || ["cancel", "tobi", "flowed"].includes(st)) return;
  try{
    const cu = await custByPhone(phone, "id");
    if(!cu) return;
    const ex = q(await sb.from("kb_customer_places").select("*").eq("customer_id", cu.id).eq("area", area).eq("address", address).maybeSingle());
    if(ex) q(await sb.from("kb_customer_places").update({ place_kind: kind || ex.place_kind, map_url: map || ex.map_url, use_count: (ex.use_count || 0) + (editing ? 0 : 1), last_used: day, updated_at: new Date().toISOString(), updated_by: KB.operatorName() }).eq("id", ex.id));
    else q(await sb.from("kb_customer_places").insert({ customer_id: cu.id, area, address, place_kind: kind, map_url: map, use_count: 1, last_used: day, updated_by: KB.operatorName() }));
  }catch(e){ /* SQL 109 の前は何もしない */ }
};

/* ---------- 一覧の「🚕 次回の交通費」：その予約の場所に入れる ---------- */
function placeOf(r){ return (placesByCust[r.customer_id] || []).find(p=>samePlace(p, r.area, r.address)); }
custCell = function(r){
  const c = r.kb_customers || {};
  if(!r.customer_id || !KB.CAN_EDIT) return c.ng ? `<br><small style="color:#B0213F">⚠️ NG：${esc(c.ng_reason || "")}</small>` : "";
  const p = placeOf(r);
  return `<div class="inl" onclick="event.stopPropagation()">
    <button type="button" class="mini ${c.ng ? "ng" : ""}" onclick="custNg(${r.id})">${c.ng ? "⚠️ 店NG：" + esc(c.ng_reason || "理由なし") : "🚫 店NGにする"}</button>
    <button type="button" class="mini" onclick="custNextFee(${r.id})">🚕 この場所の次回の交通費${p && p.next_transport != null ? "：" + yen(p.next_transport) + (p.next_note ? "<small>（" + esc(p.next_note) + "）</small>" : "") : ""}</button></div>`;
};
custNextFee = function(id){
  const r = rows.find(x=>x.id === id); if(!r || !r.customer_id) return;
  if(!r.area && !r.address){ toast("この予約は場所（エリア・ホテル）が入っていません。先に場所を入れてください"); return; }
  const p = placeOf(r) || {}, c = r.kb_customers || {};
  feeFor = id;
  $("feeTitle").textContent = "🚕 次回の交通費：" + (c.name || "お客さん") + "／" + placeLabel({ area: r.area, address: r.address, place_kind: r.place_kind });
  $("fee_amt").value = p.next_transport != null ? p.next_transport : "";
  $("fee_note").value = p.next_note || "";
  $("feeBg").classList.add("show");
  setTimeout(()=>$("fee_amt").focus(), 50);
};
saveNextFee = async function(clear){
  const id = feeFor, r = rows.find(x=>x.id === id); if(!r) return;
  $("feeBg").classList.remove("show");
  const n = clear || !String($("fee_amt").value).trim() ? null : Math.max(0, parseInt(String($("fee_amt").value).replace(/[^\d]/g, ""), 10) || 0);
  const note = n == null ? "" : $("fee_note").value.trim();
  const area = r.area || "", address = r.address || "";
  try{
    const ex = placeOf(r);
    if(ex) q(await sb.from("kb_customer_places").update({ next_transport: n, next_note: note, updated_at: new Date().toISOString(), updated_by: KB.operatorName() }).eq("id", ex.id));
    else q(await sb.from("kb_customer_places").insert({ customer_id: r.customer_id, area, address, place_kind: r.place_kind || "", next_transport: n, next_note: note, use_count: 1, last_used: r.biz_date, updated_by: KB.operatorName() }));
    const list = await loadPlacesFor([r.customer_id]); placesByCust[r.customer_id] = list;
    await pushLog(id, n == null ? "この場所の次回の交通費を消した" : "この場所の次回の交通費 → " + yen(n) + (note ? "（" + note + "）" : ""));
    toast(n == null ? "消しました" : "保存しました"); renderList();
  }catch(e){ toast("保存できませんでした（SQL 109 は実行ずみ？）：" + (e.message || e)); }
};

/* ============================================================
   2026/10/20：本日のキャスト一覧の予約を「カード」に。開かずにその場で直せる
   ・開始時刻・コース・延長・支払い・カードの進み具合・場所・お客さん・状態・キャストに伝えた・備考
   ・料金が変わるもの（時刻・コース・延長・支払い）は、裏で予約を開いて計算しなおして保存（足りないことがあれば予約が開く）
   ・カードで「URL未送信」のときは、決済の管理画面のURLを出す
   ・備考は1つずつ四角い枠で（右下に だれ・いつ）。決まった高さでスクロール
   ============================================================ */
const PAY_ADMIN_URL = "https://pay-admin.star-pay.jp/sms/sms_input.php";   // お客さんにSMSで決済URLを送る画面（2026/11/5）
const PAY_LABEL = { cash: "現金", card: "カード（×1.15）", card_paid: "カード済み" };

// 料金が変わるものを、裏で予約を開いて直して保存する
let quickBusy = false;
async function quickEdit(id, apply, msg){
  if(!KB.CAN_EDIT || quickBusy) return;
  quickBusy = true;
  const bg = $("formBg");
  bg.classList.add("silent");
  try{
    openForm(id);
    apply();
    recalc();
    await saveRes();
    if(bg.classList.contains("show")){ bg.classList.remove("silent"); }   // 足りないところがある → 予約を開いて、何が足りないか（受付の知らせ）を見せる
    else if(msg) toast(msg);
  }catch(e){ bg.classList.remove("silent"); toast("保存できませんでした：" + (e.message || e)); }
  finally{ bg.classList.remove("silent"); quickBusy = false; }
}
function qStart(id, v){ quickEdit(id, ()=>{ $("f_start").value = v; }, "開始時刻 → " + v); }
function qCourse(id, v){ quickEdit(id, ()=>{ $("f_course").value = v; }, "コース → " + v); }
function qExt(id, v){ quickEdit(id, ()=>{ $("f_ext").value = Math.max(0, +v || 0); }, "延長 → " + (+v || 0) + "回"); }
function qPay(id, v){ quickEdit(id, ()=>{ setPay(v); }, "支払い → " + (PAY_LABEL[v] || v)); }

/* ---------- 🏦 振込（SQL 173）。キャンセル料・もらい忘れを、あとで振り込んでもらう。振込待ち → 社長の確認待ち → 振込処理完了 ----------
   ・振込の額は、カードと同じで「キャストの手元にないお金」（精算の投函額から引く）
   ・振込処理完了にしたら、キャストにお釣り（未精算）を自動で作る：キャストバック ＋（振込を引く前に、もう精算済にしていた予約なら）振込の額 */
const TR_ST = [["", "なし"], ["wait", "振込待ち"], ["owner", "社長の確認待ち"], ["done", "✅ 振込処理完了"]];
// 状態のプルダウンの中身：ふつうの状態 ＋ 下に「🏦 振込」（選ぶと状態はそのままで、振込だけ変わる）
function stOpts(r, keys){
  const st = r.transfer_status || "", has = "transfer_status" in r;   // SQL 173 がまだなら振込は出さない
  const trL = st ? "・🏦" + ((TR_ST.find(x=>x[0] === st) || [])[1] || "").replace("✅ ", "") : "";
  return (keys || statusKeys(r.status)).map(k=>`<option value="${k}" ${k === r.status ? "selected" : ""}>${STATUS[k]}${k === r.status ? trL : ""}</option>`).join("")
    + (has ? `<optgroup label="🏦 振込（キャンセル料・もらい忘れ）">${TR_ST.filter(([k])=>k || st).map(([k, l])=>`<option value="tr:${k}">${k === st ? "✔ " : "　"}🏦 ${k ? l : "振込なしにもどす"}</option>`).join("")}</optgroup>` : "");
}
function trRow(r, ed){   // 振込にしたときだけ、カードの行の下に「額・キャストバック」の行
  if(!("transfer_status" in r)) return "";
  const st = r.transfer_status || "";
  if(!st) return "";
  const lock = !ed || st === "done";
  return `<div class="rc-tr">🏦 振込（${(TR_ST.find(x=>x[0] === st) || [])[1] || ""}）
    <span>額 ${lock ? `<b>${yen(r.transfer_amount)}</b>` : `<input type="number" min="0" class="rc-num" style="width:84px" value="${r.transfer_amount || ""}" placeholder="振込の額" onchange="trSet(${r.id},'transfer_amount',this.value)">`}</span>
    <span>キャストバック ${lock ? `<b>${yen(r.transfer_back)}</b>` : `<input type="number" min="0" class="rc-num" style="width:84px" value="${r.transfer_back || ""}" placeholder="0" onchange="trSet(${r.id},'transfer_back',this.value)">`}</span>
    ${!lock && ["cancel", "tobi", "flowed"].includes(r.status) ? `<small style="font-weight:700;color:#777">額を入れるとバックは自動（通常料金 ${yen(r.total)} 全額→通常バック ${yen(backOf(r))}／減額→半額）</small>` : ""}</div>`;
}
// キャンセル料のキャストバック：通常料金を全額 → 通常バック／減額 → 通常バックの半額／0円 → なし。もらい忘れ（キャンセルでない）は、もとの予約にバックが入っているので 0
function trAutoBack(r, amt){
  if(!["cancel", "tobi", "flowed"].includes(r.status) || !(amt > 0)) return 0;
  let b = Number(backOf(r)) || 0;
  if(!b){   // 予約にバックが入っていない（キャンセルのまま保存など）→ バック表（ランク×コース）から
    const cast = M.casts.find(x=>x.id === r.cast_id), g = storeGroup(r.store_key);
    const rank = cast && ((r.free_kind === "special_free" || r.free_kind === "event_free") ? ranksOn(cast).event : ranksOn(cast)[g]);
    const key = (r.course || "") + (r.free_kind ? (FREE_SUFFIX[r.free_kind] || "") : (r.visit_kind === "honshi" ? "本指" : ""));
    if(rank) b = Number(M.back[rank + "|" + key]) || 0;
  }
  return amt >= (Number(r.total) || 0) ? b : Math.floor(b / 2);
}
async function trSet(id, k, v){
  const n = Math.max(0, Number(v) || 0), r = rows.find(x=>x.id === id);
  const patch = { [k]: n };
  let msg = `🏦 振込の${k === "transfer_amount" ? "額" : "キャストバック"} → ${yen(n)}`;
  if(k === "transfer_amount" && r){ patch.transfer_back = trAutoBack(r, n); msg += `（キャストバック 自動 ${yen(patch.transfer_back)}）`; }
  if(await pushLog(id, msg, patch)) renderList();
}
async function trStatus(id, st){
  const r = rows.find(x=>x.id === id); if(!r) return;
  const prev = r.transfer_status || "", label = (TR_ST.find(x=>x[0] === st) || [])[1] || st;
  try{
    if(st === "done"){
      if(!Number(r.transfer_amount)){ toast("先に振込の額を入れてください"); renderList(); return; }
      const live = !["cancel", "tobi", "flowed"].includes(r.status);
      if(!live && !Number(r.transfer_back)){   // キャンセル料のバックが0のまま → 完了の前にもう一度自動で入れる
        const b = trAutoBack(r, Number(r.transfer_amount));
        if(b){ q(await sb.from("kb_reservations").update({ transfer_back: b }).eq("id", r.id)); r.transfer_back = b; }
      }
      let cd = {};
      if(r.cast_id){ const x = await sb.from("kb_cast_days").select("settled,settle_snapshot,settle_log").eq("biz_date", r.biz_date).eq("cast_id", r.cast_id).maybeSingle(); cd = x.data || {}; }
      // 振込を引く前に精算済にしていた（もらい忘れが精算のあとでわかった）→ キャストは多く払っているので、振込の額を返す
      const settledWithout = live && cd.settled && !(((cd.settle_snapshot || {}).trIds) || []).includes(r.id);
      const refund = (Number(r.transfer_back) || 0) + (settledWithout ? Number(r.transfer_amount) : 0);
      const why = [r.transfer_back ? "キャストバック " + yen(r.transfer_back) : "", settledWithout ? "精算済のあとの振込 " + yen(r.transfer_amount) : ""].filter(Boolean).join("＋");
      if(!confirm(`振込処理完了にしますか？（振込 ${yen(r.transfer_amount)}）` + (refund && r.cast_id ? `\n${castName(r.cast_id)} にお釣り ${yen(refund)}（${why}）を未精算に入れます` : ""))){ renderList(); return; }
      let uid = null;
      if(refund && r.cast_id){
        const note = `🏦 振込（${Number(r.biz_date.slice(5, 7))}/${Number(r.biz_date.slice(8))} ${hm(r.start_at)}の予約・${live ? "もらい忘れ" : "キャンセル料"}）のお釣り：${why}`;
        uid = q(await sb.from("kb_unsettled").insert({ cast_id: r.cast_id, biz_date: r.biz_date, amount: -refund, note, source: "manual", created_by: KB.operatorName() }).select("id").single()).id;
        const l = (Array.isArray(cd.settle_log) ? cd.settle_log : []).concat([{ at: new Date().toISOString(), by: KB.operatorName(), kind: "uns", amount: -refund, text: note }]);
        try{ q(await sb.from("kb_cast_days").upsert({ biz_date: r.biz_date, cast_id: r.cast_id, settle_log: l, updated_by: KB.operatorName(), updated_at: new Date().toISOString() }, { onConflict: "biz_date,cast_id" })); }catch(e){}
      }
      await pushLog(id, `🏦 振込 → ${label}（${yen(r.transfer_amount)}）` + (uid ? `／${castName(r.cast_id)} にお釣り ${yen(refund)} を未精算に` : ""), { transfer_status: "done", transfer_uns_id: uid });
    } else {
      // 振込処理完了をもどす → 自動で入れたお釣りも消す（もう精算していたら、もどせない）
      if(prev === "done" && r.transfer_uns_id){
        const u = q(await sb.from("kb_unsettled").select("id,done_on").eq("id", r.transfer_uns_id).maybeSingle());
        if(u && u.done_on){ toast("このお釣りは、もう " + u.done_on + " に精算済みです。先にその精算をもどしてください"); renderList(); return; }
        if(u){
          q(await sb.from("kb_unsettled").delete().eq("id", r.transfer_uns_id));
          if(r.cast_id){   // 精算の履歴にも「取り消した」を残す
            try{
              const cd = (await sb.from("kb_cast_days").select("settle_log").eq("biz_date", r.biz_date).eq("cast_id", r.cast_id).maybeSingle()).data || {};
              const l = (Array.isArray(cd.settle_log) ? cd.settle_log : []).concat([{ at: new Date().toISOString(), by: KB.operatorName(), kind: "memo", text: `🗑 ${hm(r.start_at)}の予約の振込を「${label}」にもどしたので、振込のお釣り（未精算）を取り消し` }]);
              q(await sb.from("kb_cast_days").upsert({ biz_date: r.biz_date, cast_id: r.cast_id, settle_log: l, updated_by: KB.operatorName(), updated_at: new Date().toISOString() }, { onConflict: "biz_date,cast_id" }));
            }catch(e){}
          }
        }
      }
      // はじめて振込にしたキャンセル：通常料金を全額もらう前提で、額と通常バックを入れておく（減額したら額を直すとバックも半額に）
      const first = !prev && st && ["cancel", "tobi", "flowed"].includes(r.status) && !Number(r.transfer_amount);
      const fill = first ? { transfer_amount: Number(r.total) || 0, transfer_back: trAutoBack(r, Number(r.total) || 0) } : {};
      await pushLog(id, `🏦 振込 → ${label}` + (first ? `（額 ${yen(fill.transfer_amount)}・キャストバック ${yen(fill.transfer_back)}）` : ""), Object.assign({ transfer_status: st, transfer_uns_id: null }, fill, st ? {} : { transfer_amount: 0, transfer_back: 0 }));
    }
  }catch(e){ toast("保存できませんでした：" + (e.message || e)); }
  renderList();
}

function memoBoxes(r){
  const logs = logOf(r).slice().reverse();
  return `<div class="bikobox">${logs.length ? logs.map(l=>`<div class="bk1"><div class="t">${esc(l.text)}</div><div class="s">${esc(l.by || "")} ${esc(whenShort(l.at))}</div></div>`).join("")
      : `<div class="none">まだ備考はありません（受付：${esc(r.created_by || "")} ${whenShort(r.created_at)}）</div>`}</div>
    ${KB.CAN_EDIT ? `<button type="button" class="addbiko" onclick="event.stopPropagation();addLogPrompt(${r.id})">＋ 備考を書く</button>` : ""}`;
}
function resCard(r, i){
  const c = r.kb_customers || {}, ed = KB.CAN_EDIT, cx = ["cancel", "tobi", "flowed"].includes(r.status);
  // キャストの枠の中の何番目の予約か：予約①〜⑥（色も6色。7件目からは色をくり返す）2026/11/4
  const no = Number.isInteger(i) ? i : null, noTxt = no == null ? "" : "予約" + ("①②③④⑤⑥⑦⑧⑨⑩"[no] || "(" + (no + 1) + ")");
  const prices = M.prices.filter(p=>p.store_key === r.store_key);
  const stSel = ed
    ? `<select class="stsel st ${r.status}" onchange="quickStatus(${r.id},this.value)">${stOpts(r)}</select>`
    : `<span class="st ${r.status}">${STATUS[r.status] || r.status}</span>`;
  const told = r.cast_notified_at   // 押すと「キャストまだ」⇔「キャストOK」（伝えたか）
    ? `<button class="told on" onclick="toggleNotified(${r.id})" title="${esc(r.cast_notified_by || "")} ${whenShort(r.cast_notified_at)}に伝えた。押すと取り消し">✅ キャストOK</button>`
    : `<button class="told" onclick="toggleNotified(${r.id})" title="キャストに伝えたら押す">⚠️ キャストまだ</button>`;
  const ops = (r.options || []).filter(o=>!["af", "gyakuaf"].includes(o.code)).map(o=>o.label + (o.qty > 1 ? "×" + o.qty : "")).join("・");
  const afw = [r.af_wish === "yes" ? "AF" : "", r.rev_af_wish === "yes" ? "逆AF" : ""].filter(Boolean).join("・");
  const cardStep = r.payment !== "cash" || isSplitPay(r) ? cardSel(r).replace(/^<br>/, "") : "";
  const payUrl = (r.payment === "card" || isSplitPay(r)) && (r.card_step || "unsent") === "unsent" ? `<a class="payurl" href="${PAY_ADMIN_URL}" target="_blank" rel="noopener" title="${esc(PAY_ADMIN_URL)}">💳 決済URL</a>` : "";
  // 1〜2行に：時間・お店・状態・場所・コース・総額（支払い）・電話・カードの状態・伝えた。ほかは「くわしく」にたたむ
  const nLog = logOf(r).length;
  // 閉じていても、備考を「キャストOK」の右に出す（新しい順に2つまで。登録時の状態など自動のログも出す）
  const lastLogs = logOf(r).filter(x => x.text && String(x.text).trim()).slice(-2).reverse();
  const memoInline = lastLogs.length ? `<div class="rc-memo" title="${esc(lastLogs.map(l => String(l.text).trim() + "（" + (l.by || "") + " " + whenShort(l.at) + "）").join("\n"))}">📝 ${lastLogs.map(l => esc(String(l.text).trim())).join("<i>／</i>")}</div>` : "";
  const mates = partyMates(r);
  return `<div class="rescard ${cx ? "cx" : ""} ${no == null ? "" : "rcs rs-" + r.status}" id="rc-${r.id}">   <!-- ①〜⑥の色は、予約の状態の色（2026/11/5） -->
    <div class="rc-top">
      ${noTxt ? `<span class="rc-no st ${r.status}">${noTxt}</span>` : ""}
      <span class="stbox">${stSel}${statusAtChip(r, ed)}</span>
      <small class="rc-lbl">開始</small>${ed ? `<input type="time" class="rc-time" value="${hmIn(r.start_at)}" step="300" onchange="qStart(${r.id},this.value)">` : `<b class="rc-time">${hm(r.start_at)}</b>`}<span class="rc-end">〜${hm(r.end_at)}</span>
      ${r.phone_draft ? `<span class="rc-draft" title="スマホで仮入力。PCで開いて確かめると取り入れます">📱仮入力</span>` : ""}${r.dummy_name ? `<span class="rc-store">🎭${esc(r.dummy_name)}</span>` : ""}
      <span class="rc-k">📍<b>${esc(r.area || "エリアなし")}</b></span>
      ${ed ? `<button type="button" class="rc-hotel" onclick="openHotelBox(${r.id})" title="ホテル名・部屋番号・地図（開かずに入れられる）">🏨 ${esc(r.address || "ホテル・部屋を入れる")}</button>` : r.address ? `<span class="rc-k">🏨 ${esc(r.address)}</span>` : ""}${r.address ? `<button type="button" class="rc-hcopy" title="ホテル名と部屋番号をコピー" onclick="rcCopyAddr(${r.id})">📋</button>` : ""}
      <span class="rc-k">${esc(r.course || "")}${/^\d+$/.test(r.course || "") ? "分" : ""}${r.extension_count ? "＋延長" + r.extension_count : ""}</span>
      <span class="rc-k">総額 <b class="rc-yen">${yen(r.total)}</b><small>（${r.payment === "cash" && Number(r.card_total) > 0 ? "現金＋カード " + yen(Number(r.card_total)) : esc(PAY_LABEL[r.payment] || "")}）</small></span>
      <span class="rc-k">👤<b>${c.ng ? "⚠️" : ""}${esc(c.name || "名前なし")}</b>${custTagsHtml(c)}${digits(c.phone || "").length >= 6 ? ` <span class="tel">📞${esc(c.phone)}</span>` : ` <span class="rc-nophone">📞番号まだ</span>`}</span>
      ${told}

      ${mates.map(m => `<button type="button" class="rc-mate" onclick="rcJump(${m.id})">👥 ${esc(castName(m.cast_id))}の予約へ</button>`).join("")}
      ${(r.todos || []).filter(x => !x.done_at).map(x => `<button type="button" class="told rc-todo" onclick="event.stopPropagation();toggleTodo(${r.id},${(r.todos || []).indexOf(x)})">⏳ ${esc(x.text)}</button>`).join("")}
      <span style="flex:1"></span>
      <button type="button" class="rc-open" onclick="openForm(${r.id})">✏️ 開く</button>
    </div>
    ${memoInline}
    ${cardStep || payUrl ? `<div class="rc-2">${cardStep}${payUrl}</div>` : ""}
    ${trRow(r, ed)}
    ${r.dress && dressText(r.dress) ? `<div class="rc-dress">👗 ${esc(dressText(r.dress))}</div>` : ""}
    <details class="rc-more" ${rcOpen.has(r.id) || rcAllOpen() ? "open" : ""} ontoggle="rcToggle(${r.id},this.open)"><summary>くわしく（お客さん・場所・OP・備考${nLog ? " " + nLog + "件" : ""}）</summary>
    <div class="rc-grid">
      <div class="rc-box"><div class="rc-h">💴 コース・料金</div>
        <div class="rc-row">${ed ? `<select onchange="qCourse(${r.id},this.value)">${prices.map(p=>`<option value="${esc(p.course)}" ${p.course === r.course ? "selected" : ""}>${esc(p.course)}${/^\d+$/.test(p.course) ? "分" : ""}</option>`).join("")}${prices.some(p=>p.course === r.course) ? "" : `<option selected>${esc(r.course || "")}</option>`}</select>` : esc(r.course)}
          延長 ${ed ? `<input type="number" min="0" class="rc-num" value="${r.extension_count || 0}" onchange="qExt(${r.id},this.value)">` : (r.extension_count || 0)}回
          ${r.free_kind ? `<small>${esc(FREE_SUFFIX[r.free_kind] || "")}</small>` : ""}</div>
        <div class="rc-row"><small>OP：${esc(ops || "なし")}${afw ? "　希望：" + esc(afw) : ""}${r.cast_note ? "　📝 " + esc(r.cast_note) : ""}</small> ${ed ? `<button type="button" class="mini" onclick="openForm(${r.id})">OPを直す</button>` : ""}</div>
        <div class="rc-row">支払い ${ed ? `<select onchange="qPay(${r.id},this.value)">${["cash", "card"].map(k=>`<option value="${k}" ${k === (r.payment === "card_paid" ? "card" : r.payment) ? "selected" : ""}>${PAY_LABEL[k]}</option>`).join("")}</select>` : esc(PAY_LABEL[r.payment] || "")}</div>
      </div>
      <div class="rc-box"><div class="rc-h">👤 お客さん</div>
        <div class="rc-row"><b>${c.ng ? "⚠️" : ""}${esc(c.name || "（名前なし）")}</b> <small>${(VISIT.find(v=>v[0] === r.visit_kind) || [])[1] || ""}</small></div>
        ${c.phone ? `<div class="rc-row"><span class="tel">📞 ${esc(c.phone)}</span></div>` : ""}
        ${custCell(r)}
      </div>
      <div class="rc-box"><div class="rc-h">🏨 場所</div>
        <div class="rc-row"><b>${esc(r.area || "（エリアなし）")}</b></div>
        ${placeCell(r)}
        ${todosHtml(r)}
      </div>
      <div class="rc-box"><div class="rc-h">🧾 料金の内訳・報酬</div>${rcMoneyRows(r)}</div>
      <div class="rc-box rc-biko"><div class="rc-h">📝 備考</div>${memoBoxes(r)}</div>
    </div></details>
  </div>`;
}
const rcOpen = new Set();   // 「くわしく」を開いている予約（描きなおしても開いたまま）
function rcToggle(id, on){ if(on) rcOpen.add(id); else rcOpen.delete(id); }
renderListTable = function(){
  const el = $("list"); if(!el || !M.casts) return;
  const byStart = (a, b)=>String(a.start_at).localeCompare(String(b.start_at));
  const casts = sortRows(tlRows());
  const STATE = { wait: "待機中", work: "仕事中", start: "予約スタート", precall: "出勤前連絡", gone: "今いない" };
  const block = (title, sub, list, cid, cls)=>`<div class="cblock ${cls || ""}" ${cid ? `id="cb-${cid}"` : ""}>
      <div class="ch"><b>${title}</b>${cid && KB.CAN_EDIT ? whereSel(cid) + dayStatusSel(cid) + kanzenBtn(cid) + fullBtn(cid) : ""}<small>${sub}</small><span style="flex:1"></span>${cid ? `<button class="btn btn-ghost btn-sm" onclick="editInfoNote('${cid}')">📌 今日のこと</button><button class="btn btn-ghost btn-sm" onclick="openAttend('${cid}')">📝 勤怠</button><button class="btn btn-ghost btn-sm" onclick="openSettle('${cid}')">💴 精算</button>` : ""}${cid && KB.CAN_EDIT ? `<button class="btn btn-ghost btn-sm" onclick="newBookingFor('${cid}','')">＋ 予約</button>` : ""}</div>
      ${cid ? attendHtml(cid) : ""}
      ${list.length ? list.map(resCard).join("") : `<div class="none">予約なし</div>`}</div>`;
  const noCast = rows.filter(r=>!r.cast_id).sort(byStart);
  const mode = $("s_sort").value;
  el.innerHTML = (noCast.length ? block("キャスト未定", "", noCast, "") : "")
    + (casts.length ? casts.map(x=>{
        const st = boardState(x), col = boardCol(x, st), gk = goneKind(x.cd);
        const sub = `${x.shift ? "出勤 " + tlLabel(x.shift.start) + "〜" + tlLabel(x.shift.end) + (x.shift.kanzen ? "（完）" : "") + (x.shiftOrig ? "（予定 " + tlLabel(x.shiftOrig.start) + "〜" + tlLabel(x.shiftOrig.end) + "）" : "") : "シフトなし"}・${STATE[st]}${st !== "gone" && col ? "（" + col + "）" : gk ? "（" + gk + "）" : ""}`;
        const cls = st === "gone" ? (gk === "お茶" ? "tea" : gk === "欠勤" ? "absent" : "away") : "";
        return block("【" + esc(castLabel(x)) + "】" + (x.c && typeof kbPendingAfterSettle === "function" && kbPendingAfterSettle(x.cd, rows.filter(r=>r.cast_id === x.c.id)).length ? `<span class="part2chip" title="精算済のあとで予約がふえました。💴 精算で②の精算をしてください">⚠️ ②の精算がまだ</span>` : ""), esc(sub), x.c ? rows.filter(r=>r.cast_id === x.c.id).sort(byStart).sort(offLast) : [], x.c ? x.c.id : "", cls);
      }).join("") : `<div class="gate">${mode === "freeNow" ? "今すぐ行けるキャストはいません" : mode === "onNow" ? "今出勤しているキャストはいません" : mode === "booked" ? "予約があるキャストはいません" : "この日のキャストがいません"}</div>`)
    + cancelSection();
};

/* ---------- 受付：指名キャストは あいうえお順 ---------- */
const __fillCastSel = fillCastSel;
fillCastSel = function(){
  __fillCastSel();
  const sel = $("f_cast"), grp = sel.querySelector("optgroup");
  if(!grp) return;
  const kana = id=>{ const c = M.casts.find(x=>x.id === id) || {}; return String(c.kana || c.official_name || c.temp_name || ""); };
  const opts = [...grp.querySelectorAll("option")].sort((a, b)=>kana(a.value).localeCompare(kana(b.value), "ja"));
  const cur = sel.value; opts.forEach(o=>grp.appendChild(o)); sel.value = cur;
};

/* ---------- 受付：キャストの特記事項・NG・条件は、その子のプロフ（キャストプロフの内勤画面）で見る ---------- */
const PROF_STAFF_URL = "https://sakuramoong-app.github.io/cast-sakura-profile/staff.html";
const __onCastL = onCast;
onCast = function(){
  __onCastL.apply(this, arguments);
  const c = M.casts.find(x=>x.id === $("f_cast").value);
  if(!c || !c.prof_id) return;   // プロフとつながっていない子は、今までどおり（たたんで出す）
  $("castInfo").innerHTML = `<a class="proflink" href="index.html?cast=${encodeURIComponent(c.id)}" target="_blank" rel="noopener">📒 ${esc(c.official_name || c.temp_name)}のキャスト台帳を開く（特記事項・NG・条件・ホテル）</a>`;
};

/* ============================================================
   2026/10/20：探す・キャストで絞る・希望プレイで絞る を「本日のキャスト一覧」にも／あかさたなでジャンプ／大事な未完了は点滅
   ============================================================ */
// 一覧にも同じ絞り込み（何時から何分・行ける人だけ・キャスト・希望プレイ）
function filterCasts(list){
  const want = tlHour($("s_time").value), mins = Number($("s_min").value) || 90;
  const unavailable = x => !!(x.cd && (["お茶", "欠勤", "精算済"].includes(x.cd.status) || x.cd.settled));
  if(want != null){
    const wantE = want + mins / 60;
    list.forEach(x=>{ const g = gapOf(x); x.ok = !!x.shift && !unavailable(x) && want >= x.shift.start - 0.01 && wantE <= x.shift.end + 0.01 && !x.bks.some(b=>b.s - g < wantE && want < b.e + g); });
  }
  if(selCasts.size) list = list.filter(x=>selCasts.has(castKey(x)));
  list = applyPlayFilter(list);
  if($("s_free").checked && want != null) list = list.filter(x=>x.ok);
  if(want != null) list = list.slice().sort((a, b)=>(b.ok ? 1 : 0) - (a.ok ? 1 : 0));
  return list;
}
const __sortRowsF = sortRows;
let filterForList = false;
sortRows = function(list){ const out = __sortRowsF(list); return filterForList ? filterCasts(out) : out; };
const __renderListTableF = renderListTable;
renderListTable = function(){ filterForList = true; try{ __renderListTableF(); } finally{ filterForList = false; } renderKanaBar(); };
// ボタンを押したら、一覧と全体を見たいの両方を描きなおす
toggleSelCast = function(k){ if(selCasts.has(k)) selCasts.delete(k); else selCasts.add(k); renderList(); };
togglePlay = function(k){ if(playSel.has(k)) playSel.delete(k); else playSel.add(k); renderList(); };
clearPlay = function(){ playSel.clear(); renderList(); };
clearSearch = function(){ $("s_time").value = ""; $("s_free").checked = false; selCasts.clear(); playSel.clear(); renderList(); };

/* ---------- あかさたな…でジャンプ（本日のキャスト一覧・全体を見たい） ---------- */
const KANA_ROWS = [["あ", "あいうえおぁぃぅぇぉ"], ["か", "かきくけこがぎぐげご"], ["さ", "さしすせそざじずぜぞ"], ["た", "たちつてとだぢづでどっ"], ["な", "なにぬねの"],
  ["は", "はひふへほばびぶべぼぱぴぷぺぽ"], ["ま", "まみむめも"], ["や", "やゆよゃゅょ"], ["ら", "らりるれろ"], ["わ", "わをんゐゑ"]];
function kanaHead(x){
  let s = String((x.c && (x.c.kana || x.c.official_name || x.c.temp_name)) || x.name || "").trim().charAt(0);
  const code = s.charCodeAt(0); if(code >= 0x30A1 && code <= 0x30F6) s = String.fromCharCode(code - 0x60);   // カタカナ→ひらがな
  const row = KANA_ROWS.find(r=>r[1].includes(s));
  return row ? row[0] : "他";
}
// 押した行（あ行・か行…）のキャストだけ出す。もう一度押す／「全員」で元にもどす（本日のキャスト一覧・全体を見たい）
let kanaSel = "";
function renderKanaBar(){
  const el = $("kanaBar"); if(!el || !M.casts) return;
  const have = new Set(tlRows().map(kanaHead));
  el.innerHTML = `<button type="button" class="kb ${kanaSel ? "" : "on"}" onclick="jumpKana('')">全員</button>`
    + KANA_ROWS.map(([k])=>`<button type="button" class="kb ${kanaSel === k ? "on" : ""} ${have.has(k) ? "" : "off"}" onclick="jumpKana('${k}')">${k}</button>`).join("");
}
function jumpKana(k){
  kanaSel = !k || kanaSel === k ? "" : k;
  renderList(); renderKanaBar();
}
{ const __filterCastsK = filterCasts; filterCasts = function(list){ const l = __filterCastsK(list); return kanaSel ? l.filter(x => kanaHead(x) === kanaSel) : l; }; }

/* ---------- エリアのホテル一覧（地図つき）は出さない。登録されているホテルなら、地図のURLを自動で入れる ---------- */
const __paintAreaInfoM = paintAreaInfo;
paintAreaInfo = async function(){
  await __paintAreaInfoM();
  document.querySelectorAll("#areaInfo details").forEach(d=>d.remove());   // 「🏨 ○○のホテル（押すと地図）」はなし
};
// ホテル・住所の欄に、登録されているホテルの名前が入っていたら、そのホテルの地図のURLを入れる
// （手で打った地図のURLは上書きしない。お客さんの過去の場所を選んだときは、その地図）
function autoMap(){
  const m = $("f_map"); if(!m) return;
  if(m.value.trim() && m.dataset.auto !== "1") return;
  const area = $("f_area").value.trim(), addr = $("f_address").value.replace(/[\s　]/g, "");
  let url = "";
  if(addr){
    const list = (M.hotels || []).filter(h=>!area || h.area === area || String(area).includes(h.area))
      .sort((a, b)=>String(b.hotel_name).length - String(a.hotel_name).length);
    const h = list.find(x=>x.hotel_name && addr.includes(String(x.hotel_name).replace(/[\s　]/g, "")));
    if(h) url = mapLink(h);
    else{
      const p = custPlaces.find(x=>x.map_url && samePlace(x, $("f_area").value, $("f_address").value));
      if(p) url = p.map_url;
    }
  }
  m.value = url; m.dataset.auto = url ? "1" : "";
}
const __checkNewHotelM = checkNewHotel;
checkNewHotel = function(){ __checkNewHotelM(); autoMap(); };
const __onAreaSelM = onAreaSel;
onAreaSel = function(){ __onAreaSelM(); autoMap(); };
const __pickPlaceM = pickPlace;
pickPlace = function(i){ __pickPlaceM(i); if($("f_map")) $("f_map").dataset.auto = i >= 0 && custPlaces[i] && custPlaces[i].map_url ? "" : "1"; autoMap(); };
const __openFormM = openForm;
openForm = function(id){ __openFormM(id); const m = $("f_map"); if(m){ m.dataset.auto = m.value ? "" : "1"; autoMap(); } };

// 日付は「10/21(水)」のように曜日つきで出す（押すとカレンダー）
function paintDayLabel(){
  const el = $("dayLabel"); if(!el || !day) return;
  const d = new Date(day + "T12:00:00Z"), w = d.getUTCDay();
  el.innerHTML = `<b class="dmd">${d.getUTCMonth() + 1}/${d.getUTCDate()}</b><b class="dwk ${w === 0 ? "sun" : w === 6 ? "sat" : ""}">(${"日月火水木金土"[w]})</b>` + (day === KB.bizDateOf() ? `<span class="dtoday">今日</span>` : "");
}
const __loadDayDL = loadDay;
loadDay = async function(){ if(KB.PRACTICE) $("day").value = KB.PRACTICE_DAY; day = $("day").value; paintDayLabel(); await __loadDayDL(); paintDayLabel(); };

/* ============================================================
   2026/10/20：受付画面の整理（支払いはふつうの選ぶ欄／ビジホの確認／キャストへの連絡はLINEで一言）
   ============================================================ */
renderPayChips = function(){};   // 支払い方法は、ボタンではなくふつうの選ぶ欄

/* ---------- 🏢 ビジホの確認：2名部屋で取っている？ → 取っていなければ 下迎え？・キャストが使うタオル あり／なし（必ず） ---------- */
let bizState = { twin: "", pickup: "", towel: "" };
// 2026/11/3：どの問いにも「不明」。2名部屋でもタオルは聞く。選んだあとも全部の問いを出したまま。キャストへの LINE の文にも出す
const BIZ_Q = [["twin", "2名部屋で取っている？", [["yes", "取っている"], ["no", "取っていない"], ["unknown", "不明"]]],
  ["pickup", "下迎え？", [["yes", "下迎え"], ["no", "下迎えではない"], ["unknown", "不明"]]],
  ["towel", "キャストが使うタオル", [["yes", "ある"], ["no", "ない"], ["unknown", "不明"]]]];
function bizNeed(){ return bizState.twin === "yes" ? ["twin", "towel"] : ["twin", "pickup", "towel"]; }   // 2名部屋なら下迎えは聞かなくていい
function bizMissing(){ return !!($("f_place") && $("f_place").value === "biz" && bizNeed().some(k=>!bizState[k])); }
function bizText(b){
  const yn = (v, y, n) => v === "yes" ? y : v === "no" ? n : v === "unknown" ? "不明" : "未確認";
  return [b.twin === "yes" ? "2名部屋" : b.twin === "no" ? "1名部屋" : "部屋：" + yn(b.twin), b.twin !== "yes" ? "下迎え：" + yn(b.pickup, "あり", "なし") : "", "タオル：" + yn(b.towel, "あり", "なし")].filter(Boolean).join("・");
}
function paintBiz(){
  const el = $("bizBox"); if(!el) return;
  if(!$("f_place") || $("f_place").value !== "biz"){ el.innerHTML = ""; return; }
  const need = bizNeed();
  el.innerHTML = `<div class="bizbox"><div class="bh">🏢 ビジホの確認（必ず聞く）</div>` + BIZ_Q.map(([k, label, opts])=>
    `<div class="bq ${bizState[k] || !need.includes(k) ? "" : "miss"}" ${need.includes(k) ? "" : 'style="opacity:.55"'}><span>${label}${need.includes(k) ? "" : "（2名部屋なので聞かなくてOK）"}</span>${opts.map(([v, l])=>`<button type="button" class="ynp ${bizState[k] === v ? "on" : ""}" onclick="setBiz('${k}','${v}')">${l}</button>`).join("")}</div>`).join("") + `</div>`;
}
function setBiz(k, v){ bizState[k] = v; paintBiz(); if(typeof recalc === "function" && $("f_store").value) recalc(); }
const __checkNewHotelB = checkNewHotel;
checkNewHotel = function(){ __checkNewHotelB(); paintBiz(); };
const __openFormB = openForm;
openForm = function(id){
  const r = id ? rows.find(x=>x.id === id) : null;
  bizState = Object.assign({ twin: "", pickup: "", towel: "" }, (r && r.biz_check) || {});
  __openFormB(id);
  paintBiz();
};
const __saveResB = saveRes;
saveRes = async function(){
  const cx = ["cancel", "tobi", "flowed"].includes($("f_status").value);
  if(!cx && bizMissing()){ paintBiz(); toast("🏢 ビジホの確認（2名部屋・下迎え・タオル）を選んでください"); $("bizBox").scrollIntoView({ block: "center" }); return; }
  return __saveResB();
};
// 一覧の予約にも、ビジホの確認を小さく出す
const __placeCellB = placeCell;
placeCell = function(r){ const b = r.biz_check; return __placeCellB(r) + (r.place_kind === "biz" && b && b.twin ? `<small class="bizinfo">🏢 ${bizText(b)}</small>` : ""); };

/* ---------- 🏢 ビジホの履歴（ラブホのホテルリストとは別：kb_biz_hotels）
   種類が「ビジホ」のとき：ホテル名の候補・地図のURL・前回の確認はビジホの履歴から。保存すると自動で履歴に入る ---------- */
let bizHotels = [];   // M は読みこみのたびに作りなおされるので、別に持つ
(async ()=>{ try{ bizHotels = q(await sb.from("kb_biz_hotels").select("*").order("last_used", { ascending: false })) || []; }catch(e){ bizHotels = []; } })();
const isBiz = ()=>!!($("f_place") && $("f_place").value === "biz");
const bkey = s=>String(s || "").replace(/[\s　]/g, "");
function bizFind(){
  const area = $("f_area").value.trim(), addr = bkey($("f_address").value);
  if(!addr) return null;
  return bizHotels.filter(h=>!area || !h.area || h.area === area).sort((a, b)=>String(b.hotel_name).length - String(a.hotel_name).length)
    .find(h=>addr.includes(bkey(h.hotel_name))) || null;
}
// ホテル名の候補：ビジホのときはビジホの履歴
function fillHotelList(){
  const area = $("f_area").value.trim();
  const list = isBiz() ? bizHotels.filter(h=>!area || h.area === area) : (M.hotels || []).filter(h=>h.area === area);
  $("hotelList").innerHTML = list.map(h=>`<option value="${esc(h.hotel_name)}">`).join("");
}
const __paintAreaInfoBz = paintAreaInfo;
paintAreaInfo = async function(){ await __paintAreaInfoBz(); fillHotelList(); };
// 地図のURL：ビジホのときはビジホの履歴から
const __hotelMapUrlBz = hotelMapUrl;
hotelMapUrl = function(){ if(!isBiz()) return __hotelMapUrlBz(); const h = bizFind(); return h && h.map_url ? h.map_url : ($("f_map") ? $("f_map").value.trim() : ""); };
const __autoMapBz = autoMap;
autoMap = function(){
  if(!isBiz()) return __autoMapBz();
  const m = $("f_map"); if(!m) return;
  if(m.value.trim() && m.dataset.auto !== "1") return;
  const h = bizFind(); const url = h && h.map_url ? h.map_url : "";
  m.value = url; m.dataset.auto = url ? "1" : "";
};
// ビジホのときは「ホテルリストに足しますか？」は出さない（保存するとビジホの履歴に入る）
const __paintNewHotelBz = paintNewHotel;
paintNewHotel = function(){
  if(!isBiz()) return __paintNewHotelBz();
  const el = $("newHotelBox"); if(!el) return;
  const name = hotelNameFromAddr($("f_address").value);
  if(!name || name.length < 2){ el.innerHTML = ""; return; }
  const q2 = encodeURIComponent(($("f_area").value.trim().replace(/^出張（(.*)）$/, "$1").replace(/^出張$/, "") || "") + " " + name);
  // 履歴にあるビジホでも、Googleで調べられるように
  if(!KB.CAN_EDIT || bizFind()){ el.innerHTML = `<div style="margin:4px 0;font-size:13px"><a href="https://www.google.com/maps/search/?api=1&query=${q2}" target="_blank" rel="noopener">🔍 「${esc(name)}」をGoogleマップで調べる</a>　<a href="https://www.google.com/search?q=${q2}" target="_blank" rel="noopener">🔍 Google検索</a></div>`; return; }
  el.innerHTML = `<div class="newhotel">🆕 「<b>${esc(name)}</b>」はビジホの履歴にありません。ビジホとして足しますか？（足さなくても、予約を保存すると自動で入ります）
    <div class="row2" style="margin-top:6px">
      <div class="f"><label>ビジホの名前</label><input id="nb_name" value="${esc(name)}" maxlength="80"></div>
      <div class="f"><label>メモ（例：フロント通らずに入れる）</label><input id="nb_note" maxlength="200"></div>
    </div>
    <div class="f" style="margin-top:6px"><label>地図のURL　<a href="https://www.google.com/maps/search/?api=1&query=${q2}" target="_blank" rel="noopener">🔍 Googleマップで調べる</a>（開いたら「共有」→「リンクをコピー」して貼る）</label>
      <input id="nb_map" placeholder="https://maps.app.goo.gl/…"></div>
    <div style="text-align:right;margin-top:6px"><button type="button" class="btn btn-primary btn-sm" onclick="addBizFromForm()">🏢 ビジホの履歴に足す</button></div></div>`;
};
async function addBizFromForm(){
  const name = $("nb_name").value.trim(), area = $("f_area").value.trim(), map = $("nb_map").value.trim(), note = $("nb_note").value.trim();
  if(!name){ toast("ビジホの名前を入れてください"); return; }
  if(!area){ toast("先にエリアを選んでください"); return; }
  if(map && !/^https?:\/\//i.test(map)){ toast("地図のURLは https:// から始まるものを貼ってください"); return; }
  try{
    const row = q(await sb.from("kb_biz_hotels").insert({ area, hotel_name: name, map_url: map, note, updated_by: KB.operatorName() }).select("*").single());
    bizHotels.unshift(row || { area, hotel_name: name, map_url: map, note });
    if($("f_map")) $("f_map").dataset.auto = "1";
    $("newHotelBox").innerHTML = ""; fillHotelList(); autoMap(); paintBiz(); recalc();
    toast("「" + name + "」をビジホの履歴に足しました");
  }catch(e){ toast("足せませんでした（SQL 112 は実行ずみ？）：" + (e.message || e)); }
}
// 前回の確認を、ビジホの確認の枠に出す
const __paintBizBz = paintBiz;
paintBiz = function(){
  __paintBizBz();
  const h = isBiz() && bizFind(), box = document.querySelector("#bizBox .bh");
  if(h && box && h.note) box.insertAdjacentHTML("afterend", `<div class="hist" style="margin:0 0 4px">📝 ${esc(h.note)}</div>`);
  if(h && box && h.last_check && h.last_check.twin) box.insertAdjacentHTML("afterend", `<div class="hist" style="margin:0 0 4px">前回（${esc(h.last_used || "")}）：${esc(bizText(h.last_check))}${h.use_count ? "（これまで" + h.use_count + "回）" : ""}</div>`);
};
const __checkNewHotelBz = checkNewHotel;
checkNewHotel = function(){ __checkNewHotelBz(); fillHotelList(); };
// 保存できたら、ビジホの履歴に入れる（同じエリア＋同じホテル名なら回数を足す）
const __saveResBz = saveRes;
saveRes = async function(){
  const biz = isBiz(), area = $("f_area").value.trim(), name = hotelNameFromAddr($("f_address").value).slice(0, 80);
  const map = $("f_map") ? $("f_map").value.trim() : "", chk = Object.assign({}, bizState), wasEdit = !!editing;
  const cx = ["cancel", "tobi", "flowed"].includes($("f_status").value);
  await __saveResBz();
  if(!biz || cx || !name || $("formBg").classList.contains("show")) return;   // 保存できなかったときは何もしない
  try{
    const ex = bizHotels.find(h=>h.area === area && bkey(h.hotel_name) === bkey(name));
    const patch = { map_url: map || (ex && ex.map_url) || "", last_check: chk, last_used: day, updated_at: new Date().toISOString(), updated_by: KB.operatorName() };
    if(ex){ patch.use_count = (ex.use_count || 0) + (wasEdit ? 0 : 1); q(await sb.from("kb_biz_hotels").update(patch).eq("id", ex.id)); Object.assign(ex, patch); }
    else { const row = q(await sb.from("kb_biz_hotels").insert({ area, hotel_name: name, use_count: 1, ...patch }).select("*").single()); if(row) bizHotels.unshift(row); }
  }catch(e){ toast("予約は保存しました。ビジホの履歴には入れられませんでした（SQL 112 は実行ずみ？）"); }
};

/* ---------- 📨 キャストへの予約連絡：LINEで一言（くわしくはアプリで見てもらう）
   ※キャスト用の予約アプリができて、みんなが見られるようになったら buildMsg = buildMsgShort; にする。それまでは前のくわしい文面 ---------- */
/* ---------- ⏱ 全体を見たい：今の時刻に、きらきらの縦線（1分ごとに動く）＋ 上に「今 21:35 ✨」 ---------- */
function nowHourTL(){ const j = new Date(Date.now() + 9 * 3600 * 1000); let h = j.getUTCHours() + j.getUTCMinutes() / 60; if(h < 8) h += 24; return h; }
function paintNowLine(){
  const grid = $("tlGrid"); if(!grid) return;
  const head = grid.querySelector(".hd .cells"); if(!head) return;
  let mk = head.querySelector(".nowhead");
  if(day !== KB.bizDateOf()){ if(mk) mk.remove(); return; }
  const h = nowHourTL(), left = Math.max(0, Math.min(100, (h - TL_FROM) / (TL_TO - TL_FROM) * 100)) + "%";
  if(!mk){ mk = document.createElement("div"); mk.className = "nowhead"; head.appendChild(mk); }
  const j = new Date(Date.now() + 9 * 3600 * 1000);
  mk.style.left = left; mk.innerHTML = `<span>今 ${String(j.getUTCHours()).padStart(2, "0")}:${String(j.getUTCMinutes()).padStart(2, "0")} ✨</span>`;
  grid.querySelectorAll(".r .cells > .now").forEach(el=>{ el.style.left = left; });
}
const __renderTLNow = renderTL;
renderTL = function(){ __renderTLNow(); paintNowLine(); };
setInterval(paintNowLine, 60000);
// 「全体を見たい」を開いたら、今の時刻が見えるところまで横にずらす（今日だけ）
function scrollToNow(){
  const wrap = document.querySelector(".tlwrap"), mk = document.querySelector("#tlGrid .nowhead"); if(!wrap || !mk) return;
  const x = mk.getBoundingClientRect().left - wrap.getBoundingClientRect().left + wrap.scrollLeft;
  wrap.scrollLeft = Math.max(0, x - wrap.clientWidth / 3);
}
const __showViewNow = showView;
showView = function(v){ const r = __showViewNow.apply(this, arguments); if(v === "tl") setTimeout(scrollToNow, 50); return r; };

/* ---------- 💴 内勤の日払い（その日の分。時給の内勤だけ：蘭子・若林・上川）----------
   ・出勤・退勤は30分きざみ。はじめは内勤カレンダーのシフトから入る（ちがう日は直す）
   ・金額＝時間×時給。「払った」にして、どこから払ったか（その日の回収金／キキララ）も残す
   ・集計の店落ちから引く（SQL 127）。いまは内勤みんなが見られる・直せる */
let staffPay = { rates: [], rows: [] };
const PAY_SRC = { drop: "その日の回収金", kikirara: "キキララ（両替金）", split: "両方（回収金＋キキララ）" };   // split：一部を回収金・残りをキキララ（SQL 224。2026/11/6）
function parseShiftTime(t){   // 内勤カレンダーの「20-5」「12:30-22」→ { in, out }（日をまたいだら +24）
  const m = String(t || "").match(/^(\d{1,2})(?::(\d{2}))?-(\d{1,2})(?::(\d{2}))?$/); if(!m) return null;
  const a = Number(m[1]) + (Number(m[2]) || 0) / 60; let b = Number(m[3]) + (Number(m[4]) || 0) / 60;
  if(b <= a) b += 24;
  return { in: a, out: b };
}
const halfLabel = h => { const x = h >= 24 ? h - 24 : h; return (h >= 24 ? "翌" : "") + Math.floor(x) + ":" + (x % 1 ? "30" : "00"); };
async function loadStaffPay(){
  const box = $("staffPayGrid"); if(!box) return;
  try{
    const [rates, work, shifts] = await Promise.all([
      sb.from("kb_staff_rates").select("*").order("from_date"),
      sb.from("kb_staff_work").select("*").eq("biz_date", day),
      sb.from("naikin_shifts").select("staff_id,time").eq("date", day),
    ]);
    const rt = q(rates) || [], wk = work.error ? [] : (work.data || []), sh = shifts.error ? [] : (shifts.data || []);
    const ids = [...new Set(rt.filter(r=>r.from_date <= day).map(r=>r.staff_id))];
    staffPay.rows = ids.map(id=>{
      const r = rt.filter(x=>x.staff_id === id && x.from_date <= day).pop();
      const w = wk.find(x=>x.staff_id === id), s = sh.find(x=>x.staff_id === id), p = s && parseShiftTime(s.time);
      return { id, name: r.record_name || id, hourly: (w && w.hourly) || r.hourly,
        in: w && w.clock_in != null ? Number(w.clock_in) : p ? p.in : null, out: w && w.clock_out != null ? Number(w.clock_out) : p ? p.out : null,
        saved: !!w, fromShift: !w && !!p, paid: !!(w && w.paid), src: (w && w.pay_source) || "", kiki: w && w.paid_kiki != null ? Number(w.paid_kiki) : null, amount: w && w.day_paid ? w.day_paid : null, note: (w && w.note) || "", by: (w && w.paid_by) || "", at: w && w.paid_at };
    });
    // 内勤は、自分の日払いだけ見える（店長・社長は全員）。共通ログインもGoogleログインも、ポータルの担当者の名前で決める 2026/11/4
    if(!KB.IS_BOSS){
      const me = { "きゃ": "kya", "すや": "suya", "らん": "ran", "かみ": "kami", "わか": "waka" }[KB.operatorName()] || "";
      staffPay.rows = staffPay.rows.filter(r => r.id === me);
    }
  }catch(e){ box.innerHTML = `<div class="hist">読めませんでした（SQL 127 は実行ずみ？）：${esc(e.message || e)}</div>`; return; }
  paintStaffPay();
}
// 日払いの自動の額（時間×時給）。若林・上川は半額で、2でわった額と前後することが多いので、自動で入れない（空欄。手で入れる）2026/11/5
const SP_NO_AUTO = ["waka", "kami"];
function spAuto(r){ if(SP_NO_AUTO.includes(r.id)) return 0; return r.in != null && r.out != null && r.out > r.in ? Math.round((r.out - r.in) * r.hourly) : 0; }
function paintStaffPay(){
  const box = $("staffPayGrid"); if(!box) return;
  const opts = (sel, from)=>{ let h = `<option value="">--</option>`; for(let x = from; x <= 30; x += 0.5) h += `<option value="${x}" ${sel === x ? "selected" : ""}>${halfLabel(x)}</option>`; return h; };
  const rows = staffPay.rows;
  const calcAmt = spAuto;
  const paidSum = rows.filter(r=>r.paid).reduce((a, r)=>a + (r.amount != null ? r.amount : calcAmt(r)), 0);
  $("staffPaySum").textContent = rows.length ? `払った ${yen(paidSum)}` : "";
  box.innerHTML = rows.length ? `<div class="wrapx"><table class="list" style="font-size:13.5px"><tr><th>内勤</th><th>出勤</th><th>退勤</th><th>時間</th><th>時給</th><th>日払い</th><th>払った</th><th>どこから</th><th>メモ</th><th></th></tr>
    ${rows.map((r, i)=>{ const hrs = r.in != null && r.out != null && r.out > r.in ? r.out - r.in : 0, amt = r.amount != null ? r.amount : calcAmt(r);
      return `<tr style="${r.paid ? "background:#EEF9EE" : ""}"><td><b>${esc(r.name)}</b>${r.fromShift ? '<br><small style="color:var(--sub)">内勤カレンダーより</small>' : ""}</td>
      <td><select onchange="spSet(${i},'in',this.value)">${opts(r.in, 6)}</select></td><td><select onchange="spSet(${i},'out',this.value)">${opts(r.out, 6.5)}</select></td>
      <td>${hrs ? hrs + "時間" : ""}</td><td>${yen(r.hourly)}</td>
      <td><input type="number" value="${amt || ""}" style="width:90px" onchange="spSet(${i},'amount',this.value)"></td>
      <td><label><input type="checkbox" ${r.paid ? "checked" : ""} onchange="spSet(${i},'paid',this.checked)"> 払った</label>${r.paid && r.by ? `<br><small style="color:var(--sub)">${esc(r.by)}</small>` : ""}</td>
      <td><select onchange="spSet(${i},'src',this.value)"><option value="">--</option>${Object.entries(PAY_SRC).map(([k, l])=>`<option value="${k}" ${r.src === k ? "selected" : ""}>${l}</option>`).join("")}</select>
        ${r.src === "split" ? `<div style="margin-top:4px;font-size:12.5px;white-space:nowrap">🪙 キキララから <input type="number" value="${r.kiki != null ? r.kiki : ""}" style="width:80px" onchange="spSet(${i},'kiki',this.value)">円
          <br>💴 回収金から <b>${amt && r.kiki != null ? yen(Math.max(0, amt - r.kiki)) : "−"}</b></div>` : ""}</td>
      <td><input value="${esc(r.note)}" maxlength="100" style="width:120px" onchange="spSet(${i},'note',this.value)"></td>
      <td><button type="button" class="btn btn-primary btn-sm" onclick="spSave(${i})">保存</button></td></tr>`; }).join("")}</table></div>
    ${KB.IS_BOSS ? "" : `<div class="warn" style="margin-top:6px;font-weight:800">👛 自分の日払いは、自分で入れて「払った」にしてください（ほかの人の日払いは見えません）</div>`}
    <div class="hist" style="margin-top:4px">日払い＝時間×時給（30分きざみ）。金額を手で直すこともできます。「払った」にしたら、どこから払ったか（その日の回収金／キキララ）も選んで保存してください。払った分は、集計の店落ちから引きます。</div>`
    : `<div class="hist">この日の時給の内勤はいません（時給の表：kb_staff_rates）</div>`;
}
function spSet(i, k, v){
  const r = staffPay.rows[i]; if(!r) return;
  if(k === "in" || k === "out"){ r[k] = v === "" ? null : Number(v); r.amount = null; }
  else if(k === "amount") r.amount = v === "" ? null : Math.max(0, Number(v) || 0);
  else if(k === "kiki") r.kiki = v === "" ? null : Math.max(0, Number(v) || 0);
  else if(k === "paid"){ r.paid = !!v; if(r.paid && !r.src) r.src = "drop"; }
  else r[k] = v;
  paintStaffPay();
}
async function spSave(i){
  const r = staffPay.rows[i]; if(!r) return;
  if(r.in != null && r.out != null && r.out <= r.in){ toast("退勤は出勤より後にしてください"); return; }
  if(r.paid && !r.src){ toast("どこから払ったか選んでください"); return; }
  const hrs = r.in != null && r.out != null ? r.out - r.in : null, amt = r.amount != null ? r.amount : spAuto(r);
  // 両方から払った：キキララの分は 1円〜日払いの額より少なく（回収金の分＝日払い−キキララ）。合計（日払い）は変わらないので、店落ちも変わらない
  if(r.paid && r.src === "split" && !(r.kiki > 0 && r.kiki < amt)){ toast("キキララから取った額を入れてください（日払いの額より少なく）。全部キキララなら「キキララ」を選んでください"); return; }
  const by = KB.operatorName();
  const row = { biz_date: day, staff_id: r.id, clock_in: r.in, clock_out: r.out, hours: hrs, hourly: r.hourly, day_paid: amt,
      paid: r.paid, pay_source: r.src || "", paid_by: r.paid ? (r.by || by) : "", paid_at: r.paid ? (r.at || new Date().toISOString()) : null,
      from_shift: r.fromShift, note: r.note || "", updated_by: by, updated_at: new Date().toISOString() };
  if(r.src === "split") row.paid_kiki = r.kiki;   // SQL 224 の列（分けたときだけ送る）
  try{
    q(await sb.from("kb_staff_work").upsert(row, { onConflict: "biz_date,staff_id" }));
    toast(r.name + " の日払いを保存しました"); loadStaffPay();
  }catch(e){ toast("保存できませんでした（SQL 127 は実行ずみ？）：" + (e.message || e)); }
}
const __loadDaySP = loadDay;
loadDay = async function(){ const r = await __loadDaySP.apply(this, arguments); loadStaffPay(); return r; };

/* ---------- 前回このキャストを指名したのが3年以上前なら、「以前このキャストを指名したことがあるか」を必ず聞く ----------
   （お客さんが覚えていないことがあるので、本指名・店リピの決め方をお客様に確認する）。終了した予約で、いちばん新しいもの */
var oldNomi = null, oldNomiSeq = 0, custCastNg = null;
async function checkOldNomi(){
  const seq = ++oldNomiSeq;
  const cid = $("f_cast").value, custId = (curCustomer && curCustomer.id) || (editing && editing.customer_id) || null;
  let found = null, ng = null;
  if(cid && custId){
    try{
      let qy = sb.from("kb_reservations").select("id,biz_date").eq("customer_id", custId).eq("cast_id", cid).eq("status", "done").eq("deleted", false).order("biz_date", { ascending: false }).limit(2);
      const rows2 = (q(await qy) || []).filter(r=>!(editing && r.id === editing.id));
      // 台帳エクセルから取りこんだ過去の利用も（顧客台帳。表がまだないときは気にしない）
      try{ const h = await sb.from("kb_cust_history").select("biz_date").eq("customer_id", custId).eq("cast_id", cid).eq("status", "done").order("biz_date", { ascending: false }).limit(1); if(!h.error && h.data && h.data[0]) rows2.push(h.data[0]); }catch(e){}
      rows2.sort((a, b)=>String(b.biz_date).localeCompare(String(a.biz_date)));
      // このお客さんは、このキャストNG？（顧客台帳）
      try{
        let n = await sb.from("kb_cust_cast_ng").select("id,reason,ask").eq("customer_id", custId).eq("cast_id", cid).limit(1);
        if(n.error) n = await sb.from("kb_cust_cast_ng").select("id,reason").eq("customer_id", custId).eq("cast_id", cid).limit(1);   // SQL 162 の前
        if(!n.error && n.data && n.data[0]) ng = { cid, id: n.data[0].id, reason: n.data[0].reason || "", ask: !!n.data[0].ask };
      }catch(e){}
      const last = rows2[0];
      if(last){
        const lim = new Date((day || KB.bizDateOf()) + "T00:00:00Z"); lim.setUTCFullYear(lim.getUTCFullYear() - 3);
        if(last.biz_date <= lim.toISOString().slice(0, 10)){
          const c = M.casts.find(x=>x.id === cid), d = last.biz_date.split("-");
          found = { cid, text: `前回${c ? (c.official_name || c.temp_name) : "このキャスト"}さんを指名したのは ${d[0]}/${Number(d[1])}/${Number(d[2])}（3年以上前）。お客様に「以前このキャストを指名したことはありますか？」と確認した` };
        }
      }
    }catch(e){}
  }
  if(seq !== oldNomiSeq) return;   // とちゅうでキャストやお客さんが変わった
  const changed = JSON.stringify(found) !== JSON.stringify(oldNomi) || JSON.stringify(ng) !== JSON.stringify(custCastNg);
  oldNomi = found; custCastNg = ng;
  if(changed) renderCastChecks(M.casts.find(x=>x.id === $("f_cast").value));
}
// 🤔 要確認のNG（SQL 162）を内勤が決める（キャストNG：残す＝NG／消す＝関係ない。店NG：NGのまま／NGを外す）
async function castNgDecide(id, isNg){
  const by = KB.operatorName();
  try{
    if(isNg) q(await sb.from("kb_cust_cast_ng").update({ ask: false, ask_done: true }).eq("id", id));
    else {
      q(await sb.from("kb_cust_cast_ng").delete().eq("id", id));
      // 顧客台帳の過去の利用（エクセル）の「🙅 キャストNG」の印も外す
      const custId = (curCustomer && curCustomer.id) || (editing && editing.customer_id), cid = $("f_cast").value;
      if(custId && cid) await sb.from("kb_cust_history").update({ cast_ng: false }).eq("customer_id", custId).eq("cast_id", cid).eq("cast_ng", true);
    }
    toast(isNg ? `🙅 キャストNGにしました（${by}）` : `キャストNGではない、にしました（${by}）`);
    custCastNg = null; await checkOldNomi(); renderCastChecks(M.casts.find(x => x.id === $("f_cast").value));
  }catch(e){ toast("できませんでした：" + (e.message || e)); }
}
async function custNgDecide(id, isNg){
  const by = KB.operatorName(), u = isNg ? { ng_ask: false, ng_ask_done: true } : { ng: false, ng_ask: false, ng_ask_done: true };
  try{
    q(await sb.from("kb_customers").update(u).eq("id", id));
    if(curCustomer && curCustomer.id === id) Object.assign(curCustomer, u);
    $("f_ng").value = isNg ? "1" : "0";
    toast(isNg ? `⚠️ 店NGにしました（${by}）` : `NGではない、にしました（${by}）`);
    lookupCustomer(true);
  }catch(e){ toast("できませんでした：" + (e.message || e)); }
}
async function castNgEdit(id){
  const cur = (custCastNg && custCastNg.id === id && custCastNg.reason) || "";
  const v = prompt("キャストNGの理由（直して OK）", cur); if(v === null) return;
  try{ q(await sb.from("kb_cust_cast_ng").update({ reason: v.trim(), by_name: KB.operatorName() }).eq("id", id)); toast("理由を直しました"); custCastNg = null; await checkOldNomi(); renderCastChecks(M.casts.find(x => x.id === $("f_cast").value)); }
  catch(e){ toast("できませんでした：" + (e.message || e)); }
}
async function castNgUndo(id){
  if(!confirm("このキャストNGを外しますか？（まちがいだったとき。顧客台帳からも消えます）")) return;
  castNgDecide(id, false);
}
async function custNgReason(id){
  const v = prompt("店NGの理由（直して OK）", (curCustomer && curCustomer.ng_reason) || ""); if(v === null) return;
  try{ q(await sb.from("kb_customers").update({ ng_reason: v.trim() }).eq("id", id)); if(curCustomer) curCustomer.ng_reason = v.trim(); toast("理由を直しました"); lookupCustomer(true); }
  catch(e){ toast("できませんでした：" + (e.message || e)); }
}
document.head.insertAdjacentHTML("beforeend", `<style>
  .ngask{background:#FFF8E1;border:2px solid #F5B400;border-radius:12px;padding:8px 10px;margin:6px 0;font-size:13.5px;color:#6b4e00}
  .ngask .q{background:#fff;border-radius:8px;padding:6px 8px;margin:6px 0;white-space:pre-wrap;font-size:13px}
  .ngask .btn{margin:2px 4px 0 0}
  .tobibox{background:#FFEBEE;border:2.5px solid #D32F2F;border-radius:12px;padding:8px 10px;margin:6px 0;color:#7f1d1d}
  .tobibox .th{font-size:16px;font-weight:900;color:#C62828;margin-bottom:2px}
  .tobibox .ti{border-top:1px dashed #F1A9AF;padding:5px 0;font-size:13.5px} .tobibox .ti:first-of-type{border-top:none}
  .tobibox .tm{white-space:pre-wrap;background:#fff;border-radius:8px;padding:5px 8px;margin-top:3px;font-size:14px;font-weight:700;color:#3d1010}
  .tobibox mark{background:#FFD54F;color:#5c3a00;border-radius:3px;padding:0 2px}
</style>`);
const __lookupCustomerON = lookupCustomer;
lookupCustomer = async function(){
  const r = await __lookupCustomerON.apply(this, arguments);
  // 顧客台帳で開くリンク
  if(curCustomer && $("custInfo") && !$("custLedgerLink")) $("custInfo").insertAdjacentHTML("afterbegin", `<div id="custLedgerLink" style="margin-bottom:4px"><a href="customers.html?id=${curCustomer.id}" target="_blank" rel="noopener" style="font-weight:800;color:var(--pink-deep)">👥 顧客台帳で開く（これまでの利用・キャストNG・メモ）</a></div>`);
  if(curCustomer) custCaution(curCustomer.id);
  checkOldNomi(); return r;
};
// 受付で、台帳エクセルの回の「🙅キャストNGの印」を外す（顧客台帳の「NGではない」と同じ）
async function histNgOffK(hid){
  if(!confirm("この回の「🙅キャストNG」の印を外しますか？（キャストNGではなかったとき）")) return;
  try{ q(await sb.from("kb_cust_history").update({ cast_ng: false }).eq("id", hid)); toast("印を外しました"); if(curCustomer) custCaution(curCustomer.id); }
  catch(e){ toast("できませんでした：" + (e.message || e)); }
}// ⚠️ 要注意：台帳エクセルの過去の利用（トビ・キャンセルの回数）と、キャストNGの一覧
async function custCaution(custId){
  try{
    const [h, n, rt] = await Promise.all([
      sb.from("kb_cust_history").select("id,biz_date,status,cast_raw,memo,marks,cast_ng,src_row").eq("customer_id", custId).order("biz_date", { ascending: false }).limit(2000),
      sb.from("kb_cust_cast_ng").select("cast_id,cast_name,reason").eq("customer_id", custId),
      sb.from("kb_reservations").select("biz_date,store_key,cast_id,memo_log,note").eq("customer_id", custId).eq("status", "tobi").eq("deleted", false).order("biz_date", { ascending: false }).limit(50),
    ]);
    if(!curCustomer || curCustomer.id !== custId || !$("custInfo")) return;
    const hs = (h.data || []), ngs = (n.data || []);
    const cnt = s => hs.filter(x => x.status === s).length;
    const fmt = d => d ? d.replace(/-/g, "/") : "";
    const cancel = cnt("cancel"), done = cnt("done");
    const lines = [];
    // 🚨 トビ：記録簿とエクセルの全部を、備考（今後どうするか）つきで大きく出す
    const tobis = [...(rt.data || []).map(r => ({ d: r.biz_date, who: storeLabel(r.store_key) + " " + castName(r.cast_id), memo: [r.note, ...(r.memo_log || []).map(m => m.text)].filter(Boolean).join("\n") })),
                   ...hs.filter(x => x.status === "tobi").map(x => ({ d: x.biz_date, who: x.cast_raw || "", memo: x.memo || "", row: x.src_row }))]
      .sort((a, b) => String(b.d || "").localeCompare(String(a.d || "")));
    const NEXT = /(今後|次回|次から|次は|前払い|先払い|カード|出禁|要注意|注意|本人確認|確認してから|受けない|NG|ＮＧ|保留|様子見|ブラック)/g;
    if(tobis.length) lines.push(`<div class="tobibox"><div class="th">🚨 トビ ${tobis.length}回</div>${tobis.map(t => `<div class="ti"><b>${fmt(t.d) || "日付なし"}</b> ${esc(t.who)}${t.row ? ` <small>（エクセル ${t.row}行目）</small>` : ""}
        ${t.memo ? `<div class="tm">${esc(t.memo).replace(NEXT, '<mark>$1</mark>')}</div>` : `<div class="tm" style="color:#9C8B8F">（備考なし）</div>`}</div>`).join("")}</div>`);
    if(ngs.length) lines.push(`<div class="warn">🙅 キャストNG：${ngs.map(x => esc(x.cast_id ? castName(x.cast_id) : x.cast_name)).join("・")}（このキャストでは保存できません）</div>`);
    if(cancel >= 2) lines.push(`<div class="warn" style="background:#FFF6E5;border-color:#F3C77A;color:#8a5a00">⚠️ キャンセル ${cancel}回</div>`);
    // 何かあった回（キャンセル・トビ・流れた・キャストNG・色つき・NGや出禁などの言葉・長い備考）は、備考を全文で見せる（見落とさないように）
    const WORDS = /NG|ＮＧ|出禁|トビ|ﾄﾋﾞ|飛ん|飛ば|とんだ|クレーム|トラブル|警察|盗撮|暴力|薬|要注意|注意|しつこ|強要|キャンセル/;
    const colored = m => !!m && Object.keys(m).some(k => /^fill:#|^font:#/i.test(k) || k === "other_fill" || k === "red_cols");
    const trouble = hs.filter(x => x.status !== "tobi" && (["cancel", "flowed"].includes(x.status) || x.cast_ng || colored(x.marks) || WORDS.test(x.memo || "") || (x.memo || "").length >= 40));   // トビは上の🚨に出す
    const STL = { cancel: "キャンセル", tobi: "トビ", flowed: "流れた", done: "" };
    const hlw = s => esc(s).replace(/(NG|ＮＧ|出禁|トビ|飛んだ|飛ばれ|クレーム|盗撮|暴力|薬|警察|要注意)/g, '<b style="background:#E5484D;color:#fff;border-radius:4px;padding:0 3px">$1</b>');
    const tItem = x => `<div style="border-top:1px dashed #F1C9CF;padding:4px 0"><b>${fmt(x.biz_date) || "日付なし"}</b> ${esc(x.cast_raw || "")} ${STL[x.status] ? `<b style="color:#C62828">【${STL[x.status]}】</b>` : ""}${x.cast_ng ? ` <span title="この回の行に「キャストNG」の印（エクセルの赤い字などから自動でつけた）">🙅キャストNGの印</span>${KB.CAN_EDIT && x.id ? ` <button type="button" class="btn btn-ghost btn-sm" style="padding:0 8px;font-size:11.5px" onclick="histNgOffK(${x.id})">NGではない</button>` : ""}` : ""}${colored(x.marks) ? " 🎨" : ""}${x.src_row ? ` <small style="color:#8a6d3b">（エクセル ${x.src_row}行目）</small>` : ""}
      ${x.memo ? `<div style="white-space:pre-wrap">${hlw(x.memo)}</div>` : ""}</div>`;
    if(trouble.length) lines.push(`<div class="warn" style="background:#FFF8F0;border-color:#F3B27A;color:#5c3a00;font-weight:400">
      <b>📝 台帳で何かあった回 ${trouble.length}件（備考は全文）</b>${trouble.slice(0, 3).map(tItem).join("")}
      ${trouble.length > 3 ? `<details><summary style="cursor:pointer;font-weight:800">のこり ${trouble.length - 3}件を見る</summary>${trouble.slice(3).map(tItem).join("")}</details>` : ""}</div>`);
    const old = $("custCaution"); if(old) old.remove();
    $("custInfo").insertAdjacentHTML("afterbegin", `<div id="custCaution">${lines.join("")}${hs.length ? `<div class="hist">📚 台帳（エクセル）の利用 ${done}回${hs[0] && hs[0].biz_date ? "（最後 " + fmt(hs.find(x => x.biz_date).biz_date) + "）" : ""}</div>` : ""}</div>`);
  }catch(e){}
}
const __onCastON = onCast;
onCast = function(){ const r = __onCastON.apply(this, arguments); checkOldNomi(); return r; };
const __openFormON = openForm;
openForm = function(id){ oldNomi = null; custCastNg = null; const r = __openFormON.apply(this, arguments); checkOldNomi(); return r; };

function buildMsgShort(c){
  const cast = M.casts.find(x=>x.id === $("f_cast").value);
  const d = new Date(day + "T12:00:00Z"), st = $("f_start").value;
  $("msg").value = `${cast ? (cast.official_name || cast.temp_name) + "さん" : "おつかれさまです"}
ご予約いただきましたので、アプリでご確認お願いいたします。
（${d.getUTCMonth() + 1}/${d.getUTCDate()}(${DOW[d.getUTCDay()]}) ${st || "--:--"}〜）`;
}

