<?php
/**
 * API управління користувачами (тільки для адміна)
 * GET    — список користувачів
 * PUT    — зміна ролі
 * DELETE — видалення користувача
 */

require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Тільки адміністратор має доступ
if (empty($_SESSION['user_role']) || $_SESSION['user_role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['error' => 'Доступ заборонено']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        getUsers();
        break;
    case 'PUT':
        updateUserRole();
        break;
    case 'DELETE':
        deleteUser();
        break;
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Метод не підтримується']);
}

/**
 * Отримати список всіх користувачів (з назвою класу)
 */
function getUsers(): void {
    $pdo  = getDbConnection();
    $stmt = $pdo->query(
        'SELECT u.id, u.username, u.role, u.class_id, c.name AS class_name, u.created_at
         FROM users u
         LEFT JOIN classes c ON c.id = u.class_id
         ORDER BY u.id ASC'
    );
    $users = $stmt->fetchAll();

    foreach ($users as &$u) {
        $u['id']       = (int)$u['id'];
        $u['class_id'] = $u['class_id'] !== null ? (int)$u['class_id'] : null;
    }

    echo json_encode($users);
}

/**
 * Змінити роль або клас користувача
 * PUT Body: { id, role } або { id, class_id }
 */
function updateUserRole(): void {
    $data    = json_decode(file_get_contents('php://input'), true);
    $id      = (int)($data['id'] ?? 0);
    $adminId = (int)$_SESSION['user_id'];

    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'Невірні дані']);
        return;
    }

    // Зміна класу учня
    if (array_key_exists('class_id', $data)) {
        $classId = $data['class_id'] !== null && $data['class_id'] !== '' ? (int)$data['class_id'] : null;
        $pdo     = getDbConnection();
        $stmt    = $pdo->prepare('UPDATE users SET class_id = ? WHERE id = ?');
        $stmt->execute([$classId, $id]);
        echo json_encode(['success' => true]);
        return;
    }

    $role = $data['role'] ?? '';

    if (!in_array($role, ['student', 'admin'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Невірні дані']);
        return;
    }

    // Адмін не може змінити свою власну роль
    if ($id === $adminId) {
        http_response_code(400);
        echo json_encode(['error' => 'Не можна змінити власну роль']);
        return;
    }

    $pdo  = getDbConnection();
    $stmt = $pdo->prepare('UPDATE users SET role = ? WHERE id = ?');
    $stmt->execute([$role, $id]);

    echo json_encode(['success' => true]);
}

/**
 * Видалити користувача
 * DELETE Body: { id }
 */
function deleteUser(): void {
    $data    = json_decode(file_get_contents('php://input'), true);
    $id      = (int)($data['id'] ?? 0);
    $adminId = (int)$_SESSION['user_id'];

    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'ID обов\'язковий']);
        return;
    }

    // Адмін не може видалити себе
    if ($id === $adminId) {
        http_response_code(400);
        echo json_encode(['error' => 'Не можна видалити власний акаунт']);
        return;
    }

    $pdo  = getDbConnection();
    $stmt = $pdo->prepare('DELETE FROM users WHERE id = ?');
    $stmt->execute([$id]);

    echo json_encode(['success' => true]);
}
