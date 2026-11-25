<?php
/**
 * Saves data for the Barzok map (called by the admin panel's save/publish buttons):
 *   target "media" -> media.json (photos, audio, video of places)
 *   target "data"  -> data.json  (all places, layers, people, stories, events, routes)
 *
 * SETUP: copy save-config.sample.php to save-config.php and choose WordPress-login or password mode. The previous version of each file is kept as *.backup.json.
 */
require __DIR__ . '/auth-lib.php';
$CFG = barzok_config();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function fail($code, $msg) {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'POST only');
$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in)) fail(400, 'Bad request');
if ($CFG['mode'] === 'wordpress') {
    // cookie login: the custom header cannot be sent by other websites, which blocks cross-site forgery
    if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'barzok') fail(403, 'Bad request header');
    $chk = barzok_wp_check($CFG);
    if ($chk['error']) fail(500, $chk['error']);
    if (!$chk['canEdit']) fail(403, 'برای ذخیره باید در سایت وردپرس وارد شده باشید');
} else {
    if ($CFG['password'] === 'CHANGE-ME') fail(500, 'Create save-config.php first (see save-config.sample.php)');
    if (!isset($in['password']) || !hash_equals($CFG['password'], (string)$in['password'])) {
        usleep(500000);
        fail(403, 'Wrong password');
    }
}
$target = $in['target'] ?? 'media';

if ($target === 'data') {
    if (!isset($in['data']) || !is_array($in['data'])
        || !isset($in['data']['places']) || !is_array($in['data']['places'])
        || !isset($in['data']['layers']) || !is_array($in['data']['layers'])) fail(400, 'Bad data');
    unset($in['data']['contributions'], $in['data']['media']); // visitors' private submissions are never published
    $file = __DIR__ . '/data.json';
    if (file_exists($file)) @copy($file, __DIR__ . '/data.backup.json');
    $json = json_encode($in['data'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false || strlen($json) > 12 * 1024 * 1024) fail(400, 'Data too large');
    $tmp = $file . '.tmp';
    if (file_put_contents($tmp, $json, LOCK_EX) === false || !rename($tmp, $file)) {
        fail(500, 'Could not write data.json (check folder permissions)');
    }
    echo json_encode(['ok' => true, 'places' => count($in['data']['places'])]);
    exit;
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
