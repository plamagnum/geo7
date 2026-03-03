/**
 * admin.js — модуль адмін-панелі
 * CRUD для тем, запитань, користувачів + імпорт JSON
 */

const Admin = (() => {
  // Кеш даних
  let topics    = [];
  let questions = [];
  let users     = [];

  // Поточний редагований об'єкт
  let editingId = null;

  // ============================================================
  // Ініціалізація адмін-панелі
  // ============================================================

  /**
   * Ініціалізація: завантаження початкових даних
   */
  async function init() {
    await loadTopics();
    renderTopicsTable();
    renderTopicsSelect();
  }

  // ============================================================
  // Теми
  // ============================================================

  /**
   * Завантажити список тем з сервера
   */
  async function loadTopics() {
    try {
      const res = await fetch('/api/topics.php');
      topics = await res.json();
    } catch {
      topics = [];
    }
  }

  /**
   * Відобразити таблицю тем
   */
  function renderTopicsTable() {
    const tbody = document.getElementById('topics-tbody');
    if (!tbody) return;

    if (topics.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Теми відсутні</td></tr>';
      return;
    }

    tbody.innerHTML = topics.map(t => `
      <tr>
        <td>${t.id}</td>
        <td title="${escapeHtml(t.name)}">${escapeHtml(t.name)}</td>
        <td>${t.question_count || 0}</td>
        <td class="actions">
          <button class="btn btn-sm btn-outline" onclick="Admin.editTopic(${t.id})">✏️ Ред.</button>
          <button class="btn btn-sm btn-danger"  onclick="Admin.deleteTopic(${t.id})">🗑️</button>
        </td>
      </tr>
    `).join('');
  }

  /**
   * Відображення списку тем у select для фільтра запитань
   */
  function renderTopicsSelect() {
    const selects = document.querySelectorAll('.topics-select');
    selects.forEach(sel => {
      const val = sel.value;
      sel.innerHTML = '<option value="">— Оберіть тему —</option>' +
        topics.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
      if (val) sel.value = val;
    });
  }

  /**
   * Відкрити модальне вікно для створення теми
   */
  function openTopicModal(topic = null) {
    editingId = topic ? topic.id : null;
    document.getElementById('modal-topic-title').textContent =
      topic ? 'Редагувати тему' : 'Нова тема';
    document.getElementById('topic-name').value        = topic ? topic.name        : '';
    document.getElementById('topic-description').value = topic ? topic.description : '';
    openModal('modal-topic');
  }

  /**
   * Редагування теми за ID
   */
  function editTopic(id) {
    const topic = topics.find(t => t.id === id);
    if (topic) openTopicModal(topic);
  }

  /**
   * Збереження теми (створення або оновлення)
   */
  async function saveTopic() {
    const name        = document.getElementById('topic-name').value.trim();
    const description = document.getElementById('topic-description').value.trim();

    if (!name) return App.showAlert('Введіть назву теми', 'error');

    const method  = editingId ? 'PUT' : 'POST';
    const payload = editingId
      ? { id: editingId, name, description }
      : { name, description };

    try {
      const res  = await fetch('/api/topics.php', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      closeModal('modal-topic');
      await loadTopics();
      renderTopicsTable();
      renderTopicsSelect();
      App.showAlert(editingId ? 'Тему оновлено' : 'Тему створено', 'success');
    } catch (err) {
      App.showAlert(err.message, 'error');
    }
  }

  /**
   * Видалення теми
   */
  async function deleteTopic(id) {
    if (!confirm('Видалити тему та всі її запитання?')) return;

    try {
      const res  = await fetch('/api/topics.php', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      await loadTopics();
      renderTopicsTable();
      renderTopicsSelect();
      App.showAlert('Тему видалено', 'success');
    } catch (err) {
      App.showAlert(err.message, 'error');
    }
  }

  // ============================================================
  // Запитання
  // ============================================================

  /**
   * Завантажити запитання (по темі або всі)
   */
  async function loadQuestions(topicId = '') {
    try {
      const url = topicId
        ? `/api/questions.php?topic_id=${topicId}`
        : '/api/questions.php?all=1';
      const res = await fetch(url);
      questions = await res.json();
    } catch {
      questions = [];
    }
    renderQuestionsTable();
  }

  /**
   * Відобразити таблицю запитань
   */
  function renderQuestionsTable() {
    const tbody = document.getElementById('questions-tbody');
    if (!tbody) return;

    if (questions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Запитання відсутні</td></tr>';
      return;
    }

    tbody.innerHTML = questions.map(q => `
      <tr>
        <td>${q.id}</td>
        <td title="${escapeHtml(q.topic_name || '')}">${escapeHtml(q.topic_name || '')}</td>
        <td title="${escapeHtml(q.question_text)}">${escapeHtml(q.question_text)}</td>
        <td>${q.correct_option.toUpperCase()}</td>
        <td class="actions">
          <button class="btn btn-sm btn-outline" onclick="Admin.editQuestion(${q.id})">✏️</button>
          <button class="btn btn-sm btn-danger"  onclick="Admin.deleteQuestion(${q.id})">🗑️</button>
        </td>
      </tr>
    `).join('');
  }

  /**
   * Відкрити модальне вікно для створення/редагування запитання
   */
  function openQuestionModal(question = null) {
    editingId = question ? question.id : null;
    document.getElementById('modal-question-title').textContent =
      question ? 'Редагувати запитання' : 'Нове запитання';

    const fields = ['topic_id', 'question_text', 'option_a', 'option_b',
                    'option_c', 'option_d', 'correct_option'];
    fields.forEach(f => {
      const el = document.getElementById(`q-${f}`);
      if (el) el.value = question ? (question[f] || '') : '';
    });

    // Заповнюємо select тем
    const topicSel = document.getElementById('q-topic_id');
    if (topicSel) {
      topicSel.innerHTML = '<option value="">— Оберіть тему —</option>' +
        topics.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
      if (question) topicSel.value = question.topic_id;
    }

    openModal('modal-question');
  }

  /**
   * Редагування запитання за ID
   */
  function editQuestion(id) {
    const q = questions.find(q => q.id === id);
    if (q) openQuestionModal(q);
  }

  /**
   * Збереження запитання
   */
  async function saveQuestion() {
    const topicId      = document.getElementById('q-topic_id').value;
    const questionText = document.getElementById('q-question_text').value.trim();
    const optionA      = document.getElementById('q-option_a').value.trim();
    const optionB      = document.getElementById('q-option_b').value.trim();
    const optionC      = document.getElementById('q-option_c').value.trim();
    const optionD      = document.getElementById('q-option_d').value.trim();
    const correct      = document.getElementById('q-correct_option').value;

    if (!topicId || !questionText || !optionA || !optionB || !optionC || !optionD || !correct) {
      return App.showAlert('Заповніть всі поля', 'error');
    }

    const method  = editingId ? 'PUT' : 'POST';
    const payload = {
      topic_id:       parseInt(topicId),
      question_text:  questionText,
      option_a:       optionA,
      option_b:       optionB,
      option_c:       optionC,
      option_d:       optionD,
      correct_option: correct,
    };
    if (editingId) payload.id = editingId;

    try {
      const res  = await fetch('/api/questions.php', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      closeModal('modal-question');
      const filterTopic = document.getElementById('filter-topic')?.value || '';
      await loadQuestions(filterTopic);
      App.showAlert(editingId ? 'Запитання оновлено' : 'Запитання створено', 'success');
    } catch (err) {
      App.showAlert(err.message, 'error');
    }
  }

  /**
   * Видалення запитання
   */
  async function deleteQuestion(id) {
    if (!confirm('Видалити запитання?')) return;

    try {
      const res  = await fetch('/api/questions.php', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const filterTopic = document.getElementById('filter-topic')?.value || '';
      await loadQuestions(filterTopic);
      App.showAlert('Запитання видалено', 'success');
    } catch (err) {
      App.showAlert(err.message, 'error');
    }
  }

  // ============================================================
  // Користувачі
  // ============================================================

  /**
   * Завантажити список користувачів
   */
  async function loadUsers() {
    try {
      const res = await fetch('/api/users.php');
      users     = await res.json();
    } catch {
      users = [];
    }
    renderUsersTable();
  }

  /**
   * Відобразити таблицю користувачів
   */
  function renderUsersTable() {
    const tbody = document.getElementById('users-tbody');
    if (!tbody) return;

    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Користувачі відсутні</td></tr>';
      return;
    }

    tbody.innerHTML = users.map(u => `
      <tr>
        <td>${u.id}</td>
        <td>${escapeHtml(u.username)}</td>
        <td>
          <span class="role-badge ${u.role === 'admin' ? 'role-admin' : 'role-student'}">
            ${u.role === 'admin' ? '👑 Адмін' : '🎓 Учень'}
          </span>
        </td>
        <td class="actions">
          <button class="btn btn-sm btn-outline"
                  onclick="Admin.toggleRole(${u.id}, '${u.role}')">
            ${u.role === 'admin' ? '👤 В учні' : '👑 В адміни'}
          </button>
          <button class="btn btn-sm btn-danger" onclick="Admin.deleteUser(${u.id})">🗑️</button>
        </td>
      </tr>
    `).join('');
  }

  /**
   * Зміна ролі користувача
   */
  async function toggleRole(id, currentRole) {
    const newRole = currentRole === 'admin' ? 'student' : 'admin';
    if (!confirm(`Змінити роль на "${newRole}"?`)) return;

    try {
      const res  = await fetch('/api/users.php', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await loadUsers();
      App.showAlert('Роль змінено', 'success');
    } catch (err) {
      App.showAlert(err.message, 'error');
    }
  }

  /**
   * Видалення користувача
   */
  async function deleteUser(id) {
    if (!confirm('Видалити користувача?')) return;

    try {
      const res  = await fetch('/api/users.php', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await loadUsers();
      App.showAlert('Користувача видалено', 'success');
    } catch (err) {
      App.showAlert(err.message, 'error');
    }
  }

  // ============================================================
  // Імпорт запитань
  // ============================================================

  /**
   * Імпорт з URL
   */
  async function importFromUrl() {
    const url     = document.getElementById('import-url').value.trim();
    const resultEl = document.getElementById('import-result');

    if (!url) return App.showAlert('Введіть URL', 'error');

    resultEl.textContent = '⏳ Завантаження...';
    resultEl.className   = 'alert alert-info mt-2';

    try {
      const res  = await fetch('/api/import.php?source=url', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ url }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      resultEl.textContent = `✅ Імпортовано ${data.imported} запитань у тему "${data.topic}"`;
      resultEl.className   = 'alert alert-success mt-2';
      document.getElementById('import-url').value = '';
      await loadTopics();
      renderTopicsTable();
    } catch (err) {
      resultEl.textContent = `❌ ${err.message}`;
      resultEl.className   = 'alert alert-error mt-2';
    }
  }

  /**
   * Імпорт з JSON тексту
   */
  async function importFromJson() {
    const jsonStr  = document.getElementById('import-json').value.trim();
    const resultEl = document.getElementById('import-result-json');

    if (!jsonStr) return App.showAlert('Вставте JSON', 'error');

    resultEl.textContent = '⏳ Обробка...';
    resultEl.className   = 'alert alert-info mt-2';

    try {
      const res  = await fetch('/api/import.php?source=json', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ json: jsonStr }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      let msg = `✅ Імпортовано ${data.imported} запитань у тему "${data.topic}"`;
      if (data.errors && data.errors.length > 0) {
        msg += `\n⚠️ Помилки: ${data.errors.join(', ')}`;
      }
      resultEl.textContent = msg;
      resultEl.className   = 'alert alert-success mt-2';
      document.getElementById('import-json').value = '';
      await loadTopics();
      renderTopicsTable();
    } catch (err) {
      resultEl.textContent = `❌ ${err.message}`;
      resultEl.className   = 'alert alert-error mt-2';
    }
  }

  // ============================================================
  // Утиліти: модальні вікна
  // ============================================================

  function openModal(id) {
    document.getElementById(id)?.classList.add('is-open');
  }

  function closeModal(id) {
    document.getElementById(id)?.classList.remove('is-open');
  }

  /**
   * Безпечне екранування HTML
   */
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  return {
    init,
    // Теми
    editTopic,
    deleteTopic,
    openTopicModal,
    saveTopic,
    // Запитання
    loadQuestions,
    editQuestion,
    deleteQuestion,
    openQuestionModal,
    saveQuestion,
    // Користувачі
    loadUsers,
    toggleRole,
    deleteUser,
    // Імпорт
    importFromUrl,
    importFromJson,
    // Модальні
    openModal,
    closeModal,
  };
})();
