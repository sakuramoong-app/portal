/* ============================================================
   🔬 分析の計算（2026/11/19 店長・社長の分析ページ／極門・五反田のページ）
   ・数字の決めごと（11/19 店長が決めた）
     売上 … 予約の総額（交通費こみ・カード手数料は引かない）
     本数 … 1予約＝1本（3Pも1本）。キャンセル・トビ・流れた は入れない
     報酬 … kb_money.js と同じ（手で直した報酬があればそれ）
     店落ち … 記録簿の「今日の店落ち」と同じ：暫定（総額−報酬）＋雑費 − 内勤の日払い
              ※店をしぼったときは、内勤の日払い（どの店のぶんか分からない）は引かない
     失注 … キャンセル・トビ・流れた
     出勤時間 … 記録簿の 出勤〜退勤（シフトを記録簿で直した時刻があればそれ）。欠勤は0
     指名定着 … 新規 か 店リピ で自分についたお客さんが、そのあと半年（180日）以内にまた自分を指名したか
     評価 … 本指名率（本指名の本数 ÷ 本数）A 70%以上／B 50%以上／C 50%未満
   ・画面を持たない（計算だけ）。テストは tests/cases/anal_*.js
   ============================================================ */
(function(){
  const n0 = v => Number(v) || 0;
  const DEAD = ["cancel", "tobi", "flowed"];
  const DEAD_LABEL = { cancel: "キャンセル", tobi: "トビ", flowed: "流れた" };
  const SHIFT_OK = ["input_waiting", "inputting", "confirmed", "change_requested", "change_inputting", "change_confirmed"];
  const KEEP_DAYS = 180;
  const backOf = r => r.back_override != null ? n0(r.back_override) : n0(r.course_back) + n0(r.extra_back) + n0(r.option_back);
  const addDays = (d, k) => { const t = new Date(d + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + k); return t.toISOString().slice(0, 10); };
  const diffDays = (a, b) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000);
  const dowOf = d => new Date(d + "T12:00:00Z").getUTCDay();
  const jstHour = iso => { if(!iso) return null; const t = new Date(new Date(iso).getTime() + 9 * 3600 * 1000); return t.getUTCHours(); };
  function weekKeyOfYmd(s){ const dt = new Date(s + "T12:00:00Z"); const dow = dt.getUTCDay(); dt.setUTCDate(dt.getUTCDate() + (dow === 0 ? -6 : 1 - dow)); return dt.toISOString().slice(0, 10); }

  /* 読んだ行 → 1予約ずつ（R）・1キャスト1日ずつ（D）
     res＝kb_reservations（キャンセルなども全部）／cds＝kb_cast_days／shifts＝shift_weeks／casts＝master_casts／rules＝kb_cast_rules
     pay＝{日: 内勤の日払い}／today＝営業日（これより先のシフトは数えない） */
  function build({ res, cds, shifts, casts, rules, pay, today, from }){
    casts = casts || []; rules = rules || [];
    const nameOf = id => { const c = casts.find(x => x.id === id); return c ? (c.official_name || c.temp_name || c.shift_name || "（不明）") : "（不明）"; };
    const idOfShift = nm => { const c = casts.find(x => x.shift_name === nm || x.official_name === nm); return c ? c.id : null; };
    const plan = {};
    (shifts || []).forEach(r => {
      if(!SHIFT_OK.includes(r.data && r.data.status)) return;
      const id = idOfShift(r.cast_name); if(!id) return;
      Object.entries((r.data && r.data.shifts) || {}).forEach(([d, s]) => { if((!from || d >= from) && (!today || d <= today) && s && s.start != null && s.end != null) plan[d + "|" + id] = { start: Number(s.start), end: Number(s.end) }; });
    });
    const cdOf = {}; (cds || []).forEach(c => { cdOf[c.biz_date + "|" + c.cast_id] = c; });
    const all = (res || []).filter(r => !r.deleted);
    const resOf = {};
    all.forEach(r => { if(r.cast_id && !DEAD.includes(r.status)) (resOf[r.biz_date + "|" + r.cast_id] = resOf[r.biz_date + "|" + r.cast_id] || []).push(r); });
    const D = [], zapOf = {};
    const keys = new Set([...Object.keys(plan), ...Object.keys(resOf), ...(cds || []).filter(c => !today || c.biz_date <= today).map(c => c.biz_date + "|" + c.cast_id)]);
    keys.forEach(k => {
      const [d, id] = k.split("|"); const p = plan[k], cd = cdOf[k] || {}, rs = resOf[k] || [];
      if(!p && !rs.length) return;
      const absent = cd.status === "欠勤" || (cd.attend_log || []).some(a => a.kind === "欠勤");
      const real = p ? { start: cd.shift_start_ov != null ? Number(cd.shift_start_ov) : p.start, end: cd.shift_end_ov != null ? Number(cd.shift_end_ov) : p.end } : null;
      let reward = 0, total = 0;
      rs.forEach(r => { total += n0(r.total); reward += backOf(r); });
      const exempt = window.KBM ? KBM.zappiExempt(KBM.rulesOn(rules, id, d), d) : false;
      const zappi = cd.settle_snapshot && cd.settle_snapshot.zappi != null ? n0(cd.settle_snapshot.zappi)
                  : cd.zappi_override != null ? n0(cd.zappi_override) : (exempt || !rs.length ? 0 : Math.min(3000, Math.floor(reward / 10500) * 500));
      zapOf[k] = rs.length ? zappi / rs.length : 0;
      D.push({ d, cast_id: id, cast: nameOf(id), hours: absent || !real ? 0 : Math.max(0, real.end - real.start), absent, ocha: !absent && !rs.length,
               cnt: rs.length, total, reward, zappi, drop: total - reward + zappi });
    });
    const R = all.map(r => {
      const live = !DEAD.includes(r.status), back = live ? backOf(r) : 0, k = r.biz_date + "|" + r.cast_id;
      return { id: r.id, d: r.biz_date, cast_id: r.cast_id || null, cast: r.cast_id ? nameOf(r.cast_id) : "（キャスト未定）", store: r.store_key || "", dummy: r.dummy_name || "",
               course: r.course || "", visit: r.visit_kind || "", status: r.status || "", live, customer_id: r.customer_id || null,
               total: live ? n0(r.total) : 0, lostYen: live ? 0 : n0(r.total), back, zappi: live ? (zapOf[k] || 0) : 0,
               drop: live ? n0(r.total) - back + (zapOf[k] || 0) : 0, hour: jstHour(r.start_at), dow: dowOf(r.biz_date), start_at: r.start_at || "", end_at: r.end_at || "" };
    });
    return { R, D, pay: pay || {} };
  }

  const inR = (d, rg) => d >= rg.from && d <= rg.to;
  // 店のしぼりこみ（null＝全部）
  const storeOk = (r, stores) => !stores || stores.includes(r.store);

  /* 店（全体）の数字 */
  function summary(M, rg, stores){
    const rs = M.R.filter(r => inR(r.d, rg) && storeOk(r, stores));
    const live = rs.filter(r => r.live), lost = rs.filter(r => !r.live);
    const ds = M.D.filter(x => inR(x.d, rg));
    const staffPay = stores ? 0 : Object.entries(M.pay).filter(([d]) => inR(d, rg)).reduce((a, [, v]) => a + n0(v), 0);
    const sales = live.reduce((a, r) => a + r.total, 0), reward = live.reduce((a, r) => a + r.back, 0), zappi = live.reduce((a, r) => a + r.zappi, 0);
    const v = k => live.filter(r => r.visit === k).length;
    const lostBy = {}; lost.forEach(r => { const l = DEAD_LABEL[r.status] || r.status; lostBy[l] = (lostBy[l] || 0) + 1; });
    const hours = stores ? null : ds.reduce((a, x) => a + x.hours, 0);
    return { sales, cnt: live.length, reward, zappi: Math.round(zappi), staffPay, drop: Math.round(sales - reward + zappi - staffPay),
             lostN: lost.length, lostYen: lost.reduce((a, r) => a + r.lostYen, 0), lostBy, lostRate: rs.length ? lost.length / rs.length : null,
             n_new: v("new"), n_repeat: v("repeat"), n_honshi: v("honshi"), hours, castDays: stores ? null : ds.filter(x => !x.absent && x.hours > 0).length,
             perCnt: live.length ? sales / live.length : null };
  }
  // 日ごと（グラフ用）
  function daily(M, rg, stores){
    const out = {};
    for(let d = rg.from; d <= rg.to; d = addDays(d, 1)) out[d] = { d, sales: 0, cnt: 0, drop: 0 };
    M.R.forEach(r => { if(r.live && inR(r.d, rg) && storeOk(r, stores) && out[r.d]){ out[r.d].sales += r.total; out[r.d].cnt++; out[r.d].drop += r.drop; } });
    if(!stores) Object.entries(M.pay).forEach(([d, v]) => { if(out[d]) out[d].drop -= n0(v); });
    return Object.values(out);
  }
  // 曜日×時間（開始の時刻）
  function heat(M, rg, stores){
    const g = Array.from({ length: 7 }, () => Array(24).fill(0));
    M.R.forEach(r => { if(r.live && inR(r.d, rg) && storeOk(r, stores) && r.hour != null) g[r.dow][r.hour]++; });
    return g;
  }
  // なにかでまとめる（コース・ダミー名・店・キャスト）
  function groupBy(M, rg, stores, keyFn){
    const out = {};
    M.R.forEach(r => {
      if(!r.live || !inR(r.d, rg) || !storeOk(r, stores)) return;
      const k = keyFn(r); if(k == null) return;
      const a = out[k] = out[k] || { key: k, cnt: 0, sales: 0, drop: 0, n_new: 0, n_repeat: 0, n_honshi: 0 };
      a.cnt++; a.sales += r.total; a.drop += r.drop;
      if(r.visit === "new") a.n_new++; else if(r.visit === "repeat") a.n_repeat++; else if(r.visit === "honshi") a.n_honshi++;
    });
    return Object.values(out).sort((a, b) => b.cnt - a.cnt || b.sales - a.sales);
  }

  /* 評価：本指名率 */
  function rating(honshi, cnt){
    if(!cnt) return { mark: "−", rate: null };
    const rate = honshi / cnt;
    return { mark: rate >= 0.7 ? "A" : rate >= 0.5 ? "B" : "C", rate };
  }

  /* 指名定着：期間の中で、新規か店リピで はじめて自分についたお客さん → 半年以内にまた自分を指名したか
     today までに半年たっていない人は「まだ途中」（もどってきたら定着に入る） */
  function keep(M, castId, rg, today){
    const by = {};
    M.R.filter(r => r.live && r.cast_id === castId && r.customer_id).sort((a, b) => (a.d + a.start_at).localeCompare(b.d + b.start_at))
       .forEach(r => { (by[r.customer_id] = by[r.customer_id] || []).push(r); });
    let base = 0, kept = 0, waiting = 0;
    Object.values(by).forEach(list => {
      const first = list[0];
      if(!inR(first.d, rg) || !["new", "repeat"].includes(first.visit)) return;
      base++;
      const back = list.slice(1).find(r => diffDays(first.d, r.d) <= KEEP_DAYS);   // 並べてあるので、2件目からが「そのあと」
      if(back) kept++; else if(today && diffDays(first.d, today) < KEEP_DAYS) waiting++;
    });
    return { base, kept, waiting, rate: base ? kept / base : null };
  }

  /* キャストごとの数字（ランキング・キャスト個別） */
  function casts(M, rg, stores, today){
    const out = {};
    const get = (id, name) => out[id] = out[id] || { cast_id: id, cast: name, cnt: 0, sales: 0, reward: 0, drop: 0, n_new: 0, n_repeat: 0, n_honshi: 0, hours: 0, days: 0, absent: 0, ocha: 0 };
    M.R.forEach(r => {
      if(!r.live || !r.cast_id || !inR(r.d, rg) || !storeOk(r, stores)) return;
      const a = get(r.cast_id, r.cast);
      a.cnt++; a.sales += r.total; a.reward += r.back; a.drop += r.drop;
      if(r.visit === "new") a.n_new++; else if(r.visit === "repeat") a.n_repeat++; else if(r.visit === "honshi") a.n_honshi++;
    });
    if(!stores) M.D.forEach(x => {
      if(!inR(x.d, rg)) return;
      const a = get(x.cast_id, x.cast);
      a.hours += x.hours; if(x.absent) a.absent++; else { a.days++; if(x.ocha) a.ocha++; }
    });
    return Object.values(out).map(a => {
      const rt = rating(a.n_honshi, a.cnt), kp = keep(M, a.cast_id, rg, today);
      return Object.assign(a, { drop: Math.round(a.drop), perHour: a.hours ? a.reward / a.hours : null, cntPer10h: a.hours ? a.cnt / a.hours * 10 : null,
        perCnt: a.cnt ? a.reward / a.cnt : null, honRate: rt.rate, mark: rt.mark, keep: kp });
    });
  }

  /* 期間：day｜month｜year｜custom。anchor＝"YYYY-MM-DD" */
  function range(kind, anchor, to){
    if(kind === "day") return { kind, from: anchor, to: anchor };
    if(kind === "month"){ const ym = anchor.slice(0, 7); const [y, m] = ym.split("-").map(Number); const last = new Date(Date.UTC(y, m, 0)).getUTCDate(); return { kind, from: ym + "-01", to: ym + "-" + String(last).padStart(2, "0") }; }
    if(kind === "year"){ const y = anchor.slice(0, 4); return { kind, from: y + "-01-01", to: y + "-12-31" }; }
    return { kind: "custom", from: anchor, to: to || anchor };
  }
  // 前の期間（同じ長さ。月・年は前の月・前の年）
  function prev(rg){
    if(rg.kind === "month"){ const t = new Date(rg.from + "T12:00:00Z"); t.setUTCMonth(t.getUTCMonth() - 1); return range("month", t.toISOString().slice(0, 10)); }
    if(rg.kind === "year") return range("year", String(Number(rg.from.slice(0, 4)) - 1) + "-01-01");
    const len = diffDays(rg.from, rg.to) + 1;
    return { kind: rg.kind, from: addDays(rg.from, -len), to: addDays(rg.from, -1) };
  }
  // 前の年の同じ期間
  function lastYear(rg){
    const sh = d => { const y = Number(d.slice(0, 4)) - 1; let s = y + d.slice(4); if(s.slice(5) === "02-29") s = y + "-02-28"; return s; };
    return { kind: rg.kind, from: sh(rg.from), to: rg.kind === "month" ? range("month", sh(rg.from)).to : sh(rg.to) };
  }
  // 前とくらべて（%）
  const change = (now, before) => before == null || now == null || !before ? null : (now - before) / Math.abs(before);

  /* ⚠ 要確認（アラート）2026/11/19
     ・くらべるのは「直近4週」と「その前の4週」（終わり＝きのう。今日は途中なので入れない）
     ・言いすぎないための決まり：本数が少ないとき（10本未満・出勤20時間未満）は出さない
       1週だけの変化では出さない（直近4週を2週ずつに分けて、どちらも前より悪いときだけ）
       理由は「〜かもしれません」（決めつけない）
     ・1件＝{ who, castId, what, since, vs, nums, why, look, try, level } */
  function alerts(M, end, liveFrom){
    const W = 28, r1 = { kind: "custom", from: addDays(end, -W + 1), to: end }, r0 = { kind: "custom", from: addDays(end, -2 * W + 1), to: addDays(end, -W) };
    // くらべる前の4週が 新しい記録簿の前にかかるときは出さない（数字が足りなくて、まちがった知らせになる）
    if(liveFrom && r0.from < liveFrom) return { list: [], r1, r0, tooEarly: true, readyOn: addDays(liveFrom, 2 * W) };
    const hA = { kind: "custom", from: r1.from, to: addDays(r1.from, 13) }, hB = { kind: "custom", from: addDays(r1.from, 14), to: end };
    const md = d => Number(d.slice(5, 7)) + "/" + Number(d.slice(8, 10));
    const since = md(r1.from) + "〜" + md(r1.to), vs = "その前の4週（" + md(r0.from) + "〜" + md(r0.to) + "）";
    const pt = v => Math.round(v * 1000) / 10;
    const out = [];
    const byId = rg => { const m = {}; casts(M, rg, null, end).forEach(x => { m[x.cast_id] = x; }); return m; };
    const c1 = byId(r1), c0 = byId(r0), cA = byId(hA), cB = byId(hB);
    Object.values(c1).forEach(a => {
      const b = c0[a.cast_id], x = cA[a.cast_id], y = cB[a.cast_id];
      if(!b) return;
      const enough = a.cnt >= 10 && b.cnt >= 10 && a.hours >= 20 && b.hours >= 20;
      // ① 出勤時間あたりの本数がへった（出勤がへっただけでは出さない）
      if(enough && a.cntPer10h != null && b.cntPer10h && a.cntPer10h <= b.cntPer10h * 0.75 && x && y && x.cntPer10h != null && y.cntPer10h != null && x.cntPer10h < b.cntPer10h && y.cntPer10h < b.cntPer10h)
        out.push({ level: 2, who: a.cast, castId: a.cast_id, what: "出勤時間あたりの本数がへっています", since, vs,
          nums: `10時間あたり ${Math.round(b.cntPer10h * 10) / 10}本 → ${Math.round(a.cntPer10h * 10) / 10}本（${pt(a.cntPer10h / b.cntPer10h - 1)}%）`,
          why: "出勤の時間帯が変わった・写メ日記や出勤情報が少なくなった・指名のお客さんの来る間かくがあいた、かもしれません",
          look: "キャスト個別の 日ごとのグラフ・コース・お店ごと", try: "よく売れていた曜日・時間に出勤できるか相談する／写メ日記や出勤アピールをふやす" });
      // ② 本指名率がさがった（15ポイント以上）
      if(enough && a.honRate != null && b.honRate != null && b.honRate - a.honRate >= 0.15 && x && y && x.cnt >= 3 && y.cnt >= 3 && x.honRate < b.honRate && y.honRate < b.honRate)
        out.push({ level: 2, who: a.cast, castId: a.cast_id, what: "本指名率がさがっています", since, vs,
          nums: `本指名率 ${pt(b.honRate)}% → ${pt(a.honRate)}%（評価 ${b.mark} → ${a.mark}）`,
          why: "新規がふえて割合がさがっただけ、または指名のお客さんがもどってきていない、かもしれません",
          look: "新規・店リピ・本指名の本数、指名定着", try: "新規がふえたなら問題ないことも。指名が減ったなら、お礼メッセージ・次回の予約のお願いを話す" });
      // ③ 欠勤がふえた
      if(a.absent >= 3 && a.absent > b.absent)
        out.push({ level: a.absent >= 5 ? 3 : 1, who: a.cast, castId: a.cast_id, what: "欠勤がふえています", since, vs,
          nums: `欠勤 ${b.absent}日 → ${a.absent}日`, why: "体調・生活の変化があった、かもしれません",
          look: "キャスト個別の 出勤時間・記録簿の勤怠の理由", try: "様子をきいてみる／シフトの出し方を相談する" });
    });
    // お店ぜんたい
    const s1 = summary(M, r1, null), s0 = summary(M, r0, null), sA = summary(M, hA, null), sB = summary(M, hB, null);
    const lr = s => s.cnt + s.lostN ? s.lostN / (s.cnt + s.lostN) : null;
    if(s1.lostN >= 5 && s0.cnt >= 10 && lr(s1) != null && lr(s0) != null && lr(s1) - lr(s0) >= 0.05 && lr(sA) > lr(s0) && lr(sB) > lr(s0))
      out.push({ level: 2, who: "お店ぜんたい", castId: "", what: "失注（キャンセル・トビ・流れた）の割合がふえています", since, vs,
        nums: `失注 ${pt(lr(s0))}% → ${pt(lr(s1))}%（${Object.entries(s1.lostBy).map(([k, v]) => k + " " + v).join("・")}）`,
        why: "案内できるキャストが足りない時間がある・確認電話がとどいていない、かもしれません",
        look: "お店の 曜日×時間・失注の内訳", try: "失注の多い時間帯のシフトをふやす／前日・1時間前の確認電話をきちんと" });
    const ph = s => s.hours ? s.drop / s.hours : null;
    if(s1.cnt >= 30 && s0.cnt >= 30 && ph(s1) != null && ph(s0) && ph(s1) <= ph(s0) * 0.8 && ph(sA) < ph(s0) && ph(sB) < ph(s0))
      out.push({ level: 2, who: "お店ぜんたい", castId: "", what: "出勤時間あたりの店落ちがへっています", since, vs,
        nums: `1時間あたり ${Math.round(ph(s0)).toLocaleString("ja-JP")}円 → ${Math.round(ph(s1)).toLocaleString("ja-JP")}円`,
        why: "お客さんにくらべて出勤が多すぎる時間がある、かもしれません",
        look: "お店の 曜日×時間・ランキングの 10時間あたりの本数", try: "本数の少ない時間帯の出勤を見なおす" });
    if(s0.n_new >= 5 && s1.n_new <= s0.n_new * 0.7 && sA.n_new * 2 < s0.n_new && sB.n_new * 2 < s0.n_new)
      out.push({ level: 1, who: "お店ぜんたい", castId: "", what: "新規のお客さんがへっています", since, vs,
        nums: `新規 ${s0.n_new}本 → ${s1.n_new}本`, why: "媒体の掲載・順位が変わった、かもしれません",
        look: "集計の 媒体タブ", try: "媒体の上位表示・写メ日記・新人の告知を見なおす" });
    return { list: out.sort((a, b) => b.level - a.level), r1, r0 };
  }

  window.KBA = { alerts, build, summary, daily, heat, groupBy, rating, keep, casts, range, prev, lastYear, change, addDays, diffDays, weekKeyOfYmd, DEAD, DEAD_LABEL, KEEP_DAYS, SHIFT_OK };
})();
