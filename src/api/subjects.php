<?php
/**
 * API управління предметами (CRUD)
 * GET    — список всіх предметів
 * POST   — створити предмет (адмін)
 * PUT    — оновити предмет (адмін)
 * DELETE — видалити предмет (адмін)
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
        getSubjects();
        break;
    case 'POST':
        requireAdmin();
        createSubject();
        break;
    case 'PUT':
        requireAdmin();
        updateSubject();
        break;
    case 'DELETE':
        requireAdmin();
        deleteSubject();
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
 * Отримати список всіх предметів з кількістю тем
 * GET /api/subjects.php
 */
function getSubjects(): void {
    $pdo  = getDbConnection();
    $stmt = $pdo->query(
        'SELECT s.id, s.name, s.description, s.created_at,
                COUNT(t.id) AS topic_count
         FROM subjects s
         LEFT JOIN topics t ON t.subject_id = s.id
         GROUP BY s.id
         ORDER BY s.id ASC'
    );
    $subjects = $stmt->fetchAll();

    // Конвертуємо числові поля
    foreach ($subjects as &$subject) {
        $subject['id']          = (int)$subject['id'];
        $subject['topic_count'] = (int)$subject['topic_count'];
    }

    echo json_encode($subjects);
}

/**
 * Створити новий предмет
 * POST /api/subjects.php
 * Body: { name, description }
 */
function createSubject(): void {
    $data        = json_decode(file_get_contents('php://input'), true);
    $name        = trim($data['name'] ?? '');
    $description = trim($data['description'] ?? '');

    if (empty($name)) {
        http_response_code(400);
        echo json_encode(['error' => 'Назва предмету обов\'язкова']);
        return;
    }

    $pdo  = getDbConnection();
    $stmt = $pdo->prepare('INSERT INTO subjects (name, description) VALUES (?, ?)');
    $stmt->execute([$name, $description]);
    $id = (int)$pdo->lastInsertId();

    http_response_code(201);
    echo json_encode(['success' => true, 'id' => $id, 'name' => $name, 'description' => $description]);
}

/**
 * Оновити існуючий предмет
 * PUT /api/subjects.php
 * Body: { id, name, description }
 */
function updateSubject(): void {
    $data        = json_decode(file_get_contents('php://input'), true);
    $id          = (int)($data['id'] ?? 0);
    $name        = trim($data['name'] ?? '');
    $description = trim($data['description'] ?? '');

    if (!$id || empty($name)) {
        http_response_code(400);
        echo json_encode(['error' => 'ID та назва предмету обов\'язкові']);
        return;
    }

    $pdo  = getDbConnection();
    $stmt = $pdo->prepare('UPDATE subjects SET name = ?, description = ? WHERE id = ?');
    $stmt->execute([$name, $description, $id]);

    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['error' => 'Предмет не знайдено']);
        return;
    }

    echo json_encode(['success' => true]);
}

/**
 * Видалити предмет
 * DELETE /api/subjects.php
 * Body: { id }
 */
function deleteSubject(): void {
    $data = json_decode(file_get_contents('php://input'), true);
    $id   = (int)($data['id'] ?? 0);

    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'ID предмету обов\'язковий']);
        return;
    }

    $pdo  = getDbConnection();
    $stmt = $pdo->prepare('DELETE FROM subjects WHERE id = ?');
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['error' => 'Предмет не знайдено']);
        return;
    }

    echo json_encode(['success' => true]);
}
