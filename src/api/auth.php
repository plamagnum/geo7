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
 * Body: { username, password, class_id }
 */
function handleRegister(): void {
    // Отримуємо дані з тіла запиту
    $data     = json_decode(file_get_contents('php://input'), true);
    $username = trim($data['username'] ?? '');
    $password = $data['password'] ?? '';
    $classId  = isset($data['class_id']) && $data['class_id'] !== '' ? (int)$data['class_id'] : null;

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

    // Додаємо нового користувача з вибраним класом
    $stmt = $pdo->prepare(
        'INSERT INTO users (username, password_hash, role, class_id) VALUES (?, ?, ?, ?)'
    );
    $stmt->execute([$username, $passwordHash, 'student', $classId]);
    $userId = (int)$pdo->lastInsertId();

    // Автоматичний вхід після реєстрації
    $_SESSION['user_id']   = $userId;
    $_SESSION['username']  = $username;
    $_SESSION['user_role'] = 'student';

    // Створюємо запис сесії
    createUserSession($pdo, $userId);

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

    // Створюємо запис сесії для відстеження онлайн-статусу
    createUserSession($pdo, (int)$user['id']);

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
 * Перевірка поточної сесії та оновлення last_activity
 * GET ?action=check
 */
function handleCheck(): void {
    if (!empty($_SESSION['user_id'])) {
        // Оновлюємо last_activity у всіх активних сесіях користувача
        try {
            $pdo  = getDbConnection();
            $stmt = $pdo->prepare(
                'UPDATE user_sessions SET last_activity = NOW()
                 WHERE user_id = ? AND is_online = 1'
            );
            $stmt->execute([$_SESSION['user_id']]);
        } catch (Exception $e) {
            // Не критична помилка — логуємо та продовжуємо
            error_log('Помилка оновлення last_activity: ' . $e->getMessage());
        }

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
    // Закриваємо активну сесію в БД
    if (!empty($_SESSION['user_id'])) {
        try {
            $pdo  = getDbConnection();
            $stmt = $pdo->prepare(
                'UPDATE user_sessions SET is_online = 0, logout_at = NOW()
                 WHERE user_id = ? AND is_online = 1'
            );
            $stmt->execute([$_SESSION['user_id']]);
        } catch (Exception $e) {
            error_log('Помилка закриття сесії: ' . $e->getMessage());
        }
    }

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

/**
 * Створити новий запис онлайн-сесії для користувача
 * Закриває всі попередні активні сесії
 */
function createUserSession(PDO $pdo, int $userId): void {
    try {
        // Закриваємо попередні активні сесії
        $stmt = $pdo->prepare(
            'UPDATE user_sessions SET is_online = 0, logout_at = NOW()
             WHERE user_id = ? AND is_online = 1'
        );
        $stmt->execute([$userId]);

        // Створюємо новий запис сесії
        $stmt = $pdo->prepare(
            'INSERT INTO user_sessions (user_id, is_online) VALUES (?, 1)'
        );
        $stmt->execute([$userId]);
    } catch (Exception $e) {
        error_log('Помилка створення сесії: ' . $e->getMessage());
    }
}
