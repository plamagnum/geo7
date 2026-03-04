/**
 * auth.js — модуль авторизації
 * Реєстрація, вхід, вихід, перевірка сесії
 */

const Auth = (() => {
  // Поточний авторизований користувач
  let currentUser = null;

  /**
   * Отримати поточного користувача
   */
  function getUser() {
    return currentUser;
  }

  /**
   * Перевірка чи авторизований користувач
   */
  function isLoggedIn() {
    return currentUser !== null;
  }

  /**
   * Перевірка чи є адміністратором
   */
  function isAdmin() {
    return currentUser && currentUser.role === 'admin';
  }

  /**
   * Перевірка сесії на сервері
   * Викликається при ініціалізації додатку
   */
  async function checkSession() {
    try {
      const res  = await fetch('/api/auth.php?action=check');
      const data = await res.json();
      if (data.authenticated) {
        currentUser = data.user;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Завантажити список класів і заповнити select у формі реєстрації
   */
  async function loadClassesForRegister() {
    try {
      const res     = await fetch('/api/classes.php');
      const classes = await res.json();
      const sel     = document.getElementById('register-class');
      if (!sel) return;
      sel.innerHTML = '<option value="">— Оберіть клас —</option>' +
        classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    } catch {
      // Ігноруємо помилку — поле залишається з порожнім вибором
    }
  }

  /**
   * Реєстрація нового користувача
   * @param {string} username
   * @param {string} password
   * @param {number|null} classId
   */
  async function register(username, password, classId = null) {
    const res  = await fetch('/api/auth.php?action=register', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password, class_id: classId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Помилка реєстрації');
    currentUser = data.user;
    return data.user;
  }

  /**
   * Вхід існуючого користувача
   * @param {string} username
   * @param {string} password
   */
  async function login(username, password) {
    const res  = await fetch('/api/auth.php?action=login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Помилка входу');
    currentUser = data.user;
    return data.user;
  }

  /**
   * Вихід з системи
   */
  async function logout() {
    await fetch('/api/auth.php?action=logout', { method: 'POST' });
    currentUser = null;
  }

  return { getUser, isLoggedIn, isAdmin, checkSession, loadClassesForRegister, register, login, logout };
})();
