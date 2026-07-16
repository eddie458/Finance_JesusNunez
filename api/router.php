<?php
// PHP's built-in server router. Static assets (if any) are served normally.
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (php_sapi_name() === 'cli-server' && is_file(__DIR__ . $path)) return false;
require __DIR__ . '/index.php';
