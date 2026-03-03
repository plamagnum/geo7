<?php
/**
 * API для управління темами (CRUD)
 * GET    — список тем
 * POST   — створення теми (адмін)
 * PUT    — оновлення теми (адмін)
 * DELETE — видалення теми (адмін)
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

// Запуск сесії для перевірки авторизації
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        getTopics();
        break;
    case 'POST':
        requireAdmin();
        createTopic();
        break;
    case 'PUT':
        requireAdmin();
        updateTopic();
        break;
    case 'DELETE':
        requireAdmin();
        deleteTopic();
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
 * Отримати список всіх тем з кількістю запитань
 * GET /api/topics.php
 */
function getTopics(): void {
    $pdo = getDbConnection();
    $stmt = $pdo->query(
        'SELECT t.id, t.name, t.description, t.created_at,
                COUNT(q.id) AS question_count
         FROM topics t
         LEFT JOIN questions q ON q.topic_id = t.id
         GROUP BY t.id
         ORDER BY t.id ASC'
    );
    $topics = $stmt->fetchAll();

    // Конвертуємо числові поля
    foreach ($topics as &$topic) {
        $topic['id']             = (int)$topic['id'];
        $topic['question_count'] = (int)$topic['question_count'];
    }

    echo json_encode($topics);
}

/**
 * Створити нову тему
 * POST /api/topics.php
 * Body: { name, description }
 */
function createTopic(): void {
    $data = json_decode(file_get_contents('php://input'), true);
    $name        = trim($data['name'] ?? '');
    $description = trim($data['description'] ?? '');

    if (empty($name)) {
        http_response_code(400);
        echo json_encode(['error' => 'Назва теми обов\'язкова']);
        return;
    }

    $pdo  = getDbConnection();
    $stmt = $pdo->prepare('INSERT INTO topics (name, description) VALUES (?, ?)');
    $stmt->execute([$name, $description]);
    $id = (int)$pdo->lastInsertId();

    http_response_code(201);
    echo json_encode(['success' => true, 'id' => $id, 'name' => $name, 'description' => $description]);
}

/**
 * Оновити існуючу тему
 * PUT /api/topics.php
 * Body: { id, name, description }
 */
function updateTopic(): void {
    $data = json_decode(file_get_contents('php://input'), true);
    $id          = (int)($data['id'] ?? 0);
    $name        = trim($data['name'] ?? '');
    $description = trim($data['description'] ?? '');

    if (!$id || empty($name)) {
        http_response_code(400);
        echo json_encode(['error' => 'ID та назва теми обов\'язкові']);
        return;
    }

    $pdo  = getDbConnection();
    $stmt = $pdo->prepare('UPDATE topics SET name = ?, description = ? WHERE id = ?');
    $stmt->execute([$name, $description, $id]);

    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['error' => 'Тема не знайдена']);
        return;
    }

    echo json_encode(['success' => true]);
}

/**
 * Видалити тему
 * DELETE /api/topics.php
 * Body: { id }
 */
function deleteTopic(): void {
    $data = json_decode(file_get_contents('php://input'), true);
    $id   = (int)($data['id'] ?? 0);

    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'ID теми обов\'язковий']);
        return;
    }

    $pdo  = getDbConnection();
    $stmt = $pdo->prepare('DELETE FROM topics WHERE id = ?');
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['error' => 'Тема не знайдена']);
        return;
    }

    echo json_encode(['success' => true]);
}
