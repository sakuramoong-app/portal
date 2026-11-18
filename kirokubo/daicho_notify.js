/* 📝 キャスト台帳を更新したら、内勤に通知（2026/11/18 店長）
   ・台帳で保存したら「だれが・いつ・どのキャストの・何を」を kb_settings 'daicho_updates' に残す（新しい順・100件まで）
   ・記録簿の画面が1分ごとに見て、まだ見ていない更新を 🔔 通知に出す（自分で書いたものは出さない）
   ・連絡先（電話・住所など）は中身を書かない（「連絡先」とだけ）
   ・保存がうまくいかなかったとき（「〜できませんでした」と出たとき）は残さない */
async function daichoNote(cid, name, what){
  if(!cid || !what) return;
  try{
    const cur = q(await sb.from("kb_settings").select("value").eq("key", "daicho_updates").maybeSingle());
    const list = Array.isArray(cur && cur.value) ? cur.value : [];
    list.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: new Date().toISOString(), by: operatorName() || "", cid, name: name || "", what: String(what).slice(0, 200) });
    q(await sb.from("kb_settings").upsert({ key: "daicho_updates", value: list.slice(0, 100), note: "📝 キャスト台帳の更新（記録簿で内勤に通知）" }));
  }catch(e){ console.warn("daichoNote", e); }
}
const DC_SHORT = (v, n = 30) => { const s = (typeof v === "string" ? v : JSON.stringify(v == null ? "" : v)).replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n) + "…" : s; };
// 保存の関数を包む：保存のあいだに出た toast に「できませんでした」があれば、残さない
function dcWrap(fnName, describe){
  const orig = window[fnName]; if(typeof orig !== "function") return;
  window[fnName] = async function(){
    const msgs = [], kt = toast; toast = m => { msgs.push(String(m)); return kt(m); };
    let pre = null; try{ pre = describe.before ? describe.before() : null; }catch(e){}
    let r; try{ r = await orig.apply(this, arguments); } finally { toast = kt; }
    if(msgs.some(m => /できませんでした|期限が切れ|入れてね|書いてください|選んで/.test(m))) return r;
    try{ const d = describe.after(pre); if(d && d.what) await daichoNote(d.cid, d.name, d.what); }catch(e){ console.warn("dcWrap", fnName, e); }
    return r;
  };
}
const DC_FIELDS = [["official_name", "名前"], ["temp_name", "仮の名前"], ["kana", "読み"], ["status", "状態"], ["join_date", "入店日"], ["leave_date", "退店日"], ["aliases", "別名"],
  ["stores", "在籍店舗"], ["special_notes", "特記事項"], ["ng_notes", "NG"], ["note", "メモ"], ["interval_min", "インターバル"], ["onboarding", "その他必要情報"], ["look", "見た目"],
  ["long_max", "長いコースの上限"], ["area_note", "エリア"]];
const dcCast = id => (typeof casts !== "undefined" ? casts : []).find(c => c.id === id);
const dcName = c => c ? (c.official_name || c.temp_name || c.id) : "";
dcWrap("saveCast", {
  before: () => { const c = editingId && dcCast(editingId); return c ? JSON.parse(JSON.stringify(c)) : null; },
  after: pre => {
    const c = dcCast(editingId); if(!c) return null;
    if(!pre) return { cid: c.id, name: dcName(c), what: "🆕 キャストを追加" };
    const ch = DC_FIELDS.filter(([k]) => JSON.stringify(pre[k] ?? null) !== JSON.stringify(c[k] ?? null)).map(([k, l]) => {
      if(k === "stores") return `${l}：${Object.keys(c.stores || {}).length}店`;
      if(["status", "interval_min", "join_date", "leave_date", "kana", "official_name", "temp_name"].includes(k)) return `${l}：${DC_SHORT(pre[k] ?? "")} → ${DC_SHORT(c[k] ?? "")}`;
      if(["special_notes", "ng_notes", "note"].includes(k)) return `${l}：「${DC_SHORT(c[k] || "（空）", 40)}」`;
      return l;
    });
    return ch.length ? { cid: c.id, name: dcName(c), what: ch.join("／") } : null;
  } });
dcWrap("saveTerms", { after: () => { const c = dcCast(editingId); return c ? { cid: c.id, name: dcName(c), what: "💴 バック条件・ランク" } : null; } });
dcWrap("saveRule", { after: () => { const c = dcCast(editingId); return c ? { cid: c.id, name: dcName(c), what: "📋 受付ルール" } : null; } });
dcWrap("savePrivate", { after: () => { const c = dcCast(editingId); return c ? { cid: c.id, name: dcName(c), what: "📞 連絡先（内勤だけ）" } : null; } });
dcWrap("saveProf", { after: () => { const c = (typeof pf !== "undefined" && pf && pf.c) || dcCast(editingId); return c ? { cid: c.id, name: dcName(c), what: "📝 プロフ" } : null; } });
dcWrap("pfAddLog", {
  before: () => ({ t: ($("pf_lt") || {}).value || "", c: ($("pf_lc") || {}).value || "" }),
  after: pre => { const c = (typeof pf !== "undefined" && pf && pf.c) || dcCast(editingId); return c && pre && pre.c.trim() ? { cid: c.id, name: dcName(c), what: `🗓 記録（${pre.t || "ヒアリング"}）：「${DC_SHORT(pre.c, 40)}」` } : null; } });
dcWrap("pfSaveLog", { after: () => { const c = (typeof pf !== "undefined" && pf && pf.c) || dcCast(editingId); return c ? { cid: c.id, name: dcName(c), what: "🗓 記録・ログを直した" } : null; } });
