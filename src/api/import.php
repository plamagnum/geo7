<?php
/**
 * API імпорту запитань через JSON
 * POST ?source=url  — імпорт з URL
 * POST ?source=json — імпорт з вставленого JSON
 *
 * Очікуваний формат JSON:
 * {
 *   "topic": "Назва теми",
 *   "questions": [
 *     {
 *       "question": "Текст запитання?",
 *       "options": ["Варіант A", "Варіант B", "Варіант C", "Варіант D"],
 *       "correct": 0
 *     }
 *   ]
 * }
 */

require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Тільки адміністратор може імпортувати дані
if (empty($_SESSION['user_role']) || $_SESSION['user_role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['error' => 'Доступ заборонено. Потрібні права адміністратора']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Метод не підтримується']);
    exit;
}

$source = $_GET['source'] ?? '';

switch ($source) {
    case 'url':
        importFromUrl();
        break;
    case 'json':
        importFromJson();
        break;
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Вкажіть source=url або source=json']);
}

/**
 * Імпорт запитань з URL
 * Body: { url: "https://example.com/questions.json" }
 */
function importFromUrl(): void {
    $data = json_decode(file_get_contents('php://input'), true);
    $url  = trim($data['url'] ?? '');

    if (empty($url)) {
        http_response_code(400);
        echo json_encode(['error' => 'URL обов\'язковий']);
        return;
    }

    // Перевірка формату URL
    if (!filter_var($url, FILTER_VALIDATE_URL)) {
        http_response_code(400);
        echo json_encode(['error' => 'Невірний формат URL']);
        return;
    }

    // Завантажуємо JSON з URL за допомогою cURL
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS      => 3,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_USERAGENT      => 'Geo7-Import/1.0',
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error    = curl_error($ch);
    curl_close($ch);

    if ($error || $response === false) {
        http_response_code(502);
        echo json_encode(['error' => "Помилка завантаження: {$error}"]);
        return;
    }

    if ($httpCode !== 200) {
        http_response_code(502);
        echo json_encode(['error' => "HTTP помилка: {$httpCode}"]);
        return;
    }

    // Парсимо та імпортуємо JSON
    processImport($response);
}

/**
 * Імпорт запитань з вставленого JSON
 * Body: { json: "{ ... }" }
 */
function importFromJson(): void {
    $data    = json_decode(file_get_contents('php://input'), true);
    $jsonStr = $data['json'] ?? '';

    if (empty($jsonStr)) {
        http_response_code(400);
        echo json_encode(['error' => 'JSON рядок обов\'язковий']);
        return;
    }

    processImport($jsonStr);
}

/**
 * Обробка та збереження імпортованих даних
 * @param string $jsonStr — рядок JSON для парсингу
 */
function processImport(string $jsonStr): void {
    // Парсимо JSON
    $data = json_decode($jsonStr, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        echo json_encode(['error' => 'Невірний формат JSON: ' . json_last_error_msg()]);
        return;
    }

    // Валідація структури
    if (empty($data['topic']) || !isset($data['questions']) || !is_array($data['questions'])) {
        http_response_code(400);
        echo json_encode(['error' => 'JSON має містити поля "topic" та "questions"']);
        return;
    }

    $topicName = trim($data['topic']);
    $questions = $data['questions'];

    if (empty($questions)) {
        http_response_code(400);
        echo json_encode(['error' => 'Список запитань порожній']);
        return;
    }

    $pdo = getDbConnection();

    // Починаємо транзакцію для атомарного збереження
    $pdo->beginTransaction();

    try {
        // Шукаємо або створюємо тему
        $stmt = $pdo->prepare('SELECT id FROM topics WHERE name = ?');
        $stmt->execute([$topicName]);
        $topic = $stmt->fetch();

        if ($topic) {
            $topicId = (int)$topic['id'];
        } else {
            $stmt = $pdo->prepare('INSERT INTO topics (name) VALUES (?)');
            $stmt->execute([$topicName]);
            $topicId = (int)$pdo->lastInsertId();
        }

        $imported = 0;
        $errors   = [];

        // Обробляємо кожне запитання
        foreach ($questions as $index => $q) {
            $num = $index + 1;

            // Валідація обов'язкових полів
            if (empty($q['question'])) {
                $errors[] = "Запитання #{$num}: відсутній текст";
                continue;
            }

            if (!isset($q['options']) || !is_array($q['options']) || count($q['options']) < 4) {
                $errors[] = "Запитання #{$num}: потрібно 4 варіанти відповідей";
                continue;
            }

            if (!isset($q['correct']) || !is_numeric($q['correct'])) {
                $errors[] = "Запитання #{$num}: 'correct' має бути числом від 0 до 3";
                continue;
            }

            $correctInt = (int)$q['correct'];
            if ($correctInt < 0 || $correctInt > 3) {
                $errors[] = "Запитання #{$num}: 'correct' має бути числом від 0 до 3";
                continue;
            }

            // Конвертуємо індекс правильної відповіді в літеру
            $correctMap    = [0 => 'a', 1 => 'b', 2 => 'c', 3 => 'd'];
            $correctOption = $correctMap[$correctInt];

            $stmt = $pdo->prepare(
                'INSERT INTO questions
                    (topic_id, question_text, option_a, option_b, option_c, option_d, correct_option)
                 VALUES (?, ?, ?, ?, ?, ?, ?)'
            );
            $stmt->execute([
                $topicId,
                trim($q['question']),
                trim($q['options'][0]),
                trim($q['options'][1]),
                trim($q['options'][2]),
                trim($q['options'][3]),
                $correctOption,
            ]);

            $imported++;
        }

        $pdo->commit();

        echo json_encode([
            'success'  => true,
            'topic_id' => $topicId,
            'topic'    => $topicName,
            'imported' => $imported,
            'errors'   => $errors,
        ]);

    } catch (Exception $e) {
        $pdo->rollBack();
        error_log("Помилка імпорту: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Помилка збереження даних']);
    }
}
