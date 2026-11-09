/* ============================================================
   📒 記録簿（kiroku.html）の 1/7：受付（記録簿）：受付の小窓・ダミー指名・3P・エリア・ランクと条件・受付ルール・お客さん・計算・予約連絡の文面・保存
   ※ kiroku.html の <script src> の順番どおりに読む（順番を変えると動かなくなる。2026/11/10 1つのファイルから分けた）
   ============================================================ */
/* ============================================================
   受付（記録簿）
   ・料金・バックは Supabase のマスタ（kb_prices・kb_back・kb_options・kb_cast_rules・kb_settings）から自動で計算
   ・キャストはキャスト台帳（master_casts）から選ぶ。お客さんは電話番号で探す
   ・保存すると、だれが・いつ・何を直したかが自動で残る（kb_reservation_log）
   ============================================================ */
const { sb, q, esc, yen, toast } = KB;
const $ = id => document.getElementById(id);
const DOW = ["日","月","火","水","木","金","土"];
const STATUS = { pre_call:"前日確認電話", pre_mail:"前日確認メール", hour_call:"1H前確認電話", hour_mail:"1H前確認メール", moving:"移動中", arrive_call:"到着連絡", wait_guest:"客ホテル入室待ち", wait_cast:"キャストホテル入室待ち", working:"仕事中", done:"終了", wait_cast_reply:"キャスト返事待ち", wait_guest_reply:"お客様返事待ち", wait_foreign_call:"外国人1コール待ち", cancel:"キャンセル", tobi:"トビ", flowed:"流れた（予約不成立）", checking:"確認中（旧）", wait_hotel:"ホテル連絡待ち（旧）" };   // 並び：前日確認〜終了 → 返事待ち → キャンセル・トビ
const STATUS_OLD = ["checking", "wait_hotel"];   // 今は選べない（前の予約のために残している）
const VISIT = [["new","新規"],["repeat","店リピ"],["honshi","本指名"]];
const FREE_SUFFIX = { "":"", free:"フリー", special_free:"特別フリー", event_free:"イベフリー" };

let M = {};              // マスタ一式
let day = "", rows = [], editing = null, curCustomer = null, visit = "new", mediaSel = [];
let backOv = "", backOvFor = -1, backOvNote = "";   // 報酬を手で直した値と、その理由（予約ごと）
let cbackOv = "", cbackFor = -1;   // バック表にないランク×コースのとき、受付で入れたコースのバック（予約ごと）
var custSeen = null;   // custPast＋台帳エクセルの過去の利用（新規・店リピ・本指名を決めるのに使う）
let custPast = null;   // 電話番号で見つけたお客さんの、これまでの予約（キャストを変えたら本指名・店リピを決めなおす）
let showMoney = false;

$("navArea").innerHTML = KB.nav("kiroku.html");
if($("wipArea")) $("wipArea").innerHTML = KB.wipBanner();   // 新しい記録簿では出さない
if(!KB.CAN_EDIT) document.body.classList.add("readonly");
// 受付の外（暗いところ）を押したら、一時保存してから閉じる（先に閉じると一時保存が動かなかった。2026/11/3）
KB.closeOnBackdrop($("formBg"), () => { if(KB.CAN_EDIT) draftSave(true); else closeForm(); });

async function init(){
  if(location.hash) history.replaceState(null, "", location.pathname + location.search);
  if(!(await KB.staffSession())){ $("gate").textContent = "ポータルから開いてください（ポータルでログインしてから20時間たった場合も、開き直してください）"; return; }
  try{
    const r = await Promise.all([
      sb.from("master_stores").select("*").order("sort"),
      sb.from("master_casts").select("*").neq("status","left"),
      sb.from("kb_prices").select("*"),
      sb.from("kb_back").select("*"),
      sb.from("kb_options").select("*").order("sort"),
      sb.from("kb_cast_rules").select("*").eq("active", true),
      sb.from("kb_settings").select("*"),
      sb.from("kb_media").select("*").eq("active", true).order("sort"),
      sb.from("kb_course_info").select("*"),
      sb.from("kb_rank_history").select("cast_id,grp,rank,valid_from,id,hearing_text,by_name,at"),
      sb.from("kb_dummy_names").select("*").eq("active", true).order("sort").order("id"),
      sb.from("kb_cast_checks").select("*").eq("active", true).order("sort").order("id"),
      sb.from("prof_hotels").select("hotel_id,area,hotel_name,map_url,store_status,note,tags").order("seq"),
    ]);
    const [stores, casts, prices, back, options, rules, settings, media, courseInfo, rankHist, dummies, castChecks, hotels] = r.map(q);
    M = { stores, casts, prices, options, rules, media, courseInfo, rankHist: rankHist || [], dummies: dummies || [], castChecks: castChecks || [], hotels: hotels || [], back: {}, set: {} };
    back.forEach(b=>{ M.back[b.rank + "|" + b.course] = b.amount; });
    settings.forEach(s=>{ M.set[s.key] = s.value; });
  try{ M.pops = q(await sb.from("kb_personal_ops").select("*").eq("active", true).order("sort").order("id")) || []; }catch(e){ M.pops = []; }   // 🎁 個人オプション（SQL 236 がまだでも動く）
    M.casts.sort((a,b)=> String(a.kana || a.official_name || a.temp_name).localeCompare(String(b.kana || b.official_name || b.temp_name), "ja"));
  }catch(e){ $("gate").textContent = "読み込みに失敗しました：" + (e.message || e); return; }
  $("gate").style.display = "none"; $("main").style.display = "";
  $("day").value = KB.startDay(); loadDay();   // 精算・回収明細で見ていた日（なければ今日）
}

/* ---------- 日付・一覧 ---------- */
function goToday(){ $("day").value = KB.bizDateOf(); loadDay(); }
function moveDay(n, btn){
  const d = new Date($("day").value + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); $("day").value = d.toISOString().slice(0,10);
  // 押したボタンが上下にずれないように：上のお知らせなどの高さが日によって変わっても、ボタンを同じ場所にもどす
  const top0 = btn ? btn.getBoundingClientRect().top : null;
  const keep = ()=>{ if(top0 == null) return; const dy = btn.getBoundingClientRect().top - top0; if(Math.abs(dy) > 1) window.scrollBy(0, dy); };
  const p = loadDay(); keep(); Promise.resolve(p).then(()=>{ keep(); setTimeout(keep, 300); setTimeout(keep, 1200); });
}
async function loadDay(){
  day = $("day").value; KB.rememberDay(day);
  const d = new Date(day + "T12:00:00Z");
  $("dayInfo").textContent = `${d.getUTCMonth()+1}/${d.getUTCDate()}(${DOW[d.getUTCDay()]}) の営業日（朝6時まで）`;
  try{
    const [res, note] = await Promise.all([
      sb.from("kb_reservations").select("*, kb_customers(*)").eq("biz_date", day).eq("deleted", false).order("start_at"),
      sb.from("kb_day_notes").select("notice").eq("biz_date", day).maybeSingle(),
    ]);
    rows = q(res) || [];
    $("notice").value = (q(note) || {}).notice || "";
  }catch(e){ toast("読み込みに失敗しました：" + (e.message || e)); rows = []; }
  renderList();
}
function castName(id){ const c = M.casts.find(x=>x.id===id); return c ? (c.official_name || c.temp_name) : (id || "—"); }
function storeLabel(k){ const s = M.stores.find(x=>x.key===k); return s ? s.label : k; }
function hmRaw(iso){ if(!iso) return ""; const d = new Date(iso); const j = new Date(d.getTime()+9*3600*1000); return String(j.getUTCHours()).padStart(2,"0")+":"+String(j.getUTCMinutes()).padStart(2,"0"); }
// 深夜（朝6時まで）は 24時より後の書き方にそろえる：3:00 → 27:00（内勤・キャストで書き方をそろえて、まちがえないように。2026/11/4）
function hm(iso){ const s = hmRaw(iso); if(!s) return s; const h = Number(s.slice(0, 2)); return h < 6 ? String(h + 24) + s.slice(2) : s; }
// 時刻の入力欄に入れる値：パソコンは文字の欄なので 27:00 のまま。スマホは時刻の欄なので 03:00
const TIME_TEXT = !/iPhone|iPad|Android/i.test(navigator.userAgent);
function hmIn(iso){ return TIME_TEXT ? hm(iso) : hmRaw(iso); }
// 時・分 → 「27:00」の形（24時より後の書き方）
function lateHM(t){ t = Math.round(t); let h = Math.floor(t / 60) % 24; const m = ((t % 60) + 60) % 60; if(h < 6) h += 24; return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0"); }
function backOf(r){ return KBM.backOf(r); }   // 💴 kb_money.js

function renderList(){
  const live = rows.filter(r=>r.status !== "cancel" && r.status !== "tobi" && r.status !== "flowed");
  const total = live.reduce((a,r)=>a + r.total, 0), back = live.reduce((a,r)=>a + backOf(r), 0);
  $("sum").innerHTML = `<div class="s">件数<b>${live.length}件</b></div>
    <div class="s ${showMoney?"":"hide"}">売上総額<b>${yen(total)}</b></div>
    <div class="s ${showMoney?"":"hide"}">キャスト報酬<b>${yen(back)}</b></div>
    <div class="s ${showMoney?"":"hide"}">店落ち（暫定）<b>${yen(total - back)}</b></div>
    <button class="btn btn-ghost btn-sm" onclick="showMoney=!showMoney;renderList()">${showMoney?"🙈 金額をかくす":"👁 金額を見る"}</button>`;
  $("list").innerHTML = rows.length ? `<tr><th>時間</th><th>キャスト</th><th>店舗</th><th>コース</th><th>お客さん</th><th>状態（ここで変えられる）</th><th>キャストに</th><th>総額</th><th>報酬</th><th>対応した内勤・日時</th></tr>` +
    rows.map(r=>{
      const c = r.kb_customers || {};
      const when = t => { if(!t) return ""; const d = new Date(t); return (d.getMonth()+1) + "/" + d.getDate() + " " + String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0"); };
      // 状態は、一覧から直接変えられる（小窓を開かなくてよい）
      const stSel = KB.CAN_EDIT
        ? `<select class="stsel st ${r.status}" onclick="event.stopPropagation()" onchange="quickStatus(${r.id},this.value)">${stOpts(r, Object.keys(STATUS))}</select>`
        : `<span class="st ${r.status}">${STATUS[r.status]||r.status}</span>`;
      return `<tr class="r" onclick="openForm(${r.id})">
        <td>${hm(r.start_at)}〜${hm(r.end_at)}</td><td>${r.dummy_name ? `<small style="color:#6c5896">🎭${esc(r.dummy_name)} →</small> ` : ""}<b>${esc(castName(r.cast_id))}</b></td><td>${esc(storeLabel(r.store_key))}</td>
        <td>${esc(r.course)}${r.free_kind?"・"+FREE_SUFFIX[r.free_kind]:""}${r.extension_count?" 延長"+r.extension_count:""}${r.payment!=="cash"?" 💳":""}</td>
        <td>${c.ng?"⚠️":""}${esc(c.name||"")}<small style="color:var(--sub)"> ${VISIT.find(v=>v[0]===r.visit_kind)?.[1]||""}</small></td>
        <td>${stSel}</td>
        <td>${r.cast_notified_at ? `<span style="color:#2f9e6e;font-weight:800">✅ 伝えた</span><br><small style="color:var(--sub)">${esc(r.cast_notified_by||"")} ${when(r.cast_notified_at)}</small>` : `<span style="color:#d9534f;font-weight:800">⚠️ まだ</span>`}</td>
        <td class="money">${yen(r.total)}</td><td class="money">${yen(backOf(r))}</td>
        <td><small>受付：${esc(r.created_by||"")} ${when(r.created_at)}${r.updated_by && r.updated_at !== r.created_at ? `<br>最後：${esc(r.updated_by)} ${when(r.updated_at)}` : ""}</small></td></tr>`;
    }).join("") : `<tr><td style="text-align:center;color:var(--sub);font-weight:800;padding:24px">この日の受付はまだありません</td></tr>`;
}
// 一覧から状態だけ変える
async function quickStatus(id, st){
  if(!KB.CAN_EDIT) return;
  try{
    q(await sb.from("kb_reservations").update(Object.assign({ status: st, updated_by: KB.operatorName() }, (rows.find(x => x.id === id) || {}).status_at ? { status_at: null } : {})).eq("id", id));
    const r = rows.find(x=>x.id === id); if(r){ r.status = st; if(r.status_at) r.status_at = null; r.updated_by = KB.operatorName(); r.updated_at = new Date().toISOString(); }
    toast("状態を「" + STATUS[st] + "」にしました"); renderList();
  }catch(e){ toast("変えられませんでした：" + (e.message || e)); loadDay(); }
}
// 📞 前日確電・1H前確電がきた（予約の状態を「前日確認電話／メール」「1H前確認電話／メール」から次に進めた）→ その種類のテンプレを、そのキャストをえらんだ状態で開く（2026/11/7 店長）
//   テンプレがまだなければ、登録のしかたを知らせるだけ
{ const __qsTpl = quickStatus; quickStatus = async function(id, st){
    const r0 = rows.find(x => x.id === id), was = r0 && r0.status;
    const res = await __qsTpl.apply(this, arguments);
    const sc = ["pre_call", "pre_mail"].includes(was) ? "前日確電" : ["hour_call", "hour_mail"].includes(was) ? "1H前確電" : "";
    if(sc && st !== was && !["cancel", "tobi", "flowed", "pre_call", "pre_mail", "hour_call", "hour_mail"].includes(st)){
      if(tplList().some(t => (t.scene || "") === sc)) openTplBox(null, r0.cast_id || "", sc);
      else toast(`📝「${sc}」のテンプレを登録しておくと、ここで開いてコピーできます（📝 テンプレ → 種類「${sc}」）`);
    }
    return res; }; }
async function saveNotice(){
  if(!KB.CAN_EDIT) return;
  try{ q(await sb.from("kb_day_notes").upsert({ biz_date: day, notice: $("notice").value, updated_by: KB.operatorName() })); toast("お知らせを保存しました"); if(day === KB.bizDateOf()) noticeSeenSet(day, $("notice").value); }
  catch(e){ toast("保存できませんでした：" + (e.message || e)); }
}

/* ---------- 受付の小窓 ---------- */
function storeGroup(store){ const br = M.set.back_ranks || {}; for(const g in br){ if((br[g]||[]).includes(store)) return g; } return "sakurana"; }
// お泊り「泊23-5」は 23時〜5時 → 6時間（前は泊はいつも8時間だった。2026/11/4）
function minutesOf(course){
  const s = String(course).normalize("NFKC");
  if(s.includes("泊")){ const t = s.match(/(\d{1,2})\s*[-〜~～]\s*(\d{1,2})/); if(t){ const h = ((Number(t[2]) - Number(t[1])) % 24 + 24) % 24; if(h) return h * 60; } return 480; }
  const m = s.match(/(\d+)$/); return m ? Number(m[1]) : 0;
}

function openForm(id){
  editing = id ? rows.find(r=>r.id===id) : null;
  const r = editing || {};
  $("formTitle").textContent = id ? `受付の編集（No.${id}）` : "＋ 受付";
  $("receptionNotes").innerHTML = (M.set.reception_notes || []).map(t=>`<div class="info">📌 ${esc(t)}</div>`).join("");
  // 新しい受付は、店舗・指名・種別・支払い方法を「まだ選んでいない」から（必須）
  $("f_store").innerHTML = `<option value="">（店舗を選ぶ）</option>` + M.stores.map(s=>`<option value="${s.key}">${esc(s.label)}</option>`).join("");
  $("f_store").value = id ? (r.store_key || "sakuramoon") : "";
  nomiChosen = true;   // 新しい受付も「指名あり」を選んだところから（フリーのときだけ押しかえる）
  const grp = { active:"在籍", break:"お休み中", new:"入店前", interview:"面接中" };
  $("f_cast").innerHTML = `<option value="">（キャストを選ぶ）</option>` + Object.keys(grp).map(st=>{
    const list = M.casts.filter(c=>c.status===st); if(!list.length) return "";
    return `<optgroup label="${grp[st]}">` + list.map(c=>`<option value="${c.id}">${esc(c.official_name || c.temp_name)}</option>`).join("") + `</optgroup>`;
  }).join("");
  $("f_cast").value = r.cast_id || "";
  $("f_start").value = r.start_at ? hmIn(r.start_at) : "";
  $("f_status").innerHTML = `<option value="">⚠️ 選択してください</option>` + Object.keys(STATUS).filter(k=>!STATUS_OLD.includes(k) || k === r.status).map(k=>`<option value="${k}">${STATUS[k]}</option>`).join("");
  $("f_status").value = r.status || "";
  stColor();
  // キャストに伝えたか
  $("f_notified").checked = !!r.cast_notified_at;
  $("notifiedInfo").textContent = r.cast_notified_at ? (r.cast_notified_by || "") + " " + new Date(r.cast_notified_at).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  // あとで書くこと：店NG・メモ・備考が入っていれば開いておく
  $("laterBox").open = !!(r.kb_customers && r.kb_customers.ng);
  $("f_free").value = r.free_kind || "";
  $("f_ext").value = r.extension_count || 0; $("f_date").value = r.date_count || 0;
  $("f_nh").checked = !!r.nh_rate; $("f_adm").checked = (r.admission || 0) > 0;
  setDress(r.dress);
  // 👥 3P・4P：保存してある予約は、OP（3p_cast／3p_guest）から
  { const po = (r.options || []).find(o => o.code === "3p_cast" || o.code === "3p_guest");
    party = { kind: po ? (po.code === "3p_guest" ? "guest" : "cast") : "", n: po && /4P/.test(po.label) ? 3 : 2, casts: [], af: [], grp: (po && po.grp) || "",
      note: ((r.memo_log || []).find(m => /^👥/.test(m.text || "")) || {}).text || "" }; }
  fillAreaSel(r.area || ""); $("f_address").value = r.address || "";
  setRadio("f_afw", r.af_wish || ""); setRadio("f_rafw", r.rev_af_wish || ""); syncAfSel();
  $("optDetails").open = false;
  $("f_transport").value = r.transport || 0; $("f_discount").value = r.discount || 0; $("f_discnote").value = r.discount_note || "";
  $("f_pay").value = id ? (r.payment === "card_paid" ? "card" : r.payment === "cash" && Number(r.card_total) > 0 ? "split" : (r.payment || "cash")) : "";
  if($("f_cardpart")) $("f_cardpart").value = id && r.payment === "cash" && Number(r.card_total) > 0 ? Math.round(Number(r.card_total) / ((M.set.card || {}).rate || 1.15)) : "";
  $("f_confirm").value = r.confirm_call || ""; $("f_note").value = r.note || "";
  visit = id ? (r.visit_kind || "new") : ""; mediaSel = (r.media || []).slice();
  document.querySelectorAll("#formBg .miss").forEach(el=>el.classList.remove("miss"));
  const c = r.kb_customers || {};
  curCustomer = r.customer_id ? { id: r.customer_id, ...c } : null;
  $("f_phone").value = c.phone || ""; $("f_name").value = c.name || ""; $("f_email").value = c.email || ""; $("f_ng").value = c.ng ? "1" : "0"; $("f_custnote").value = "";
  $("custInfo").innerHTML = "";
  onStore(r);
  onCast();
  if(curCustomer) lookupCustomer(true);
  $("delBtn").style.display = id ? "" : "none";
  document.querySelectorAll("#formBg input, #formBg select, #formBg textarea:not(#msg)").forEach(el=>{ el.disabled = !KB.CAN_EDIT; });
  $("logInfo").textContent = "";
  if(id) loadLog(id);
  $("formBg").classList.add("show");
  recalc();
}
function closeForm(){ $("formBg").classList.remove("show"); }

function onStore(r){
  const store = $("f_store").value, g = storeGroup(store);
  const list = M.prices.filter(p=>p.store_key===store);
  const keep = (r && r.course) || $("f_course").value;
  $("f_course").innerHTML = `<option value="">（コースを選ぶ）</option>` + list.map(p=>`<option value="${esc(p.course)}">${esc(p.course)}${/^\d+$/.test(p.course)?"分" + (Number(p.course) >= 60 ? "（" + (Math.round(Number(p.course) / 6) / 10) + "時間）" : ""):""}　${yen(p.price)}${p.note?"（"+esc(p.note)+"）":""}</option>`).join("");
  if(keep && list.some(p=>p.course===keep)) $("f_course").value = keep;
  // オプション
  const sel = (r && r.options) || [];
  $("f_opts").innerHTML = M.options.filter(o=>o.store_group===g && !/^[34]P/.test(o.label || "")).map(o=>{   // 3P・4Pは上の「👥 3P・4P」で選ぶ
    const s = sel.find(x=>x.code===o.code && x.group===g);
    const qty = s ? s.qty : 1;
    // AF・逆AF は上の「必ず聞く」で選ぶので、ここには出さない（チェックだけ自動）
    return `<div class="opt" ${["af", "gyakuaf"].includes(o.code) ? 'style="display:none"' : ""}>
      <input type="checkbox" id="o_${o.code}" ${s?"checked":""} onchange="recalc()">
      <label class="lbl" for="o_${o.code}">${esc(o.label)}${o.note?`<br><small>${esc(o.note)}</small>`:""}</label>
      <input type="number" id="oq_${o.code}" min="1" value="${qty}" title="${o.unit==="per_item"?"枚数":o.unit==="per_cast"?"キャストの人数":"回数"}" oninput="recalc()" ${o.unit==="once"?'style="visibility:hidden"':""}>
      <input type="number" id="op_${o.code}" value="${s?s.price:o.price}" title="料金（1回あたり）" oninput="recalc()" ${o.manual?"":"readonly"}>
      <input type="number" id="ob_${o.code}" value="${s?s.back:o.back}" title="バック（1回あたり）" oninput="recalc()" ${o.manual?"":"readonly"}>
      <input class="opmemo" id="om_${o.code}" value="${esc((s && s.memo) || "")}" placeholder="📝 メモ（キャストに送る文に出ます。例：ナース・白）" oninput="recalc()">
    </div>`;
  }).join("") + `<div style="font-size:11px;color:var(--sub);margin-top:4px">右の2つは「料金」「バック」（1回あたり）。内容で変わるOPだけ直せます。</div>`;
  const xs = sel.filter(s=>/^custom\d*$/.test(s.code || "")).sort((a, b)=>(Number(a.code.slice(6)) || 1) - (Number(b.code.slice(6)) || 1)), x = xs[0];   // ほかのOP：1つめは上の欄、2つめからは足した欄
  $("f_xop_label").value = x ? x.label : ""; $("f_xop_price").value = x ? x.price : ""; $("f_xop_back").value = x ? x.back : "";
  clearXop(); xs.slice(1).forEach(o => addXop(null, o));
  // 媒体・新規リピ
  $("f_media").innerHTML = M.media.map(m=>`<button type="button" class="chip ${mediaSel.includes(m.code)?"on":""}" onclick="toggleMedia('${m.code}')">${esc(m.label)}</button>`).join("");
  $("f_visit").innerHTML = VISIT.map(([k,l])=>`<button type="button" class="chip ${visit===k?"on":""}" onclick="setVisit('${k}')">${l}</button>`).join("");
  renderNomiChips();
  renderPops(r ? (r.options || []) : undefined);   // 🎁 個人オプション（予約を開いたときは、入っていた分にチェック。お店を変えただけならチェックはそのまま）
  storeOnlyFields();
  optSummary();
  // ダミーのお店：ダミー名を選ぶ
  renderDummy(r ? (r.dummy_name || "") : undefined);
  // コースの説明（極門）
  recalc();
}

/* ---------- ダミー指名（極門・エイティーン） ---------- */
/* ---------- ダミーキャストのデータ・マッチ率（極門・エイティーン） ----------
   ダミーを選ぶと、その日出勤しているキャストを「近い順」に出す。
   比べるもの：身長・カップ・Pサイズ（キャストプロフの「T158-B82(D)-W58-H85」「15、太め」から読む）、
              AF・逆AF・射精の可否（キャストプロフのオプション ◎○△×）
   出勤：サクラシフト（shift_weeks）のその日のシフト */
const MARKS = ["", "◎", "○", "△", "×"];
let profById = null;            // キャストプロフ（prof_id → data）
const shiftCache = {};          // 営業日 → { シフト名: {start,end,confirmed} }
async function loadProfs(){
  if(profById) return profById;
  const rows = q(await sb.from("prof_casts").select("id,data").eq("deleted", false)) || [];
  profById = {}; rows.forEach(r=>{ profById[r.id] = r.data || {}; });
  return profById;
}
function weekKeyOfYmd(s){
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay(), diff = dow === 0 ? -6 : 1 - dow;
  dt.setUTCDate(dt.getUTCDate() + diff);
  return dt.toISOString().slice(0, 10);
}
async function loadShifts(ymd){
  if(shiftCache[ymd]) return shiftCache[ymd];
  const src = ymd === KB.PRACTICE_DAY ? KB.realBizDateOf() : ymd;   // 🧪 練習の日は、今日のシフトを出す
  const rows = q(await sb.from("shift_weeks").select("cast_name,data").eq("wk", weekKeyOfYmd(src))) || [];
  const out = {};
  rows.forEach(r=>{
    const sh = r.data && r.data.shifts && r.data.shifts[src];
    // 内勤が受理（確認通知）したシフトだけ。サクラシフトでは 受理 → 入力待ち → 内勤入力中 → 確定 と進む（媒体へ入れ終わると確定）。
    // 変更の申請中・入力中・変更確定も、受理したことがあるので出す。出さないのは「未提出」「提出済み（まだ受理していない）」だけ
    if(!["input_waiting", "inputting", "confirmed", "change_requested", "change_inputting", "change_confirmed"].includes(r.data && r.data.status)) return;
    if(sh && sh.start != null && sh.end != null) out[r.cast_name] = { start: sh.start, end: sh.end, confirmed: ["confirmed", "change_confirmed"].includes(r.data.status), kanzen: !!((r.data.kanzen || {})[src]) };   // kanzen＝完（完全終了。キャストがシフトで書く）2026/11/5
    else {
      // その日（営業日の朝6時より後）にシフトで消された子は、記録簿には「欠勤」として残す（元のシフトの時間で）2026/11/6 店長OK
      const h = ((r.data.changeHistory || {})[src]) || [], first = h[0], last = h[h.length - 1];
      if(first && first.before && last && !last.after && last.at && new Date(last.at) >= new Date(src + "T06:00:00+09:00"))
        out[r.cast_name] = { start: first.before.start, end: first.before.end, confirmed: false, kanzen: false, dropped: true, droppedAt: last.at, droppedBy: last.by || "" };
    }
  });
  return (shiftCache[ymd] = out);
}
function hourLabel(h){ h = Number(h); const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return (hh >= 24 ? "翌" + (hh - 24) : hh) + ":" + String(mm).padStart(2, "0"); }   // 18.5 → 18:30
// キャストプロフから、身長・カップ・Pサイズ・AF など
function specOfProf(d){
  const sp = (d.storeProfiles && d.storeProfiles["サクラムーン"]) || {};
  const size = String(sp.size || d.size || ""), ps = String(sp.psize || d.psize || "");
  const opts = Object.assign({}, d.options || {}, sp.options || {});
  const t = size.match(/T\s*(\d{3})/i), cup = size.match(/\(\s*([A-K])\s*\)/i) || size.match(/([A-K])\s*カップ/i), p = ps.match(/(\d+(?:\.\d+)?)/);
  return { height: t ? Number(t[1]) : null, cup: cup ? cup[1].toUpperCase() : "", psize: p ? Number(p[1]) : null,
           af: opts["AF"] || "", rev_af: opts["逆AF"] || "",
           shasei: opts["キャスト射精"] || opts["射精"] || opts[Object.keys(opts).find(k => /^(キャスト)?射精/.test(k) && !/無限|顔|口/.test(k)) || ""] || "", size, psizeText: ps };   // プロフのオプション名がちがっても読む
}
// ダミー名の写真（公式HPの在籍番号 hp_no から。SQL 156）。押すと公式HPのその子のページ
const DUMMY_SITE = { eighteen: "18-josokko-gakuen", gokumon: "gokumon-sm" };
function dmProfUrl(d){ const site = DUMMY_SITE[d && d.store_key], no = d && Number(d.hp_no); return site && no ? `https://www.${site}.com/gal/gal-${no}.html` : ""; }   // 公式HPのその子のページ
function dmPhoto(d, w){
  const site = DUMMY_SITE[d && d.store_key], no = d && Number(d.hp_no);
  if(!site || !no) return "";
  return `<a href="https://www.${site}.com/gal/gal-${no}.html" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="flex:none;line-height:0"><img src="https://www.${site}.com/galpic/gal180x240-${no}.jpg" alt="" loading="lazy" onerror="this.parentNode.remove()" style="width:${w}px;height:${Math.round(w * 4 / 3)}px;object-fit:cover;border-radius:8px;background:#eee"></a>`;
}
// 近さ（100 がいちばん近い）。比べられるものがなければ null
// 見た目のタグ（SQL 157。ダミー名は kb_dummy_names.look、キャストは master_casts.look）
const LOOK = { vibe: ["清楚", "かわいい系", "きれい系", "ギャル", "ボーイッシュ", "大人っぽい", "ロリ系"], len: ["ショート", "ボブ", "ミディアム", "ロング"], color: ["黒", "暗め", "明るめ", "金・派手"] };
function lookText(lk){ lk = lk || {}; return [(lk.vibe || []).join("・"), lk.len, lk.color, lk.wig ? "ウィッグ可" : ""].filter(Boolean).join(" "); }
// 重み：身長40・カップ30・Pサイズ30・AF/逆AF（できないと大きく下げる）＞ 見た目（雰囲気25・髪の長さ18・髪の明るさ15。ウィッグで変えられる子は髪を見ない）
function matchScore(dm, sp, c){
  let s = 100, n = 0;
  if(dm.height && sp.height){ s -= Math.min(40, Math.abs(dm.height - sp.height) * 2); n++; }
  if(dm.cup && sp.cup){ s -= Math.min(30, Math.abs(dm.cup.charCodeAt(0) - sp.cup.charCodeAt(0)) * 8); n++; }
  if(dm.psize && sp.psize){ s -= Math.min(30, Math.abs(Number(dm.psize) - sp.psize) * 6); n++; }
  [["af", 50, 20], ["rev_af", 50, 20], ["shasei", 40, 10]].forEach(([k, x, tri])=>{
    if(dm[k] === "◎" || dm[k] === "○"){ n++; if(sp[k] === "×") s -= x; else if(sp[k] === "△") s -= tri; else if(!sp[k]) s -= 5; }
  });
  const a = dm.look || {}, b = (c && c.look) || {};
  if((a.vibe || []).length && (b.vibe || []).length){ const same = a.vibe.filter(v => b.vibe.includes(v)).length; s -= Math.round(25 * (1 - same / Math.min(a.vibe.length, b.vibe.length))); n++; }
  if(!b.wig){
    const step = (k, per, max) => { const i = LOOK[k].indexOf(a[k]), j = LOOK[k].indexOf(b[k]); if(i >= 0 && j >= 0){ s -= Math.min(max, Math.abs(i - j) * per); n++; } };
    step("len", 6, 18); step("color", 5, 15);
  }
  return n ? Math.max(0, Math.round(s)) : null;
}
async function renderDummyMatch(){
  const el = $("dummyMatch");
  const store = $("f_store").value, name = $("f_dummy").value;
  if(!isDummyStore(store) || !name){ el.innerHTML = ""; return; }
  const dm = M.dummies.find(d=>d.store_key === store && d.name === name) || {};
  const spec = [dm.age ? dm.age + "歳" : "", dm.height ? "T" + dm.height : "", dm.weight ? dm.weight + "kg" : "", dm.cup ? dm.cup + "カップ" : "", dm.psize ? "P" + dm.psize : ""].filter(Boolean).join(" ");
  const ops = [["AF", dm.af], ["逆AF", dm.rev_af], ["射精", dm.shasei]].filter(x=>x[1]).map(x=>x[0] + x[1]).join(" ");
  el.innerHTML = `<div style="font-size:12.5px;margin-top:6px;display:flex;gap:8px;align-items:flex-start">${dmPhoto(dm, 90)}<div><b>🎭 ${esc(name)}</b>：${esc(spec || "データなし")} ${esc(ops)}${lookText(dm.look) ? `<br><small>👀 ${esc(lookText(dm.look))}</small>` : ""}${dm.note ? `<br><small>${esc(dm.note)}</small>` : ""}</div></div>
    <div style="font-size:12px;color:var(--sub);margin-top:4px">近いキャストを探しています…</div>`;
  try{
    const [profs, shifts] = await Promise.all([loadProfs(), loadShifts(($("f_day") && $("f_day").value) || day)]);   // 受付の日付のシフト
    if($("f_dummy").value !== name) return;   // 選びなおされた
    const rows = M.casts.map(c=>{
      const sh = shifts[c.shift_name] || shifts[c.official_name];
      if(!sh) return null;
      const sp = specOfProf(profs[c.prof_id] || {});
      return { c, sh, sp, score: matchScore(dm, sp, c) };
    }).filter(Boolean).sort((a, b)=>(b.score == null ? -1 : b.score) - (a.score == null ? -1 : a.score));
    const head = el.firstElementChild.outerHTML;
    if(!rows.length){ el.innerHTML = head + `<div class="warn" style="margin-top:4px">この日（${esc(day)}）出勤のキャストが、サクラシフトに見つかりません</div>`; return; }
    el.innerHTML = head + `<div style="font-size:12px;font-weight:800;margin:6px 0 2px">🎯 この日出勤しているキャスト（近い順）</div>`
      + rows.map(x=>{
        const op = [["AF", x.sp.af], ["逆AF", x.sp.rev_af], ["射精", x.sp.shasei]].map(o=>o[0] + (o[1] || "？")).join(" ");
        return `<div style="display:flex;gap:6px;align-items:center;background:#fff;border-radius:10px;padding:6px 8px;margin-bottom:4px;font-size:12.5px">
          ${pctBadge(x.score)}
          <div style="flex:1"><b>${esc(x.c.official_name || x.c.temp_name)}</b> <small>${hourLabel(x.sh.start)}〜${hourLabel(x.sh.end)}${x.sh.confirmed ? "" : "（未確定）"}</small><br>
            <small style="color:var(--sub)">${esc(x.sp.size || "サイズなし")} P${esc(x.sp.psizeText || "？")}　${esc(op)}${lookText(x.c.look) ? "　👀" + esc(lookText(x.c.look)) : ""}</small></div>
          <button type="button" class="btn btn-ghost btn-sm" onclick="$('f_cast').value='${x.c.id}';onCast()">この人にする</button></div>`;
      }).join("")
      + `<div style="font-size:11px;color:var(--sub)">％は身長・カップ・Pサイズ・AF/逆AF/射精の近さの目安です（体重はキャストプロフにないので比べていません）</div>`;
  }catch(e){ el.innerHTML = `<div class="warn">近いキャストを探せませんでした：${esc(e.message || e)}</div>`; }
}

// ダミーキャストのデータを入れる・直す
function openDummyData(id){
  const d = M.dummies.find(x=>x.id === id); if(!d) return;
  const sel = (k)=>`<select id="dd_${k}">${MARKS.map(m=>`<option value="${m}" ${d[k] === m ? "selected" : ""}>${m || "－"}</option>`).join("")}</select>`;
  $("dummyEdit").innerHTML = `<div style="font-size:12.5px;font-weight:800;margin-bottom:4px;display:flex;gap:8px;align-items:flex-end">${dmPhoto(d, 72)}🎭 ${esc(d.name)} のデータ</div>
    <div class="grid3">
      <div class="f"><label>年齢</label><input id="dd_age" type="number" value="${d.age ?? ""}"></div>
      <div class="f"><label>身長（cm）</label><input id="dd_height" type="number" value="${d.height ?? ""}"></div>
      <div class="f"><label>体重（kg）</label><input id="dd_weight" type="number" value="${d.weight ?? ""}"></div>
      <div class="f"><label>カップ</label><input id="dd_cup" maxlength="5" value="${esc(d.cup || "")}" placeholder="C"></div>
      <div class="f"><label>Pサイズ（cm）</label><input id="dd_psize" type="number" step="0.5" value="${d.psize ?? ""}"></div>
      <div class="f"><label>AF</label>${sel("af")}</div>
      <div class="f"><label>逆AF</label>${sel("rev_af")}</div>
      <div class="f"><label>射精</label>${sel("shasei")}</div>
      <div class="f"><label>指名料（円・空ならふつう）</label><input id="dd_nomi" type="number" step="500" value="${d.nomination_fee ?? ""}" placeholder="例：3000"></div>
      <div class="f"><label>公式HPの番号（写真用）</label><input id="dd_hpno" type="number" value="${d.hp_no ?? ""}" placeholder="gal-○○ の数字"></div>
    </div>
    ${"look" in d ? `<div class="f" style="margin-top:6px"><label>👀 見た目（公式HPの写真を見て選ぶ・マッチ率に使います）</label>
      <div style="display:flex;flex-wrap:wrap;gap:4px 10px;font-size:13px">${LOOK.vibe.map(v => `<label style="display:flex;gap:3px;align-items:center;font-weight:600"><input type="checkbox" class="dd_vibe" value="${v}" style="width:auto" ${((d.look || {}).vibe || []).includes(v) ? "checked" : ""}>${v}</label>`).join("")}</div>
      <div style="display:flex;gap:6px;margin-top:4px">${[["len", "髪の長さ"], ["color", "髪の明るさ"]].map(([k, l]) => `<select id="dd_${k}" style="flex:1"><option value="">${l}（－）</option>${LOOK[k].map(v => `<option ${(d.look || {})[k] === v ? "selected" : ""}>${v}</option>`).join("")}</select>`).join("")}</div></div>` : ""}
    <div class="f"><label>メモ</label><input id="dd_note" maxlength="500" value="${esc(d.note || "")}"></div>
    <div style="display:flex;gap:6px;margin-top:6px"><button type="button" class="btn btn-primary btn-sm" onclick="saveDummyData(${id})">保存</button>
      <button type="button" class="btn btn-ghost btn-sm" onclick="renderDummyEdit()">もどる</button></div>`;
}
async function saveDummyData(id){
  const n = k => { const v = $("dd_" + k).value; return v === "" ? null : Number(v); };
  const u = { age: n("age"), height: n("height"), weight: n("weight"), psize: n("psize"),
              cup: $("dd_cup").value.trim().toUpperCase(), af: $("dd_af").value, rev_af: $("dd_rev_af").value, shasei: $("dd_shasei").value, note: $("dd_note").value.trim() };
  if(M.dummies.some(x => "nomination_fee" in x)) u.nomination_fee = n("nomi");   // SQL 155 のあと
  if(M.dummies.some(x => "hp_no" in x)) u.hp_no = n("hpno");   // SQL 156 のあと
  if($("dd_len")) u.look = { vibe: [...document.querySelectorAll(".dd_vibe:checked")].map(x => x.value), len: $("dd_len").value, color: $("dd_color").value };   // SQL 157 のあと
  try{
    q(await sb.from("kb_dummy_names").update(u).eq("id", id));
    Object.assign(M.dummies.find(x=>x.id === id), u);
    toast("ダミーのデータを保存しました"); renderDummyEdit(); renderDummyMatch();
  }catch(e){ toast("保存できませんでした：" + (e.message || e)); }
}

/* ---------- お店で出る欄（NH料金はキューティだけ・入会金は極門だけ） ---------- */
function storeOnlyFields(){
  const store = $("f_store").value;
  const nh = store === "cutie", adm = store === "gokumon";
  $("nhWrap").style.display = nh ? "" : "none"; if(!nh) $("f_nh").checked = false;
  $("admWrap").style.display = adm ? "" : "none"; if(!adm) $("f_adm").checked = false;
  $("dressWrap").style.display = nh ? "" : "none";   // 👗 キューティーは、お客さんの女装の欄
}
/* ---------- 👥 3P・4P ----------
   キャスト複数：1つの受付画面で、一緒に行くキャストも選ぶ → 保存すると、キャストごとの予約（その子の料金・バック）を自動で作る
   お客2名：基本料金×2＋3,000円（1つの予約）。どちらも 3P料金は 1人 3,000円（バック 2,000円） */
const PARTY_FEE = 3000, PARTY_BACK = 2000;
let party = { kind: "", n: 2, casts: [], af: [] };   // kind：""／"cast"／"guest"
function paintParty(){
  const opt = [["", "なし"], ["cast2", "キャスト2名（3P）"], ["cast3", "キャスト3名（4P）"], ["guest", "お客2名（3P）"]];
  const cur = party.kind === "cast" ? "cast" + party.n : party.kind;
  $("partyNow").textContent = party.kind ? "：" + (opt.find(o => o[0] === cur) || [])[1] : "";
  if(party.kind){ $("partyWrap").open = true; $("optDetails").open = true; }
  $("partyChips").innerHTML = opt.map(([k, l]) => `<button type="button" class="chip ${cur === k ? "on" : ""}" ${editing && party.kind === "cast" && k !== cur ? "disabled" : ""} onclick="setParty('${k}')">${l}</button>`).join("");
  if(party.kind !== "cast"){ $("partyCasts").innerHTML = party.kind === "guest" ? `<div style="font-size:12px;color:#1f5d99">（基本料金＋指名料）×2＋3P料金 ${yen(PARTY_FEE * 2)}（バック ${yen(PARTY_BACK * 2)}）。コースのバックも×2</div>` : ""; return; }
  if(editing){ $("partyCasts").innerHTML = `<div style="font-size:12px;color:#1f5d99">${esc(party.note || "一緒に行ったキャストの予約は、それぞれの枠にあります")}（直すときは、その子の予約も開いて直してください）</div>`; return; }
  const opts = $("f_cast").innerHTML;
  $("partyCasts").innerHTML = `<div style="font-size:12px;color:#1f5d99;margin-bottom:4px">上の「キャスト」＋一緒に行くキャスト。保存すると、<b>キャストごとの予約</b>（その子の料金・バック・AF・逆AF・3P料金 ${yen(PARTY_FEE)}）を自動で作ります。ほかの有料オプションは上の子の予約だけに入るので、ほかの子につけるときは保存したあとその子の枠で</div>`
    + Array.from({ length: party.n - 1 }, (_, i) => { const w = party.af[i] || {}, yn = (k, v) => `<label class="ynb"><input type="radio" name="p${k}_${i}" value="${v}" ${w[k] === v ? "checked" : ""} onchange="party.af[${i}]=Object.assign(party.af[${i}]||{},{${k}:'${v}'});recalc()"><span>${v === "yes" ? "〇" : "✕"}</span></label>`;
      return `<div class="f" style="margin-top:4px"><label>👤 一緒に行くキャスト${party.n > 2 ? " " + (i + 1) : ""}</label><select class="pcast" data-i="${i}" onchange="party.casts[${i}]=this.value;paintParty();recalc()">${opts}</select>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:4px;font-size:13px;font-weight:700">この子へのご希望　<span>AF：${yn("af", "yes")}${yn("af", "no")}</span><span>逆AF：${yn("raf", "yes")}${yn("raf", "no")}</span></div></div>`; }).join("")
    + `<div class="f" style="margin-top:6px"><label>💴 代表してお金をもらう子</label><select id="partyRep" onchange="party.rep=this.value;recalc()"></select></div>`;
  document.querySelectorAll("#partyCasts .pcast").forEach(s => { s.value = party.casts[Number(s.dataset.i)] || ""; });
  partyRepPaint();
}
function partyMembers(){ return [$("f_cast").value, ...party.casts].filter(Boolean); }
function partyRepPaint(){
  const el = $("partyRep"); if(!el) return;
  const ms = partyMembers();
  if(!ms.includes(party.rep)) party.rep = ms[0] || "";
  el.innerHTML = ms.map(id => `<option value="${id}">${esc(castName(id))}</option>`).join("") || `<option value="">（キャストを選ぶ）</option>`;
  el.value = party.rep || "";
}
// 一緒に行く子も、有料オプション・交通費は同じ（11/2 きゃ：3Pはオプションも交通費も人数ぶん）。AF・逆AFだけ、その子のご希望で
function withAf(w, fn){ return withAf0(w, fn); }
// 一緒に行く子のAF・逆AFのご希望で、いったん計算する（終わったら上の子のご希望にもどす）
function withAf0(w, fn){
  const keep = { af: radioVal("f_afw"), raf: radioVal("f_rafw"), o1: $("o_af") ? $("o_af").checked : null, o2: $("o_gyakuaf") ? $("o_gyakuaf").checked : null };
  if(w){
    setRadio("f_afw", w.af || ""); setRadio("f_rafw", w.raf || "");
    const g = storeGroup($("f_store").value), af = w.af === "yes", raf = w.raf === "yes", has = code => !!$("o_" + code) && M.options.some(o => o.store_group === g && o.code === code);
    if(has("gyakuaf")){ if(has("af")) $("o_af").checked = af; $("o_gyakuaf").checked = raf; } else if(has("af")) $("o_af").checked = af || raf;
  }
  try{ return fn(); }
  finally{ setRadio("f_afw", keep.af); setRadio("f_rafw", keep.raf); syncAfSel(); if(keep.o1 !== null) $("o_af").checked = keep.o1; if(keep.o2 !== null) $("o_gyakuaf").checked = keep.o2; }
}
// 1人ずつの料金（その子で計算しなおす）
function partyShares(){
  const main = $("f_cast").value, ms = partyMembers();
  const out = ms.map((cid, i) => { $("f_cast").value = cid; return { cid, total: withAf(i ? party.af[party.casts.indexOf(cid)] : null, () => calc().total) }; });
  $("f_cast").value = main;
  return out;
}
function setParty(k){
  party.kind = k === "guest" ? "guest" : k ? "cast" : ""; party.n = k === "cast3" ? 3 : 2;
  party.casts = party.casts.slice(0, party.n - 1); party.af = (party.af || []).slice(0, party.n - 1);
  paintParty(); recalc();
  try{ renderCastChecks(M.casts.find(c => c.id === $("f_cast").value)); }catch(e){}   // 3Pの案内（📣）を出す・消す
}
// 保存するとき：一緒に行くキャストの予約（その子で計算しなおす）
function partyExtraRows(row){
  if(editing || party.kind !== "cast") return [];
  const main = $("f_cast").value, others = party.casts.filter(Boolean);
  if(others.length < party.n - 1) throw new Error("👥 一緒に行くキャストを選んでください");
  if(new Set([main, ...others]).size !== others.length + 1) throw new Error("👥 同じキャストが2回選ばれています");
  const names = [main, ...others].map(castName).join("・"), by = KB.operatorName(), at = new Date().toISOString();
  const note = { at, by, text: `👥 ${party.n === 3 ? "4P" : "3P"}：${names}（いっしょに受付）` };
  row.memo_log = [...(row.memo_log || []), note];
  party.casts.forEach((cid, i) => { if(cid){ const w = party.af[i] || {}; if(!w.af || !w.raf) throw new Error(`👥 ${castName(cid)}へのAF・逆AFのご希望を選んでください`); } });
  const out = others.map(cid => {
    const w = party.af[party.casts.indexOf(cid)] || {};
    $("f_cast").value = cid; const c2 = withAf(w, () => calc());
    return Object.assign({}, row, { cast_id: cid, af_wish: w.af, rev_af_wish: w.raf, nomination_fee: c2.nomination, options: c2.opts, option_total: c2.optionTotal, total: c2.total,
      card_total: c2.pay === "cash" ? 0 : c2.total, course_back: c2.courseBack, option_back: c2.optionBack, extra_back: c2.extra, back_override: null, ...(HAS_226 ? { nomi_back: c2.nomiBack || 0 } : {}),
      cast_notified_at: null, cast_notified_by: "", ...("todos" in row ? { todos: [] } : {}), checks: [] });
  });
  $("f_cast").value = main; calc();
  // いっしょの予約の印（3p_cast のOPに grp）。一覧で「👥 ○○の予約へ」で行き来する
  const grp = "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  [row, ...out].forEach(x => { x.options = (x.options || []).map(o => o.code === "3p_cast" ? Object.assign({}, o, { grp }) : o); });
  return out;
}
// この予約といっしょの3P・4Pの予約（grp が同じ。前に作ったものは、同じお客さん・同じ開始時刻）
function partyMates(r){
  const op = (r.options || []).find(o => o.code === "3p_cast"); if(!op) return [];
  return rows.filter(x => x.id !== r.id && !x.deleted && (x.options || []).some(o => o.code === "3p_cast" && (op.grp ? o.grp === op.grp : x.customer_id === r.customer_id && x.start_at === r.start_at)));
}
function rcJump(id){
  if($("viewList") && $("viewList").style.display === "none") showView("list");
  const el = document.getElementById("rc-" + id); if(!el) { toast("その予約が一覧に見つかりません（並び・絞りを外してください）"); return; }
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  el.classList.remove("rcflash"); void el.offsetWidth; el.classList.add("rcflash");
}
const __openFormParty = openForm;
openForm = function(){ const r = __openFormParty.apply(this, arguments); paintParty(); return r; };
/* ---------- 👗 キューティー：お客さんの女装（kb_reservations.dress：{ h, w, wig:"黒ショート", cloth, book }。SQL 164） ---------- */
let HAS_DRESS = false;
Promise.resolve(sb.from("kb_reservations").select("dress").limit(1)).then(res=>{ HAS_DRESS = !!res && !res.error; }).catch(()=>{});
// SQL 226（本指名バック nomi_back・満了・中抜け）を実行ずみか
let HAS_226 = false;
Promise.resolve(sb.from("kb_reservations").select("nomi_back").limit(1)).then(res=>{ HAS_226 = !!res && !res.error; }).catch(()=>{});
// 本指名バックがまだ入っていない本指名の予約（SQL 227 で決まらなかったもの）：そのキャストのランクで本指のバックと合えば入れる
//   入れるのは nomi_back（精算明細で行を分けるだけ）。報酬・店落ちは変わらない。開いたときに1回だけ（2026/11/7）
(function(){
  let tries = 0;
  const run = async () => {
    if(++tries > 20) return;
    if(!HAS_226 || !M.casts || !M.casts.length || !M.back || !Object.keys(M.back).length || !KB.CAN_EDIT || day === KB.PRACTICE_DAY){ setTimeout(run, 3000); return; }
    try{
      const l = q(await sb.from("kb_reservations").select("id,cast_id,store_key,course,course_back,free_kind,nh_rate").eq("visit_kind", "honshi").is("nomi_back", null).is("back_override", null).gt("course_back", 0).eq("deleted", false).limit(300)) || [];
      for(const r of l){
        if(r.free_kind) continue;
        const cast = M.casts.find(c => c.id === r.cast_id); if(!cast) continue;
        const g = storeGroup(r.store_key), rank = ranksOn(cast)[g]; if(!rank) continue;
        const ranks = g === "cutie" && !/NH/.test(rank) ? [rank + "+NH指名", rank] : [rank];
        const r1 = ranks.find(k => M.back[k + "|" + r.course + "本指"] === r.course_back); if(!r1) continue;
        const b0 = M.back[r1 + "|" + r.course] ?? M.back[rank + "|" + r.course];
        if(b0 == null || r.course_back <= b0) continue;
        await sb.from("kb_reservations").update({ nomi_back: r.course_back - b0 }).eq("id", r.id).is("nomi_back", null);
        const mine = rows.find(x => x.id === r.id); if(mine) mine.nomi_back = r.course_back - b0;
      }
    }catch(e){}
  };
  setTimeout(run, 5000);
})();
const WIG_COL = [["黒", "#1d1a1a"], ["茶", "#7b4a2a"], ["金", "#c9a06a"]], WIG_LEN = ["ショート", "ミディアム", "ロング"];
let wigSel = "", underSel = "";
// 👙 下着：お金はバック無OP（calc でオプションに足す）
const UNDER = [["set", "上下セット", 3000], ["pants", "パンツのみ", 1000], ["bra", "ブラレンタル＋パンツ", 1000]];
function paintWig(){
  $("f_wig").innerHTML = WIG_COL.map(([c, col]) => WIG_LEN.map(l => { const v = c + l;
    return `<button type="button" class="wigb ${wigSel === v ? "on" : ""}" onclick="wigSel=wigSel==='${v}'?'':'${v}';paintWig();recalc()"><span class="sw" style="background:${col};height:${l === "ショート" ? 10 : l === "ミディアム" ? 16 : 22}px"></span>${v}</button>`; }).join("")).join("");
  $("f_under").innerHTML = [["", "なし", 0]].concat(UNDER).map(([k, l, p]) => `<button type="button" class="chip ${underSel === k ? "on" : ""}" onclick="underSel='${k}';paintWig();recalc()">${l}${p ? " " + yen(p) : ""}</button>`).join("");
}
function getDress(){
  const n = id => { const v = $(id).value; return v === "" ? null : Number(v); };
  const d = { h: n("f_dH"), w: n("f_dW"), wig: wigSel, cloth: $("f_dCloth").value.trim(), book: $("f_dBook").value.trim(), under: underSel, makeup: $("f_makeup").checked };
  return Object.values(d).some(v => v !== null && v !== "" && v !== false) ? d : null;
}
function setDress(d){
  d = d || {}; $("f_dH").value = d.h ?? ""; $("f_dW").value = d.w ?? ""; wigSel = d.wig || ""; $("f_dCloth").value = d.cloth || ""; $("f_dBook").value = d.book || "";
  underSel = d.under || ""; $("f_makeup").checked = !!d.makeup; paintWig();
}
const underLabel = k => (UNDER.find(x => x[0] === k) || [])[1] || "";
function dressText(d){ if(!d) return ""; return [d.h ? d.h + "cm" : "", d.w ? d.w + "kg" : "", d.wig ? "ウィッグ" + d.wig : "", d.cloth ? "服：" + d.cloth : "", d.book ? "📖" + d.book : "", d.under ? "下着：" + underLabel(d.under) : ""].filter(Boolean).join("・"); }
// 🧳 女レ道具セット（キャストへの予約連絡の持ち物）
function dressKit(d){   // キューティーはいつもメイク道具を持っていく
  d = d || {};
  return [d.wig ? "ウィッグ（" + d.wig + "）" : "", d.cloth || d.book ? "洋服（" + [d.cloth, d.book ? "スタイルブック " + d.book : ""].filter(Boolean).join("・") + "）" : "",
    d.under ? "下着（" + underLabel(d.under) + "）" : "", "メイク道具"].filter(Boolean).join("／")
    + (d.h || d.w ? `\n　お客様：${[d.h ? "身長" + d.h + "cm" : "", d.w ? "体重" + d.w + "kg" : ""].filter(Boolean).join("・")}` : "");
}

/* ---------- AF・逆AF の希望（必ず聞く） ---------- */
function radioVal(name){ const el = document.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : ""; }
function setRadio(name, v){ document.querySelectorAll('input[name="' + name + '"]').forEach(el=>{ el.checked = el.value === v; }); }
// 希望ありなら、そのお店の AF／逆AF のオプションにチェックを入れる（サクラナは「AF・逆AF」1つ・極門は別々）
// 🔸 4択（AF／逆AF／両方／アナルプレイなし）→ AF・逆AF の〇× に入れる。〇×から4択の表示ももどす
const AF_SEL = { af: ["yes", "no"], raf: ["no", "yes"], both: ["yes", "yes"], none: ["no", "no"] };
function setAfSel(v){ const p = AF_SEL[v]; if(!p) return; setRadio("f_afw", p[0]); setRadio("f_rafw", p[1]); onAfWish(); }
function syncAfSel(){
  const a = radioVal("f_afw"), r = radioVal("f_rafw");
  const v = Object.keys(AF_SEL).find(k => AF_SEL[k][0] === a && AF_SEL[k][1] === r) || "";
  setRadio("f_afsel", v);
}
function onAfWish(){
  syncAfSel();
  const g = storeGroup($("f_store").value), af = radioVal("f_afw") === "yes", raf = radioVal("f_rafw") === "yes";
  const has = code => !!$("o_" + code) && M.options.some(o=>o.store_group === g && o.code === code);
  if(has("gyakuaf")){ if(has("af")) $("o_af").checked = af; $("o_gyakuaf").checked = raf; }
  else if(has("af")) $("o_af").checked = af || raf;
  recalc();
}
function optSummary(){
  const n = [...document.querySelectorAll("#f_opts input[type=checkbox]:checked")].filter(b=>!["o_af", "o_gyakuaf"].includes(b.id)).length + ($("f_xop_label").value.trim() ? 1 : 0) + xopExtra().length;
  $("optCount").textContent = n ? `（${n}件 選択中）` : "";
  if(n) $("optDetails").open = true;
}

/* ---------- エリア：ホテル一覧（地図つき）・交通費のめやす ---------- */
const AREA_TRIP = "出張";   // 出張は行き先（例：横浜）を書ける → エリアは「出張（横浜）」
function areaList(){ return [...new Set((M.hotels || []).map(h=>h.area).filter(Boolean))]; }
function tripDest(area){ const m = String(area || "").match(/^出張(?:（(.*)）)?$/); return m ? (m[1] || "") : null; }
function fillAreaSel(area){
  const list = areaList(), dest = tripDest(area), known = !area || dest != null || list.includes(area);
  $("f_areaSel").innerHTML = `<option value="">（エリアを選ぶ）</option>` + list.map(a=>`<option>${esc(a)}</option>`).join("")
    + (known ? "" : `<option>${esc(area)}</option>`);   // 前に「そのほか」で書いた場所は、そのまま
  $("f_area").value = area || ""; $("f_area").style.display = "none";
  $("f_areaSel").value = dest != null ? AREA_TRIP : (area || "");
  $("f_trip").style.display = dest != null ? "" : "none"; $("f_trip").value = dest || "";
  showAreaFee();
}
function onAreaSel(){
  const v = $("f_areaSel").value, trip = v === AREA_TRIP;
  $("f_trip").style.display = trip ? "" : "none"; if(!trip) $("f_trip").value = "";
  $("f_area").value = v;
  if(trip) $("f_trip").focus();
  showAreaFee();
  recalc();   // キャストへの予約連絡も新しい場所に
}
function onTripDest(){ const d = $("f_trip").value.trim(); $("f_area").value = AREA_TRIP + (d ? "（" + d + "）" : ""); showAreaFee(); recalc(); }
let areaTimer = null;
function showAreaFee(){ clearTimeout(areaTimer); areaTimer = setTimeout(paintAreaInfo, 300); }
async function paintAreaInfo(){
  const area = $("f_area").value.trim(), el = $("areaInfo");
  const hotels = (M.hotels || []).filter(h=>h.area === area);
  $("hotelList").innerHTML = hotels.map(h=>`<option value="${esc(h.hotel_name)}">`).join("");
  if(!area){ el.innerHTML = ""; return; }
  let html = "";
  if(hotels.length){
    html += `<details class="info" style="margin:0 0 6px"><summary style="cursor:pointer;font-weight:800">🏨 ${esc(area)}のホテル（${hotels.length}件・押すと地図）</summary>`
      + hotels.map(h=>`<div style="font-size:12.5px;padding:2px 0">${h.store_status === "ok" ? "✅" : h.store_status === "ng" ? "🚫" : h.store_status === "far" ? "△" : "・"} ${esc(h.hotel_name)}`
        + ` <a href="${esc(mapLink(h))}" target="_blank" rel="noopener">📍地図</a>` + (h.note ? `<small style="color:var(--sub)"> ${esc(h.note)}</small>` : "") + `</div>`).join("")
      + `</details>`;
  }
  // 交通費のめやす（受付の記録＋提案額の記録）
  try{
    const like = "%" + area.replace(/[%_]/g, "") + "%";
    const [rs, fs] = await Promise.all([
      sb.from("kb_reservations").select("store_key,transport,biz_date").ilike("area", like).gt("transport", 0).eq("deleted", false).order("biz_date", { ascending: false }).limit(300),
      sb.from("kb_area_fees").select("place,store_key,fee,note,by_name,at").ilike("place", like).order("at", { ascending: false }).limit(100),
    ]);
    if($("f_area").value.trim() !== area) return;   // 入力が変わった
    const fees = (q(rs) || []).map(r=>({ fee: r.transport, store: r.store_key, when: r.biz_date, kind: "受付" }))
      .concat((q(fs) || []).map(f=>({ fee: f.fee, store: f.store_key, when: String(f.at).slice(0, 10), kind: "提案", note: f.note })));
    if(fees.length){
      const avg = Math.round(fees.reduce((a, b)=>a + b.fee, 0) / fees.length / 100) * 100;
      const min = Math.min(...fees.map(f=>f.fee)), max = Math.max(...fees.map(f=>f.fee));
      html += `<div class="info">🚕 <b>${esc(area)}</b> の交通費：平均 <b>${yen(avg)}</b>（${fees.length}件・${yen(min)}〜${yen(max)}）<br>`
        + `<small>最近：${fees.slice(0, 4).map(f=>`${f.when.slice(5).replace("-", "/")} ${esc(storeLabel(f.store) || "")} ${yen(f.fee)}${f.kind === "提案" ? "（提案）" : ""}`).join("、")}</small></div>`;
    } else if(!hotels.length){
      html += `<div class="warn">🚕 「${esc(area)}」の交通費の記録はまだありません。提案した金額を入れて「💾 この場所の提案額として記録」を押すと、次から平均が出ます。</div>`;
    }
  }catch(e){ html += `<div class="warn">交通費の記録を読めませんでした：${esc(e.message || e)}</div>`; }
  // 📒 台帳エクセル・記録簿で、この場所に行ったことのあるお客さん（顧客台帳の「📍 エリアで探す」と同じ。SQL 215）2026/11/6
  window.pastPlaceCache = window.pastPlaceCache || {};
  try{
    const word = (typeof tripDest === "function" && tripDest(area)) || area;
    if(word && word.length >= 2 && !/^(池袋|鶯谷|五反田)$/.test(word)){
      // 一度探した場所は覚えておく（エリアの欄は何回も描きなおすので、そのたびに探すと間に合わない回があった）
      let hits = pastPlaceCache[word];
      if(!hits){
        try{ hits = q(await sb.rpc("kb_customer_place_search", { p_q: word, p_limit: 50 })) || []; pastPlaceCache[word] = hits; }
        catch(e){ hits = []; }
      }
      if($("f_area").value.trim() !== area) return;
      if(hits.length) html += `<details class="pastplace"><summary>📒 台帳・記録簿で「${esc(word)}」に行ったこと：${hits.length >= 50 ? "50件以上" : hits.length + "件"}（押すと見る）</summary>`
        + hits.slice(0, 15).map(x => `<div>${x.biz_date ? esc(x.biz_date.slice(2).replace(/-/g, "/")) : ""}　${esc([x.area, x.place].filter(Boolean).join(" "))}${Number(x.transport) ? "　🚕 " + yen(x.transport) : ""}　<small>${esc(x.name || "")}・${esc(x.src)}</small></div>`).join("") + `</details>`;
    }
  }catch(e){}
  el.innerHTML = html;
}
// ホテルの地図のリンク。正しいアドレス（https://〜）がなければ、ホテル名＋エリアで Google マップを検索するリンクにする
// 長い地図のURL（ブラウザのアドレス欄からコピーした google.com/maps/place/… など）は iPhone で開けないことがあるので、
//   キャストに送るときは、ホテル名で Google マップを探すリンクにする（2026/11/6）
function isLongMap(u){ u = String(u || ""); return u.length > 120 || /google\.[a-z.]+\/maps\/(place|@|dir)/i.test(u); }
function longMapWarn(el){ const u = String(el.value || "").trim(), w = el.parentElement && el.parentElement.querySelector(".lmwarn");
  if(w) w.remove(); if(u && isLongMap(u)) el.insertAdjacentHTML("afterend", `<div class="lmwarn">⚠️ 長いURLです（iPhoneで開けないことがあります）。Googleマップの「共有」→「リンクをコピー」の <b>https://maps.app.goo.gl/…</b> を貼ってください</div>`); }
document.addEventListener("input", e => { if(e.target && ["f_map", "nh_map", "hb_map"].includes(e.target.id)) longMapWarn(e.target); }, true);
document.head.insertAdjacentHTML("beforeend", `<style>.lmwarn{background:#FFF4E5;border:1.5px solid #FFB547;color:#a35a00;border-radius:10px;padding:4px 10px;font-size:12.5px;font-weight:700;margin-top:4px;flex-basis:100%}</style>`);
function mapLink(h){
  const u = String(h.map_url || "").trim();
  if(/^https?:\/\//i.test(u) && !isLongMap(u)) return u;
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent((h.area || "") + " " + (h.hotel_name || "") + " ホテル");
}
// ホテル・自宅の欄に書いたホテルの地図（ホテル一覧の名前が入っていれば。長い名前を先に探す）
function hotelMapUrl(){
  const area = $("f_area").value.trim(), addr = $("f_address").value.replace(/\s/g, "");
  if(!addr) return "";
  const list = (M.hotels || []).filter(h=>!area || h.area === area)
    .sort((a, b)=>String(b.hotel_name).length - String(a.hotel_name).length);
  const h = list.find(x=>addr.includes(String(x.hotel_name).replace(/\s/g, "")));
  return h ? mapLink(h) : "";
}
async function saveAreaFee(){
  const place = $("f_area").value.trim(), fee = Math.max(0, +$("f_transport").value || 0);
  if(!place){ toast("エリア（場所）を入れてください"); return; }
  if(!fee){ toast("交通費の金額を入れてください"); return; }
  const note = prompt("メモ（例：お客さんに提案・成約しなかった など。空でもOK）", "") ;
  if(note === null) return;
  try{
    q(await sb.from("kb_area_fees").insert({ place, store_key: $("f_store").value || null, fee, note: note.trim(), by_name: KB.operatorName() }));
    toast("この場所の提案額を記録しました"); paintAreaInfo();
  }catch(e){ toast("記録できませんでした：" + (e.message || e)); }
}

// その日（受付の日付）に出勤しているか。シフトを読んでいなければ「わからない」＝出勤あつかい
function dmWorking(cid){
  const c = M.casts.find(x => x.id === cid); if(!c) return false;
  const bd = ($("f_day") && $("f_day").value) || day;
  const sh = bd === day ? shiftCache[day] : (typeof otherDay !== "undefined" && otherDay[bd] ? otherDay[bd].sh : null);
  if(!sh) return true;
  return !!(sh[c.shift_name] || sh[c.official_name]);
}
// このお客さんが前にこのダミー名で会った子が、この日は出勤していない → { ダミー名: "あや お休み" }
function dmBlocked(store){
  const out = {};
  if(!Array.isArray(custSeen) && !Array.isArray(custPast)) return out;
  const by = {};
  seenNorm().filter(p => p.store_key === store && p.dummy_name && p.cast_id && !["cancel", "tobi", "flowed"].includes(p.status) && !(editing && p.id === editing.id))
    .forEach(p => { (by[p.dummy_name] = by[p.dummy_name] || new Set()).add(p.cast_id); });
  Object.entries(by).forEach(([n, ids]) => { const l = [...ids]; if(!l.some(dmWorking)) out[n] = l.map(castName).join("・") + " お休み"; });
  return out;
}function isDummyStore(store){ const s = M.stores.find(x=>x.key===store); return !!(s && s.dummy); }
function renderDummy(keep){
  const store = $("f_store").value, on = isDummyStore(store);
  $("dummyWrap").style.display = on ? "" : "none";
  if(!on) return;
  let cur = keep !== undefined && keep !== null ? keep : $("f_dummy").value;
  const list = M.dummies.filter(d=>d.store_key===store && !(typeof ownersOf === "function" && ownersOf(store, d.name).length));   // キャスト専用の名前は、ダミーの一覧に出さない
  // 前のお店（や前の受付）で選んでいた名前は残さない。残すのは、このお店の名前・専用の名前・この予約に保存してある名前だけ
  if(cur && !list.some(d=>d.name===cur) && !(typeof ownersOf === "function" && ownersOf(store, cur).length) && !(editing && editing.store_key === store && editing.dummy_name === cur)) cur = "";
  // 前にこの名前で行った子が、この日は出勤していない → 選べない
  const blocked = typeof dmBlocked === "function" ? dmBlocked(store) : {};
  if(cur && blocked[cur] && !(editing && editing.dummy_name === cur)) cur = "";
  $("f_dummy").innerHTML = `<option value="">（ダミー名を選ぶ）</option>` + list.map(d=>`<option value="${esc(d.name)}" ${blocked[d.name] ? "disabled" : ""}>${esc(d.name)}${blocked[d.name] ? "（" + esc(blocked[d.name]) + "）" : ""}</option>`).join("")
    + (cur && !list.some(d=>d.name===cur) ? `<option>${esc(cur)}</option>` : "");
  $("f_dummy").value = cur || "";
  if($("dummyEdit").style.display !== "none") renderDummyEdit();
  renderDummyMatch();
}
function toggleDummyEdit(){
  const el = $("dummyEdit");
  el.style.display = el.style.display === "none" ? "" : "none";
  if(el.style.display !== "none") renderDummyEdit();
}
function renderDummyEdit(){
  const store = $("f_store").value;
  const list = M.dummies.filter(d=>d.store_key===store);
  $("dummyEdit").innerHTML = `<div style="font-size:12px;font-weight:800;margin-bottom:4px">${esc(storeLabel(store))} のダミー名</div>`
    + (list.length ? list.map(d=>`<span class="chip" style="cursor:default"><a href="javascript:void(0)" onclick="openDummyData(${d.id})" title="データを入れる・直す">${esc(d.name)}${d.height || d.cup || d.psize ? "" : " ✏️"}</a> <a href="javascript:void(0)" onclick="removeDummy(${d.id})" style="color:#c9556a">×</a></span>`).join(" ") + `<div style="font-size:11px;color:var(--sub);margin-top:4px">名前を押すと、身長・カップなどのデータを入れられます（マッチ率に使います）</div>` : `<span style="font-size:12px;color:var(--sub)">まだありません</span>`)
    + `<div style="display:flex;gap:6px;margin-top:6px"><input id="dummyNew" maxlength="40" placeholder="ダミー名を足す（公式HPの名前と完全一致）" style="flex:1" onkeydown="if(event.key==='Enter'&&!event.isComposing){event.preventDefault();addDummy();}">
       <button type="button" class="btn btn-ghost btn-sm" onclick="addDummy()">足す</button></div>`;
}
async function addDummy(){
  const name = $("dummyNew").value.trim(), store = $("f_store").value;
  if(!name) return;
  try{
    const row = q(await sb.from("kb_dummy_names").insert({ store_key: store, name, sort: M.dummies.length + 1, created_by: KB.operatorName() }).select().single());
    M.dummies.push(row);
    renderDummy(name); toast("ダミー名を足しました");
  }catch(e){ toast("足せませんでした：" + (String(e.message || e).includes("duplicate") ? "同じ名前があります" : (e.message || e))); }
}
async function removeDummy(id){
  const d = M.dummies.find(x=>x.id===id); if(!d) return;
  if(!confirm("ダミー名「" + d.name + "」を一覧から外しますか？（今までの受付の記録はそのまま）")) return;
  try{
    q(await sb.from("kb_dummy_names").delete().eq("id", id));
    M.dummies = M.dummies.filter(x=>x.id!==id);
    renderDummy(); toast("外しました");
  }catch(e){ toast("外せませんでした：" + (e.message || e)); }
}
function toggleMedia(code){ mediaSel = mediaSel.includes(code) ? mediaSel.filter(x=>x!==code) : [...mediaSel, code];
  document.querySelectorAll("#f_media .chip").forEach((b,i)=>b.classList.toggle("on", mediaSel.includes(M.media[i].code))); if(typeof netReply === "function") netReply(); }

/* ---------- その日に効いているランク・条件（台帳の「適用開始日つき」の履歴から） ---------- */
function rankRowsOn(cast){
  const out = {};
  M.rankHist.forEach(r=>{
    if(r.cast_id !== cast.id || r.valid_from > day) return;
    const b = out[r.grp];
    if(!b || r.valid_from > b.valid_from || (r.valid_from === b.valid_from && r.id > b.id)) out[r.grp] = r;
  });
  return out;
}
function ranksOn(cast){
  const rows = rankRowsOn(cast), o = {};
  if(!Object.keys(rows).length) return cast.ranks || {};   // 履歴がまだ無いキャストは台帳の値
  Object.keys(rows).forEach(g=>{ if(rows[g].rank) o[g] = rows[g].rank; });
  return o;
}
function rulesOn(castId){
  return M.rules.filter(r=>r.cast_id === castId && (r.valid_from || "2000-01-01") <= day && (!r.valid_to || r.valid_to > day));
}
// ヒアリングを見る
let hearings = [];
function hearLink(text, by, at){
  hearings.push({ text, by, at });
  return ` <a href="javascript:void(0)" onclick="showHear(${hearings.length - 1})" style="color:#c9556a;font-weight:800">🔗ヒアリング</a>`;
}
function showHear(i){
  const h = hearings[i]; if(!h) return;
  const d = h.at ? new Date(h.at) : null;
  alert("💬 ヒアリング" + (h.by ? "（" + h.by + (d ? "　" + (d.getMonth()+1) + "/" + d.getDate() : "") + "）" : "") + "\n\n" + (h.text || "（記録がありません）"));
}

// 🎁 個人オプション：選んだキャストの分だけ、オプションの下に出す（キャスト台帳の「🎁 個人オプション」で登録）2026/11/10
//   sel：予約を開いたときの options（入っていた個人OPにチェック・そのときの料金とバックのまま）。なければ、いまの画面のチェックを残す
function renderPops(sel){
  const el = $("f_pops"); if(!el) return;
  const cast = M.casts && M.casts.find(x => x.id === ($("f_cast") ? $("f_cast").value : ""));
  const list = cast ? (M.pops || []).filter(p => p.cast_id === cast.id) : [];
  const keep = {};
  if(Array.isArray(sel)) sel.filter(o => /^pop_\d+$/.test(o.code || "")).forEach(o => { keep[o.code] = o; });
  else list.forEach(p => { const cb = $("pp_" + p.id); if(cb && cb.checked) keep["pop_" + p.id] = { qty: +$("ppq_" + p.id).value || 1, price: +$("ppp_" + p.id).value || 0, back: +$("ppb_" + p.id).value || 0 }; });
  el.innerHTML = list.length ? `<div style="margin-top:6px;font-weight:800;font-size:13px">🎁 ${esc(cast.official_name || cast.temp_name || "")}の個人オプション</div>` + list.map(p => {
    const s = keep["pop_" + p.id];
    return `<div class="opt">
      <input type="checkbox" id="pp_${p.id}" ${s ? "checked" : ""} onchange="recalc()">
      <label class="lbl" for="pp_${p.id}">🎁 ${esc(p.label)}${p.note ? `<br><small>${esc(p.note)}</small>` : ""}</label>
      <input type="number" id="ppq_${p.id}" min="1" value="${s ? s.qty || 1 : 1}" title="着数・枚数" oninput="recalc()" ${p.unit === "per_item" ? "" : 'style="visibility:hidden"'}>
      <input type="number" id="ppp_${p.id}" value="${s ? s.price : p.price}" title="料金（1回あたり）" oninput="recalc()">
      <input type="number" id="ppb_${p.id}" value="${s ? s.back : p.back}" title="バック（1回あたり）" oninput="recalc()">
      <input class="opmemo" id="ppm_${p.id}" value="${esc((s && s.memo) || "")}" placeholder="📝 メモ（キャストに送る文に出ます。例：セーラー服）" oninput="recalc()">
    </div>`;
  }).join("") : "";
}
function onCast(){
  const c = M.casts.find(x=>x.id===$("f_cast").value);
  renderCastChecks(c);
  if(!c){ $("castInfo").innerHTML = ""; renderPops(); recalc(); return; }
  hearings = [];
  const GL = {sakurana:"サクラナ",cutie:"CC",gokumon:"極門",event:"イベ"};
  const rr = rankRowsOn(c), rks = ranksOn(c);
  const rk = Object.entries(rks).map(([k,v])=>`${GL[k]||k} ${esc(v)}` + (rr[k] ? hearLink(rr[k].hearing_text, rr[k].by_name, rr[k].at) : "")).join("　");
  const rules = rulesOn(c.id).map(r=>"・" + esc(r.note) + hearLink(r.hearing_text, r.by_name, r.created_at)).join("<br>");
  $("castInfo").innerHTML =
    (rk ? `<div class="info">⭐ ランク：${rk}</div>` : `<div class="warn">ランクが台帳に入っていません（バックは手で入れてください）</div>`) +
    (c.special_notes ? `<div class="info">📝 特記事項：${esc(c.special_notes)}</div>` : "") +
    (c.ng_notes ? `<div class="warn">🚫 NG：${esc(c.ng_notes)}</div>` : "") +
    (rules ? `<div class="info">🧮 このキャストの条件：<br>${rules}</div>` : "");
  renderPops();   // 🎁 個人オプション
  recalc();
}

/* ---------- 📋 受付ルール（キャストごと）。お客様の条件に当てはまるものだけ出す ----------
   📣 announce：全部チェックしないと保存できない／✅ confirm：チェックするまで「〜待ち」の状態でしか保存できない
   ⏳ after：保存すると予約の「やること」に入る／🤫 know：出るだけ
   ⌛ 長いコースの上限（台帳）・NGのオプション（プロフの×）も、ここで赤く出す */
let guestFlags = new Set();
const GUEST = [["foreign", "🌏 外国人"], ["josou", "👗 女装"], ["female", "👩 女性"], ["couple", "💑 カップル"]];
function renderGuestChips(){
  const el = $("f_guest"); if(!el) return;
  el.innerHTML = GUEST.map(([k, l])=>`<button type="button" class="chip ${guestFlags.has(k) ? "on" : ""}" onclick="toggleGuest('${k}')">${l}</button>`).join("");
  // 押したらすぐ真下に：このキャストがプロフで × にしているもの
  const c = M.casts && M.casts.find(x=>x.id === $("f_cast").value);
  const o = c && typeof profOpts === "function" ? profOpts(c) : null;
  const ng = o ? GUEST.filter(([k])=>guestFlags.has(k) && o[GUEST_PROF[k]] === "×").map(([, l])=>l.replace(/^\S+\s/, "")) : [];
  el.parentNode.querySelectorAll(".guestng,.guestok").forEach(x=>x.remove());
  const on = GUEST.filter(([k])=>guestFlags.has(k));
  if(!c || !on.length) return;
  if(!profById && typeof loadProfs === "function"){ loadProfs().then(renderGuestChips).catch(()=>{}); return; }
  if(ng.length){ el.insertAdjacentHTML("afterend", `<div class="guestng">🚫 ${esc(castName(c.id))}は ${ng.map(esc).join("・")} のお客様NG です</div>`); return; }
  // NGでないときも、プロフの印を出す（わからないときは、わからないと出す）
  const MK = { "◎": "◎ 大好き", "○": "○ OK", "△": "△ 条件つき" };
  const txt = !o ? "プロフとつながっていないので、NGかどうかわかりません"
    : on.map(([k, l])=>`${l.replace(/^\S+\s/, "")}：${GUEST_PROF[k] in o && o[GUEST_PROF[k]] ? (MK[o[GUEST_PROF[k]]] || o[GUEST_PROF[k]]) : (["female", "couple"].includes(k) ? "プロフに質問がありません" : "プロフに入っていません")}`).join("　");
  el.insertAdjacentHTML("afterend", `<div class="guestok">${esc(castName(c.id))}：${esc(txt)}</div>`);
}
const GUEST_PROF = { foreign: "外国人", josou: "女装", female: "女性のお客様", couple: "カップルのお客様" };   // プロフの可否の名前（女性・カップルはプロフにまだない）
function toggleGuest(k){ if(guestFlags.has(k)) guestFlags.delete(k); else guestFlags.add(k); renderGuestChips(); renderCastChecks(M.casts.find(c=>c.id === $("f_cast").value)); }
function formMinutes(){ try{ const c = calc(); return minutesOf(c.course) + c.ext*30 + c.date*30; }catch(e){ return 0; } }
function formOptLabels(){ try{ return (calc().opts || []).map(o=>String(o.label || "")); }catch(e){ return []; } }
function ruleApplies(x){
  const cond = x.cond || "always", v = x.cond_value || "";
  if(cond === "always") return true;
  if(cond === "new") return visit === "new";
  if(["foreign", "josou", "female", "couple"].includes(cond)) return guestFlags.has(cond);
  if(cond === "store") return $("f_store").value === v;
  if(cond === "long") return formMinutes() >= Number(v || 0);
  if(cond === "option") return formOptLabels().some(l=>l.includes(v) || (l && v.includes(l)));
  return true;
}
// プロフで×のものに当たっていないか（オプション・女装・外国人など）
function ngWarnings(c){
  const out = [];
  const o = typeof profOpts === "function" ? profOpts(c) : null;
  if(!o){ if(typeof profById !== "undefined" && !profById && typeof loadProfs === "function" && !window.__profLoadingRules){ window.__profLoadingRules = true; loadProfs().then(()=>renderCastChecks(M.casts.find(x=>x.id === $("f_cast").value))).catch(()=>{}); } return out; }
  const core = s => String(s).replace(/（.*?）|\(.*?\)/g, "").replace(/^キャスト/, "").replace(/のお客様$/, "").trim();
  const labels = formOptLabels(), seenNg = new Set();
  Object.keys(o).forEach(k=>{
    if(o[k] !== "×") return;
    const kc = core(k); if(!kc || seenNg.has(kc)) return; seenNg.add(kc);   // 名前とidの両方で入っているので、同じものは1回だけ
    if(labels.some(l=>{ const lc = core(l); return lc && (lc.includes(kc) || kc.includes(lc)); })) out.push(`「${k}」は × です`);
  });
  if(guestFlags.has("josou") && o["女装"] === "×") out.push("女装のお客様は × です");
  if(guestFlags.has("foreign") && o["外国人"] === "×") out.push("外国人のお客様は × です");
  if(guestFlags.has("female") && o["女性のお客様"] === "×") out.push("女性のお客様は × です");
  if(guestFlags.has("couple") && o["カップルのお客様"] === "×") out.push("カップルのお客様は × です");
  return out;
}
function renderCastChecks(c){
  renderGuestChips();   // キャストが変わったら、お客様のことのNGも出しなおす
  const el = $("castChecks");
  if(!c){ el.innerHTML = ""; return; }
  // いまチェックしてあるもの（描きなおしても消さない）＋ 前に保存したもの
  const keep = new Set([...document.querySelectorAll("#castChecks .cchk:checked")].map(b=>b.dataset.text));
  if(el.dataset.cast !== c.id){ keep.clear(); }
  if(editing && editing.cast_id === c.id) (editing.checks || []).forEach(x=>keep.add(x.text));
  el.dataset.cast = c.id;
  const all = M.castChecks.filter(x=>x.cast_id === c.id && ruleApplies(x));
  const by = k => all.filter(x=>(x.kind || "announce") === k);
  const ann = by("announce"), conf = by("confirm").slice(), after = by("after"), know = by("know").filter(x=>!String(x.text).startsWith("🏨"));   // 🏨 ホテルのことは「このキャストのホテル」にまとめて出す
  // 前回このキャストを指名したのが3年以上前 → 「以前このキャストを指名したことがあるか」を必ず聞く（下の checkOldNomi）
  if(typeof oldNomi !== "undefined" && oldNomi && oldNomi.cid === c.id) ann.unshift({ text: oldNomi.text });
  // このお客さんは、このキャストNG（顧客台帳）→ 受けない
  const custNg = typeof custCastNg !== "undefined" && custCastNg && custCastNg.cid === c.id ? custCastNg : null;
  // ⌛ 長いコース
  const mins = formMinutes(), warn = ngWarnings(c);
  // 👥 3P・4P のとき：3Pができるホテルを案内する（2026/11/9 内勤さん）
  if(typeof party !== "undefined" && party.kind){
    // 👥 ホテル一覧（キャスト台帳）で「3P可」にしたホテルを、選んだエリアの分だけ出す（2026/11/9）
    const area = ($("f_area") && $("f_area").value.trim()) || "", h3 = (M.hotels || []).filter(h => Array.isArray(h.tags) && h.tags.includes("3P可"));
    const inArea = area ? h3.filter(h => h.area && (area.includes(h.area) || h.area.includes(area))) : [];
    const addr = ($("f_address") && $("f_address").value.trim()) || "", curH = (M.hotels || []).find(h => h.hotel_name && addr.includes(h.hotel_name));
    const list = !h3.length ? "（キャスト台帳のホテル一覧で「👥3P可」にチェックすると、ここに出ます）"
      : !area ? "（エリアを選ぶと、3P可のホテルが出ます）"
      : inArea.length ? "　3P可：" + inArea.map(h => { const m = (h.tags || []).find(t => String(t).startsWith("3Pメモ:")); return h.hotel_name + (m ? "（" + String(m).slice(5) + "）" : ""); }).join("・") : "　" + area + "に3P可のホテルが登録されていません";   // 3Pのメモ（料金など）もいっしょに
    const warn = curH && !(Array.isArray(curH.tags) && curH.tags.includes("3P可")) ? `　⚠️ 今のホテル「${curH.hotel_name}」は3P可になっていません` : "";
    ann.unshift({ text: "✅ 3P可能なホテルを案内する（" + (party.kind === "guest" ? "お客様2名" : "キャスト" + party.n + "名") + "）" + list + warn });
  }
  // 🌙 お泊り：池袋・鶯谷・五反田以外（遠方）は本指名のみ（新規・店リピのときに出す）
  try{
    const area = $("f_area").value.trim();
    if(String(calc().course || "").includes("泊") && area && !/池袋|鶯谷|五反田/.test(area) && (visit === "new" || visit === "repeat")) ann.unshift({ text: "🌙 遠方泊りは本指名のみです（池袋・鶯谷・五反田以外のお泊り）" });
  }catch(e){}
  let longNg = false;
  let askHtml = "";
  if(custNg && custNg.ask){   // 🤔 エクセルの備考から見分けた、判断にまようキャストNG → 内勤が決めるまで保存しない
    longNg = true;
    askHtml = `<div class="ngask">🤔 <b>キャストNG？ 関係ない？</b>（台帳エクセルの備考に「NG」などの言葉がありました）
      <div class="q">${esc(custNg.reason || "")}</div>
      <button type="button" class="btn btn-danger btn-sm" onclick="castNgDecide(${custNg.id},true)">🙅 ${esc(castName(c.id))}はNG（受けない）</button>
      <button type="button" class="btn btn-ghost btn-sm" onclick="castNgDecide(${custNg.id},false)">関係ない（NGではない）</button></div>`;
  } else if(custNg){   // たしかなNGでも、自動で入れたものはまちがいがあるので、外す・理由を直すができる
    longNg = true;
    askHtml = `<div class="ngask" style="background:#FFE8EC;border-color:#E5486C;color:#B0213F">🙅 <b>このお客さんは、${esc(castName(c.id))}NGです。別のキャストにしてください</b>
      ${custNg.reason ? `<div class="q">${esc(custNg.reason)}</div>` : ""}
      ${custNg.id ? `<button type="button" class="btn btn-ghost btn-sm" onclick="castNgEdit(${custNg.id})">✏️ 理由を直す</button>
      <button type="button" class="btn btn-ghost btn-sm" onclick="castNgUndo(${custNg.id})">NGを外す（まちがいだった）</button>` : ""}</div>`;
  }
  // 🎭 ダミー：このお客さんが前にこのダミー名で会った子（実際に行ったキャスト）以外では行けない（「あの時の子じゃない」になるので）
  const dmNow = isDummyStore($("f_store").value) && $("f_dummy") ? $("f_dummy").value : "";
  // ⭐ 本物（この子の専用の名前。美沙＝みさ など）は、いつも同じ名前で行くので、ダミーのチェックはしない（2026/11/7：本物の美沙で「ダミー「美沙」では行けません」と出て保存できなかった）
  const isReal = dmNow && typeof ownName === "function" && ownName(c, $("f_store").value) === dmNow;
  if(dmNow && !isReal && Array.isArray(custPast)){
    // 記録簿の予約＋台帳エクセル（「雪（A」なども読む）の両方で見る
    const seenX = typeof seenNorm === "function" ? seenNorm() : custPast;
    const been = seenX.filter(p => p.store_key === $("f_store").value && p.dummy_name === dmNow && !["cancel", "tobi", "flowed"].includes(p.status) && (!editing || p.id !== editing.id))
      .sort((a, b) => String(b.biz_date).localeCompare(String(a.biz_date)));
    const who = [...new Set(been.map(p => p.cast_id).filter(Boolean))];
    const rawWho = [...new Set(been.filter(p => !p.cast_id).map(p => p.cast_raw).filter(Boolean))];
    if(!who.length && rawWho.length) warn.unshift(`🎭 台帳エクセルでは、前に「${dmNow}」で「${rawWho.join("・")}」が行っています（台帳のキャストとつながっていないので、同じ子か確かめてください）`);
    if(who.length && !who.includes(c.id)){
      longNg = true;
      warn.unshift(`🎭 このお客さんは前に「${dmNow}」で ${who.map(castName).join("・")} が行っています（${String(been[0].biz_date || "").slice(2).replace(/-/g, "/") || "日付なし"}${been[0].excel ? "・台帳エクセル" : ""}）。${who.map(castName).join("・")} 以外では行けません`);
    }
    // 前に18・極門でこの子が（ちがう名前で）行っていたら、ダミー指名では行けない（顔でばれる）
    if(!who.length){
      const dsx = M.stores.filter(s => s.dummy).map(s => s.key);
      const met = seenX.filter(p => dsx.includes(p.store_key) && p.cast_id === c.id && !["cancel", "tobi", "flowed"].includes(p.status) && (!editing || p.id !== editing.id));
      if(met.length){ longNg = true; warn.unshift(`🎭 ${castName(c.id)} は、このお客さんに18・極門で行ったことがあります（${met[0].biz_date.slice(5).replace("-", "/")} ${storeLabel(met[0].store_key)}${met[0].dummy_name ? "🎭" + met[0].dummy_name : ""}）。ダミー「${dmNow}」では行けません`); }
    }
  }
  if(c.long_max && mins > c.long_max){
    if(c.long_over === "ng"){ longNg = true; warn.unshift(`⌛ ${c.long_max}分までのキャストです（それより長いコースは受けない）`); }
    else conf.unshift({ text: `⌛ ${c.long_max}分を超えるので、キャストに確認した` });
  }
  const box = (x, kind)=>`<label style="display:flex;gap:8px;align-items:flex-start;font-size:13.5px;padding:3px 0;cursor:pointer">
      <input type="checkbox" class="cchk" data-kind="${kind}" data-text="${esc(x.text)}" ${keep.has(x.text) ? "checked" : ""} style="margin-top:3px;transform:scale(1.25)"> <span>${esc(x.text)}</span></label>`;
  let h = askHtml;
  if(warn.length) h += `<div style="background:#FFE8EC;border:2px solid #E5486C;border-radius:12px;padding:8px 10px;margin:6px 0;font-size:13.5px;font-weight:700;color:#B0213F">🚫 ${warn.map(esc).join("<br>🚫 ")}</div>`;
  if(ann.length) h += `<div style="background:#FFF4E5;border:2px solid #FFB547;border-radius:12px;padding:8px 10px;margin:6px 0">
    <div style="font-weight:800;font-size:13px;color:#a35a00;margin-bottom:4px">📣 お客様に案内（案内したらチェック）</div>${ann.map(x=>box(x, "announce")).join("")}
    <div style="font-size:11px;color:#a35a00;margin-top:2px">全部チェックしないと、受付を保存できません</div></div>`;
  if(conf.length) h += `<div style="background:#E8F4FF;border:2px solid #6AA8E8;border-radius:12px;padding:8px 10px;margin:6px 0">
    <div style="font-weight:800;font-size:13px;color:#1f5d99;margin-bottom:4px">✅ キャストに確認してから受ける（確認したらチェック）</div>${conf.map(x=>box(x, "confirm")).join("")}
    <div style="font-size:11px;color:#1f5d99;margin-top:2px">チェックするまでは「キャスト返事待ち」などの待ちの状態でしか保存できません</div></div>`;
  if(after.length) h += `<div style="background:#EEF9EE;border-radius:12px;padding:8px 10px;margin:6px 0;font-size:13.5px">
    <div style="font-weight:800;font-size:13px;color:#2e7a35">⏳ 予約のあとにやること（保存すると予約一覧に残ります）</div>${after.map(x=>"・" + esc(x.text)).join("<br>")}</div>`;
  if(know.length) h += `<div style="background:#F3F0F5;border-radius:12px;padding:8px 10px;margin:6px 0;font-size:13.5px">
    <div style="font-weight:800;font-size:13px;color:#6a5a70">🤫 知っておくこと</div>${know.map(x=>"・" + esc(x.text)).join("<br>")}</div>`;
  el.innerHTML = h;
  el.dataset.longng = longNg ? "1" : "";
}
// 🧰 準備がいるもの：オプション・個人オプションの名前に、この言葉が入っていたら（女レのコースも）。言葉は kb_settings の prep_words で足せる 2026/11/10
const PREP_WORDS_DEF = ["コスプレ", "衣装", "制服", "ナース", "セーラー", "パンスト", "ストッキング", "網タイツ", "ランジェリー", "下着", "ボンデージ", "SM", "ＳＭ", "道具", "ロープ", "縄", "拘束", "おもちゃ", "バイブ", "ディルド", "ペニバン", "女装"];
function prepTodoTexts(c){
  const words = (M.set && Array.isArray(M.set.prep_words) && M.set.prep_words.length ? M.set.prep_words : PREP_WORDS_DEF).map(w => String(w).toLowerCase());
  const hit = s => { const t = String(s || "").normalize("NFKC").toLowerCase(); return words.some(w => t.includes(w.normalize("NFKC"))); };
  const out = [];
  if(c && /^女レ/.test(String(c.course || ""))) out.push("🧰 準備（前日まで）：女レ道具セット");
  ((c && c.opts) || []).filter(o => hit(o.label)).forEach(o => out.push("🧰 準備（前日まで）：" + String(o.label).replace(/^🎁/, "") + (o.qty > 1 ? "×" + o.qty : "") + (o.memo ? "（" + o.memo + "）" : "")));
  return out;
}
// 保存用：{ list（チェックしたもの）, missAnnounce, missConfirm, longNg, todos }
function checksForSave(){
  const boxes = [...document.querySelectorAll("#castChecks .cchk")];
  const prev = editing ? (editing.checks || []) : [];
  const by = KB.operatorName(), at = new Date().toISOString();
  const list = boxes.filter(b=>b.checked).map(b=>{ const t = b.dataset.text; return prev.find(p=>p.text === t) || { text: t, kind: b.dataset.kind, at, by }; });
  const c = M.casts.find(x=>x.id === $("f_cast").value);
  const afterTexts = c ? M.castChecks.filter(x=>x.cast_id === c.id && (x.kind || "announce") === "after" && ruleApplies(x)).map(x=>x.text) : [];
  const prevTodos = editing ? (editing.todos || []) : [];
  const todos = afterTexts.map(t=>prevTodos.find(p=>p.text === t) || { text: t, done_at: null, done_by: "" });
  // 🏨 新規の在室確認（部屋番号を入れたとき「する」を選んだら、予約のあとにやることに）
  if(typeof roomCheck !== "undefined" && roomCheck){ const tx = "🏨 新規の在室確認（" + ($("f_address").value.trim() || "ホテル") + "）"; const old = prevTodos.find(p => /在室確認/.test(p.text)); todos.push(old || { text: tx, done_at: null, done_by: "" }); }
  // 🧰 前日までに準備がいるもの（女レ・コスプレ・パンスト・ランジェリー・SM道具など）→ 予約のカードに ✅（準備した）2026/11/10
  try{ prepTodoTexts(calc()).forEach(tx => { if(!todos.some(t => t.text === tx)) todos.push(prevTodos.find(p => p.text === tx) || { text: tx, done_at: null, done_by: "" }); }); }catch(e){}
  return {
    list, todos,
    missAnnounce: boxes.some(b=>b.dataset.kind === "announce" && !b.checked),
    missConfirm: boxes.some(b=>b.dataset.kind === "confirm" && !b.checked),
    longNg: $("castChecks").dataset.longng === "1",
  };
}

/* ---------- お客さん ---------- */
const digits = s => String(s||"").normalize("NFKC").replace(/[^\d]/g, "");
// 電話番号：数字だけにする。「+81」（日本）は 0 から始まる形に、ほかの国の「+」「00」で始まる番号は「+」を残す
const phoneNorm = s => { const t = String(s||"").normalize("NFKC").trim(), d = digits(t); if(/^0+$/.test(d) && d.length <= 4) return d;   // 「00」＝電話番号不明は、そのまま残す（国番号の00とまちがえない）
  if(!/^(\+|00)/.test(t)) return d; const n = t.startsWith("00") ? d.slice(2) : d; return n.startsWith("81") ? "0" + n.slice(2) : (n ? "+" + n : ""); };
// 電話番号でお客さんを探す：主の番号 → 副番号（SQL 179。まだなら主の番号だけ）
//   同じ番号のお客さんが何人もいるとき（台帳から入れた同じ人など）は、いちばん新しく予約した人を出す（2026/11/5）
async function custByPhone(phone, cols){
  const pick = async list => {
    if(!list || !list.length) return null;
    if(list.length === 1) return list[0];
    try{
      const r = q(await sb.from("kb_reservations").select("customer_id,biz_date").in("customer_id", list.map(c => c.id)).eq("deleted", false).order("biz_date", { ascending: false }).limit(1).maybeSingle());
      if(r) return list.find(c => c.id === r.customer_id) || list[0];
    }catch(e){}
    return list.slice().sort((x, y) => String(y.updated_at || "").localeCompare(String(x.updated_at || "")))[0];
  };
  const sel = cols === "*" ? "*" : cols + ",updated_at";
  const a = await pick(q(await sb.from("kb_customers").select(sel).eq("phone", phone).order("id").limit(20)));
  if(a) return a;
  const b = await sb.from("kb_customers").select(sel).contains("phones", [phone]).order("id").limit(20);
  return b.error ? null : pick(b.data);
}
// 🗣 名前を聞いた ✅（2026/11/7 店長）：台帳の名前は今までどおり自動で入れる。新しい予約で台帳のお客さんのときは「名前を聞いた」にチェックしないと保存できない（聞き忘れ防止）
let nameAsked = false;
document.addEventListener("input", e => { if(e.target && e.target.id === "f_name") try{ nameHintPaint(curCustomer); }catch(_){} }, true);
{ const __ofNh = openForm; openForm = function(){ nameAsked = false; const r = __ofNh.apply(this, arguments); try{ nameHintPaint(editing ? null : curCustomer); }catch(e){} return r; }; }
function nameAskNeeded(){ return !editing && !!curCustomer && !!curCustomer.name; }
function nameHintPaint(c){
  const inp = $("f_name"); if(!inp) return;
  let el = $("nameHint");
  if(!el){ inp.insertAdjacentHTML("afterend", `<div id="nameHint"></div>`); el = $("nameHint"); }
  if(!c || !c.name || editing){ el.innerHTML = ""; return; }
  const same = inp.value.trim() === String(c.name).trim();
  el.innerHTML = `<label class="nh ${nameAsked ? "ok" : ""}" id="nameAskChk"><input type="checkbox" ${nameAsked ? "checked" : ""} onchange="nameAsked=this.checked;nameHintPaint(curCustomer);if(typeof paintReqBar==='function')paintReqBar()">
    🗣 <b>お客さんに名前を聞いた</b>（台帳の名前：${esc(c.name)}${same ? "" : `　→ 今の欄：${esc(inp.value.trim() || "空")}`}）</label>`;
}
document.head.insertAdjacentHTML("beforeend", `<style>#nameHint .nh{display:block;margin-top:6px;background:#FFF5D6;border:2px solid #F2C94C;border-radius:12px;padding:6px 10px;font-size:13.5px;font-weight:800;color:#6b5300;cursor:pointer}
  #nameHint .nh input{width:auto;margin-right:4px;vertical-align:-2px;transform:scale(1.2)} #nameHint .nh.ok{background:#E6F6EC;border-color:#9AD3A8;color:#1d6b3a}</style>`);
async function lookupCustomer(keepName){
  const phone = phoneNorm($("f_phone").value);
  $("f_phone").value = phone;
  // 📞 下4けただけで調べる：その4けたで終わる番号のお客さんを出して、えらぶ（2026/11/5）
  if(/^\d{4}$/.test(phone) && !/^0+$/.test(phone)){
    curCustomer = null; custPast = null; custSeen = null;
    $("custInfo").innerHTML = `<div class="info">🔎 下4けた ${esc(phone)} で探しています…</div>`;
    try{
      const l = q(await sb.from("kb_customers").select("id,name,phone,ng").like("phone", "%" + phone).order("id", { ascending: false }).limit(15)) || [];
      if(digits($("f_phone").value) !== phone) return;   // とちゅうで番号を変えた
      $("custInfo").innerHTML = l.length ? `<div class="info">🔎 下4けたが <b>${esc(phone)}</b> のお客さん（${l.length >= 15 ? "15人以上・新しい15人" : l.length + "人"}）。押すと、その番号で調べます
        <div class="l4list">${l.map(c => `<button type="button" class="l4" onclick="$('f_phone').value='${esc(c.phone)}';lookupCustomer()">${c.ng ? "⚠️" : ""}<b>${esc(c.name || "名前なし")}</b> <small>${esc(c.phone)}</small></button>`).join("")}</div></div>`
        : `<div class="info">下4けたが ${esc(phone)} のお客さんはいません（全部の番号を入れると、新しいお客さんとして登録できます）</div>`;
    }catch(e){ $("custInfo").innerHTML = `<div class="warn">探せませんでした：${esc(e.message || e)}</div>`; }
    return;
  }
  if(phone.length < 6){ curCustomer = null; custPast = null; custSeen = null; $("custInfo").innerHTML = ""; return; }
  try{
    const c = await custByPhone(phone, "*");
    curCustomer = c || null;
    if(!c){ custPast = []; custSeen = []; $("custInfo").innerHTML = `<div class="info">🆕 はじめての電話番号です（保存すると新しいお客さんとして登録します）</div>
      <div class="xlwarn">📒 似た名前のお客さんがいる・番号を変えたと言っている・様子があやしいときは、<b>キャストを行かせる前に、エクセルの台帳も確認してください</b>（店NGかもしれません）</div>`; if(!editing) setVisit("new"); return; }
    nameAsked = false;   // お客さんが変わったら「名前を聞いた」を外す
    if(!keepName || !$("f_name").value) $("f_name").value = c.name || "";
    nameHintPaint(c);
    if(!keepName || !$("f_email").value) $("f_email").value = c.email || "";   // メールは、受付で入れたものを消さない
    $("f_ng").value = c.ng ? "1" : "0"; $("f_custnote").value = c.ng_reason || c.note || "";
    // ダミーで行った子の確認（renderCastChecks）のため、多めに読む。履歴に出すのは新しい10件
    // 今開いている予約は「これまで」に入れない（その予約自体が「前に来た1件」に見えてしまうので。2026/11/3）
    const pastAll = (q(await sb.from("kb_reservations").select("id,biz_date,store_key,cast_id,dummy_name,course,status,total,address,free_kind").eq("customer_id", c.id).eq("deleted", false).order("biz_date", {ascending:false}).limit(200)) || [])
      .filter(x => !(editing && x.id === editing.id));
    custPast = pastAll;
    // 台帳エクセルの過去の利用もいっしょに（これまで・指名したことのあるキャスト・新規／店リピ／本指名の自動）
    let xl = [];
    try{ const h = await sb.from("kb_cust_history").select("biz_date,store_key,store_raw,cast_id,cast_raw,course,status,total,place,free_kind").eq("customer_id", c.id).order("biz_date", { ascending: false }).limit(300);
      xl = (h.data || []).map(x => ({ biz_date: x.biz_date || "", store_key: x.store_key, store_raw: x.store_raw, cast_id: x.cast_id, cast_raw: x.cast_raw, dummy_name: "", course: x.course, status: x.status, total: x.total, place: x.place, free_kind: x.free_kind || "", excel: true })); }catch(e){}
    // 台帳エクセルの行が、記録簿の予約と キャスト・お店・総額・場所 まで同じなら、同じ利用を2回書いたもの（日付が打ちまちがいで別の日になっていても）
    //   → 数えない・出さない（本指名と判断されないように）。台帳のデータは変えない
    const pk = s => String(s || "").normalize("NFKC").replace(/\s/g, "");
    //   また、同じ日・同じキャスト・同じお店の予約が記録簿にあれば、それも同じ利用（11/1・11/2 は台帳エクセルと記録簿の両方に書いてある。2026/11/3）
    //   記録簿の予約1件につき、台帳の行は1件だけ（同じ日に2回来たお客さんの2回目を消さないように）
    const usedRes = new Set();
    const dupOf = x => {
      if(!x.cast_id) return false;
      let r = pastAll.find(r => !usedRes.has(r.id) && r.biz_date === x.biz_date && r.cast_id === x.cast_id && r.store_key === x.store_key);
      if(!r && Number(x.total) > 0 && pk(x.place)) r = pastAll.find(r => !usedRes.has(r.id) && r.cast_id === x.cast_id && r.store_key === x.store_key && Number(r.total) === Number(x.total) && pk(r.address) === pk(x.place));
      if(r){ usedRes.add(r.id); return true; }
      return false;
    };
    xl = xl.filter(x => !dupOf(x));
    custSeen = pastAll.concat(xl).sort((a, b) => String(b.biz_date).localeCompare(String(a.biz_date)));
    const seenAll = custSeen;
    const past = seenAll.slice(0, 10);
    // 指名したことのあるキャスト：フリーで入った回は「指名」ではないので入れない（2026/11/9 内勤さん）
    const casts = [...new Set(seenAll.filter(p => !["cancel", "tobi", "flowed"].includes(p.status) && !isFreeVisit(p)).map(p => p.cast_id ? castName(p.cast_id) : p.cast_raw).filter(Boolean))];
    $("custInfo").innerHTML = (c.ng && c.ng_ask ? `<div class="ngask">🤔 <b>出禁・店NG？</b>（台帳エクセルの備考から見分けました。条件つきの書き方なので、内勤が決めてください）<div class="q">${esc(c.ng_reason || "")}</div>
        <button type="button" class="btn btn-danger btn-sm" onclick="custNgDecide(${c.id},true)">⚠️ 店NG（受けない）</button>
        <button type="button" class="btn btn-ghost btn-sm" onclick="custNgDecide(${c.id},false)">NGではない（受けてOK）</button></div>`
      : c.ng ? `<div class="warn">⚠️ 店NGです：${esc(c.ng_reason||"理由なし")}
          <div style="margin-top:6px"><button type="button" class="btn btn-ghost btn-sm" onclick="custNgReason(${c.id})">✏️ 理由を直す</button>
          <button type="button" class="btn btn-ghost btn-sm" onclick="if(confirm('店NGを外しますか？（まちがいだったとき）'))custNgDecide(${c.id},false)">NGを外す（まちがいだった）</button></div></div>` : "") +
      // 📝 お客さんメモ（顧客台帳のメモ。台帳エクセルの電話の欄の文字・⚠️注意の言葉もここ）
      (String(c.note || "").trim() ? `<div style="background:#FFF8D6;border:1.5px solid #F2C94C;border-radius:12px;padding:8px 12px;margin:8px 0;font-size:14px;line-height:1.7"><b>📝 お客さんメモ</b><br>${esc(String(c.note).trim()).replace(/\n/g, "<br>")}</div>` : "") +
      // 🏷 顧客タグ（顧客台帳でつける。SQL 217）2026/11/6
      `<div id="custTagBox">${custTagBox(c)}</div>` +
      // 履歴は1回ずつ1行で、大きめ・濃いめに（受付でいちばん大事なので）
      `<div class="custhist"><div class="ch-head">📋 これまで ${seenAll.length}件${xl.length ? `（うち台帳エクセル ${xl.length}件）` : ""}${seenAll.length > 10 ? "（新しい10件）" : ""}</div>
        ${past.map(p => { const x = p.status === "cancel" ? "キャンセル" : p.status === "tobi" ? "トビ" : "";
          return `<div class="ch-row ${x ? "chx" : ""} ${M.stores.some(s => s.dummy && s.key === p.store_key) ? "dm" : ""}"><span class="d">${p.biz_date ? (p.biz_date.slice(2, 4) !== new Date().toISOString().slice(2, 4) ? p.biz_date.slice(2, 4) + "/" : "") + p.biz_date.slice(5).replace("-","/") : "日付なし"}</span><span class="s">${esc(p.store_key ? storeLabel(p.store_key) : p.store_raw || "")}${p.excel ? " 📚" : ""}</span>
            <span class="c">${p.dummy_name ? `<span class="dn">🎭${esc(p.dummy_name)}</span> → ` : ""}<b>${esc(p.cast_id ? castName(p.cast_id) : p.cast_raw || "")}</b></span><span class="k">${esc(p.course)}</span>${isFreeVisit(p) ? `<span class="frv">フリー</span>` : ""}${x ? `<span class="xx">${x}</span>` : ""}</div>`; }).join("") || `<div class="ch-row">なし</div>`}
        <div class="ch-foot">指名したことのあるキャスト：<b>${casts.map(esc).join("、") || "なし"}</b></div></div>`;
    if(!editing){
      const cid = $("f_cast").value;
      setVisit(visitFrom(seenAll, cid));
    }
  }catch(e){ $("custInfo").innerHTML = `<div class="warn">お客さんを探せませんでした：${esc(e.message||e)}</div>`; }
}
function setVisit(v){ visit = v; document.querySelectorAll("#f_visit .chip").forEach((b,i)=>b.classList.toggle("on", VISIT[i][0]===v)); recalc(); }
// 指名する？（フリー区分の select はかくして、ボタンで選ぶ。新しい受付は何も選んでいないところから）
const NOMI = [["", "指名あり"], ["free", "フリー"], ["special_free", "特別フリー"], ["event_free", "イベフリー"]];
let nomiChosen = false;
function renderNomiChips(){
  const v = $("f_free").value;
  $("f_nomiChips").innerHTML = NOMI.map(([k, l])=>`<button type="button" class="chip ${nomiChosen && v === k ? "on" : ""}" onclick="setNomi('${k}')">${l}</button>`).join("");
  if($("afReq")){ const fr = !!$("f_free").value; $("afReq").textContent = fr ? "フリーは任意" : "必須"; $("afReq").style.opacity = fr ? ".5" : ""; }
}
function setNomi(v){ nomiChosen = true; $("f_free").value = v; renderNomiChips();
  // フリー ⇔ 指名あり を変えたら、新規・店リピ・本指名も決めなおす（新しい受付で、お客さんを調べてあるとき）2026/11/9
  if(!editing && typeof custPast !== "undefined" && custPast) visit = visitFrom(custSeen || custPast, $("f_cast").value);
  if(typeof setVisit === "function") setVisit(visit); else recalc(); }
// 必須の項目で、まだ入っていないもの [名前, 場所の id]（キャンセル・トビにするときは見ない）
function missingRequired(quiet){   // quiet：ピカピカ用（たたんである所を開かない）
  return [
    [!digits($("f_phone").value), "電話番号", "f_phone"],
    [!$("f_name").value.trim(), "お客さんの名前", "f_name"],
    [typeof nameAskNeeded === "function" && nameAskNeeded() && !nameAsked, "名前を聞いた ✅", "nameAskChk"],   // 台帳のお客さんの新しい予約（2026/11/7）
    [!visit, "種別（新規・店リピ・本指名）", "f_visit"],
    [!nomiChosen, "指名する？", "f_nomiChips"],
    [!$("f_store").value, "売上店舗", "f_store"],
    [!$("f_start").value, "開始時刻", "f_start"],
    [!$("f_course").value, "コース", "f_course"],
    [!$("f_area").value.trim(), "エリア", "f_areaSel"],
    [!$("f_place").value, "ラブホ・ビジホ・自宅", "f_place"],
    [!$("f_free").value && (!radioVal("f_afw") || !radioVal("f_rafw")), "AF・逆AF", "afBox"],
    [!$("f_pay").value, "支払い方法", "f_pay"],
    [!mediaSel.length, "媒体", "f_media"],
    [!!(editing && editing.phone_draft && !IS_PHONE() && $("f_draftOk") && !$("f_draftOk").checked), "スマホの仮入力：キャストに送ったか確かめた", "f_draftBox"],
    [!!($("f_backov") && $("f_backov").value !== "" && !backOvNote.trim() && (quiet || (($("backDet") && ($("backDet").open = true)), true))), "報酬を手で直した理由", "f_backovNote"],
  ].filter(x=>x[0]).map(x=>[x[1], x[2]]);
}
// 📌 受付の上に、必須でまだ入っていないものをいつも出す（押すとその欄へ）2026/11/6
function paintReqBar(){
  const fb = $("formBg"); if(!fb || !fb.classList.contains("show")) return;
  let bar = $("reqBar");
  if(!bar){ const m = fb.querySelector(".drawer") || fb.querySelector(".modal"), h = $("formTitle"); if(!m) return; (h || m).insertAdjacentHTML(h ? "afterend" : "afterbegin", `<div id="reqBar" class="reqbar"></div>`); bar = $("reqBar"); }
  const cancelLike = ["cancel", "tobi", "flowed"].includes(($("f_status") || {}).value);
  let list = []; try{ list = cancelLike ? [] : missingRequired(true); }catch(e){}
  bar.className = "reqbar " + (list.length ? "ng" : "ok");
  bar.innerHTML = list.length ? `⚠️ 必須でまだ：${list.map(([n, id]) => `<button type="button" onclick="const el=$('${id}');if(el){el.scrollIntoView({block:'center',behavior:'smooth'});el.classList.add('miss');}">${esc(n)}</button>`).join("")}`
    : "✅ 必須はぜんぶ入っています";
}
{ let reqT = null; document.addEventListener("input", e => { if(e.target.closest && e.target.closest("#formBg")){ clearTimeout(reqT); reqT = setTimeout(paintReqBar, 300); } }, true);
  document.addEventListener("change", e => { if(e.target.closest && e.target.closest("#formBg")){ clearTimeout(reqT); reqT = setTimeout(paintReqBar, 300); } }, true);
  document.addEventListener("click", e => { if(e.target.closest && e.target.closest("#formBg")){ clearTimeout(reqT); reqT = setTimeout(paintReqBar, 400); } }, true); }
document.head.insertAdjacentHTML("beforeend", `<style>.reqbar{position:sticky;top:0;z-index:30;margin:-4px 0 8px;padding:6px 10px;border-radius:12px;font-size:13px;font-weight:800;box-shadow:0 4px 10px -6px rgba(0,0,0,.3)}
  .reqbar.ng{background:#FFE8EC;border:2px solid #F09AAA;color:#B0213F} .reqbar.ok{background:#E5F6EC;border:2px solid #9AD3A8;color:#2e8b57}
  .reqbar button{font-family:inherit;font-size:12.5px;font-weight:800;background:#fff;border:1.5px solid #F09AAA;color:#B0213F;border-radius:99px;padding:1px 8px;margin:2px 3px;cursor:pointer}</style>`);
function markMissing(list){
  document.querySelectorAll("#formBg .miss").forEach(el=>el.classList.remove("miss"));
  list.forEach(([, id])=>{ const el = $(id); if(el) el.classList.add("miss"); });
  const first = list.length && $(list[0][1]); if(first) first.scrollIntoView({ block: "center" });
}
// 入れたら赤い枠を消す
["input", "change", "click"].forEach(ev=>document.addEventListener(ev, e=>{ const m = e.target.closest && e.target.closest(".miss"); if(m) m.classList.remove("miss"); }));

// ＋ ほかのOP（2つめから）：欄の id は f_xop_label_2 … （一時保存でもどせるように）2026/11/5
let xopN = 1;
function addXop(idx, o){
  const i = idx || ++xopN; if(idx && idx > xopN) xopN = idx;
  if($("f_xop_label_" + i)) return;
  $("xopMore").insertAdjacentHTML("beforeend", `<div class="opt xoprow" style="margin-top:4px"><span></span><input type="text" id="f_xop_label_${i}" placeholder="ほかのOP（自由入力）" oninput="recalc()" value="${esc(o ? o.label : "")}">
    <span></span><input type="number" id="f_xop_price_${i}" placeholder="料金" oninput="recalc()" value="${o ? o.price : ""}"><input type="number" id="f_xop_back_${i}" placeholder="バック" oninput="recalc()" value="${o ? o.back : ""}">
    <button type="button" class="btn btn-ghost btn-sm" title="この行を消す" onclick="this.closest('.xoprow').remove();recalc()">🗑</button></div>`);
}
function clearXop(){ const el = $("xopMore"); if(el) el.innerHTML = ""; xopN = 1; }
function xopExtra(){ return [...document.querySelectorAll("#xopMore .xoprow")].map(r => { const [l, p, b] = r.querySelectorAll("input"); return { label: l.value.trim(), price: +p.value || 0, back: +b.value || 0 }; }).filter(x => x.label); }
// コースの説明（kb_course_info）の【プレイ内容】にふくまれるOPは、お金を取らない（例：極門の極コースは逆AF込み・入門はAF・逆AF込み）2026/11/4
function courseIncludesOp(store, course, label){
  const info = (M.courseInfo || []).find(i => i.store_key === store && String(course || "").startsWith(i.course_type));
  if(!info) return false;
  const m = String(info.description || "").match(/【プレイ内容】\s*\n?([^\n]*)/);
  return !!m && m[1].split(/[・、,\s]+/).map(s => s.trim()).includes(label);
}
/* ---------- ↕ OPの並びを直す（お店のグループごと。kb_options.sort）2026/11/5 ---------- */
let optOrder = null;
function openOptOrder(g){
  g = g || storeGroup($("f_store").value);
  if(!optOrder || optOrder.g !== g) optOrder = { g, list: M.options.filter(o => o.store_group === g).map(o => o.code) };
  let bg = $("ooBg");
  if(!bg){ bg = document.createElement("div"); bg.id = "ooBg"; bg.className = "modal-bg"; document.body.appendChild(bg); KB.closeOnBackdrop(bg, () => { bg.classList.remove("show"); optOrder = null; }); }
  const lab = code => (M.options.find(o => o.store_group === g && o.code === code) || {}).label || code;
  const groups = [...new Set(M.options.map(o => o.store_group))];
  bg.innerHTML = `<div class="modal" style="max-width:520px"><button class="x" onclick="$('ooBg').classList.remove('show');optOrder=null">×</button>
    <h2>↕ OPの並びを直す</h2>
    <div class="f" style="margin:6px 0"><label>お店のグループ</label><select onchange="optOrder=null;openOptOrder(this.value)">${groups.map(x => `<option value="${x}" ${x === g ? "selected" : ""}>${({ sakurana: "サクラ系（サクラムーン・ラナ など）", cutie: "キューティ", gokumon: "極門" })[x] || x}</option>`).join("")}</select></div>
    <div class="oolist">${optOrder.list.map((code, i) => `<div class="oorow"><b>${i + 1}</b><span>${esc(lab(code))}</span>
      <button type="button" class="btn btn-ghost btn-sm" ${i ? "" : "disabled"} onclick="moveOpt(${i},-1)">▲</button><button type="button" class="btn btn-ghost btn-sm" ${i < optOrder.list.length - 1 ? "" : "disabled"} onclick="moveOpt(${i},1)">▼</button></div>`).join("")}</div>
    ${KB.CAN_EDIT ? `<button type="button" class="btn btn-primary" style="margin-top:10px;width:100%" onclick="saveOptOrder()">この並びで保存（内勤みんな）</button>` : ""}</div>`;
  bg.classList.add("show");
}
function moveOpt(i, d){ const l = optOrder.list, j = i + d; if(j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; openOptOrder(optOrder.g); }
async function saveOptOrder(){
  if(!KB.CAN_EDIT || !optOrder) return;
  const { g, list } = optOrder;
  try{
    for(let i = 0; i < list.length; i++) q(await sb.from("kb_options").update({ sort: i + 1 }).eq("store_group", g).eq("code", list[i]));
    list.forEach((code, i) => { const o = M.options.find(x => x.store_group === g && x.code === code); if(o) o.sort = i + 1; });
    M.options.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    $("ooBg").classList.remove("show"); optOrder = null;
    toast("OPの並びを保存しました（次に受付を開いたときから、この並びです）");
  }catch(e){ toast("保存できませんでした：" + (e.message || e)); }
}
document.head.insertAdjacentHTML("beforeend", `<style>.oorow{display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px dashed var(--line)} .oorow b{width:24px;color:var(--sub)} .oorow span{flex:1;font-weight:700}</style>`);
/* ---------- 計算 ---------- */
function calc(){
  const store = $("f_store").value, g = storeGroup(store), course = $("f_course").value;
  const cast = M.casts.find(x=>x.id===$("f_cast").value);
  const free = $("f_free").value, ext = Math.max(0, +$("f_ext").value||0), date = Math.max(0, +$("f_date").value||0);
  const why = [];
  let price = (M.prices.find(p=>p.store_key===store && p.course===course) || {}).price || 0;
  // 指名料：フリーは0。キャストの特例があればその額。キューティの NH 料金は＋3,000円
  let nomination = 0;
  if(!free){
    nomination = (M.set.nomination || {}).default || 2000;
    const nr = cast && rulesOn(cast.id).find(r=>r.kind==="nomination_fee");
    if(nr){ nomination = nr.params.amount; why.push(`指名料：特例 ${yen(nomination)}`); }
    // ダミー（エイティーンなど）は子ごとの指名料（公式HPの★）
    const dm = isDummyStore(store) && $("f_dummy") && M.dummies.find(x => x.store_key === store && x.name === $("f_dummy").value);
    if(dm && dm.nomination_fee != null){ nomination = Number(dm.nomination_fee) || 0; why.push(`指名料：🎭${dm.name} は ${yen(nomination)}`); }
    if(g === "cutie" && $("f_nh").checked){ nomination += 3000; why.push("NH料金：指名料＋3,000円"); }
  }
  const extSet = (M.set.extension || {})[g] || { price:10000, back:5000 };
  const dateSet = M.set.date || { price:5000, back:2500 };
  const admSet = M.set.admission || { price:2000, back_add:1000 };
  const admission = $("f_adm").checked ? admSet.price : 0;
  // オプション
  const opts = [];
  M.options.filter(o=>o.store_group===g).forEach(o=>{
    if(!$("o_"+o.code) || !$("o_"+o.code).checked) return;
    if(courseIncludesOp(store, course, o.label)){ why.push(`${o.label}：コース（${course}）のプレイ内容にふくまれるので 0円`); return; }
    let p = +$("op_"+o.code).value||0, b = +$("ob_"+o.code).value||0;
    const special = cast && rulesOn(cast.id).find(r=>r.kind==="op_price" && r.params.op===o.code && (!r.params.group || r.params.group===g));
    if(special){ p = special.params.price; b = special.params.back; why.push(`${o.label}：特例 ${yen(p)}（バック${yen(b)}）`); }
    const qty = o.unit === "once" ? 1 : Math.max(1, +$("oq_"+o.code).value||1);
    // サクラナの「AF・逆AF」1つのOPは、希望したほうだけの名前に（どちらかだけなら、どちらかだけ出す）
    let label = o.label;
    if(o.code === "af" && !$("o_gyakuaf")){ const a = radioVal("f_afw") === "yes", ra = radioVal("f_rafw") === "yes"; label = a && !ra ? "AF" : ra && !a ? "逆AF" : o.label; }
    const memo = $("om_" + o.code) ? $("om_" + o.code).value.trim().slice(0, 60) : "";   // 📝 オプションのメモ（キャストに送る）2026/11/10
    opts.push({ group:g, code:o.code, label, qty, price:p, back:b, manual:o.manual, ...(memo ? { memo } : {}) });
  });
  // 👥 3P・4P：1人につき 3,000円（バック 2,000円）。キャスト複数はキャストごとの予約に1つずつ／お客2名は1つ
  if(typeof party !== "undefined" && party.kind){
    const lab = party.kind === "guest" ? "3P（お客2名）" : party.n >= 3 ? "4P（キャスト" + party.n + "名）" : "3P（キャスト2名）";
    const gx = party.kind === "guest" ? 2 : 1;   // お客2名は 3P料金も×2（6,000円・バック 4,000円）
    opts.push({ group:g, code: party.kind === "guest" ? "3p_guest" : "3p_cast", label: lab, qty:1, price:PARTY_FEE * gx, back:PARTY_BACK * gx, manual:true, ...(party.grp ? { grp: party.grp } : {}) });
  }
  // 👙 キューティーの下着（バック無OP）
  if(store === "cutie" && typeof underSel !== "undefined" && underSel){ const u = UNDER.find(x => x[0] === underSel); if(u) opts.push({ group:g, code:"underwear", label:"下着（" + u[1] + "）", qty:1, price:u[2], back:0, manual:true }); }
  xopExtra().forEach((x, i)=>opts.push({ group:g, code:"custom" + (i + 2), label:x.label, qty:1, price:x.price, back:x.back, manual:true }));   // 2つめからのほかのOP
  if($("f_xop_label").value.trim()){
    opts.push({ group:g, code:"custom", label:$("f_xop_label").value.trim(), qty:1, price:+$("f_xop_price").value||0, back:+$("f_xop_back").value||0, manual:true });
  }
  // 🎁 個人オプション（キャストごと。kb_personal_ops・SQL 236）2026/11/10
  (M.pops || []).filter(p => cast && p.cast_id === cast.id).forEach(p => {
    const cb = $("pp_" + p.id); if(!cb || !cb.checked) return;
    const qty = p.unit === "per_item" ? Math.max(1, +$("ppq_" + p.id).value || 1) : 1;
    const memo = $("ppm_" + p.id) ? $("ppm_" + p.id).value.trim().slice(0, 60) : "";
    opts.push({ group:g, code:"pop_" + p.id, label:"🎁" + p.label, qty, price: Math.max(0, +$("ppp_" + p.id).value || 0), back: Math.max(0, +$("ppb_" + p.id).value || 0), manual:true, ...(memo ? { memo } : {}) });
  });
  const optionTotal = opts.reduce((a,o)=>a + o.price*o.qty, 0);
  const optionBack = opts.reduce((a,o)=>a + o.back*o.qty, 0);
  const transport = Math.max(0, +$("f_transport").value||0), discount = Math.max(0, +$("f_discount").value||0);
  // 👥 お客2名の3P：指名料こみの基本額をお客さんの人数ぶん（例 90分：40,000＋4,000＋3P 3,000）
  if(typeof party !== "undefined" && party.kind === "guest"){ why.push(`お客2名の3P：基本料金 ${yen(price)}・指名料 ${yen(nomination)} を×2`); price = price * 2; nomination = nomination * 2; }
  let total = price + admission + nomination + ext*extSet.price + date*dateSet.price + transport + optionTotal - discount;
  const pay = $("f_pay").value;
  const cardRate = (M.set.card || {}).rate || 1.15;
  // 現金＋カード（分けて払う）：カードで払う分にだけ手数料（×1.15）をのせる。キャストが受け取るのは現金の分だけ 2026/11/4
  let splitCard = 0;
  if($("splitWrap")) $("splitWrap").style.display = pay === "split" ? "" : "none";
  if(pay === "split"){ const base = Math.min(total, Math.max(0, Number($("f_cardpart") ? $("f_cardpart").value : 0) || 0)); splitCard = Math.round(base * cardRate); total = total - base + splitCard; }
  else if(pay && pay !== "cash"){ total = Math.round(total * cardRate); }
  // バック：店舗のグループのランク（特別フリー・イベフリーは「イベ」のランク）＋コース＋（本指／フリー…）
  let courseBack = 0, rank = "", key = "", backMissing = null, nomiBack = 0;
  if(cast){
    rank = (free === "special_free" || free === "event_free") ? ranksOn(cast).event : ranksOn(cast)[g];
    const suffix = free ? FREE_SUFFIX[free] : (visit === "honshi" ? "本指" : "");
    if(rank){
      let r2 = rank;
      if(g === "cutie" && $("f_nh").checked && !/NH/.test(rank)) r2 = rank + "+NH指名";
      key = course + suffix;
      courseBack = M.back[r2 + "|" + key];
      if(courseBack == null && r2 !== rank) courseBack = M.back[rank + "|" + key];
      if(courseBack == null){
        // バック表にないランク×コース：受付で入れた金額を使う（保存すると、このランク×コースが埋まる＝次から自動）
        if(cbackFor !== (editing ? editing.id : 0)){ cbackFor = editing ? editing.id : 0; cbackOv = ""; }
        backMissing = { rank: r2, key, course, g, price };
        const mv = Number(cbackOv) || 0;
        if(mv > 0){ courseBack = mv; why.push(`コースのバック：${r2}・${key} → ${yen(mv)}（受付で入れた。保存すると次から自動）`); }
        else { courseBack = 0; why.push(`⚠️ バック表に「${r2}・${key}」がありません → 「💗 キャストの報酬」でこのコースのバックを入れてください`); }
      }
      else {
        why.push(`コースのバック：${rank}・${key} → ${yen(courseBack)}`);
        // 本指名：本指のバック − ふつうのバック ＝ 本指名バック（精算明細で別の行に出す。合計は同じ）2026/11/7
        if(suffix === "本指"){ const b0 = M.back[r2 + "|" + course] ?? M.back[rank + "|" + course]; if(b0 != null && courseBack > b0){ nomiBack = courseBack - b0; why.push(`（うち本指名バック ${yen(nomiBack)}）`); } }
      }
      if(courseBack && typeof party !== "undefined" && party.kind === "guest"){ courseBack = courseBack * 2; nomiBack = nomiBack * 2; why.push(`お客2名の3P：コースのバックも×2 → ${yen(courseBack)}`); }
    }else why.push("⚠️ このお店用のランクが台帳にありません → 報酬を手で入れてください");
  }
  let extra = ext*extSet.back + date*dateSet.back;
  if(ext) why.push(`延長 ${ext}回：バック ${yen(ext*extSet.back)}`);
  if(date) why.push(`デート ${date}回：バック ${yen(date*dateSet.back)}`);
  if(admission){ extra += admSet.back_add; why.push(`入会金あり：報酬＋${yen(admSet.back_add)}`); }
  if(cast){
    rulesOn(cast.id).filter(r=>r.kind==="back_add").forEach(r=>{
      const p = r.params || {};
      const okStore = !p.store || p.store === store, okCourse = !p.course || p.course === course;
      const okMin = !p.min_minutes || minutesOf(course) >= p.min_minutes;
      if(okStore && okCourse && okMin){ extra += p.amount; why.push(`特例：${r.note}（＋${yen(p.amount)}）`); }
    });
  }
  return { store, g, course, price, nomination, admission, extFee: ext*extSet.price, dateFee: date*dateSet.price, opts, optionTotal,
           optionBack, transport, discount, total, pay, splitCard, courseBack, nomiBack, extra, why, rank, ext, date, free, backMissing };
}

let last = null;
function recalc(){
  if(!$("f_store").value) return;
  optSummary();
  const c = last = calc();
  // 報酬を手で直した値（打ったら覚えておく。描きなおしても消えない）
  if(backOvFor !== (editing ? editing.id : 0)){ backOvFor = editing ? editing.id : 0; backOv = editing && editing.back_override != null ? String(editing.back_override) : ""; backOvNote = (editing && editing.back_override_note) || ""; }
  const ov = backOv;
  const back = c.courseBack + c.optionBack + c.extra;
  $("calc").innerHTML = `
    <h3>💴 お客さんの料金</h3>
    <div class="row"><span>基本額（${esc(c.course)}）</span><b>${yen(c.price)}</b></div>
    ${c.admission?`<div class="row"><span>入会金</span><b>${yen(c.admission)}</b></div>`:""}
    <div class="row"><span>指名料</span><b>${yen(c.nomination)}</b></div>
    ${c.extFee?`<div class="row"><span>延長</span><b>${yen(c.extFee)}</b></div>`:""}
    ${c.dateFee?`<div class="row"><span>デート</span><b>${yen(c.dateFee)}</b></div>`:""}
    ${c.optionTotal?`<div class="row"><span>オプション</span><b>${yen(c.optionTotal)}</b></div>`:""}
    ${c.transport?`<div class="row"><span>交通費</span><b>${yen(c.transport)}</b></div>`:""}
    ${c.discount?`<div class="row"><span>割引</span><b>−${yen(c.discount)}</b></div>`:""}
    ${c.pay && c.pay!=="cash"?`<div class="row"><span>カード（×${(M.set.card||{}).rate||1.15}）</span><b></b></div>`:""}
    <div class="row total"><span>総額</span><b>${yen(c.total)}</b></div>`;
  if($("backSum")) $("backSum").textContent = "：" + yen(ov !== "" ? (Number(ov) || 0) : back);
  const bm = c.backMissing;
  $("calcBack").innerHTML = (bm ? `<div style="background:#FFF4E5;border:2px solid #FFB547;border-radius:12px;padding:8px 10px;margin-bottom:8px">
      <b style="font-size:13.5px;color:#a35a00">📝 「${esc(bm.rank)}・${esc(bm.key)}」のバックがまだありません</b>
      <div id="cbackRef" style="font-size:12.5px;line-height:1.7;margin-top:4px;color:var(--sub)">参考を読んでいます…</div>
      <div class="f" style="margin-top:6px"><label>このコースのバック（コースの分だけ・円）</label>
        <input type="number" id="f_cback" value="${esc(cbackOv)}" oninput="cbackOv=this.value" onchange="recalc()" placeholder="例：11000"></div>
      <div style="font-size:11.5px;color:#a35a00;line-height:1.7">保存すると、次からは「${esc(bm.rank)}・${esc(bm.key)}」は自動でこの金額になります。<br>
        ⚠️ <b>新しく入れたときは、店長に報告してください。</b><br>
        キャストには「過去にないコース内容だったので、バックを手で入れました。万が一直しが必要な場合は、店長から連絡が来ます」とお伝えください。</div></div>` : "") + `
    <div class="row back"><span>コースのバック</span><b>${yen(c.courseBack)}</b></div>
    <div class="row back"><span>OPのバック</span><b>${yen(c.optionBack)}</b></div>
    <div class="row back"><span>延長・入会金・特例</span><b>${yen(c.extra)}</b></div>
    <div class="row total"><span>報酬${ov !== "" ? "（自動の計算）" : ""}</span><b ${ov !== "" ? 'style="text-decoration:line-through;opacity:.5"' : ""}>${yen(back)}</b></div>
    ${ov !== "" ? `<div class="row total"><span>報酬（手で直した）</span><b>${yen(Number(ov) || 0)}</b></div>` : ""}
    <div class="f" style="margin-top:8px"><label>報酬を手で直す（空なら自動）…特例などで、報酬の合計をこの金額にしたいとき。精算もこの金額になります</label>
      <input type="number" id="f_backov" value="${esc(ov)}" ${KB.CAN_EDIT?"":"disabled"} oninput="backOv=this.value" onchange="recalc()" placeholder="例：15000"></div>
    ${ov !== "" ? `<div class="f" style="margin-top:6px"><label>手で直した理由<span class="req">必須</span></label>
      <input id="f_backovNote" maxlength="200" value="${esc(backOvNote)}" ${KB.CAN_EDIT?"":"disabled"} oninput="backOvNote=this.value;this.classList.remove('miss')" placeholder="例：店長OKの特例（○○の件）"></div>` : ""}
    <div class="why">${esc(c.why.join("\n"))}</div>`;
  if(bm){ if($("backDet")) $("backDet").open = true; loadBackRef(bm); }   // たたんであると見落とすので開く
  // コースの説明（極門など）
  const info = M.courseInfo.find(i=>i.store_key===c.store && String(c.course).startsWith(i.course_type));
  $("courseInfo").innerHTML = info ? `<div class="info"><b>${esc(info.title)}</b>\n${esc(info.description)}</div>` : "";
  buildMsg(c);
}

/* ---------- 予約連絡の文面 ---------- */
function buildMsg(c){
  const cast = M.casts.find(x=>x.id===$("f_cast").value);
  const d = new Date(day + "T12:00:00Z");
  // 時刻は 24時より後の書き方（27:00〜28:30）。深夜にかかるときは「※営業日の深夜3:00〜4:30です」と1行足す（2026/11/4）
  let st = $("f_start").value, en = "", lateNote = "";
  if(st){ const [h,m] = st.split(":").map(Number); let s0 = h*60+m; if(s0 < 360) s0 += 1440;
    const mins = minutesOf(c.course) + c.ext*30 + c.date*30, t = s0 + mins; st = lateHM(s0); en = lateHM(t);
    const real = x => { const hh = Math.floor(x / 60) % 24; return (x >= 1440 ? "深夜" : "") + hh + ":" + String(x % 60).padStart(2, "0"); };
    if(t > 1440) lateNote = `\n※${d.getUTCMonth()+1}/${d.getUTCDate()}(${DOW[d.getUTCDay()]})営業日の${s0 >= 1440 ? real(s0) + "〜" + real(t).replace("深夜", "") : real(s0) + "〜" + real(t)}です`; }
  const opTxt = o => o.label + (o.qty>1?"×"+o.qty:"") + (o.memo ? "（" + o.memo + "）" : "");   // 📝 オプションのメモも（2026/11/10）
  const backOps = c.opts.filter(o=>o.back>0).map(opTxt).join("・") || "なし";
  const noBackOps = c.opts.filter(o=>!(o.back>0)).map(opTxt).join("・") || "なし";
  // 店名はエリアを伏せる（「五反田逆アナル倶楽部」を見て、行く場所をまちがえる子がいるので。2026/11/3）
  const storeNoArea = k => storeLabel(k).replace(/[（(]?(池袋|五反田|鶯谷|錦糸町|渋谷|新宿|上野|秋葉原|大塚|巣鴨)[）)]?/g, "").trim() || storeLabel(k);
  // 本指名のときだけ、そのキャストを前回指名した日（受付の「本指名」の横と同じ lastNomiOf）。新規・店リピは日付なし
  const prev = visit === "honshi" ? lastNomiOf($("f_cast").value) : "";
  const visitTxt = ((VISIT.find(v=>v[0]===visit) || [])[1] || "") + (prev ? "（前回 " + prev + "）" : "");
  // 文は「✏️ 連絡の文を直す」で、内勤みんなで直せる（kb_settings 'cast_msg_tpl'。2026/11/5）
  const T = castMsgTpl(), yen0 = n => Number(n || 0).toLocaleString("ja-JP");
  const money = { 総額: yen0(c.total), 現金: yen0(c.total - (c.splitCard || 0)), カード: yen0(c.splitCard || 0) };
  const V = {
    // 18・極門：ダミー名のプロフ（公式HPのページ）のURLも（2026/11/5）
    ダミー行: isDummyStore(c.store) && $("f_dummy").value ? "\n（ダミー名「" + $("f_dummy").value + "」で受けています）"
      + (() => { const dm = M.dummies.find(x => x.store_key === c.store && x.name === $("f_dummy").value), u = dmProfUrl(dm); return u ? "\n【プロフ】" + u : ""; })() : "",
    日時: `${d.getUTCMonth()+1}/${d.getUTCDate()}(${DOW[d.getUTCDay()]}) ${st||"--:--"}〜${en||"--:--"}${lateNote}`,
    店名: storeNoArea(c.store), 名前: $("f_name").value || "お客", 種別: visitTxt,
    コース: `${c.course}${/^\d+$/.test(c.course)?"分":""}${c.free?"（"+FREE_SUFFIX[c.free]+"）":""}${c.ext?"＋延長"+c.ext*30+"分":""}`,
    場所見出し: { love: "ホテル", biz: "ホテル", home: "自宅" }[$("f_place").value] || "ホテル・自宅",
    場所: `${$("f_area").value} ${$("f_address").value}`,
    ビジホ行: (() => { try{ return $("f_place").value === "biz" ? "\n【ビジホ】" + bizText(bizState) : ""; }catch(e){ return ""; } })(),
    地図行: hotelMapUrl() ? "\n【地図】" + hotelMapUrl() : "",
    バック有OP: backOps, バック無OP: noBackOps,
    特記事項行: $("f_castnote") && $("f_castnote").value.trim() ? "\n【特記事項】" + $("f_castnote").value.trim() : "",
    お金: fillVars(T[c.pay === "split" ? "split" : c.pay === "cash" ? "cash" : "card"], money),
  };
  $("msg").value = fillVars(T.main, V);
}
function fillVars(t, V){ return String(t || "").replace(/\{([^{}\s]+)\}/g, (m, k) => (k in V ? V[k] : m)); }
const CAST_MSG_DEF = {
  main: `お疲れ様です
ご予約いただきました！
ご確認お願いいたします🙇
{ダミー行}
{日時}
【店名】{店名}
【名前】{名前}様 {種別}
【コース】{コース}
【{場所見出し}】{場所}{ビジホ行}{地図行}
【バック有OP】{バック有OP}
【バック無OP】{バック無OP}{特記事項行}
{お金}`,
  cash: `【料金総額】{総額}円

※【盗難・料金貰い忘れ対策】料金はお会いして最初にいただいてください。
部屋内ではキャストさん及びお客様どちらもお風呂やトイレにも貴重品を肌身離さず持ち歩くよう心がけてください。
【お金を盗られる事件が実際にありました。気を付けましょう】`,
  card: `【お支払い】カード決済の為、お金はいただかずスタートしてください

※【盗難対策】部屋内ではキャストさん及びお客様どちらもお風呂やトイレにも貴重品を肌身離さず持ち歩くよう心がけてください。
【お金を盗られる事件が実際にありました。気を付けましょう】`,
  split: `【料金総額】{総額}円（現金 {現金}円＋カード {カード}円）
※現金の {現金}円は、お会いして最初にいただいてください（カードの分は決済URLで払っていただきます）
部屋内ではキャストさん及びお客様どちらもお風呂やトイレにも貴重品を肌身離さず持ち歩くよう心がけてください。
【お金を盗られる事件が実際にありました。気を付けましょう】`,
};
function castMsgTpl(){ const v = (M.set && M.set.cast_msg_tpl) || {}; const o = {}; Object.keys(CAST_MSG_DEF).forEach(k => { o[k] = typeof v[k] === "string" && v[k].trim() ? v[k] : CAST_MSG_DEF[k]; }); return o; }
function openCastMsgTpl(){
  let bg = $("cmBg");
  if(!bg){ bg = document.createElement("div"); bg.id = "cmBg"; bg.className = "modal-bg"; document.body.appendChild(bg); KB.closeOnBackdrop(bg, () => bg.classList.remove("show")); }
  const T = castMsgTpl(), ro = KB.CAN_EDIT ? "" : "disabled";
  const box = (k, label, rows) => `<div class="f" style="margin-top:8px"><label>${label}</label><textarea id="cm_${k}" rows="${rows}" style="width:100%;font-family:inherit;font-size:13px" ${ro}>${esc(T[k])}</textarea></div>`;
  bg.innerHTML = `<div class="modal" style="max-width:680px"><button class="x" onclick="$('cmBg').classList.remove('show')">×</button>
    <h2>✏️ 📨 キャストへの予約連絡の文</h2>
    <p style="font-size:12.5px;color:var(--sub);line-height:1.7;margin:0 0 4px">内勤みんな同じ文になります。{ } の中は、その予約の内容に変わります。<br>
      使えるもの：{ダミー行} {日時} {店名} {名前} {種別} {コース} {場所見出し} {場所} {ビジホ行} {地図行} {バック有OP} {バック無OP} {特記事項行} {お金}<br>
      <b>【コース】【バック無OP】【料金総額】の見出しは消さないでください</b>（3P・希望プレイ・カード決済の文が、ここに自動で足されます）</p>
    ${box("main", "📨 本文", 14)}
    ${box("cash", "💴 {お金}：現金のとき（{総額}）", 5)}
    ${box("card", "💳 {お金}：カードのとき", 4)}
    ${box("split", "💴＋💳 {お金}：現金＋カードのとき（{総額} {現金} {カード}）", 5)}
    ${KB.CAN_EDIT ? `<div style="display:flex;gap:6px;margin-top:10px"><button type="button" class="btn btn-primary" style="flex:1" onclick="saveCastMsgTpl()">保存</button>
      <button type="button" class="btn btn-ghost" onclick="if(confirm('はじめの文にもどしますか？（保存するまでは変わりません）'))Object.keys(CAST_MSG_DEF).forEach(k=>$('cm_'+k).value=CAST_MSG_DEF[k])">はじめの文にもどす</button></div>` : ""}</div>`;
  bg.classList.add("show");
}
async function saveCastMsgTpl(){
  if(!KB.CAN_EDIT) return;
  const v = {}; Object.keys(CAST_MSG_DEF).forEach(k => { v[k] = $("cm_" + k).value; });
  if(!/【コース】/.test(v.main) || !/【バック無OP】/.test(v.main)){ if(!confirm("【コース】か【バック無OP】の見出しがありません。3P・希望プレイの文が入らなくなりますが、保存しますか？")) return; }
  try{
    q(await sb.from("kb_settings").upsert({ key: "cast_msg_tpl", value: v, note: "📨 キャストへの予約連絡の文（受付の ✏️ 連絡の文を直す）" }));
    M.set.cast_msg_tpl = v; $("cmBg").classList.remove("show"); toast("保存しました"); recalc();
  }catch(e){ toast("保存できませんでした：" + (e.message || e)); }
}
function copyMsg(){ navigator.clipboard.writeText($("msg").value).then(()=>toast("📋 文面をコピーしました")); }
// 📩 ネット予約の返信（店名・お店の電話番号・予約の内容）。お店の電話番号は公式HPのもの（2026/10/28）
const STORE_TEL = { sakuramoon: "03-5944-9075", lana_uguisu: "03-5944-9288", lana_kinshi: "03-5944-9288", dressgarden: "03-5944-9075", peachmoon: "03-5944-9075",
  gyakuanal: "03-6277-1964", cutie: "03-6384-4261", eighteen: "03-6802-4755", gokumon: "03-6802-4530" };
const NET_MEDIA = ["heaven_net", "pure_net", "fuja_net", "official_mail"];
function netReply(){
  const wrap = $("netReplyWrap"); if(!wrap) return;
  const on = mediaSel.some(m => NET_MEDIA.includes(m) || /_net$/.test(m));
  wrap.style.display = on ? "" : "none"; if(!on || !last) return;
  const c = last, store = c.store, cast = M.casts.find(x => x.id === $("f_cast").value);
  const bd = ($("f_day") && $("f_day").value) || day, d = new Date(bd + "T12:00:00Z"), st = $("f_start").value;
  // お客さまへの返信は、ふつうの日付と時刻（深夜3時なら「次の日の 03:00」。27:00 とは書かない）2026/11/4
  let en = "", cd2 = d, st2 = st;
  if(st){ const [h, m] = st.split(":").map(Number); let s0 = h * 60 + m; if(s0 < 360) s0 += 1440;
    const t = s0 + minutesOf(c.course) + c.ext * 30 + c.date * 30, n = x => String(Math.floor(x / 60) % 24).padStart(2, "0") + ":" + String(x % 60).padStart(2, "0");
    if(s0 >= 1440){ cd2 = new Date(d.getTime() + 24 * 3600 * 1000); }
    st2 = n(s0); en = n(t); }
  const who = isDummyStore(store) && $("f_dummy").value ? $("f_dummy").value : cast ? ((cast.stores && cast.stores[store] && cast.stores[store].name) || cast.official_name || cast.temp_name) : "（キャスト）";
  const ops = c.opts.map(o => o.label + (o.qty > 1 ? "×" + o.qty : "")).join("・");
  const place = [$("f_area").value, $("f_address").value].filter(Boolean).join(" ");
  // 文は「✏️ 返信の文を直す」で、内勤みんなで直せる（kb_settings 'net_reply_tpl'。2026/11/5）
  const V = { 名前: $("f_name").value || "お客", 店名: storeLabel(store), 日時: `${cd2.getUTCMonth() + 1}/${cd2.getUTCDate()}(${DOW[cd2.getUTCDay()]}) ${st2 || "--:--"}〜${en || "--:--"}`,
    キャスト: who, コース: `${c.course}${/^\d+$/.test(c.course) ? "分" : ""}${c.ext ? "（延長" + c.ext * 30 + "分）" : ""}`, 場所: place || "（未定）",
    オプション行: ops ? "\n■オプション：" + ops : "", 希望プレイ行: $("f_play") && $("f_play").value.trim() ? "\n■希望プレイ（無料の範囲）：" + $("f_play").value.trim() : "", 料金: c.total.toLocaleString("ja-JP") + "円", 支払: c.pay === "cash" ? "現金" : c.pay === "split" ? "現金＋カード" : "カード", 電話: STORE_TEL[store] || "" };
  $("netReply").value = netTpl().replace(/\{(名前|店名|日時|キャスト|コース|場所|オプション行|希望プレイ行|料金|支払|電話)\}/g, (m, k) => V[k]);
}
const NET_TPL_DEF = `{名前}様

この度は{店名}をご利用いただき、誠にありがとうございます。
下記の内容でご予約を承りました。

■ご予約日時：{日時}
■キャスト：{キャスト}
■コース：{コース}
■ご利用場所：{場所}{オプション行}{希望プレイ行}
■料金総額：{料金}（{支払}）

ご不明な点やご変更がございましたら、お気軽にお電話ください。
当日はどうぞよろしくお願いいたします。

{店名}
TEL：{電話}`;
function netTpl(){ const v = M.set && M.set.net_reply_tpl; let t = typeof v === "string" && v.trim() ? v : NET_TPL_DEF;
  // 前に保存した文に {希望プレイ行} がなければ、{オプション行} のあとに入れる（2026/11/7 店長：今のテンプレにも入るように）
  if(!t.includes("{希望プレイ行}")) t = t.includes("{オプション行}") ? t.replace("{オプション行}", "{オプション行}{希望プレイ行}") : t.replace(/(\n■料金総額)/, "{希望プレイ行}$1");
  return t; }
function openNetTpl(){
  let bg = $("ntBg");
  if(!bg){ bg = document.createElement("div"); bg.id = "ntBg"; bg.className = "modal-bg"; document.body.appendChild(bg); KB.closeOnBackdrop(bg, () => bg.classList.remove("show")); }
  bg.innerHTML = `<div class="modal" style="max-width:640px"><button class="x" onclick="$('ntBg').classList.remove('show')">×</button>
    <h2>✏️ 📩 お客さまへの返信の文</h2>
    <p style="font-size:12.5px;color:var(--sub);line-height:1.7;margin:0 0 8px">いつもの注意事項なども、ここに書けば毎回入ります（内勤みんな同じ文）。<br>
      {名前} {店名} {日時} {キャスト} {コース} {場所} {オプション行} {希望プレイ行} {料金} {支払} {電話} は、その予約の内容になります。</p>
    <textarea id="nt_text" rows="18" style="width:100%;font-family:inherit;font-size:13.5px">${esc(netTpl())}</textarea>
    ${KB.CAN_EDIT ? `<div style="display:flex;gap:6px;margin-top:8px"><button type="button" class="btn btn-primary" style="flex:1" onclick="saveNetTpl()">保存</button>
      <button type="button" class="btn btn-ghost" onclick="if(confirm('はじめの文にもどしますか？'))$('nt_text').value=NET_TPL_DEF">はじめの文にもどす</button></div>` : ""}</div>`;
  bg.classList.add("show");
}
async function saveNetTpl(){
  if(!KB.CAN_EDIT) return;
  const v = $("nt_text").value;
  try{
    q(await sb.from("kb_settings").upsert({ key: "net_reply_tpl", value: v, note: "📩 ネット予約のお客さまへの返信の文（受付の ✏️ 返信の文を直す）" }));
    M.set.net_reply_tpl = v; $("ntBg").classList.remove("show"); toast("保存しました"); netReply();
  }catch(e){ toast("保存できませんでした：" + (e.message || e)); }
}

/* ---------- 保存・削除 ---------- */
function startAt(){
  const st = $("f_start").value; if(!st) return null;
  let [h,m] = st.split(":").map(Number);
  // 日本時間で組み立てる。朝6時より前は次の日の日付（営業日はそのまま）
  //   「25:00」「27:00」のような書き方も、その営業日の深夜（次の日の1時・3時）として読む（2026/11/4）
  const bd = ($("f_day") && $("f_day").value) || day;   // 日付を変えたとき（別の日の予約にする）
  const late = h >= 24; if(late) h -= 24;
  const d = new Date(`${bd}T${String(h).padStart(2,"0")}:${String(m || 0).padStart(2,"0")}:00+09:00`);
  if(late || h < 6) d.setTime(d.getTime() + 24*3600*1000);
  return d;
}
async function saveRes(){
  if(!KB.CAN_EDIT){ toast("作成中のため、直せるのは店長だけです"); return; }
  if(!$("f_cast").value){ toast(isDummyStore($("f_store").value) ? "実際に行くキャストを選んでください" : "キャストを選んでください"); return; }
  // 専用在籍指名で子を選んでいるのに、名前の欄が空のとき（念のため）：選んだ子の専用の名前を入れなおす
  if(isDummyStore($("f_store").value) && !$("f_dummy").value && typeof dmMode !== "undefined" && dmMode === "named" && $("f_named") && $("f_named").value){ try{ onNamedPick(true); }catch(e){} }
  if(isDummyStore($("f_store").value) && !$("f_dummy").value){ toast(typeof dmMode !== "undefined" && dmMode === "named" ? "「ダミー or 本物の一覧」から指名された子（⭐ 本物）を選んでください" : "「ダミー or 本物の一覧」から選んでください（ダミー名がなければ ⚙️ から足せます）"); return; }
  // 受付ルール：📣は全部チェック／✅はチェックするまで「〜待ち」でしか保存できない／⌛受けない長さは保存できない（キャンセル・トビは除く）
  if(!$("f_status").value){ toast("⚠️ 状態を選んでください"); $("f_status").scrollIntoView({ block: "center" }); return; }
  const cancelLike = ["cancel", "tobi", "flowed"].includes($("f_status").value);
  // 必須の項目（キャンセル・トビにするときは、なくても保存できる）
  const miss = cancelLike ? [] : missingRequired();
  if(miss.length){ toast("⚠️ まだ入っていない必須の項目：" + miss.map(x=>x[0]).join("・")); markMissing(miss); return; }
  const waiting = String($("f_status").value).startsWith("wait_");
  const ck = checksForSave();
  // 出禁・店NGのお客さんは受けない（NGが解除になったら「店NG」を「NGではない」に直してから）
  if(!cancelLike && curCustomer && curCustomer.ng && curCustomer.ng_ask){ toast("🤔 このお客さんが出禁・店NGか、先に決めてください（お客さんの欄のボタン）"); $("custInfo").scrollIntoView({ block: "center" }); return; }
  // 止めるのは「新しい予約」で「もともと店NG」のお客さんだけ。終わった予約などを開いて、今回 店NG にする（記録する）のは保存できる
  if(!cancelLike && !editing && $("f_ng").value === "1" && curCustomer && curCustomer.ng){ toast("🚫 出禁・店NGのお客さんです。受けられません（解除なら、お客さんの「店NG」を直してから）"); $("custInfo").scrollIntoView({ block: "center" }); return; }
  // 🈵 満了のキャストは、その日の新しい予約を受けない（受けるときは、キャストの枠の「🈵 満了」を外してから）2026/11/7
  if(!cancelLike && !editing && (($("f_day") && $("f_day").value) || day) === day && (castDays[$("f_cast").value] || {}).full_at){ toast("🈵 " + castName($("f_cast").value) + "さんは満了です。受けるときは、キャストの枠の「🈵 満了」を外してから"); return; }
  // 🔎 要確認のお客さん：新しい予約は、キャストに確認したかを聞く（返事待ちの状態なら聞かない）2026/11/7
  if(!cancelLike && !editing && !waiting && curCustomer && (curCustomer.tags || []).some(x => /要確認/.test(x)) && !confirm("🔎 要確認のお客さんです。\nキャストに確認しましたか？\n（まだなら「キャンセル」を押して、状態を「キャスト返事待ち」にしてください）")) return;
  if(!cancelLike && ck.longNg){ toast("🚫 このキャストでは受けられません（赤い枠の理由を見てください）"); $("castChecks").scrollIntoView({ block: "center" }); return; }
  if(!cancelLike && ck.missAnnounce){ toast("📣 お客様に案内することに、まだチェックがついていません"); $("castChecks").scrollIntoView({ block: "center" }); return; }
  if(!cancelLike && ck.missConfirm && !waiting){ toast("✅ キャストに確認してから受けるものがあります。確認したらチェック、まだなら状態を「キャスト返事待ち」に"); $("castChecks").scrollIntoView({ block: "center" }); return; }
  const checks = ck.list;
  if(!cancelLike && !$("f_free").value && (!radioVal("f_afw") || !radioVal("f_rafw"))){ toast("🔸 AF・逆AF のご希望を聞いて、選んでください"); $("optDetails").scrollIntoView({ block: "center" }); return; }
  if(!$("f_course").value){ toast("コースを選んでください"); return; }
  if(!(await KB.staffSession())){ toast("ログインの期限が切れました。ポータルから開き直してください"); return; }
  const c = calc(), by = KB.operatorName();
  try{
    // お客さん（電話番号があれば探す・なければ作る）
    let customerId = curCustomer ? curCustomer.id : null, exPrimary = "";
    // 電話番号不明（00 など6けたより短い）は、番号なしのお客さんとして入れる（ほかの「00」のお客さんとまとめない）2026/11/4
    const phoneIn = phoneNorm($("f_phone").value), phone = digits(phoneIn).length >= 6 ? phoneIn : "";
    const name = $("f_name").value.trim(), ng = $("f_ng").value === "1", cn = $("f_custnote").value.trim();
    if(phone || name){
      if(!customerId && phone){
        const ex = await custByPhone(phone, "id,phone");
        if(ex){ customerId = ex.id; exPrimary = ex.phone || ""; }
      }
      const cu = { phone, name, ng, updated_by: by };
      // 副番号で見つけたお客さんは、主の番号を書きかえない（主の番号がまだないときだけ入れる）
      const primary = curCustomer && curCustomer.id === customerId ? (curCustomer.phone || "") : exPrimary;
      if(customerId && primary && digits(primary).length >= 6 && primary !== phone) delete cu.phone;   // 主の番号が「00」（不明）なら、あとで入れた番号を主の番号にする
      if(customerId && !phone) delete cu.phone;   // 番号不明で保存しても、もとの番号は消さない
      { const em = $("f_email").value.trim(); if(em) cu.email = em; }   // メールアドレス（入れたときだけ。消すのは顧客台帳で）
      if(ng) cu.ng_reason = cn; else if(cn && $("f_ng").value !== "2") cu.note = cn;   // キャストNGの理由は、お客さんメモには入れない
      if(customerId) q(await sb.from("kb_customers").update(cu).eq("id", customerId));
      else customerId = q(await sb.from("kb_customers").insert(cu).select("id").single()).id;
      // 🙅 キャストNG（選んでいるキャストだけ）：キャストごとのNGに足す（同じキャストにもうあれば足さない）2026/11/4
      const ngCast = $("f_cast").value;
      if($("f_ng").value === "2" && customerId && ngCast){
        const has = await sb.from("kb_cust_cast_ng").select("id").eq("customer_id", customerId).eq("cast_id", ngCast).limit(1);
        if(!(has.data || []).length) q(await sb.from("kb_cust_cast_ng").insert({ customer_id: customerId, cast_id: ngCast, cast_name: castName(ngCast), reason: cn, source: "manual", by_name: by }));
      }
    }
    const s = startAt();
    const mins = minutesOf(c.course) + c.ext*30 + c.date*30;
    const ovRaw = $("f_backov") ? $("f_backov").value : "";
    const row = {
      biz_date: ($("f_day") && $("f_day").value) || day, store_key: c.store, cast_id: $("f_cast").value, customer_id: customerId,
      dummy_name: isDummyStore(c.store) ? $("f_dummy").value : "",
      checks,
      ...(("guest_flags" in (rows[0] || editing || {}) || M.castChecks.some(x=>"kind" in x)) ? { guest_flags: [...guestFlags], todos: ck.todos } : {}),
      af_wish: radioVal("f_afw"), rev_af_wish: radioVal("f_rafw"),
      play_wish: $("f_play").value.trim(),
      cast_notified_at: $("f_notified").checked ? ((editing && editing.cast_notified_at) || new Date().toISOString()) : null,
      cast_notified_by: $("f_notified").checked ? ((editing && editing.cast_notified_at && editing.cast_notified_by) || by) : "",
      visit_kind: visit, free_kind: c.free, nh_rate: $("f_nh").checked,
      ...(HAS_DRESS ? { dress: c.store === "cutie" ? getDress() : null } : {}),
      start_at: s ? s.toISOString() : null, end_at: s ? new Date(s.getTime() + mins*60000).toISOString() : null,
      area: $("f_area").value.trim(), address: $("f_address").value.trim(), course: c.course,
      ...(("place_kind" in (rows[0] || editing || {})) || ($("f_place") && $("f_place").value) ? { place_kind: $("f_place") ? $("f_place").value : "" } : {}),
      ...(("biz_check" in (rows[0] || editing || {})) || ($("f_place") && $("f_place").value === "biz") ? { biz_check: $("f_place") && $("f_place").value === "biz" ? bizState : null } : {}),
      extension_count: c.ext, date_count: c.date, options: c.opts, media: mediaSel,
      ...(HAS_EXT_ORDERS ? { ext_orders: extOrders } : {}),
      base_price: c.price, admission: c.admission, nomination_fee: c.nomination, extension_fee: c.extFee + c.dateFee,
      transport: c.transport, option_total: c.optionTotal, discount: c.discount, discount_note: $("f_discnote").value.trim(),
      // 現金＋カードは、支払いは「現金」のまま、カードの分（手数料こみ）を card_total に入れる（精算・回収明細でカードとして引く）
      total: c.total, payment: c.pay === "split" ? "cash" : c.pay === "card" && editing && (editing.card_step === "paid" || editing.payment === "card_paid") ? "card_paid" : c.pay, card_total: c.pay === "cash" ? 0 : c.pay === "split" ? (c.splitCard || 0) : c.total,
      course_back: c.courseBack, option_back: c.optionBack, extra_back: c.extra,
      ...(HAS_226 ? { nomi_back: c.nomiBack || 0 } : {}),   // コースのバックのうち本指名の分（精算明細で別の行に。合計は変わらない）
      back_override: ovRaw === "" ? null : Number(ovRaw),
      ...(("back_override_note" in (rows[0] || editing || {})) || ovRaw !== "" ? { back_override_note: ovRaw === "" ? "" : backOvNote.trim() } : {}),
      // 📱 スマホで保存しても、そのまま本予約（2026/11/02 社長OK。前の「仮入力」は使わない）
      ...(("phone_draft" in (rows[0] || editing || {})) ? { phone_draft: false } : {}),
      status: $("f_status").value, confirm_call: $("f_confirm").value.trim(), note: $("f_note").value, updated_by: by,
      ...formStatusAtPatch(),   // ⏰ この状態の時刻（SQL 182）
      ...(() => { const v = $("f_castnote") ? $("f_castnote").value.trim() : ""; return v || rows.some(x => "cast_note" in x) || (editing && "cast_note" in editing) ? { cast_note: v } : {}; })(),   // 📝 キャストに伝える特記事項（SQL 187）
      ...(() => { const lg = statusLog(editing ? (rows.find(x => x.id === editing.id) || editing) : null, $("f_status").value, by); const all = editing ? lg : (lg || []).concat(formPendingNow()); return all && all.length ? { memo_log: all } : {}; })(),   // 備考に状態の経緯
    };
    // 🔒 精算済の予約・エクセルから取りこんだ予約は、お金の数字を前のまま残す（料金表を変えても、過去の売上・バック・店落ちが変わらないように）2026/11/6 店長
    //   金額を本当に直したいときは、先に精算済をもどしてから
    if(editing && moneyLocked(editing)){
      const old = rows.find(x => x.id === editing.id) || editing;
      const same = (a, b) => (a == null || a === "" || a === 0 || a === false) && (b == null || b === "" || b === 0 || b === false) || JSON.stringify(a) === JSON.stringify(b) || (typeof a !== "object" && Number(a) === Number(b) && !isNaN(Number(a)));
      const changed = MONEY_KEYS.filter(k => k in old && !same(row[k], old[k]));
      MONEY_KEYS.forEach(k => { if(k in old) row[k] = old[k]; });
      if(changed.length) toast("🔒 精算済（またはエクセルから取りこんだ）予約なので、金額は前のまま保存しました");
    }
    if(editing) q(await sb.from("kb_reservations").update(row).eq("id", editing.id));
    else { row.created_by = by; const extra = partyExtraRows(row); q(await sb.from("kb_reservations").insert([row, ...extra])); if(extra.length) toast(`👥 ${extra.length + 1}人のキャストの予約を作りました`); }
    { const bd = $("f_day") && $("f_day").value; closeForm();
      // 日付を変えて保存したら、その日の画面にうつる
      if(bd && bd !== day){ $("day").value = bd; toast("保存しました🌸（" + Number(bd.slice(5, 7)) + "/" + Number(bd.slice(8)) + " の画面にうつりました）"); } else toast("保存しました🌸"); }
    loadDay();
  }catch(e){ toast("保存できませんでした：" + (e.message || e)); }
}
async function removeRes(){
  if(!KB.CAN_EDIT || !editing) return;
  if(!confirm("この受付を削除しますか？（記録には「削除」として残ります）")) return;
  try{ q(await sb.from("kb_reservations").update({ deleted: true, updated_by: KB.operatorName() }).eq("id", editing.id)); closeForm(); toast("削除しました"); loadDay(); }
  catch(e){ toast("削除できませんでした：" + (e.message || e)); }
}
async function loadLog(id){
  try{
    const logs = q(await sb.from("kb_reservation_log").select("at,by_name,action,changes").eq("reservation_id", id).order("at")) || [];
    $("logInfo").innerHTML = "🕒 記録：" + logs.map(l=>{
      const t = new Date(l.at); const j = new Date(t.getTime()+9*3600*1000);
      const w = `${j.getUTCMonth()+1}/${j.getUTCDate()} ${String(j.getUTCHours()).padStart(2,"0")}:${String(j.getUTCMinutes()).padStart(2,"0")}`;
      const what = l.action === "insert" ? "受付" : l.action === "delete" ? "削除" : "変更（" + Object.keys(l.changes||{}).slice(0,6).join("・") + "）";
      return `${w} ${esc(l.by_name||"")} ${what}`;
    }).join(" ／ ");
  }catch(e){}
}


