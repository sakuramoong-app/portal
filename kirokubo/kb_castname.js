/* 🔎 名前からキャストをさがす（2026/11/26 店長）：顧客台帳・受付で同じ
   ・書き方のちがいは同じにする：全角/半角・空白・カタカナ/ひらがな・うしろの「くん・ちゃん・さん・様」（らぱんくん＝らぱん）
   ・「みさき（美咲）」のようなかっこは、両方の名前でさがす
   ・さがす名前：正式な名前・仮の名前・サクラシフトの名前・よみがな・別名・過去の名前（SQL 969 name_history）
   ・日付 d があれば、その日に使っていた名前・在籍していた子を先にする（同じ名前の別の子をまちがえないように）
   ・こたえは「当てはまる子の一覧」。1人ならその子、2人以上ならだれか決まっていない（人が選ぶ） */
function cnNorm(s){
  s = String(s || "").normalize("NFKC").replace(/[\s　・･.,、。]/g, "");
  s = s.replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60));   // カタカナ → ひらがな
  s = s.replace(/(くん|君|ちゃん|さん|様|さま|嬢)$/, "");
  return s.toLowerCase();
}
function cnParts(raw){
  const r = String(raw || "").trim(), m = r.match(/^(.*?)[（(]([^）)]*)[）)]?\s*$/);
  return [...new Set((m ? [m[1], m[2]] : [r]).map(cnNorm).filter(Boolean))];
}
const cnIn = (d, from, to) => !d || ((!from || String(from) <= d) && (!to || d <= String(to)));
// その子の名前（d があれば、その日に使っていた過去の名前だけ。期間が書いていない過去の名前はいつでも）
function cnNamesOf(c, d){
  const base = [c.official_name, c.temp_name, c.shift_name, c.kana, ...(Array.isArray(c.aliases) ? c.aliases : [])];
  const hist = (Array.isArray(c.name_history) ? c.name_history : []).filter(h => h && h.name && cnIn(d, h.from, h.to)).map(h => h.name);
  return [...new Set(base.concat(hist).map(cnNorm).filter(Boolean))];
}
function castsByName(raw, d, casts){
  casts = casts || (typeof M !== "undefined" && M && M.casts) || [];   // M は let（window.M ではない）
  const parts = cnParts(raw); if(!parts.length) return [];
  const pick = test => casts.filter(c => { const ns = cnNamesOf(c, d); return parts.some(p => ns.some(n => test(n, p))); });
  let hit = pick((n, p) => n === p);
  if(!hit.length) hit = pick((n, p) => p.length >= 2 && n.length > p.length && (n.endsWith(p) || n.startsWith(p)));   // 「みさ」→「みさき」は、1人だけのときに使う
  if(!hit.length) hit = pick((n, p) => n.length >= 2 && p.length > n.length && (p.endsWith(n) || p.startsWith(n)));
  // その日に在籍していた子・その日に使っていた過去の名前を先に
  if(d && hit.length > 1){
    const at = hit.filter(c => cnIn(d, c.join_date, c.leave_date));
    if(at.length) hit = at;
    if(hit.length > 1){
      const byHist = hit.filter(c => (Array.isArray(c.name_history) ? c.name_history : []).some(h => h && h.name && (h.from || h.to) && cnIn(d, h.from, h.to) && parts.includes(cnNorm(h.name))));
      if(byHist.length) hit = byHist;
    }
  }
  return hit;
}
// 1人に決まるときだけ、その子（決まらなければ null）
function castByNameAt(raw, d, casts){ const l = castsByName(raw, d, casts); return l.length === 1 ? l[0] : null; }
