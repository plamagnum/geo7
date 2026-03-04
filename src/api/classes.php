<?php
/**
 * API управління класами (CRUD)
 * GET    — список всіх класів
 * POST   — створити клас (адмін)
 * PUT    — оновити клас (адмін)
 * DELETE — видалити клас (адмін)
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
        getClasses();
        break;
    case 'POST':
        requireAdmin();
        createClass();
        break;
    case 'PUT':
        requireAdmin();
        updateClass();
        break;
    case 'DELETE':
        requireAdmin();
        deleteClass();
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
 * Отримати список всіх класів з кількістю учнів
 * GET /api/classes.php
 */
function getClasses(): void {
    $pdo  = getDbConnection();
    $stmt = $pdo->query(
        'SELECT c.id, c.name, c.description, c.created_at,
                COUNT(u.id) AS student_count
         FROM classes c
         LEFT JOIN users u ON u.class_id = c.id
         GROUP BY c.id
         ORDER BY c.id ASC'
    );
    $classes = $stmt->fetchAll();

    // Конвертуємо числові поля
    foreach ($classes as &$class) {
        $class['id']            = (int)$class['id'];
        $class['student_count'] = (int)$class['student_count'];
    }

    echo json_encode($classes);
}

/**
 * Створити новий клас
 * POST /api/classes.php
 * Body: { name, description }
 */
function createClass(): void {
    $data        = json_decode(file_get_contents('php://input'), true);
    $name        = trim($data['name'] ?? '');
    $description = trim($data['description'] ?? '');

    if (empty($name)) {
        http_response_code(400);
        echo json_encode(['error' => 'Назва класу обов\'язкова']);
        return;
    }

    $pdo  = getDbConnection();
    $stmt = $pdo->prepare('INSERT INTO classes (name, description) VALUES (?, ?)');
    $stmt->execute([$name, $description]);
    $id = (int)$pdo->lastInsertId();

    http_response_code(201);
    echo json_encode(['success' => true, 'id' => $id, 'name' => $name, 'description' => $description]);
}

/**
 * Оновити існуючий клас
 * PUT /api/classes.php
 * Body: { id, name, description }
 */
function updateClass(): void {
    $data        = json_decode(file_get_contents('php://input'), true);
    $id          = (int)($data['id'] ?? 0);
    $name        = trim($data['name'] ?? '');
    $description = trim($data['description'] ?? '');

    if (!$id || empty($name)) {
        http_response_code(400);
        echo json_encode(['error' => 'ID та назва класу обов\'язкові']);
        return;
    }

    $pdo  = getDbConnection();
    $stmt = $pdo->prepare('UPDATE classes SET name = ?, description = ? WHERE id = ?');
    $stmt->execute([$name, $description, $id]);

    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['error' => 'Клас не знайдено']);
        return;
    }

    echo json_encode(['success' => true]);
}

/**
 * Видалити клас
 * DELETE /api/classes.php
 * Body: { id }
 */
function deleteClass(): void {
    $data = json_decode(file_get_contents('php://input'), true);
    $id   = (int)($data['id'] ?? 0);

    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'ID класу обов\'язковий']);
        return;
    }

    $pdo  = getDbConnection();
    $stmt = $pdo->prepare('DELETE FROM classes WHERE id = ?');
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['error' => 'Клас не знайдено']);
        return;
    }

    echo json_encode(['success' => true]);
}
