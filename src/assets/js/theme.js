/**
 * theme.js — перемикач темної/світлої теми
 * Зберігає вибір в localStorage
 */

const Theme = (() => {
  // Ключ для збереження в localStorage
  const STORAGE_KEY = 'geo7_theme';

  // Поточна тема
  let current = localStorage.getItem(STORAGE_KEY) || 'light';

  /**
   * Застосовує тему до документа
   * @param {string} theme — 'light' або 'dark'
   */
  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    // Оновлюємо іконку кнопки
    const btn = document.getElementById('btn-theme');
    if (btn) {
      btn.textContent = theme === 'dark' ? '☀️' : '🌙';
      btn.title = theme === 'dark' ? 'Світла тема' : 'Темна тема';
    }
  }

  /**
   * Ініціалізація теми при завантаженні сторінки
   */
  function init() {
    apply(current);
  }

  /**
   * Перемикання між темами
   */
  function toggle() {
    current = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY, current);
    apply(current);
  }

  return { init, toggle, get: () => current };
})();
