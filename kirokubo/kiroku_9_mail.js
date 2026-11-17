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
