<?php
declare(strict_types=1);

final class Http {
    public static function body(): array { return json_decode(file_get_contents('php://input'), true) ?: []; }
    public static function respond(mixed $data, int $status = 200): never {
        http_response_code($status); header('Content-Type: application/json'); echo json_encode($data); exit;
    }
    public static function fail(string $message, int $status = 422): never { self::respond(['error' => $message], $status); }
}
