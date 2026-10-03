/*!
 * 拆解台語羅馬字 — 臺語羅馬字聲母／韻母／聲調／變調互動教材
 * Copyright © 2026 臺中明道中學 詹宗龍. All rights reserved.
 * 版權所有。未經作者同意，請勿轉載、重製或修改。
 */
// 懸浮「全螢幕」切換鈕：手機小螢幕時隱藏瀏覽器網址列，讓教材最大化顯示；再按一次恢復
(function () {
  const doc = document;
  const root = doc.documentElement;
  const request = root.requestFullscreen || root.webkitRequestFullscreen;
  const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
  // 不支援全螢幕 API 的瀏覽器（如 iPhone Safari）不顯示按鈕
  if (!request || !exit) return;

  const ICON_ENTER = '<svg viewBox="0 0 24 24" fill="none" stroke="#111111" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="M4 9V4H9"/><path d="M15 4H20V9"/><path d="M20 15V20H15"/><path d="M9 20H4V15"/></svg>';
  const ICON_EXIT = '<svg viewBox="0 0 24 24" fill="none" stroke="#111111" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="M9 4V9H4"/><path d="M20 9H15V4"/><path d="M15 20V15H20"/><path d="M4 15H9V20"/></svg>';

  const btn = doc.createElement('button');
  btn.className = 'icon-btn fullscreen-icon';
  btn.id = 'fullscreenBtn';
  doc.body.appendChild(btn);

  function isFull() { return !!(doc.fullscreenElement || doc.webkitFullscreenElement); }
  function render() {
    const full = isFull();
    btn.innerHTML = full ? ICON_EXIT : ICON_ENTER;
    btn.title = full ? '恢復' : '全螢幕';
    btn.setAttribute('aria-label', btn.title);
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();   // 不觸發投影片「下一步」或關閉發音對照表
    try {
      const p = isFull() ? exit.call(doc) : request.call(root);
      if (p && p.catch) p.catch(() => {});
    } catch (err) { /* 瀏覽器拒絕時維持原狀 */ }
  });
  doc.addEventListener('fullscreenchange', render);
  doc.addEventListener('webkitfullscreenchange', render);
  render();
})();
