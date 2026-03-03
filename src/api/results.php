<?php
/**
 * API результатів тестів
 * POST — зберегти результат
 * GET  — отримати результати (свої або всіх для адміна)
 */

require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Перевірка авторизації
if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Необхідна авторизація']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        getResults();
        break;
    case 'POST':
        saveResult();
        break;
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Метод не підтримується']);
}

/**
 * Отримати результати тестів
 * Адмін бачить всі, учень — тільки свої
 */
function getResults(): void {
    $pdo    = getDbConnection();
    $userId = (int)$_SESSION['user_id'];
    $role   = $_SESSION['user_role'] ?? 'student';

    if ($role === 'admin') {
        // Адмін бачить результати всіх учнів
        $stmt = $pdo->query(
            'SELECT r.id, r.score, r.total_questions, r.completed_at,
                    u.username, t.name AS topic_name,
                    ROUND(r.score / r.total_questions * 100) AS percent
             FROM quiz_results r
             JOIN users  u ON u.id = r.user_id
             JOIN topics t ON t.id = r.topic_id
             ORDER BY r.completed_at DESC
             LIMIT 200'
        );
    } else {
        // Учень бачить тільки свої результати
        $stmt = $pdo->prepare(
            'SELECT r.id, r.score, r.total_questions, r.completed_at,
                    u.username, t.name AS topic_name,
                    ROUND(r.score / r.total_questions * 100) AS percent
             FROM quiz_results r
             JOIN users  u ON u.id = r.user_id
             JOIN topics t ON t.id = r.topic_id
             WHERE r.user_id = ?
             ORDER BY r.completed_at DESC
             LIMIT 50'
        );
        $stmt->execute([$userId]);
    }

    $results = $stmt->fetchAll();

    // Конвертуємо числові поля
    foreach ($results as &$r) {
        $r['id']              = (int)$r['id'];
        $r['score']           = (int)$r['score'];
        $r['total_questions'] = (int)$r['total_questions'];
        $r['percent']         = (int)$r['percent'];
    }

    echo json_encode($results);
}

/**
 * Зберегти результат тесту
 * POST /api/results.php
 * Body: { topic_id, score, total_questions }
 */
function saveResult(): void {
    $data           = json_decode(file_get_contents('php://input'), true);
    $topicId        = (int)($data['topic_id'] ?? 0);
    $score          = (int)($data['score'] ?? 0);
    $totalQuestions = (int)($data['total_questions'] ?? 0);
    $userId         = (int)$_SESSION['user_id'];

    // Валідація
    if (!$topicId || $totalQuestions < 1) {
        http_response_code(400);
        echo json_encode(['error' => 'Невірні дані результату']);
        return;
    }

    // Переконуємось що score не перевищує total_questions
    if ($score < 0 || $score > $totalQuestions) {
        http_response_code(400);
        echo json_encode(['error' => 'Невірний рахунок']);
        return;
    }

    $pdo  = getDbConnection();
    $stmt = $pdo->prepare(
        'INSERT INTO quiz_results (user_id, topic_id, score, total_questions)
         VALUES (?, ?, ?, ?)'
    );
    $stmt->execute([$userId, $topicId, $score, $totalQuestions]);
    $id = (int)$pdo->lastInsertId();

    echo json_encode(['success' => true, 'id' => $id]);
}
