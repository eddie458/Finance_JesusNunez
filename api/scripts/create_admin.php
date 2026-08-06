<?php
declare(strict_types=1);

require dirname(__DIR__) . '/src/Database.php';

if ($argc < 3) {
    fwrite(STDERR, "Usage: php api/scripts/create_admin.php <email> <password> [currency]\n");
    exit(1);
}

[$script, $email, $password, $currency] = $argv + [null, null, null, 'MXN'];
$email = filter_var($email, FILTER_VALIDATE_EMAIL);
$currency = strtoupper($currency);
if (!$email || strlen($password) < 8 || !preg_match('/^[A-Z]{3}$/', $currency)) {
    fwrite(STDERR, "Use a valid email, a password of at least 8 characters, and a 3-letter currency.\n");
    exit(1);
}

$pdo = Database::connection();
$find = $pdo->prepare('SELECT id FROM users WHERE email = ?');
$find->execute([$email]);
$existing = $find->fetch();
if ($existing) {
    $pdo->prepare("UPDATE users SET password_hash = ?, base_currency = ?, role = 'admin' WHERE id = ?")
        ->execute([password_hash($password, PASSWORD_DEFAULT), $currency, $existing['id']]);
    echo "Promoted $email to administrator.\n";
} else {
    $pdo->prepare("INSERT INTO users (email, password_hash, base_currency, role) VALUES (?, ?, ?, 'admin')")
        ->execute([$email, password_hash($password, PASSWORD_DEFAULT), $currency]);
    echo "Created administrator $email.\n";
}
