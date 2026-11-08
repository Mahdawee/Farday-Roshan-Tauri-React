<?php
/**
 * دانلود امن فایل پشتیبان (فقط مدیر)
 */
require_once __DIR__ . '/app/bootstrap.php';
app_boot();
require_admin();

$dir  = FR_ROOT . '/backups';
$name = basename((string) get('name'));
$path = $dir . '/' . $name;

if ($name === '' || !preg_match('/^[A-Za-z0-9_\-\.]+\.sql$/', $name) || !is_file($path)) {
    flash('فایل پشتیبان یافت نشد.', 'error');
    redirect('backup.php');
}

log_activity('backup', 'database', null, 'دانلود فایل پشتیبان ' . $name);

header('Content-Type: application/sql; charset=UTF-8');
header('Content-Length: ' . filesize($path));
header('Content-Disposition: attachment; filename="' . $name . '"');
header('Cache-Control: no-store');
readfile($path);
exit;
