<?php
declare(strict_types=1);

final class Auth {
    public static function userId(): int {
        session_start();
        if (empty($_SESSION['user_id'])) Http::fail('Authentication required.', 401);
        return (int) $_SESSION['user_id'];
    }
    public static function login(int $id): void { session_start(); session_regenerate_id(true); $_SESSION['user_id'] = $id; }
    public static function logout(): void { session_start(); $_SESSION = []; session_destroy(); }
}
