// Overlay window: polls localStorage for the last checked item and displays it.

(function () {
  const itemEl = document.getElementById('overlayItem');
  const valueEl = document.getElementById('overlayValue');
  const boxEl = document.getElementById('overlayBox');

  let hideTimer = null;
  let lastTimestamp = (() => {
    try {
      const raw = localStorage.getItem('arcr_value_last_checked');
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      return parsed && parsed.timestamp ? parsed.timestamp : 0;
    } catch (e) {
      return 0;
    }
  })();

  function hideOverlaySoon() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      boxEl.classList.remove('visible');
    }, 4000);
  }

  function updateFromStorage() {
    const raw = localStorage.getItem('arcr_value_last_checked');
    if (!raw) {
      itemEl.textContent = 'No item';
      valueEl.textContent = '';
      boxEl.classList.remove('visible');
      return;
    }
    try {
      const data = JSON.parse(raw);
      if (data && data.item) {
        itemEl.textContent = data.item;
        valueEl.textContent = data.value != null ? `— ${data.value}` : '— not found';
        if (data.timestamp && data.timestamp !== lastTimestamp) {
          lastTimestamp = data.timestamp;
          boxEl.classList.add('visible');
          hideOverlaySoon();
        }
      } else {
        itemEl.textContent = 'No item';
        valueEl.textContent = '';
        boxEl.classList.remove('visible');
      }
    } catch (e) {
      itemEl.textContent = 'No item';
      valueEl.textContent = '';
      boxEl.classList.remove('visible');
    }
  }

  updateFromStorage();
  setInterval(updateFromStorage, 1500);

  window.addEventListener('storage', function (ev) {
    if (ev.key === 'arcr_value_last_checked' || ev.key === 'arcr_value_items_db') {
      updateFromStorage();
    }
  });

  window.addEventListener('arcr_checked', updateFromStorage);
  window.addEventListener('arcr_game_update', updateFromStorage);
})();