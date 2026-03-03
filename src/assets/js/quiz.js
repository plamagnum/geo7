/**
 * quiz.js — модуль тестування
 * Завантажує запитання, управляє процесом тесту
 */

const Quiz = (() => {
  // Дані поточного тесту
  let questions       = [];
  let currentIndex    = 0;
  let score           = 0;
  let topicId         = null;
  let topicName       = '';
  let answered        = false;
  let autoNextTimer   = null;

  // Посилання на DOM-елементи (встановлюються при init)
  let els = {};

  /**
   * Ініціалізація посилань на DOM-елементи
   */
  function initElements() {
    els = {
      quizSection:    document.getElementById('section-quiz'),
      topicTitle:     document.getElementById('quiz-topic-title'),
      counter:        document.getElementById('quiz-counter'),
      progressFill:   document.getElementById('quiz-progress-fill'),
      questionText:   document.getElementById('quiz-question-text'),
      optionsList:    document.getElementById('quiz-options-list'),
      resultSection:  document.getElementById('section-result'),
      resultIcon:     document.getElementById('result-icon'),
      resultScore:    document.getElementById('result-score'),
      resultMessage:  document.getElementById('result-message'),
      btnRetry:       document.getElementById('btn-result-retry'),
      btnTopics:      document.getElementById('btn-result-topics'),
    };
  }

  /**
   * Завантажити та почати тест за темою
   * @param {number} id — ID теми
   * @param {string} name — назва теми
   */
  async function start(id, name) {
    topicId   = id;
    topicName = name;

    // Очищаємо попередній стан
    questions    = [];
    currentIndex = 0;
    score        = 0;
    answered     = false;
    clearTimeout(autoNextTimer);

    try {
      const res  = await fetch(`/api/quiz.php?topic_id=${id}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Помилка завантаження тесту');

      questions = data.questions;
      if (questions.length === 0) {
        App.showAlert('В цій темі ще немає запитань', 'info');
        return;
      }

      // Відображаємо секцію тесту
      App.showSection('quiz');
      renderQuestion();
    } catch (err) {
      App.showAlert(err.message, 'error');
    }
  }

  /**
   * Відобразити поточне запитання
   */
  function renderQuestion() {
    if (!els.quizSection) initElements();
    const q = questions[currentIndex];

    // Оновлюємо прогрес-бар та лічильник
    const progress = ((currentIndex) / questions.length) * 100;
    els.progressFill.style.width = `${progress}%`;
    els.counter.textContent = `${currentIndex + 1} / ${questions.length}`;
    els.topicTitle.textContent = `🌍 ${topicName}`;

    // Текст запитання
    els.questionText.textContent = q.question_text;

    // Варіанти відповідей
    const options = [
      { key: 'a', text: q.option_a },
      { key: 'b', text: q.option_b },
      { key: 'c', text: q.option_c },
      { key: 'd', text: q.option_d },
    ];

    els.optionsList.innerHTML = '';
    options.forEach(({ key, text }) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.dataset.key = key;
      btn.innerHTML = `
        <span class="option-btn__label">${key.toUpperCase()}</span>
        <span>${escapeHtml(text)}</span>
      `;
      btn.addEventListener('click', () => handleAnswer(key, q.correct_option));
      els.optionsList.appendChild(btn);
    });

    answered = false;
  }

  /**
   * Обробка відповіді користувача
   * @param {string} selected — обрана літера (a/b/c/d)
   * @param {string} correct  — правильна літера
   */
  function handleAnswer(selected, correct) {
    if (answered) return;
    answered = true;

    // Підраховуємо рахунок
    if (selected === correct) score++;

    // Підсвічуємо правильну/неправильну відповідь
    const buttons = els.optionsList.querySelectorAll('.option-btn');
    buttons.forEach(btn => {
      btn.disabled = true;
      const key = btn.dataset.key;
      if (key === correct) {
        btn.classList.add('correct');
      } else if (key === selected && selected !== correct) {
        btn.classList.add('wrong');
      }
    });

    // Автоматичний перехід до наступного запитання через 1.5 с
    autoNextTimer = setTimeout(() => {
      currentIndex++;
      if (currentIndex < questions.length) {
        renderQuestion();
      } else {
        showResult();
      }
    }, 1500);
  }

  /**
   * Показати екран результатів
   */
  async function showResult() {
    // Оновлюємо прогрес до 100%
    els.progressFill.style.width = '100%';

    // Визначаємо іконку та повідомлення за результатом
    const percent = Math.round((score / questions.length) * 100);
    let icon, message;

    if (percent >= 90) {
      icon = '🏆'; message = 'Відмінно! Ти справжній знавець географії!';
    } else if (percent >= 70) {
      icon = '🎉'; message = 'Молодець! Гарний результат!';
    } else if (percent >= 50) {
      icon = '📚'; message = 'Непогано, але є куди рости. Вчи далі!';
    } else {
      icon = '💪'; message = 'Не здавайся! Повтори матеріал та спробуй ще.';
    }

    els.resultIcon.textContent = icon;
    els.resultScore.textContent = `${score} / ${questions.length}`;
    els.resultMessage.textContent = message;

    // Зберігаємо результат в БД
    try {
      await fetch('/api/results.php', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          topic_id:        topicId,
          score:           score,
          total_questions: questions.length,
        }),
      });
    } catch {
      // Ігноруємо помилку збереження — не критично
    }

    // Відображаємо секцію результату
    App.showSection('result');
  }

  /**
   * Повторити тест з тією ж темою
   */
  function retry() {
    start(topicId, topicName);
  }

  /**
   * Екранування HTML для безпечного виводу
   * @param {string} str
   */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  return { start, retry, initElements };
})();
