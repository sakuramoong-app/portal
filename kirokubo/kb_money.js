/* ============================================================
   💴 お金の計算は、ぜんぶここ（2026/11/10「計算を1か所に」）
   記録簿（kiroku.html）・精算（settle.html）・回収明細（kaishu.html）・集計（stats.html）が、このファイルの計算を使う
   ※ 計算を変えるときは、ここだけを直す。直したら tests/run_tests.sh（kb_money のテスト）で、いままでと同じ答えになるか確かめる
   ・報酬（バック）… 手で直した報酬（back_override）があればそれ。なければ コース＋延長＋OP のバック
   ・雑費 … 報酬＋OP 10,500円ごとに500円（3,000円まで）。雑費なしの曜日（キャストのルール）は0。手で直した額があればそれ
   ・源泉 … 報酬÷9（エクセルと同じく四捨五入。簡易計算）
   ・店落ち … 総額 − 報酬 − OP ＋ 雑費（交通費・プラスマイナスは経費なので入れない）
   ・キャストの手取り … 報酬＋OP＋交通費バック＋プラス − 雑費 − マイナス
   ・投函する額 … 総額 − 手取り − カードで払った分 − 振込の分
   ============================================================ */
(function(){
  const n0 = v => Number(v) || 0;
  // キャンセル・トビ・流れた予約は、お金に入れない
  const isLive = r => r.status !== "cancel" && r.status !== "tobi" && r.status !== "flowed";
  // 1予約の報酬（OP込み）
  const backOf = r => r.back_override != null ? n0(r.back_override) : n0(r.course_back) + n0(r.option_back) + n0(r.extra_back);
  // 雑費（自動）：報酬＋OP の合計から
  const zappiAuto = rewardPlusOption => Math.min(3000, Math.floor(n0(rewardPlusOption) / 10500) * 500);
  // 源泉（報酬÷9・四捨五入）
  const gensen = v => Math.round(n0(v) / 9);
  // その日に効いているキャストのルール
  const rulesOn = (rules, castId, day) => (rules || []).filter(r => r.cast_id === castId && (r.valid_from || "2000-01-01") <= day && (!r.valid_to || r.valid_to > day));
  // 雑費なしの曜日か
  const zappiExempt = (rulesOfDay, day) => { const dow = new Date(day + "T12:00:00Z").getUTCDay(); return (rulesOfDay || []).some(x => x.kind === "zappi_exempt" && ((x.params || {}).days || []).includes(dow)); };

  /* キャスト1人・1日分の精算（記録簿のキャストの枠・精算のページ）
     all＝その日のそのキャストの予約（キャンセルなども入れて渡す）／cd＝kb_cast_days の行／rules＝rulesOn で、その日のルール／skip＝今日は精算しない予約の id の Set */
  function calcCast({ all, cd, rules, day, skip }){
    all = all || []; cd = cd || {};
    const allLive = all.filter(isLive);
    // ② 先精算のあとの追加分：前の精算（①…）に入った予約は数えない（unsettled.js の kbSnapParts・kbPartIds）2026/11/4
    //   精算済のあとでふえた予約があるときも、ふえた予約だけで計算する（チェックを外した予約＝今日は精算しない も入れない）
    const prevParts = typeof kbSnapParts === "function" && (!cd.settled || kbPendingAfterSettle(cd, all).length) ? kbSnapParts(cd) : [];
    const doneIds = prevParts.length ? kbPartIds(cd, all, prevParts) : new Set();
    const live = allLive.filter(r => !doneIds.has(r.id) && !(skip && skip.has(r.id)));
    const prevSum = k => prevParts.reduce((a, p) => a + n0(p[k]), 0);
    // 報酬：手で直した報酬があればそれ（OP込みの金額として扱う）
    let reward = 0, option = 0;
    live.forEach(r => {
      if(r.back_override != null) reward += r.back_override;
      else { reward += (r.course_back || 0) + (r.extra_back || 0); option += (r.option_back || 0); }
    });
    // 交通費バック（台帳の条件）
    let transportBack = 0; const why = [];
    //   条件がいくつあっても、1つの予約の交通費バックは「いちばん多い条件の額」だけ（足し算しない。交通費より多くならない）2026/11/12
    const tbRules = (rules || []).filter(x => x.kind === "transport_back"), tbUsed = new Set();
    live.forEach(r => {
      const t = r.transport || 0; if(!t) return;
      let best = 0, bestRule = null;
      tbRules.forEach(x => {
        if(x.params && x.params.min_transport && t < Number(x.params.min_transport)) return;   // 交通費が○円以上のときだけ
        const v = x.params && x.params.amount != null ? Math.min(Number(x.params.amount) || 0, t) : Math.round(t * (Number(x.params && x.params.rate) || 0));
        if(v > best){ best = v; bestRule = x; }
      });
      if(best){ transportBack += Math.min(best, t); tbUsed.add(bestRule); }
    });
    tbUsed.forEach(x => why.push("交通費バック：" + x.note));
    // 雑費（自動・免除の曜日・手で直したとき）
    const exempt = zappiExempt(rules, day);
    // 雑費は1日まとめて計算して、前の精算で払った分を引く（②だけで計算すると多くなったり少なくなったりするので）
    const zFull = rr => zappiAuto(rr.reduce((a, r) => a + (r.back_override != null ? r.back_override : (r.course_back || 0) + (r.extra_back || 0) + (r.option_back || 0)), 0));
    const zappiA = exempt ? 0 : (prevParts.length ? Math.max(0, zFull(allLive) - prevSum("zappi")) : zappiAuto(reward + option));
    const zappi = cd.zappi_override != null ? Math.max(0, cd.zappi_override - prevSum("zappi")) : zappiA;
    const plusItems = Array.isArray(cd.plus_items) ? cd.plus_items : [];
    const minusItems = Array.isArray(cd.minus_items) ? cd.minus_items : [];
    const plus = Math.max(0, plusItems.reduce((a, b) => a + n0(b.amount), 0) - prevSum("plus"));     // ②：前の精算で払ったプラス・マイナスは引く
    const minus = Math.max(0, minusItems.reduce((a, b) => a + n0(b.amount), 0) - prevSum("minus"));
    const takeHome = reward + option + transportBack + plus - zappi - minus;
    const total = live.reduce((a, r) => a + (r.total || 0), 0);
    // カードは予約の1時間前までに決済URLで先に払ってもらう（現金はキャストに入らない）。「カード」「カード精算済」どちらも引く
    // 現金＋カード（分けて払う）の予約は、カードの分（card_total）だけ引く 2026/11/4
    const cardPaid = live.reduce((a, r) => a + ((r.payment === "card" || r.payment === "card_paid") ? (r.total || 0) : n0(r.card_total)), 0);
    const cardUnconfirmed = live.filter(r => r.payment === "card").length;
    // 🏦 振込（SQL 173）：あとで振り込んでもらう分は、カードと同じでキャストの手元にない
    const trList = live.filter(r => r.transfer_status && Number(r.transfer_amount)), transferPaid = trList.reduce((a, r) => a + n0(r.transfer_amount), 0), trIds = trList.map(r => r.id);
    const drop = total - takeHome - cardPaid - transferPaid;
    const withholding = gensen(reward + option);         // 源泉：エクセルと同じく四捨五入
    const provisional = total - reward - option;          // 暫定残額（総額 − 報酬）
    const shopDrop = total - reward - option + zappi;     // 店落ち＝総額−報酬＋雑費（交通費・プラスマイナスは経費なので入れない）
    const realDrop = provisional - withholding;           // 実質的な店落ち（暫定残額 − 源泉）
    // 投函した額：精算済にすると空にもどす（②の精算で前の額が残らないように）。精算済の枠では、精算したときの額を出す（2026/11/5）
    const snapDep = cd.settled && !prevParts.length && cd.settle_snapshot ? cd.settle_snapshot.deposited : null;
    const deposited = cd.deposited != null ? cd.deposited : snapDep != null ? Number(snapDep) : null;
    const diff = deposited != null ? deposited - drop : null;   // マイナス＝未精算／プラス＝お釣り
    return { partNo: prevParts.length + 1, prevParts, allLive, transferPaid, trIds, all, live, cd, reward, option, transportBack, why, exempt, zappiAuto: zappiA, zappi, plusItems, minusItems, plus, minus, takeHome, total, cardPaid, cardUnconfirmed, drop, withholding, provisional, shopDrop, realDrop, deposited, diff };
  }
  window.KBM = { isLive, backOf, zappiAuto, gensen, rulesOn, zappiExempt, calcCast };
})();
