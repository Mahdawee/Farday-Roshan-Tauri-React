<?php
/**
 * کتابخانه پشتیبان‌گیری — مشترک بین صفحه «پشتیبان‌گیری» و اسکریپت خط فرمان
 */
if (!defined('FR_ROOT')) {
    define('FR_ROOT', dirname(__DIR__));
}

/** ساخت فایل پشتیبان با استفاده از PHP (بدون mysqldump) */
function create_backup(string $dir): string
{
    $tables = [];
    foreach (Db::all('SHOW TABLES') as $row) {
        $tables[] = array_values($row)[0];
    }
    $sql = "-- پشتیبان دیتابیس سیستم فردای روشن\n-- تاریخ: " . date('Y-m-d H:i:s') . "\n"
         . "SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\n\n";
    foreach ($tables as $t) {
        $create = Db::one('SHOW CREATE TABLE `' . $t . '`');
        $sql .= "DROP TABLE IF EXISTS `$t`;\n" . array_values($create)[1] . ";\n\n";
        $rows = Db::all('SELECT * FROM `' . $t . '`');
        if ($rows) {
            $chunks = array_chunk($rows, 200);
            foreach ($chunks as $chunk) {
                $cols = array_keys($chunk[0]);
                $sql .= 'INSERT INTO `' . $t . '` (`' . implode('`,`', $cols) . '`) VALUES ';
                $vals = [];
                foreach ($chunk as $r) {
                    $v = [];
                    foreach ($r as $val) {
                        $v[] = $val === null ? 'NULL' : Db::pdo()->quote((string) $val);
                    }
                    $vals[] = '(' . implode(',', $v) . ')';
                }
                $sql .= implode(",\n", $vals) . ";\n";
            }
        }
        $sql .= "\n";
    }
    $sql .= "SET FOREIGN_KEY_CHECKS=1;\n";
    $name = 'backup-' . date('Y-m-d_His') . '.sql';
    file_put_contents($dir . '/' . $name, $sql);
    return $name;
}
