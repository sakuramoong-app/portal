/* ============================================================
   ✉ メール予約の貼りつけ（2026/11/18 店長：お客さんから来た予約メールをそのまま貼る → 受付に入れる）
   メールの形（公式HP・各サイトの予約フォーム）：
     【予約された方の情報】お名前：○○ 様／★★お客様の電話番号⇒ …／★★お客様のメール⇒ …
     ご利用日時: 11月22日(日) 18時 30分／コース時間: 90分／ご利用地域ホテル: …／ご希望のキャスト: 23:名前
     オプションの行「…（無料）: 〇」「…（有料）: ×」／どちらのサイトをご覧になりましたか: …／その他: …（下の行まで）
   ・入れるだけ。保存はいつもの「登録する」で（確認してから）
   ・売上店舗はメールに書いていないので、えらんでいなければ、えらんでから「もう一度入れる」で キャスト・コース・オプションも入る
   ============================================================ */
const MAIL_AREA = { ikebukuro: "池袋", uguisudani: "鶯谷", uguisu: "鶯谷", gotanda: "五反田", kinshicho: "錦糸町", shibuya: "渋谷", shinjuku: "新宿", ueno: "上野" };
function mailParse(t){
  t = String(t || "").replace(/\r/g, "");
  const line = re => { const m = t.match(re); return m ? m[1].trim() : ""; };
  const o = {};
  o.name = line(/お名前[：:]\s*(.+?)\s*様/);
  o.phone = line(/電話番号\s*[⇒：:]\s*([0-9０-９\-－+ ]+)/).replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xFEE0)).replace(/[^\d]/g, "");
  o.email = line(/メール\s*[⇒：:]\s*(\S+@\S+)/);
  const dt = t.match(/ご利用日時[：:]\s*(\d{1,2})月\s*(\d{1,2})日[^\d\n]*?(\d{1,2})時\s*(\d{1,2})?\s*分?/);
  if(dt){ o.month = Number(dt[1]); o.date = Number(dt[2]); o.hh = Number(dt[3]); o.mm = Number(dt[4] || 0); }
  o.course = line(/コース時間[：:]\s*(\d+)\s*分/);
  o.place = line(/ご利用地域ホテル[：:][ \t]*([^\n]*)/);
  const c = t.match(/ご希望のキャスト[：:]\s*(?:(\d+)\s*[:：])?\s*([^\n]+)/);
  if(c){ o.castNo = c[1] || ""; o.cast = c[2].trim(); }
  o.opts = [];
  t.split("\n").forEach(l => { const m = l.match(/^(.+?（(?:無料|有料)）[^:：]*)[：:]\s*([〇○◯×✕xX])?\s*$/); if(m && m[2]) o.opts.push({ label: m[1].trim(), yes: /[〇○◯]/.test(m[2]) }); });
  o.site = line(/どちらのサイトをご覧になりましたか[：:][ \t]*([^\n]*)/);
  const ot = t.match(/その他[：:][ \t]*([\s\S]*?)(?:\n━|\n--\s*\n|$)/);
  o.other = ot ? ot[1].trim() : "";
  return o;
}
// 予約の日：今年（その月日がもう2か月以上前なら来年）
function mailDay(o){
  if(!o.month || !o.date) return "";
  const now = new Date(Date.now() + 9 * 3600000); let y = now.getUTCFullYear();
  const cand = new Date(Date.UTC(y, o.month - 1, o.date));
  if(cand < new Date(now.getTime() - 60 * 86400000)) y++;
  return `${y}-${String(o.month).padStart(2, "0")}-${String(o.date).padStart(2, "0")}`;
}
// 予約フォームのオプション名 → このお店のオプション
function mailOptCode(label, g){
  if(/(^|[^逆])AF（/.test(label) && !/逆AF/.test(label)) return "af";
  if(/逆AF/.test(label)) return "gyakuaf";
  const core = label.replace(/（.*$/, "").replace(/^キャスト/, "").replace(/（道具込み）|まみれプレイ|プレイ/g, "").trim();
  const list = M.options.filter(x => x.store_group === g);
  const hit = list.find(x => x.label === core) || list.find(x => core && (x.label.includes(core) || core.includes(x.label)))
    || (/無限射精/.test(label) ? list.find(x => /無限/.test(x.label)) : null)
    || (/射精/.test(label) && !/無限/.test(label) ? list.find(x => /射精/.test(x.label) && !/無限/.test(x.label)) : null);
  return hit ? hit.code : "";
}
let MAIL_LAST = null;
function mailApply(o, quiet){
  o = o || MAIL_LAST; if(!o) return;
  MAIL_LAST = o;
  const done = [], left = [];
  const fire = el => { try{ el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }catch(e){} };
  if(o.phone && $("f_phone") && !$("f_phone").value.trim()){ $("f_phone").value = o.phone; done.push("電話番号"); try{ lookupCustomer(); }catch(e){} }
  if(o.name && $("f_name") && !$("f_name").value.trim()){ $("f_name").value = o.name; done.push("名前"); }
  if(o.email && $("f_email") && !$("f_email").value.trim()){ $("f_email").value = o.email; done.push("メール"); }
  const d = mailDay(o);
  if(d && $("f_day")){ $("f_day").value = d; fire($("f_day")); done.push("日付"); }
  if(o.hh != null && $("f_start")){ $("f_start").value = String(o.hh).padStart(2, "0") + ":" + String(o.mm || 0).padStart(2, "0"); fire($("f_start")); done.push("開始時刻"); }
  // 場所：エリアの名前ならエリア、それ以外（ホテル名など）はホテル・住所の欄
  if(o.place && $("f_areaSel")){
    const p = MAIL_AREA[o.place.toLowerCase().replace(/\s/g, "")] || o.place;
    const opt = [...$("f_areaSel").options].find(x => x.value && (x.value === p || x.textContent.trim() === p));
    if(opt){ $("f_areaSel").value = opt.value; try{ onAreaSel(); }catch(e){} done.push("エリア"); }
    else if($("f_address") && !$("f_address").value.trim()){ $("f_address").value = p; fire($("f_address")); done.push("ホテル・場所"); }
  }
  // 媒体：メールで来た予約なので「公式メール予約」＋ 見たサイト（2026/11/18）
  if(Array.isArray(M.media)){
    const pick = code => { const m = M.media.find(x => x.code === code); if(m && !mediaSel.includes(code)) toggleMedia(code); return !!m; };
    if(pick("official_mail")) done.push("媒体（公式メール予約）");
    if(o.site){ const code = mailSiteCode(o.site); if(code && pick(code)) done.push("媒体（" + o.site + "）"); else left.push("媒体（" + o.site + "）"); }
  }
  // 売上店舗がえらばれていれば：キャスト・コース・オプション
  const store = $("f_store") && $("f_store").value;
  if(!store){ left.push("売上店舗（えらんでから「もう一度入れる」でキャスト・コース・オプションも入ります）"); }
  else {
    const g = storeGroup(store);
    if(o.cast){
      const c = typeof castByRaw === "function" ? castByRaw(o.cast) : null;
      if(c){ if(![...$("f_cast").options].some(x => x.value === c.id) && $("f_castAll")){ $("f_castAll").checked = true; fillCastSel(); }
        $("f_cast").value = c.id; if($("f_cast").value === c.id){ onCast(); done.push("キャスト"); } else left.push("キャスト（" + o.cast + "）"); }
      else left.push("キャスト（" + o.cast + "）");
    }
    if(o.course && $("f_course")){ const v = [...$("f_course").options].find(x => x.value === o.course); if(v){ $("f_course").value = o.course; fire($("f_course")); done.push("コース"); } else left.push("コース（" + o.course + "分）"); }
    const yes = o.opts.filter(x => x.yes), af = yes.some(x => mailOptCode(x.label, g) === "af"), raf = yes.some(x => mailOptCode(x.label, g) === "gyakuaf");
    if(o.opts.some(x => /AF（/.test(x.label))){ setRadio("f_afw", af ? "yes" : "no"); setRadio("f_rafw", raf ? "yes" : "no"); try{ onAfWish(); }catch(e){} done.push("AF・逆AF"); }
    yes.forEach(x => {
      if(/3P/.test(x.label)){ left.push("3P（上の「👥 3P・4P」で）"); return; }
      const code = mailOptCode(x.label, g); if(!code || code === "af" || code === "gyakuaf") { if(!code) left.push("オプション（" + x.label.replace(/（.*$/, "") + "）"); return; }
      const b = $("o_" + code); if(b && !b.checked){ b.checked = true; fire(b); }
    });
    if(yes.length) done.push("オプション");
  }
  // その他 → 備考に
  if(o.other && typeof formPending !== "undefined" && !editing && !formPending.some(x => String(x.text).includes(o.other.slice(0, 20)))){
    formPending.push({ at: new Date().toISOString(), by: KB.operatorName() || "（担当者なし）", text: "✉ メールの「その他」：" + o.other.replace(/\n{2,}/g, "\n") });
    try{ renderFormLog(); }catch(e){} done.push("備考（その他）");
  }
  try{ recalc(); }catch(e){}
  const el = $("mailRes");
  if(el) el.innerHTML = `<div class="mailok">✅ 入れたもの：${done.join("・") || "なし"}</div>${left.length ? `<div class="mailng">⚠️ 手で入れてください：${left.map(esc).join("／")}</div>` : ""}
    ${store ? "" : `<button type="button" class="btn btn-ghost btn-sm" onclick="mailApply()">🔁 もう一度入れる（売上店舗をえらんだあと）</button>`}`;
  if(!quiet) toast("✉ メールの内容を入れました。確認してから登録してください");
}
function mailOpen(){
  const bg = document.createElement("div"); bg.className = "modal-bg show"; bg.id = "mailBg"; bg.style.zIndex = 90;
  bg.innerHTML = `<div class="modal" style="max-width:620px"><button class="x" onclick="document.getElementById('mailBg').remove()">×</button>
    <h2>✉ メール予約を貼る</h2>
    <div class="hint">お客さんから来た予約メールを、そのまま下に貼ってください（ぜんぶでOK）。電話番号・名前・日時・コース・場所・キャスト・オプション・サイト・その他を受付に入れます</div>
    <textarea id="mailText" style="width:100%;min-height:200px;margin-top:8px;font-size:13px" placeholder="ここに貼る（Ctrl＋V）"></textarea>
    <div style="display:flex;gap:6px;margin-top:8px"><button type="button" class="btn btn-primary" onclick="mailGo()">受付に入れる</button><button type="button" class="btn btn-ghost" onclick="document.getElementById('mailBg').remove()">やめる</button></div></div>`;
  document.body.appendChild(bg);
  setTimeout(() => { const t = $("mailText"); if(t) t.focus(); }, 50);
}
function mailGo(){
  const t = $("mailText").value, o = mailParse(t);
  if(!o.phone && !o.month && !o.cast){ toast("予約メールの形ではないようです（電話番号・ご利用日時・ご希望のキャストが見つかりません）"); return; }
  document.getElementById("mailBg").remove();
  mailApply(o);
  const r = $("mailRes"); if(r) r.scrollIntoView({ block: "center", behavior: "smooth" });
}
// 受付の電話番号の上に「✉ メールを貼る」と、結果の欄
{ const __ofMail = openForm; openForm = function(id){
  const r = __ofMail.apply(this, arguments);
  MAIL_LAST = null;
  try{
    const ph = $("f_phone"), f = ph && ph.closest(".f");
    if(f && !$("mailBar")) f.insertAdjacentHTML("beforebegin", `<div id="mailBar" class="mailbar"><button type="button" class="btn btn-ghost btn-sm" onclick="mailOpen()">✉ メール予約を貼る</button><span class="hint">予約メールが来たときは、ここに貼ると受付に入ります</span><div id="mailRes"></div></div>`);
    if($("mailRes")) $("mailRes").innerHTML = "";
    if($("mailBar")) $("mailBar").style.display = id ? "none" : "";
  }catch(e){}
  return r;
}; }
document.head.insertAdjacentHTML("beforeend", `<style>
  .mailbar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 8px;padding:6px 8px;background:#EEF6FF;border-radius:12px}
  .mailbar #mailRes{width:100%;display:grid;gap:4px} .mailbar #mailRes:empty{display:none}
  .mailok{font-weight:800;color:#1E7A3C;font-size:13px} .mailng{font-weight:800;color:#c0392b;font-size:13px}
</style>`);
// 「どちらのサイトをご覧になりましたか」→ 媒体のコード
function mailSiteCode(s){
  s = String(s || "");
  const T = [[/公式/, "official"], [/ヘブン/, "heaven"], [/風俗じゃぱん|風じゃ/, "fuja"], [/口コミ/, "kuchikomi"], [/ぴゅあ/, "pure"], [/マンゾク|満足/, "manzoku"], [/駅ちか|駅チカ/, "ekichika"], [/スナイパー/, "sniper"], [/デリじゃ|デリヘルじゃぱん/, "deli"], [/NHF|ニューハーフ/i, "nhf"]];
  const hit = T.find(([re]) => re.test(s));
  if(hit && M.media.some(x => x.code === hit[1])) return hit[1];
  const m = M.media.find(x => x.label === s || (s && (x.label.includes(s) || s.includes(x.label))));
  return m ? m.code : "";
}

/* ---------- 📩 お客さまへの返信：テンプレをえらぶ（2026/11/18 店長：送った返信の例から）
   ・① 予約の確認（いつもの文：✏️ 返信の文を直す）／② 時間がうまっている → 別の時間の提案／③ 本日の空き状況／④ おすすめキャスト
     ⑤ 確定のお願い（間に合わなくなる）／⑥ 時間とカード決済の確認／⑦ またのご連絡をお待ちしています
   ・{提案} は、下の「提案・案内する内容」に書いたもの（時間・場所・キャストなど）
   ・②〜⑦ の文も「✏️ この文を直す」で内勤みんなで直せる（kb_settings 'net_reply_tpls'） ---------- */
const NR_SIGN = `-- 
サクラムーングループ
03-5944-9075
営業時間　12：00～翌5：00
※毎週月曜日　12：00～22：00`;
const NR_DEF = {
  busy: { name: "② 時間がうまっている → 別の時間の提案", text: `{名前}様

{店名}です。
{月日}ですが、ご希望のお時間は先約がございます。

{提案}でしたらご案内可能です。
ご都合いかがでしょうか。
お電話が優先のご予約となりますのでご了承ください。

{署名}` },
  today: { name: "③ 本日の空き状況", text: `{名前}様

お問い合わせありがとうございます。

本日の空き状況ですと、
{提案}となります。

ご都合いかがでしょうか。
また、お電話でのお問い合わせが優先となりますのでご了承ください。

ご連絡お待ちしております。

{署名}` },
  osusume: { name: "④ おすすめキャストのご案内", text: `{名前}様

{店名}です。
お問い合わせありがとうございます。

{提案}

がオススメとなっております。
当日のご予約はお電話にてお願い申し上げます。
ではご予約お待ちしております。

{署名}` },
  deadline: { name: "⑤ 確定のお願い（間に合わなくなる）", text: `度々のご連絡失礼いたします。

{キャスト}さんですが、移動にお時間をいただきますので
{提案}頃までにご予約確定をいただかないと
{開始}は間に合わなくなりますのでご了承ください。

なお、お電話でのご予約が優先となりますので
他のご予約が入ってしまうこともございます。

併せてご了承ください。
ご返信お待ちしております。

{署名}` },
  cardcheck: { name: "⑥ 時間とカード決済の確認", text: `お問い合わせありがとうございます。

ご希望のお時間ですが、{月日} {開始}でお間違いないでしょうか？

カード決済可能ですが、手数料込で{料金}となります。
上記お時間確認が取れましたらSMSにて決済URLをお送りいたします。

ご返信お待ちしております。

{署名}` },
  again: { name: "⑦ またのご連絡をお待ちしています", text: `かしこまりました。
{キャスト}さん人気のキャストですので、早めにご予約頂ければと思います。
是非またのご連絡お待ちしております。

{署名}` }
};
let NR_KIND = "kakunin";
function nrTpls(){ const v = (M.set && M.set.net_reply_tpls) || {}; const o = {}; Object.keys(NR_DEF).forEach(k => { o[k] = { name: NR_DEF[k].name, text: typeof v[k] === "string" && v[k].trim() ? v[k] : NR_DEF[k].text }; }); return o; }
function nrPre(t){
  const d = ($("f_day") && $("f_day").value) || day, st = ($("f_start") && $("f_start").value) || "";
  let md = "", hm = st;
  if(d){ const x = new Date(d + "T12:00:00Z"); let s = x; if(st){ const [h, m] = st.split(":").map(Number); if(h < 6) s = new Date(x.getTime() + 864e5); hm = String(h % 24) + "：" + String(m).padStart(2, "0"); } md = `${s.getUTCMonth() + 1}/${s.getUTCDate()}(${DOW[s.getUTCDay()]})`; }
  const tei = ($("nrSuggest") && $("nrSuggest").value.trim()) || "（ここに書く）";
  return t.replace(/\{提案\}/g, tei).replace(/\{月日\}/g, md || "（日付）").replace(/\{開始\}/g, hm || "（時間）").replace(/\{署名\}/g, NR_SIGN);
}
{ const __netTplNR = netTpl; netTpl = function(){ return nrPre(NR_KIND === "kakunin" ? __netTplNR() : (nrTpls()[NR_KIND] || {}).text || __netTplNR()); }; }
function nrBarPaint(){
  const w = $("netReplyWrap"); if(!w) return;
  let b = $("nrBar");
  if(!b){ w.insertAdjacentHTML("afterbegin", `<div id="nrBar" class="nrbar"></div>`); b = $("nrBar"); }
  const T = nrTpls(), uses = NR_KIND !== "kakunin" && /\{提案\}/.test(T[NR_KIND] ? T[NR_KIND].text : "");
  const keep = $("nrSuggest") ? $("nrSuggest").value : "";
  b.innerHTML = `<label>📩 返信の種類 <select id="nrKind" onchange="NR_KIND=this.value;nrBarPaint();netReply()"><option value="kakunin" ${NR_KIND === "kakunin" ? "selected" : ""}>① 予約の確認（いつもの文）</option>${Object.keys(T).map(k => `<option value="${k}" ${NR_KIND === k ? "selected" : ""}>${esc(T[k].name)}</option>`).join("")}</select></label>
    ${NR_KIND !== "kakunin" && KB.CAN_EDIT ? `<button type="button" class="btn btn-ghost btn-sm" onclick="nrEdit()">✏️ この文を直す</button>` : ""}
    <div id="nrSugWrap" style="${uses ? "" : "display:none"};width:100%"><label style="display:block;font-size:12.5px;font-weight:800">提案・案内する内容（{提案} に入ります）</label>
      <textarea id="nrSuggest" rows="2" style="width:100%" placeholder="例：15：00～16：30で鶯谷でのご予約でしたら90分／かんなさん、朝倉りかさん" oninput="netReply()">${esc(keep)}</textarea></div>`;
}
{ const __netReplyNR = netReply; netReply = function(){ try{ if(!$("nrBar")) nrBarPaint(); }catch(e){} return __netReplyNR.apply(this, arguments); }; }
function nrEdit(){
  const k = NR_KIND, T = nrTpls(); if(!T[k]) return;
  let bg = $("nrEdBg");
  if(!bg){ bg = document.createElement("div"); bg.id = "nrEdBg"; bg.className = "modal-bg"; document.body.appendChild(bg); }
  bg.innerHTML = `<div class="modal" style="max-width:640px"><button class="x" onclick="$('nrEdBg').classList.remove('show')">×</button>
    <h2>✏️ ${esc(T[k].name)}</h2>
    <p style="font-size:12.5px;color:var(--sub);line-height:1.7;margin:0 0 8px">{名前} {店名} {月日} {開始} {キャスト} {コース} {場所} {料金} {支払} {提案} {署名} は、その予約の内容になります（内勤みんな同じ文）。</p>
    <textarea id="nr_text" rows="16" style="width:100%;font-family:inherit;font-size:13.5px">${esc(T[k].text)}</textarea>
    <div style="display:flex;gap:6px;margin-top:8px"><button type="button" class="btn btn-primary" style="flex:1" onclick="nrSave('${k}')">保存</button>
      <button type="button" class="btn btn-ghost" onclick="if(confirm('はじめの文にもどしますか？'))$('nr_text').value=NR_DEF['${k}'].text">はじめの文にもどす</button></div></div>`;
  bg.classList.add("show");
}
async function nrSave(k){
  const v = Object.assign({}, (M.set && M.set.net_reply_tpls) || {}, { [k]: $("nr_text").value });
  try{ q(await sb.from("kb_settings").upsert({ key: "net_reply_tpls", value: v, note: "📩 お客さまへの返信のテンプレ（②〜⑦。受付で えらぶ）" }));
    M.set.net_reply_tpls = v; $("nrEdBg").classList.remove("show"); toast("保存しました"); netReply(); }
  catch(e){ toast("保存できませんでした：" + (e.message || e)); }
}
{ const __ofNR = openForm; openForm = function(){ NR_KIND = "kakunin"; const r = __ofNR.apply(this, arguments); try{ const b = $("nrBar"); if(b) b.remove(); }catch(e){} return r; }; }
document.head.insertAdjacentHTML("beforeend", `<style>
  .nrbar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:6px;font-weight:800;font-size:13px}
  .nrbar select{font-family:inherit;font-size:13px;font-weight:700;padding:5px 8px;border-radius:10px}
</style>`);
/* ✏️ 返信の文を直す（①）は、いつも①の文をそのまま開く（2026/11/18 店長：②〜⑦をえらんでいるときに開くと、その文が①に保存されてしまっていた）
   ②〜⑦をえらんでいるときは、その文の編集（✏️ この文を直す）を開く */
{ const __openNetTplNR = openNetTpl; openNetTpl = function(){
  if(NR_KIND !== "kakunin"){ nrEdit(); return; }
  const keep = netTpl; netTpl = function(){ const v = M.set && M.set.net_reply_tpl; let t = typeof v === "string" && v.trim() ? v : NET_TPL_DEF; return t; };
  try{ return __openNetTplNR.apply(this, arguments); } finally{ netTpl = keep; }
}; }
// 🤝 希望プレイに「キャストと相談」を足す（2026/11/18 店長）。もう入っていれば足さない
function playAdd(w){ const el = $("f_play"); if(!el) return; const v = el.value.trim(); if(v.includes(w)) return; el.value = v ? v + "・" + w : w; try{ recalc(); }catch(e){} }
/* 📞 返信①の確認電話のお願い（2026/11/18 店長）
   ・中2日あいている予約（受付日の3日後以降。例：11/18 受付 → 11/21 の予約）… 前日の12時～21時に確認電話
   ・12時台の予約 … 当日 11:45 に確認電話／13時以降の予約 … 1時間前（時刻つき）
   ・いつも … ホテル入室前に確認電話
   文の中の {確認電話} に入る。前の文の「★…前日…」「★…1時間前…」の行は、自動でこれにおきかえる */
function nrCallLines(){
  const d = ($("f_day") && $("f_day").value) || day, st = ($("f_start") && $("f_start").value) || "", today = KB.bizDateOf();
  const gap = d && today ? Math.round((new Date(d + "T12:00:00Z") - new Date(today + "T12:00:00Z")) / 864e5) : 0;
  const a = [];
  if(gap >= 3) a.push("★大変お手数ですが、ご予約日前日の12時～21時頃に確認のお電話をお客様よりお願いいたします。");
  if(st){
    const [h, m] = st.split(":").map(Number);
    if(h === 12) a.push("★大変お手数ですが、当日11:45に確認のお電話をお客様よりお願いいたします。");
    else { let t = (h < 6 ? h + 24 : h) * 60 + m - 60; const hh = Math.floor(t / 60) % 24; a.push(`★大変お手数ですが、ご予約時間の1時間前（${hh}:${String(t % 60).padStart(2, "0")}）に確認のお電話をお客様よりお願いいたします。`); }
  }
  a.push("★必ずホテル入室前に、確認のお電話をお願いいたします。");
  return a;
}
{ const __nrPreCall = nrPre; nrPre = function(t){
  t = String(t || "");
  if(!t.includes("{確認電話}")){
    let first = true;
    t = t.replace(/^★(?:大変お手数ですが、ご予約日前日|お手数ですが予約時間1時間前|お手数ですがホテル入室前)[^\n]*\n?/gm, () => first ? (first = false, "{確認電話}\n") : "");
  }
  return __nrPreCall(t.replace(/\{確認電話\}/g, nrCallLines().join("\n")));
}; }
