<?php
/**
 * Copy this file to save-config.php (same folder) and edit it.
 * save-config.php is never overwritten when you upload a new build of the map.
 *
 * mode 'wordpress': only people logged in to your WordPress site (with the capability below) can edit & publish.
 *                   The map must live on the same domain as WordPress, e.g. barzokhouse.com/map/.
 * mode 'password' : a single shared password (use a long random one).
 */
return [
    'mode' => 'wordpress',
    'capability' => 'edit_pages',   // 'manage_options' = administrators only; 'edit_pages' = editors + admins
    'wp_load' => null,              // e.g. '/home/USER/public_html/wp-load.php' — only if it is not found automatically
    'password' => 'CHANGE-ME',      // used only when mode is 'password'
];
