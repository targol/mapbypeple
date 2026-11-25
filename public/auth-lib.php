<?php
/**
 * Shared login check for auth.php and save-data.php.
 * Settings come from save-config.php (copy save-config.sample.php). That file is NOT part of the build,
 * so updating the map never overwrites your password / settings.
 */
function barzok_config() {
    static $c = null;
    if ($c !== null) return $c;
    $c = ['mode' => 'password', 'password' => 'CHANGE-ME', 'capability' => 'edit_pages', 'wp_load' => null];
    $f = __DIR__ . '/save-config.php';
    if (is_file($f)) {
        $u = include $f;
        if (is_array($u)) $c = array_merge($c, $u);
    }
    return $c;
}

function barzok_find_wp_load($c) {
    if (!empty($c['wp_load']) && is_file($c['wp_load'])) return $c['wp_load'];
    $dir = __DIR__;
    for ($i = 0; $i < 6; $i++) {
        if (is_file($dir . '/wp-load.php')) return $dir . '/wp-load.php';
        $parent = dirname($dir);
        if ($parent === $dir) break;
        $dir = $parent;
    }
    return null;
}

/** Is the visitor logged in to WordPress (cookie) and allowed to edit? */
function barzok_wp_check($c) {
    $out = ['loggedIn' => false, 'canEdit' => false, 'name' => '', 'loginUrl' => '', 'error' => ''];
    $wp = barzok_find_wp_load($c);
    if (!$wp) {
        $out['error'] = 'wp-load.php not found (set wp_load in save-config.php)';
        return $out;
    }
    require_once $wp;
    if (!function_exists('is_user_logged_in')) {
        $out['error'] = 'WordPress did not load';
        return $out;
    }
    $out['loginUrl'] = function_exists('wp_login_url') ? wp_login_url() : '';
    if (is_user_logged_in()) {
        $out['loggedIn'] = true;
        $u = wp_get_current_user();
        $out['name'] = $u && !empty($u->display_name) ? $u->display_name : '';
        $out['canEdit'] = current_user_can($c['capability']);
    }
    return $out;
}
