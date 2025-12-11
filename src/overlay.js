// Overlay window: polls localStorage for the last checked item and displays it.

(function () {
  const itemEl = document.getElementById('overlayItem');
  const valueEl = document.getElementById('overlayValue');

  function updateFromStorage() {
    const raw = localStorage.getItem('arcr_value_last_checked');
    if (!raw) {
      itemEl.textContent = 'No item';
      valueEl.textContent = '';
      return;
    }
    try {
      const data = JSON.parse(raw);
      if (data && data.item) {
        itemEl.textContent = data.item;
        valueEl.textContent = data.value != null ? `— ${data.value}` : '— not found';
      } else {
        itemEl.textContent = 'No item';
        valueEl.textContent = '';
      }
    } catch (e) {
      itemEl.textContent = 'No item';
      valueEl.textContent = '';
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