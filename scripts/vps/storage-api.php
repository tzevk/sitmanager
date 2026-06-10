<?php
// Simple file storage API used by the Next.js app to read/write student
// documents stored on this server (since the app's hosting platform has
// no direct filesystem access to this machine).
//
// Deploy: upload this file to /home/user/public_html/storage-api.php
// (served at https://accentapp.in/storage-api.php)
//
// Files are stored under /home/user/public_html/uploads/student_document/{studentId}/{filename}

$SECRET = 'e74d79822931aa762fbef52c2a92c03296513547b2b3efbd';
$BASE_DIR = '/home/user/public_html/uploads/student_document';

header('X-Content-Type-Options: nosniff');

$secret = $_SERVER['HTTP_X_STORAGE_SECRET'] ?? ($_GET['secret'] ?? '');
if (!hash_equals($SECRET, (string) $secret)) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

function sanitize_path($value) {
    $value = str_replace('\\', '/', (string) $value);
    $parts = explode('/', $value);
    $clean = [];
    foreach ($parts as $part) {
        if ($part === '' || $part === '.' || $part === '..') continue;
        $part = preg_replace('/[^a-zA-Z0-9._-]/', '', $part);
        if ($part !== '') $clean[] = $part;
    }
    return implode('/', $clean);
}

$relPath = sanitize_path($_GET['path'] ?? '');
if ($relPath === '') {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Missing path']);
    exit;
}

$fullPath = $BASE_DIR . '/' . $relPath;
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    if (!is_file($fullPath)) {
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Not found']);
        exit;
    }
    $mime = mime_content_type($fullPath) ?: 'application/octet-stream';
    header('Content-Type: ' . $mime);
    header('Content-Length: ' . filesize($fullPath));
    header('Content-Disposition: inline; filename="' . basename($fullPath) . '"');
    readfile($fullPath);
    exit;
}

if ($method === 'POST') {
    $dir = dirname($fullPath);
    if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Could not create directory']);
        exit;
    }

    $input = file_get_contents('php://input');
    if ($input === false || strlen($input) === 0) {
        http_response_code(400);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Empty body']);
        exit;
    }

    if (file_put_contents($fullPath, $input) === false) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Write failed']);
        exit;
    }

    header('Content-Type: application/json');
    echo json_encode(['ok' => true, 'bytes' => strlen($input)]);
    exit;
}

http_response_code(405);
header('Content-Type: application/json');
echo json_encode(['error' => 'Method not allowed']);
