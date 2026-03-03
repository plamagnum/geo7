<?php
/**
 * API для отримання запитань для тесту
 * GET ?topic_id=X — отримати рандомні запитання для тесту (без правильних відповідей)
 */

require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Перевірка авторизації — тести доступні тільки авторизованим користувачам
if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Необхідна авторизація']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Метод не підтримується']);
    exit;
}

$topicId = (int)($_GET['topic_id'] ?? 0);

if (!$topicId) {
    http_response_code(400);
    echo json_encode(['error' => 'Вкажіть topic_id']);
    exit;
}

// Кількість запитань у тесті (можна змінювати)
$limit = (int)($_GET['limit'] ?? 10);
if ($limit < 1 || $limit > 50) {
    $limit = 10;
}

$pdo = getDbConnection();

// Перевіряємо чи існує тема
$stmt = $pdo->prepare('SELECT id, name FROM topics WHERE id = ?');
$stmt->execute([$topicId]);
$topic = $stmt->fetch();

if (!$topic) {
    http_response_code(404);
    echo json_encode(['error' => 'Тема не знайдена']);
    exit;
}

// Отримуємо рандомні запитання — правильна відповідь включена
// (фронтенд приховує її до відповіді)
$stmt = $pdo->prepare(
    'SELECT id, question_text, option_a, option_b, option_c, option_d, correct_option
     FROM questions
     WHERE topic_id = ?
     ORDER BY RAND()
     LIMIT ?'
);
$stmt->execute([$topicId, $limit]);
$questions = $stmt->fetchAll();

// Конвертуємо числові поля
foreach ($questions as &$q) {
    $q['id'] = (int)$q['id'];
}

echo json_encode([
    'topic'     => $topic,
    'questions' => $questions,
]);
