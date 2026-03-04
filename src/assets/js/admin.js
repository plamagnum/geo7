/**
 * admin.js — модуль адмін-панелі
 * CRUD для тем, запитань, користувачів, класів, предметів + імпорт JSON + онлайн-статус
 */

const Admin = (() => {
  // Кеш даних
  let topics    = [];
  let questions = [];
  let users     = [];
  let classes   = [];
  let subjects  = [];

  // Поточний редагований об'єкт
  let editingId = null;

  // ============================================================
  // Ініціалізація адмін-панелі
  // ============================================================

  /**
   * Ініціалізація: завантаження початкових даних
   */
  async function init() {
    await Promise.all([loadTopics(), loadClasses(), loadSubjects()]);
    renderTopicsTable();
    renderTopicsSelect();
    renderSubjectsSelectForTopic();
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
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Теми відсутні</td></tr>';
      return;
    }

    tbody.innerHTML = topics.map(t => `
      <tr>
        <td>${t.id}</td>
        <td title="${escapeHtml(t.name)}">${escapeHtml(t.name)}</td>
        <td>${escapeHtml(t.subject_name || '—')}</td>
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
   * Заповнити select предметів у модалці теми
   */
  function renderSubjectsSelectForTopic() {
    const sel = document.getElementById('topic-subject');
    if (!sel) return;
    const val = sel.value;
    sel.innerHTML = '<option value="">— Без предмету —</option>' +
      subjects.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
    if (val) sel.value = val;
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
    renderSubjectsSelectForTopic();
    const subjSel = document.getElementById('topic-subject');
    if (subjSel) subjSel.value = topic ? (topic.subject_id || '') : '';
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
    const subjectId   = document.getElementById('topic-subject')?.value || null;

    if (!name) return App.showAlert('Введіть назву теми', 'error');

    const method  = editingId ? 'PUT' : 'POST';
    const payload = editingId
      ? { id: editingId, name, description, subject_id: subjectId ? parseInt(subjectId) : null }
      : { name, description, subject_id: subjectId ? parseInt(subjectId) : null };

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
   * Відобразити таблицю користувачів (з класом)
   */
  function renderUsersTable() {
    const tbody = document.getElementById('users-tbody');
    if (!tbody) return;

    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Користувачі відсутні</td></tr>';
      return;
    }

    // Будуємо options для вибору класу
    const classOptions = '<option value="">— Без класу —</option>' +
      classes.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

    tbody.innerHTML = users.map(u => `
      <tr>
        <td>${u.id}</td>
        <td>${escapeHtml(u.username)}</td>
        <td>
          <span class="role-badge ${u.role === 'admin' ? 'role-admin' : 'role-student'}">
            ${u.role === 'admin' ? '👑 Адмін' : '🎓 Учень'}
          </span>
        </td>
        <td>
          <select class="form-select form-select-sm" onchange="Admin.changeUserClass(${u.id}, this.value)">
            ${classOptions}
          </select>
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

    // Встановлюємо поточні значення класів
    users.forEach((u, index) => {
      const row = tbody.querySelector(`tr:nth-child(${index + 1})`);
      if (!row) return;
      const sel = row.querySelector('select');
      if (sel && u.class_id) sel.value = u.class_id;
    });
  }

  /**
   * Зміна класу користувача
   */
  async function changeUserClass(id, classId) {
    try {
      const res  = await fetch('/api/users.php', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id, class_id: classId || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      App.showAlert('Клас змінено', 'success');
    } catch (err) {
      App.showAlert(err.message, 'error');
    }
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
  // Класи
  // ============================================================

  /**
   * Завантажити список класів
   */
  async function loadClasses() {
    try {
      const res = await fetch('/api/classes.php');
      classes   = await res.json();
    } catch {
      classes = [];
    }
    renderClassesTable();
    renderClassesSelectForOnline();
  }

  /**
   * Відобразити таблицю класів
   */
  function renderClassesTable() {
    const tbody = document.getElementById('classes-tbody');
    if (!tbody) return;

    if (classes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Класи відсутні</td></tr>';
      return;
    }

    tbody.innerHTML = classes.map(c => `
      <tr>
        <td>${c.id}</td>
        <td>${escapeHtml(c.name)}</td>
        <td>${escapeHtml(c.description || '')}</td>
        <td>${c.student_count || 0}</td>
        <td class="actions">
          <button class="btn btn-sm btn-outline" onclick="Admin.editClass(${c.id})">✏️ Ред.</button>
          <button class="btn btn-sm btn-danger"  onclick="Admin.deleteClass(${c.id})">🗑️</button>
        </td>
      </tr>
    `).join('');
  }

  /**
   * Заповнити select класів у фільтрі онлайн-панелі
   */
  function renderClassesSelectForOnline() {
    const sel = document.getElementById('filter-online-class');
    if (!sel) return;
    const val = sel.value;
    sel.innerHTML = '<option value="">Всі класи</option>' +
      classes.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    if (val) sel.value = val;
  }

  /**
   * Відкрити модальне вікно для створення/редагування класу
   */
  function openClassModal(cls = null) {
    editingId = cls ? cls.id : null;
    document.getElementById('modal-class-title').textContent =
      cls ? 'Редагувати клас' : 'Новий клас';
    document.getElementById('class-name').value        = cls ? cls.name        : '';
    document.getElementById('class-description').value = cls ? cls.description : '';
    openModal('modal-class');
  }

  /**
   * Редагування класу за ID
   */
  function editClass(id) {
    const cls = classes.find(c => c.id === id);
    if (cls) openClassModal(cls);
  }

  /**
   * Збереження класу (створення або оновлення)
   */
  async function saveClass() {
    const name        = document.getElementById('class-name').value.trim();
    const description = document.getElementById('class-description').value.trim();

    if (!name) return App.showAlert('Введіть назву класу', 'error');

    const method  = editingId ? 'PUT' : 'POST';
    const payload = editingId
      ? { id: editingId, name, description }
      : { name, description };

    try {
      const res  = await fetch('/api/classes.php', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      closeModal('modal-class');
      await loadClasses();
      App.showAlert(editingId ? 'Клас оновлено' : 'Клас створено', 'success');
    } catch (err) {
      App.showAlert(err.message, 'error');
    }
  }

  /**
   * Видалення класу
   */
  async function deleteClass(id) {
    if (!confirm('Видалити клас?')) return;

    try {
      const res  = await fetch('/api/classes.php', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      await loadClasses();
      App.showAlert('Клас видалено', 'success');
    } catch (err) {
      App.showAlert(err.message, 'error');
    }
  }

  // ============================================================
  // Предмети
  // ============================================================

  /**
   * Завантажити список предметів
   */
  async function loadSubjects() {
    try {
      const res = await fetch('/api/subjects.php');
      subjects  = await res.json();
    } catch {
      subjects = [];
    }
    renderSubjectsTable();
  }

  /**
   * Відобразити таблицю предметів
   */
  function renderSubjectsTable() {
    const tbody = document.getElementById('subjects-tbody');
    if (!tbody) return;

    if (subjects.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Предмети відсутні</td></tr>';
      return;
    }

    tbody.innerHTML = subjects.map(s => `
      <tr>
        <td>${s.id}</td>
        <td>${escapeHtml(s.name)}</td>
        <td>${escapeHtml(s.description || '')}</td>
        <td>${s.topic_count || 0}</td>
        <td class="actions">
          <button class="btn btn-sm btn-outline" onclick="Admin.editSubject(${s.id})">✏️ Ред.</button>
          <button class="btn btn-sm btn-danger"  onclick="Admin.deleteSubject(${s.id})">🗑️</button>
        </td>
      </tr>
    `).join('');
  }

  /**
   * Відкрити модальне вікно для створення/редагування предмету
   */
  function openSubjectModal(subject = null) {
    editingId = subject ? subject.id : null;
    document.getElementById('modal-subject-title').textContent =
      subject ? 'Редагувати предмет' : 'Новий предмет';
    document.getElementById('subject-name').value        = subject ? subject.name        : '';
    document.getElementById('subject-description').value = subject ? subject.description : '';
    openModal('modal-subject');
  }

  /**
   * Редагування предмету за ID
   */
  function editSubject(id) {
    const subject = subjects.find(s => s.id === id);
    if (subject) openSubjectModal(subject);
  }

  /**
   * Збереження предмету (створення або оновлення)
   */
  async function saveSubject() {
    const name        = document.getElementById('subject-name').value.trim();
    const description = document.getElementById('subject-description').value.trim();

    if (!name) return App.showAlert('Введіть назву предмету', 'error');

    const method  = editingId ? 'PUT' : 'POST';
    const payload = editingId
      ? { id: editingId, name, description }
      : { name, description };

    try {
      const res  = await fetch('/api/subjects.php', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      closeModal('modal-subject');
      await loadSubjects();
      renderSubjectsSelectForTopic();
      App.showAlert(editingId ? 'Предмет оновлено' : 'Предмет створено', 'success');
    } catch (err) {
      App.showAlert(err.message, 'error');
    }
  }

  /**
   * Видалення предмету
   */
  async function deleteSubject(id) {
    if (!confirm('Видалити предмет?')) return;

    try {
      const res  = await fetch('/api/subjects.php', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      await loadSubjects();
      renderSubjectsSelectForTopic();
      App.showAlert('Предмет видалено', 'success');
    } catch (err) {
      App.showAlert(err.message, 'error');
    }
  }

  // ============================================================
  // Онлайн-статус учнів
  // ============================================================

  // Таймер автооновлення онлайн-панелі
  let onlineRefreshTimer = null;

  /**
   * Завантажити та відобразити онлайн-статус учнів
   * @param {string|number} classId — фільтр по класу (опціонально)
   */
  async function loadOnlineStudents(classId = '') {
    // Очищаємо попередній таймер
    if (onlineRefreshTimer) {
      clearInterval(onlineRefreshTimer);
    }

    await fetchAndRenderOnline(classId);

    // Автооновлення кожні 30 секунд
    onlineRefreshTimer = setInterval(() => fetchAndRenderOnline(classId), 30000);
  }

  /**
   * Отримати та відобразити список онлайн-учнів
   */
  async function fetchAndRenderOnline(classId = '') {
    try {
      const url = classId
        ? `/api/sessions.php?action=online&class_id=${classId}`
        : '/api/sessions.php?action=online';
      const res      = await fetch(url);
      const students = await res.json();
      renderOnlineTable(students);
    } catch {
      const tbody = document.getElementById('online-tbody');
      if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Помилка завантаження</td></tr>';
    }
  }

  /**
   * Відобразити таблицю онлайн-статусу учнів
   */
  function renderOnlineTable(students) {
    const tbody = document.getElementById('online-tbody');
    if (!tbody) return;

    if (!students || students.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Учнів не знайдено</td></tr>';
      return;
    }

    tbody.innerHTML = students.map(s => {
      const statusClass = s.is_active ? 'status-online' : 'status-offline';
      const statusText  = s.is_active ? '🟢 Онлайн' : '🔴 Офлайн';
      return `
        <tr>
          <td>${escapeHtml(s.username)}</td>
          <td>${escapeHtml(s.class_name || '—')}</td>
          <td><span class="${statusClass}">${statusText}</span></td>
          <td>${formatDateTime(s.login_at)}</td>
          <td>${formatDateTime(s.logout_at)}</td>
          <td>${formatDateTime(s.last_activity)}</td>
        </tr>
      `;
    }).join('');
  }

  /**
   * Форматування дати/часу
   */
  function formatDateTime(str) {
    if (!str) return '—';
    const d = new Date(str);
    return d.toLocaleString('uk-UA', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
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
    changeUserClass,
    deleteUser,
    // Класи
    loadClasses,
    editClass,
    deleteClass,
    openClassModal,
    saveClass,
    // Предмети
    loadSubjects,
    editSubject,
    deleteSubject,
    openSubjectModal,
    saveSubject,
    // Онлайн
    loadOnlineStudents,
    // Імпорт
    importFromUrl,
    importFromJson,
    // Модальні
    openModal,
    closeModal,
  };
})();
