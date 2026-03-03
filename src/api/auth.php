<?php
/**
 * API авторизації: реєстрація, вхід, перевірка сесії, вихід
 * Підтримує дії: register, login, check, logout
 */

// Підключаємо конфігурацію БД
require_once __DIR__ . '/../config/database.php';

// Налаштування заголовків
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Обробка preflight-запитів CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Запуск сесії
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Визначаємо дію з параметра запиту
$action = $_GET['action'] ?? '';

// Маршрутизація запитів за дією
switch ($action) {
    case 'register':
        handleRegister();
        break;
    case 'login':
        handleLogin();
        break;
    case 'check':
        handleCheck();
        break;
    case 'logout':
        handleLogout();
        break;
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Невідома дія']);
}

/**
 * Реєстрація нового користувача
 * POST ?action=register
 * Body: { username, password }
 */
function handleRegister(): void {
    // Отримуємо дані з тіла запиту
    $data = json_decode(file_get_contents('php://input'), true);
    $username = trim($data['username'] ?? '');
    $password = $data['password'] ?? '';

    // Валідація вхідних даних
    if (empty($username) || empty($password)) {
        http_response_code(400);
        echo json_encode(['error' => "Ім'я користувача та пароль обов'язкові"]);
        return;
    }

    // Перевірка довжини імені користувача
    if (strlen($username) < 3 || strlen($username) > 100) {
        http_response_code(400);
        echo json_encode(['error' => "Ім'я користувача має бути від 3 до 100 символів"]);
        return;
    }

    // Перевірка довжини пароля
    if (strlen($password) < 4) {
        http_response_code(400);
        echo json_encode(['error' => 'Пароль має бути мінімум 4 символи']);
        return;
    }

    $pdo = getDbConnection();

    // Перевіряємо унікальність імені користувача
    $stmt = $pdo->prepare('SELECT id FROM users WHERE username = ?');
    $stmt->execute([$username]);
    if ($stmt->fetch()) {
        http_response_code(409);
        echo json_encode(['error' => 'Користувач з таким іменем вже існує']);
        return;
    }

    // Хешуємо пароль за допомогою bcrypt
    $passwordHash = password_hash($password, PASSWORD_BCRYPT);

    // Додаємо нового користувача
    $stmt = $pdo->prepare(
        'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)'
    );
    $stmt->execute([$username, $passwordHash, 'student']);
    $userId = (int)$pdo->lastInsertId();

    // Автоматичний вхід після реєстрації
    $_SESSION['user_id']   = $userId;
    $_SESSION['username']  = $username;
    $_SESSION['user_role'] = 'student';

    echo json_encode([
        'success'  => true,
        'user'     => [
            'id'       => $userId,
            'username' => $username,
            'role'     => 'student',
        ],
    ]);
}

/**
 * Вхід існуючого користувача
 * POST ?action=login
 * Body: { username, password }
 */
function handleLogin(): void {
    $data = json_decode(file_get_contents('php://input'), true);
    $username = trim($data['username'] ?? '');
    $password = $data['password'] ?? '';

    if (empty($username) || empty($password)) {
        http_response_code(400);
        echo json_encode(['error' => "Ім'я користувача та пароль обов'язкові"]);
        return;
    }

    $pdo = getDbConnection();

    // Шукаємо користувача в БД
    $stmt = $pdo->prepare('SELECT id, username, password_hash, role FROM users WHERE username = ?');
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    // Перевіряємо пароль
    if (!$user || !password_verify($password, $user['password_hash'])) {
        http_response_code(401);
        echo json_encode(['error' => "Невірне ім'я користувача або пароль"]);
        return;
    }

    // Зберігаємо дані в сесії
    $_SESSION['user_id']   = (int)$user['id'];
    $_SESSION['username']  = $user['username'];
    $_SESSION['user_role'] = $user['role'];

    echo json_encode([
        'success' => true,
        'user'    => [
            'id'       => (int)$user['id'],
            'username' => $user['username'],
            'role'     => $user['role'],
        ],
    ]);
}

/**
 * Перевірка поточної сесії
 * GET ?action=check
 */
function handleCheck(): void {
    if (!empty($_SESSION['user_id'])) {
        echo json_encode([
            'authenticated' => true,
            'user'          => [
                'id'       => $_SESSION['user_id'],
                'username' => $_SESSION['username'],
                'role'     => $_SESSION['user_role'],
            ],
        ]);
    } else {
        echo json_encode(['authenticated' => false]);
    }
}

/**
 * Вихід з системи
 * POST ?action=logout
 */
function handleLogout(): void {
    // Очищаємо дані сесії
    $_SESSION = [];

    // Знищуємо cookie сесії
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            time() - 42000,
            $params['path'],
            $params['domain'],
            $params['secure'],
            $params['httponly']
        );
    }

    // Знищуємо сесію
    session_destroy();

    echo json_encode(['success' => true]);
}
