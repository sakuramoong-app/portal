/* ============================================================
   kb_live.js — 記録簿のリアルタイム（記録簿・精算 共通）
   ・だれかが保存したら、ほかの人の画面に「変わったよ」の合図を送る（受けた画面は読みなおす）
   ・だれがどの予約を入力中か（presence）
   合図には中身（お客さん・金額など）は入れない。名前と予約の番号だけ。
   ※ kb_common.js より前に読むこと（保存を見はるため、通信の入口を先に包む）
   ============================================================ */
(function(){
  const tabId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const changedCbs = [], presenceCbs = [];
  let ch = null, ready = false, editing = null, sendTimer = null, others = [];

  // 保存（kb_ の表への書きこみ）を見はる。読むだけ・rpc は数えない
  const of = window.fetch.bind(window);
  window.fetch = async function(input, init){
    const res = await of(input, init);
    try{
      const url = typeof input === "string" ? input : (input && input.url) || "";
      const m = String((init && init.method) || (input && input.method) || "GET").toUpperCase();
      if(m !== "GET" && m !== "HEAD" && /\/rest\/v1\/kb_[a-z_]+/.test(url) && res.ok) changed();
    }catch(e){}
    return res;
  };
  function changed(){
    clearTimeout(sendTimer);
    sendTimer = setTimeout(() => { if(ch && ready) ch.send({ type: "broadcast", event: "changed", payload: { from: tabId, by: who() } }); }, 600);
  }
  const who = () => { try{ return (window.KB && KB.operatorName()) || "だれか"; }catch(e){ return "だれか"; } };

  function track(){
    if(!ch || !ready) return;
    ch.track({ tab: tabId, by: who(), rid: editing, page: location.pathname.split("/").pop(), at: Date.now() }).catch(() => {});
  }
  function readPresence(){
    const st = ch.presenceState(), list = [];
    Object.keys(st).forEach(k => (st[k] || []).forEach(p => { if(p.tab !== tabId) list.push(p); }));
    others = list;
    presenceCbs.forEach(f => { try{ f(list); }catch(e){} });
  }
  function start(){
    if(!window.KB || !KB.sb){ setTimeout(start, 300); return; }
    if(typeof KB.sb.channel !== "function") return;
    ch = KB.sb.channel("kb-live", { config: { broadcast: { self: false }, presence: { key: tabId } } });
    ch.on("broadcast", { event: "changed" }, msg => {
      const p = (msg && msg.payload) || {};
      if(p.from === tabId) return;
      changedCbs.forEach(f => { try{ f(p); }catch(e){} });
    });
    ch.on("presence", { event: "sync" }, readPresence);
    ch.subscribe(status => {
      ready = status === "SUBSCRIBED";
      if(ready) track();
    });
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();

  window.KBLive = {
    onChanged: f => changedCbs.push(f),
    onPresence: f => presenceCbs.push(f),
    setEditing(rid){ editing = rid == null ? null : String(rid); track(); },
    others: () => others,
  };
})();
