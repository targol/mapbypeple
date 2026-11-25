<?php
/** Tells the map whether the current visitor may edit (used to show / hide the admin panel). */
require __DIR__ . '/auth-lib.php';
$c = barzok_config();
$r = ['mode' => $c['mode'], 'canEdit' => false, 'loggedIn' => false, 'name' => '', 'loginUrl' => ''];
if ($c['mode'] === 'wordpress') $r = array_merge($r, barzok_wp_check($c));
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
echo json_encode($r, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
