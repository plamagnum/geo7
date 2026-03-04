<?php
/**
 * API онлайн-сесій користувачів (тільки для адміна)
 * GET                      — список онлайн-сесій (з фільтром по class_id)
 * GET ?action=online        — список учнів, що зараз онлайн
 * GET ?action=history&user_id=X — історія входів/виходів конкретного учня
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

// Запуск сесії для перевірки авторизації
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Тільки адміністратор має доступ
if (empty($_SESSION['user_role']) || $_SESSION['user_role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['error' => 'Доступ заборонено']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Метод не підтримується']);
    exit;
}

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'online':
        getOnlineStudents();
        break;
    case 'history':
        getUserHistory();
        break;
    default:
        getSessions();
}

/**
 * Список поточних онлайн-сесій (з фільтром по class_id)
 * GET /api/sessions.php
 * GET /api/sessions.php?class_id=1
 */
function getSessions(): void {
    $pdo      = getDbConnection();
    $classId  = isset($_GET['class_id']) ? (int)$_GET['class_id'] : 0;

    // Учень вважається онлайн, якщо is_online=1 і last_activity < 5 хвилин тому
    $sql = 'SELECT us.id, us.user_id, u.username, c.name AS class_name,
                   us.login_at, us.logout_at, us.last_activity,
                   us.is_online,
                   (us.is_online = 1 AND us.last_activity >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)) AS is_active
            FROM user_sessions us
            JOIN users u ON u.id = us.user_id
            LEFT JOIN classes c ON c.id = u.class_id';

    if ($classId) {
        $sql .= ' WHERE u.class_id = ?';
        $stmt = $pdo->prepare($sql . ' ORDER BY us.last_activity DESC');
        $stmt->execute([$classId]);
    } else {
        $stmt = $pdo->prepare($sql . ' ORDER BY us.last_activity DESC');
        $stmt->execute();
    }

    $sessions = $stmt->fetchAll();

    // Конвертуємо числові та булеві поля
    foreach ($sessions as &$s) {
        $s['id']        = (int)$s['id'];
        $s['user_id']   = (int)$s['user_id'];
        $s['is_online']  = (bool)$s['is_online'];
        $s['is_active']  = (bool)$s['is_active'];
    }

    echo json_encode($sessions);
}

/**
 * Список учнів, що зараз онлайн
 * GET /api/sessions.php?action=online
 * GET /api/sessions.php?action=online&class_id=1
 */
function getOnlineStudents(): void {
    $pdo     = getDbConnection();
    $classId = isset($_GET['class_id']) ? (int)$_GET['class_id'] : 0;

    // Отримуємо останню сесію кожного користувача
    $sql = 'SELECT u.id AS user_id, u.username, c.name AS class_name,
                   us.login_at, us.logout_at, us.last_activity,
                   us.is_online,
                   (us.is_online = 1 AND us.last_activity >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)) AS is_active
            FROM users u
            LEFT JOIN (
                SELECT s1.*
                FROM user_sessions s1
                INNER JOIN (
                    SELECT user_id, MAX(id) AS max_id
                    FROM user_sessions
                    GROUP BY user_id
                ) s2 ON s1.id = s2.max_id
            ) us ON us.user_id = u.id
            LEFT JOIN classes c ON c.id = u.class_id
            WHERE u.role = "student"';

    if ($classId) {
        $sql .= ' AND u.class_id = ?';
        $stmt = $pdo->prepare($sql . ' ORDER BY is_active DESC, us.last_activity DESC');
        $stmt->execute([$classId]);
    } else {
        $stmt = $pdo->prepare($sql . ' ORDER BY is_active DESC, us.last_activity DESC');
        $stmt->execute();
    }

    $students = $stmt->fetchAll();

    // Конвертуємо числові та булеві поля
    foreach ($students as &$s) {
        $s['user_id']   = (int)$s['user_id'];
        $s['is_online']  = (bool)($s['is_online'] ?? false);
        $s['is_active']  = (bool)($s['is_active'] ?? false);
    }

    echo json_encode($students);
}

/**
 * Історія входів/виходів конкретного учня
 * GET /api/sessions.php?action=history&user_id=X
 */
function getUserHistory(): void {
    $userId = (int)($_GET['user_id'] ?? 0);

    if (!$userId) {
        http_response_code(400);
        echo json_encode(['error' => 'user_id обов\'язковий']);
        return;
    }

    $pdo  = getDbConnection();
    $stmt = $pdo->prepare(
        'SELECT us.id, us.login_at, us.logout_at, us.last_activity, us.is_online
         FROM user_sessions us
         WHERE us.user_id = ?
         ORDER BY us.login_at DESC
         LIMIT 100'
    );
    $stmt->execute([$userId]);
    $history = $stmt->fetchAll();

    // Конвертуємо поля
    foreach ($history as &$h) {
        $h['id']       = (int)$h['id'];
        $h['is_online'] = (bool)$h['is_online'];
    }

    echo json_encode($history);
}
