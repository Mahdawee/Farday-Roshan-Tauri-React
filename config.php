<?php
/**
 * تنظیمات اتصال به دیتابیس — سیستم مدیریت فردای روشن
 * ---------------------------------------------------------------------------
 * این فایل روی کمپیوتر محلی (Local) و همچنان روی هاست کار می‌کند.
 * اگر خواستید تنظیمات را تغییر دهید، بهترین راه این است که فایل
 * config.local.php را بسازید و مقادیر را در آن بنویسید؛
 * مقادیر آن روی این فایل اولویت دارد.
 *
 * نمونه (config.local.php):
 *   <?php return ['db_name' => 'farday_roshan', 'db_user' => 'root', 'db_pass' => '1234'];
 */

$config = [
    // ---- دیتابیس ----
    'db_host'    => '127.0.0.1',
    'db_port'    => 3306,
    'db_name'    => 'farday_roshan',
    'db_user'    => 'root',
    'db_pass'    => '',
    'db_charset' => 'utf8mb4',

    // ---- عمومی ----
    'app_name'   => 'سیستم مدیریت فردای روشن',
    'timezone'   => 'Asia/Kabul',
    // بازه زمانی برای «باقی مانده بدهی» بر اساس تاریخ سیستم؛ خالی = همه
    'session_name' => 'FR_SYSTEM',
];

$localFile = __DIR__ . '/config.local.php';
if (is_file($localFile)) {
    $local = require $localFile;
    if (is_array($local)) {
        $config = array_merge($config, $local);
    }
}

return $config;
