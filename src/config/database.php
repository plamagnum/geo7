<?php
/**
 * Конфігурація підключення до бази даних через PDO
 * Використовуємо змінні середовища для гнучкого налаштування
 */

// Параметри підключення з env або значення за замовчуванням
$dbHost = getenv('DB_HOST') ?: 'mysql';
$dbPort = getenv('DB_PORT') ?: '3306';
$dbName = getenv('DB_NAME') ?: 'geo7';
$dbUser = getenv('DB_USER') ?: 'geo7user';
$dbPass = getenv('DB_PASS') ?: 'geo7pass';

// DSN рядок для PDO
$dsn = "mysql:host={$dbHost};port={$dbPort};dbname={$dbName};charset=utf8mb4";

// Налаштування PDO
$pdoOptions = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,   // кидати виключення при помилках
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,          // повертати асоціативні масиви
    PDO::ATTR_EMULATE_PREPARES   => false,                     // використовувати нативні prepared statements
];

/**
 * Функція для отримання підключення до БД
 * Повертає PDO об'єкт або кидає виключення
 */
function getDbConnection(): PDO {
    global $dsn, $dbUser, $dbPass, $pdoOptions;
    try {
        $pdo = new PDO($dsn, $dbUser, $dbPass, $pdoOptions);
        // Примусово встановлюємо кодування UTF-8 для коректної роботи з кирилицею
        $pdo->exec("SET NAMES utf8mb4");
        return $pdo;
    } catch (PDOException $e) {
        // Логуємо помилку та повертаємо зрозуміле повідомлення
        error_log("Помилка підключення до БД: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Помилка підключення до бази даних']);
        exit;
    }
}
