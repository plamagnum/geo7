<?php
/**
 * API для управління запитаннями (CRUD)
 * GET    ?topic_id=X — запитання по темі
 * GET    ?all=1      — всі запитання (адмін)
 * POST               — створити запитання (адмін)
 * PUT                — оновити запитання (адмін)
 * DELETE             — видалити запитання (адмін)
 */

require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        getQuestions();
        break;
    case 'POST':
        requireAdmin();
        createQuestion();
        break;
    case 'PUT':
        requireAdmin();
        updateQuestion();
        break;
    case 'DELETE':
        requireAdmin();
        deleteQuestion();
        break;
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Метод не підтримується']);
}

/**
 * Перевірка прав адміністратора
 */
function requireAdmin(): void {
    if (empty($_SESSION['user_role']) || $_SESSION['user_role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Доступ заборонено. Потрібні права адміністратора']);
        exit;
    }
}

/**
 * Отримати запитання (по темі або всі)
 * GET ?topic_id=X або GET ?all=1
 */
function getQuestions(): void {
    $pdo      = getDbConnection();
    $topicId  = (int)($_GET['topic_id'] ?? 0);
    $getAll   = isset($_GET['all']) && $_GET['all'] === '1';

    if ($topicId) {
        // Запитання конкретної теми
        $stmt = $pdo->prepare(
            'SELECT q.*, t.name AS topic_name
             FROM questions q
             JOIN topics t ON t.id = q.topic_id
             WHERE q.topic_id = ?
             ORDER BY q.id ASC'
        );
        $stmt->execute([$topicId]);
    } elseif ($getAll) {
        // Всі запитання для адмін-панелі
        $stmt = $pdo->query(
            'SELECT q.*, t.name AS topic_name
             FROM questions q
             JOIN topics t ON t.id = q.topic_id
             ORDER BY q.topic_id, q.id ASC'
        );
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'Вкажіть topic_id або all=1']);
        return;
    }

    $questions = $stmt->fetchAll();

    // Конвертуємо числові поля
    foreach ($questions as &$q) {
        $q['id']       = (int)$q['id'];
        $q['topic_id'] = (int)$q['topic_id'];
    }

    echo json_encode($questions);
}

/**
 * Створити нове запитання
 * POST /api/questions.php
 */
function createQuestion(): void {
    $data = json_decode(file_get_contents('php://input'), true);

    $topicId      = (int)($data['topic_id'] ?? 0);
    $questionText = trim($data['question_text'] ?? '');
    $optionA      = trim($data['option_a'] ?? '');
    $optionB      = trim($data['option_b'] ?? '');
    $optionC      = trim($data['option_c'] ?? '');
    $optionD      = trim($data['option_d'] ?? '');
    $correct      = strtolower(trim($data['correct_option'] ?? ''));

    // Валідація обов'язкових полів
    if (!$topicId || empty($questionText) || empty($optionA) ||
        empty($optionB) || empty($optionC) || empty($optionD)) {
        http_response_code(400);
        echo json_encode(['error' => 'Всі поля обов\'язкові']);
        return;
    }

    // Перевірка допустимих значень правильної відповіді
    if (!in_array($correct, ['a', 'b', 'c', 'd'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Правильна відповідь має бути a, b, c або d']);
        return;
    }

    $pdo  = getDbConnection();
    $stmt = $pdo->prepare(
        'INSERT INTO questions
            (topic_id, question_text, option_a, option_b, option_c, option_d, correct_option)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([$topicId, $questionText, $optionA, $optionB, $optionC, $optionD, $correct]);
    $id = (int)$pdo->lastInsertId();

    http_response_code(201);
    echo json_encode(['success' => true, 'id' => $id]);
}

/**
 * Оновити запитання
 * PUT /api/questions.php
 */
function updateQuestion(): void {
    $data = json_decode(file_get_contents('php://input'), true);

    $id           = (int)($data['id'] ?? 0);
    $topicId      = (int)($data['topic_id'] ?? 0);
    $questionText = trim($data['question_text'] ?? '');
    $optionA      = trim($data['option_a'] ?? '');
    $optionB      = trim($data['option_b'] ?? '');
    $optionC      = trim($data['option_c'] ?? '');
    $optionD      = trim($data['option_d'] ?? '');
    $correct      = strtolower(trim($data['correct_option'] ?? ''));

    if (!$id || !$topicId || empty($questionText) || empty($optionA) ||
        empty($optionB) || empty($optionC) || empty($optionD)) {
        http_response_code(400);
        echo json_encode(['error' => 'Всі поля обов\'язкові']);
        return;
    }

    if (!in_array($correct, ['a', 'b', 'c', 'd'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Правильна відповідь має бути a, b, c або d']);
        return;
    }

    $pdo  = getDbConnection();
    $stmt = $pdo->prepare(
        'UPDATE questions SET
            topic_id = ?, question_text = ?,
            option_a = ?, option_b = ?, option_c = ?, option_d = ?,
            correct_option = ?
         WHERE id = ?'
    );
    $stmt->execute([$topicId, $questionText, $optionA, $optionB, $optionC, $optionD, $correct, $id]);

    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['error' => 'Запитання не знайдено']);
        return;
    }

    echo json_encode(['success' => true]);
}

/**
 * Видалити запитання
 * DELETE /api/questions.php
 */
function deleteQuestion(): void {
    $data = json_decode(file_get_contents('php://input'), true);
    $id   = (int)($data['id'] ?? 0);

    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'ID запитання обов\'язковий']);
        return;
    }

    $pdo  = getDbConnection();
    $stmt = $pdo->prepare('DELETE FROM questions WHERE id = ?');
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['error' => 'Запитання не знайдено']);
        return;
    }

    echo json_encode(['success' => true]);
}
