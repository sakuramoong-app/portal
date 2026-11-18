/* 📞 記録簿のトップ（2026/11/19 店長）
   ・電話番号の検索を、上の固定の帯（日付の行）に入れる。いつでも番号で探せる
   ・トップの「🔎 フィルター」（当日フィルター・未来フィルター）は出さない（受付の中の 🔎 探す を使う）
   ・探した結果は帯の下に出す（長いときは帯の中でスクロール） */
(function topTel(){
  const bar = document.querySelector(".stickybar"), tel = document.getElementById("nf_tel");
  if(bar && tel && !bar.contains(tel)){ tel.classList.add("teltop"); bar.appendChild(tel); }
  const flt = document.getElementById("fltAll"); if(flt){ flt.open = false; flt.style.display = "none"; }
})();
document.head.insertAdjacentHTML("beforeend", `<style>
  .stickybar #nf_tel.teltop{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:2px 0 4px;padding:4px 8px;background:#fff;border:1.5px solid var(--line,#F3D6E0);border-radius:12px}
  .stickybar #nf_tel.teltop .lbl{font-weight:900;font-size:13px}
  .stickybar #nf_tel.teltop #s_tel{max-width:240px;padding:5px 10px;font-size:14px}
  .stickybar #nf_tel.teltop #telResult{max-height:34vh;overflow:auto}
  .stickybar #nf_tel.teltop #telResult:empty{display:none}
</style>`);
