/* Apply the saved palette before styles paint; themes never touch game saves. */
(() => {
  const themes = { forest: '#111615', midnight: '#0b1224', paper: '#f5f1e8', ember: '#211410', arcade: '#170f29' };
  const key = '1023-theme-v1';
  function apply(value) {
    const theme = Object.hasOwn(themes, value) ? value : 'forest';
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]').content = themes[theme];
    const select = document.getElementById('theme-select');
    if (select) select.value = theme;
  }
  let saved;
  try { saved = localStorage.getItem(key); } catch {}
  apply(saved);
  document.addEventListener('DOMContentLoaded', () => {
    const select = document.getElementById('theme-select');
    select.value = document.documentElement.dataset.theme;
    select.addEventListener('change', () => {
      apply(select.value);
      try { localStorage.setItem(key, select.value); } catch {}
    });
  });
  window.addEventListener('storage', event => { if (event.key === key || event.key === null) apply(event.newValue); });
})();
