<?php
/**
 * Saves media.json for the Barzok map (called by the admin panel's "Save to host" button).
 *
 * SETUP: put this file next to index.html (the same folder as media.json) and change the
 * password below to a long random one. Whoever knows it can change the media of the map.
 * The previous version is kept as media.backup.json.
 */
$PASSWORD = 'CHANGE-ME';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function fail($code, $msg) {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'POST only');
if ($PASSWORD === 'CHANGE-ME') fail(500, 'Set a password inside save-media.php first');

$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in) || !isset($in['password']) || !hash_equals($PASSWORD, (string)$in['password'])) {
    usleep(500000);
    fail(403, 'Wrong password');
}
if (!isset($in['media']) || !is_array($in['media'])) fail(400, 'No media');

function clean_url($u) {
    $u = trim((string)$u);
    if (strlen($u) > 600) return null;
    if (preg_match('#^https?://[^\s<>"\']+$#i', $u)) return $u;
    if (preg_match('#^[A-Za-z0-9_\-./%]+$#', $u) && strpos($u, '..') === false) return $u; // relative file on this host
    return null;
}
function clean_text($t) { return mb_substr(trim((string)$t), 0, 200); }

$out = [];
foreach ($in['media'] as $placeId => $m) {
    if (!preg_match('/^[a-z0-9-]{1,80}$/', (string)$placeId) || !is_array($m)) continue;
    $entry = [];
    foreach (['photos' => 'captionFa', 'audio' => 'titleFa', 'videos' => 'titleFa'] as $kind => $textKey) {
        if (empty($m[$kind]) || !is_array($m[$kind])) continue;
        $list = [];
        foreach ($m[$kind] as $item) {
            if (!is_array($item)) continue;
            $url = clean_url($item['url'] ?? '');
            if ($url === null) continue;
            $row = ['url' => $url, $textKey => clean_text($item[$textKey] ?? '')];
            if ($kind === 'photos' && !empty($item['captionEn'])) $row['captionEn'] = clean_text($item['captionEn']);
            $list[] = $row;
        }
        if ($list) $entry[$kind] = $list;
    }
    if ($entry) $out[$placeId] = $entry;
}

$file = __DIR__ . '/media.json';
if (file_exists($file)) @copy($file, __DIR__ . '/media.backup.json');
$json = json_encode($out ?: new stdClass(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
$tmp = $file . '.tmp';
if (file_put_contents($tmp, $json, LOCK_EX) === false || !rename($tmp, $file)) {
    fail(500, 'Could not write media.json (check folder permissions)');
}
echo json_encode(['ok' => true, 'places' => count($out)]);
