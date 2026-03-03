/**
 * app.js — основна логіка SPA (Single Page Application)
 * Управляє навігацією між секціями, авторизацією, завантаженням тем
 */

// ============================================================
// Головний об'єкт додатку
// ============================================================
const App = (() => {

  /**
   * Ініціалізація додатку при завантаженні сторінки
   */
  async function init() {
    // Застосовуємо збережену тему
    Theme.init();

    // Ініціалізуємо елементи квізу
    Quiz.initElements();

    // Прив'язуємо обробники кнопок хедера
    bindHeaderEvents();

    // Перевіряємо авторизацію сесії
    const loggedIn = await Auth.checkSession();

    if (loggedIn) {
      onAuthSuccess(Auth.getUser());
    } else {
      showSection('auth');
    }
  }

  /**
   * Прив'язка подій хедера
   */
  function bindHeaderEvents() {
    // Кнопка перемикання теми
    document.getElementById('btn-theme')?.addEventListener('click', () => Theme.toggle());

    // Гамбургер-меню
    document.getElementById('btn-hamburger')?.addEventListener('click', toggleMobileMenu);

    // Кнопки навігації в хедері
    document.getElementById('btn-topics')?.addEventListener('click', () => {
      closeMobileMenu();
      showSection('topics');
      loadTopics();
    });
    document.getElementById('btn-results-nav')?.addEventListener('click', () => {
      closeMobileMenu();
      showSection('results');
      loadResults();
    });
    document.getElementById('btn-admin-nav')?.addEventListener('click', () => {
      closeMobileMenu();
      showSection('admin');
      Admin.init();
    });
    document.getElementById('btn-logout')?.addEventListener('click', () => {
      closeMobileMenu();
      handleLogout();
    });

    // Кнопки мобільного меню (дублюють хедер)
    document.getElementById('mob-topics')?.addEventListener('click', () => {
      closeMobileMenu();
      showSection('topics');
      loadTopics();
    });
    document.getElementById('mob-results')?.addEventListener('click', () => {
      closeMobileMenu();
      showSection('results');
      loadResults();
    });
    document.getElementById('mob-admin')?.addEventListener('click', () => {
      closeMobileMenu();
      showSection('admin');
      Admin.init();
    });
    document.getElementById('mob-logout')?.addEventListener('click', () => {
      closeMobileMenu();
      handleLogout();
    });

    // Кнопки авторизації
    document.getElementById('btn-login-tab')?.addEventListener('click', () => switchAuthTab('login'));
    document.getElementById('btn-register-tab')?.addEventListener('click', () => switchAuthTab('register'));
    document.getElementById('btn-login')?.addEventListener('click', handleLogin);
    document.getElementById('btn-register')?.addEventListener('click', handleRegister);

    // Enter у полях форм авторизації
    document.getElementById('login-password')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') handleLogin();
    });
    document.getElementById('register-password')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') handleRegister();
    });

    // Кнопки результатів тесту
    document.getElementById('btn-result-retry')?.addEventListener('click', () => Quiz.retry());
    document.getElementById('btn-result-topics')?.addEventListener('click', () => {
      showSection('topics');
      loadTopics();
    });

    // Логотип — повернення до головної
    document.getElementById('header-logo')?.addEventListener('click', () => {
      if (Auth.isLoggedIn()) {
        showSection('topics');
        loadTopics();
      }
    });

    // Адмін-вкладки
    document.querySelectorAll('.admin-tab').forEach(tab => {
      tab.addEventListener('click', () => switchAdminTab(tab.dataset.tab));
    });

    // Фільтр запитань по темі
    document.getElementById('filter-topic')?.addEventListener('change', e => {
      Admin.loadQuestions(e.target.value);
    });

    // Кнопки відкриття модальних вікон (адмін)
    document.getElementById('btn-add-topic')?.addEventListener('click', () => Admin.openTopicModal());
    document.getElementById('btn-add-question')?.addEventListener('click', () => Admin.openQuestionModal());
    document.getElementById('btn-import-url')?.addEventListener('click', () => Admin.importFromUrl());
    document.getElementById('btn-import-json')?.addEventListener('click', () => Admin.importFromJson());

    // Збереження форм модальних вікон
    document.getElementById('btn-save-topic')?.addEventListener('click', () => Admin.saveTopic());
    document.getElementById('btn-save-question')?.addEventListener('click', () => Admin.saveQuestion());

    // Закриття модальних вікон
    document.querySelectorAll('.modal__close, .btn-modal-cancel').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.closest('.modal-overlay')?.classList.remove('is-open');
      });
    });

    // Закриття модалки при кліку на overlay
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.classList.remove('is-open');
      });
    });
  }

  // ============================================================
  // Авторизація
  // ============================================================

  /**
   * Перемикання між вкладками входу/реєстрації
   */
  function switchAuthTab(tab) {
    document.getElementById('btn-login-tab')?.classList.toggle('active', tab === 'login');
    document.getElementById('btn-register-tab')?.classList.toggle('active', tab === 'register');
    document.getElementById('form-login')?.classList.toggle('hidden', tab !== 'login');
    document.getElementById('form-register')?.classList.toggle('hidden', tab !== 'register');
  }

  /**
   * Обробка входу
   */
  async function handleLogin() {
    const username = document.getElementById('login-username')?.value.trim();
    const password = document.getElementById('login-password')?.value;
    const errEl    = document.getElementById('login-error');

    if (errEl) errEl.textContent = '';

    if (!username || !password) {
      if (errEl) errEl.textContent = 'Заповніть всі поля';
      return;
    }

    try {
      const user = await Auth.login(username, password);
      onAuthSuccess(user);
    } catch (err) {
      if (errEl) errEl.textContent = err.message;
    }
  }

  /**
   * Обробка реєстрації
   */
  async function handleRegister() {
    const username = document.getElementById('register-username')?.value.trim();
    const password = document.getElementById('register-password')?.value;
    const errEl    = document.getElementById('register-error');

    if (errEl) errEl.textContent = '';

    if (!username || !password) {
      if (errEl) errEl.textContent = 'Заповніть всі поля';
      return;
    }

    try {
      const user = await Auth.register(username, password);
      onAuthSuccess(user);
    } catch (err) {
      if (errEl) errEl.textContent = err.message;
    }
  }

  /**
   * Дії після успішної авторизації
   */
  function onAuthSuccess(user) {
    // Оновлюємо UI хедера
    const userEl = document.getElementById('header-username');
    if (userEl) userEl.textContent = `👤 ${user.username}`;

    // Показуємо кнопку виходу
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) logoutBtn.style.display = 'flex';

    // Показуємо/ховаємо кнопки залежно від ролі
    const adminBtn    = document.getElementById('btn-admin-nav');
    const mobAdminBtn = document.getElementById('mob-admin');
    if (adminBtn)    adminBtn.classList.toggle('hidden', user.role !== 'admin');
    if (mobAdminBtn) mobAdminBtn.classList.toggle('hidden', user.role !== 'admin');

    // Для адміна — додаємо стовпець "Учень" у таблицю результатів
    if (user.role === 'admin') {
      const headerRow = document.getElementById('results-header');
      if (headerRow && !headerRow.querySelector('.col-username')) {
        const th = document.createElement('th');
        th.className = 'col-username';
        th.textContent = 'Учень';
        headerRow.insertBefore(th, headerRow.firstChild);
      }
    }

    // Очищаємо поля форм авторизації
    ['login-username', 'login-password', 'register-username', 'register-password'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    // Переходимо до головної сторінки
    showSection('topics');
    loadTopics();
  }

  /**
   * Вихід з системи
   */
  async function handleLogout() {
    await Auth.logout();
    // Скидаємо UI хедера
    const userEl = document.getElementById('header-username');
    if (userEl) userEl.textContent = '';
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) logoutBtn.style.display = 'none';
    showSection('auth');
  }

  // ============================================================
  // Теми
  // ============================================================

  /**
   * Завантажити та відобразити теми для учня
   */
  async function loadTopics() {
    const container = document.getElementById('topics-container');
    if (!container) return;

    container.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

    try {
      const res    = await fetch('/api/topics.php');
      const topics = await res.json();

      if (topics.length === 0) {
        container.innerHTML = '<div class="empty-state">🌍 Теми ще не додані</div>';
        return;
      }

      // Іконки для тем (циклічно)
      const icons = ['🌍', '🌡️', '👥', '🌿', '🏔️', '🌊', '🏙️', '🗺️'];

      container.innerHTML = '<div class="topics-grid">' +
        topics.map((t, i) => `
          <div class="topic-card" onclick="App.startQuiz(${t.id}, '${escapeHtml(t.name)}')">
            <div class="topic-card__icon">${icons[i % icons.length]}</div>
            <div class="topic-card__body">
              <div class="topic-card__name">${escapeHtml(t.name)}</div>
              ${t.description
                ? `<div class="topic-card__desc">${escapeHtml(t.description)}</div>`
                : ''}
              <div class="topic-card__count">📝 ${t.question_count} запитань</div>
            </div>
          </div>
        `).join('') +
        '</div>';
    } catch {
      container.innerHTML = '<div class="empty-state">❌ Помилка завантаження тем</div>';
    }
  }

  /**
   * Запустити тест
   */
  function startQuiz(topicId, topicName) {
    Quiz.start(topicId, topicName);
  }

  // ============================================================
  // Результати
  // ============================================================

  /**
   * Завантажити та відобразити результати
   */
  async function loadResults() {
    const tbody  = document.getElementById('results-tbody');
    const titleEl = document.getElementById('results-title');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="loading-state"><div class="spinner"></div></td></tr>';

    if (titleEl) {
      titleEl.textContent = Auth.isAdmin()
        ? '📊 Результати всіх учнів'
        : '📊 Мої результати';
    }

    try {
      const res     = await fetch('/api/results.php');
      const results = await res.json();

      if (results.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Результатів ще немає</td></tr>';
        return;
      }

      tbody.innerHTML = results.map(r => {
        const badgeClass = r.percent >= 70 ? 'badge-success'
                         : r.percent >= 50 ? 'badge-warning' : 'badge-danger';
        return `
          <tr>
            ${Auth.isAdmin() ? `<td>${escapeHtml(r.username)}</td>` : ''}
            <td>${escapeHtml(r.topic_name)}</td>
            <td>${r.score} / ${r.total_questions}</td>
            <td><span class="badge ${badgeClass}">${r.percent}%</span></td>
            <td>${formatDate(r.completed_at)}</td>
          </tr>
        `;
      }).join('');
    } catch {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state">❌ Помилка завантаження</td></tr>';
    }
  }

  // ============================================================
  // Навігація
  // ============================================================

  /**
   * Показати секцію за іменем
   * @param {string} name — ім'я секції (topics, quiz, result, auth, admin, results)
   */
  function showSection(name) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('is-active'));
    document.getElementById(`section-${name}`)?.classList.add('is-active');

    // Оновлюємо активну кнопку навігації
    document.querySelectorAll('.btn-nav').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`btn-${name}-nav`) ||
                      document.getElementById(`btn-${name}`);
    if (activeBtn) activeBtn.classList.add('active');
  }

  // ============================================================
  // Адмін-панель
  // ============================================================

  /**
   * Перемикання між вкладками адмін-панелі
   */
  function switchAdminTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    document.querySelectorAll('.admin-panel').forEach(p => {
      p.classList.toggle('is-active', p.dataset.panel === tab);
    });

    // Завантажуємо дані при першому переході на вкладку
    if (tab === 'questions') Admin.loadQuestions();
    if (tab === 'users')     Admin.loadUsers();
  }

  // ============================================================
  // Утиліти
  // ============================================================

  /**
   * Показати повідомлення (alert) у верхній частині поточної секції
   * @param {string} msg — текст повідомлення
   * @param {string} type — тип: 'success', 'error', 'info'
   */
  function showAlert(msg, type = 'info') {
    // Знаходимо або створюємо контейнер повідомлень
    let el = document.getElementById('global-alert');
    if (!el) {
      el = document.createElement('div');
      el.id = 'global-alert';
      el.style.cssText = 'position:fixed;top:70px;left:50%;transform:translateX(-50%);' +
        'z-index:3000;min-width:280px;max-width:90vw;';
      document.body.appendChild(el);
    }

    el.className = `alert alert-${type}`;
    el.textContent = msg;
    el.style.display = 'block';

    // Автоматично ховаємо через 4 секунди
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.style.display = 'none'; }, 4000);
  }

  /**
   * Форматування дати
   */
  function formatDate(str) {
    if (!str) return '';
    const d = new Date(str);
    return d.toLocaleString('uk-UA', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  /**
   * Безпечне екранування HTML
   */
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(str)));
    return div.innerHTML;
  }

  /**
   * Відкрити/закрити мобільне меню
   */
  function toggleMobileMenu() {
    document.getElementById('mobile-menu')?.classList.toggle('is-open');
  }

  function closeMobileMenu() {
    document.getElementById('mobile-menu')?.classList.remove('is-open');
  }

  // ============================================================
  // Публічний API
  // ============================================================
  return {
    init,
    showSection,
    showAlert,
    loadTopics,
    startQuiz,
    escapeHtml,
  };
})();

// Запускаємо додаток після завантаження DOM
document.addEventListener('DOMContentLoaded', () => App.init());
