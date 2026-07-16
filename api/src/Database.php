<?php
declare(strict_types=1);

final class Database {
    public static function connection(): PDO {
        static $pdo = null;
        if ($pdo instanceof PDO) return $pdo;
        $envFile = dirname(__DIR__) . '/.env';
        if (is_file($envFile)) foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            if (!str_starts_with(trim($line), '#') && str_contains($line, '=')) {
                [$key, $value] = explode('=', $line, 2); $_ENV[trim($key)] = trim($value);
            }
        }
        $host = $_ENV['DB_HOST'] ?? '127.0.0.1'; $port = $_ENV['DB_PORT'] ?? '3306';
        $name = $_ENV['DB_NAME'] ?? 'finance_tracker'; $user = $_ENV['DB_USER'] ?? 'root'; $password = $_ENV['DB_PASSWORD'] ?? '';
        $pdo = new PDO("mysql:host=$host;port=$port;dbname=$name;charset=utf8mb4", $user, $password, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        return $pdo;
    }
}
