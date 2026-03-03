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
 * Отримати список всіх користувачів
 */
function getUsers(): void {
    $pdo  = getDbConnection();
    $stmt = $pdo->query(
        'SELECT id, username, role, created_at FROM users ORDER BY id ASC'
    );
    $users = $stmt->fetchAll();

    foreach ($users as &$u) {
        $u['id'] = (int)$u['id'];
    }

    echo json_encode($users);
}

/**
 * Змінити роль користувача
 * PUT Body: { id, role }
 */
function updateUserRole(): void {
    $data    = json_decode(file_get_contents('php://input'), true);
    $id      = (int)($data['id'] ?? 0);
    $role    = $data['role'] ?? '';
    $adminId = (int)$_SESSION['user_id'];

    if (!$id || !in_array($role, ['student', 'admin'])) {
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
