<?php
/**
 * لایه دیتابیس (PDO) — فردای روشن
 */

class Db
{
    private static ?PDO $pdo = null;
    private static int $queries = 0;
    private static string $lastSql = '';

    /** تعداد کوئری‌های اجراشده در این درخواست (برای بررسی کارایی) */
    public static function queryCount(): int
    {
        return self::$queries;
    }

    /** آخرین کوئری اجراشده (فقط برای نمایش در صفحه بررسی سلامت) */
    public static function lastQuery(): string
    {
        return self::$lastSql;
    }

    public static function pdo(): PDO
    {
        if (self::$pdo === null) {
            $c = app_config();
            $dsn = sprintf(
                'mysql:host=%s;port=%s;dbname=%s;charset=%s',
                $c['db_host'], $c['db_port'], $c['db_name'], $c['db_charset']
            );
            try {
                self::$pdo = new PDO($dsn, $c['db_user'], $c['db_pass'], [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES   => false,
                    PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4, sql_mode='STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'",
                ]);
            } catch (PDOException $e) {
                // در صفحه نصب، خطا باید به خود صفحه برگردانده شود تا کار نصب ادامه یابد
                if (defined('FR_ALLOW_DB_FAILURE')) {
                    throw $e;
                }
                http_response_code(500);
                echo '<div style="font-family:Tahoma;direction:rtl;padding:20px;background:#fff3cd;border:1px solid #ffc107;margin:20px">';
                echo '<h3>اتصال به دیتابیس برقرار نشد</h3>';
                echo '<p>۱) مطمئن شوید MySQL/MariaDB روشن است. '
                   . '۲) صفحه <b>install.php</b> را باز کنید تا دیتابیس و جداول ساخته شوند. '
                   . '۳) اگر باز هم مشکل بود، صفحه <b>doctor.php</b> مشکل را دقیق نشان می‌دهد.</p>';
                echo '<p style="display:flex;gap:10px;flex-wrap:wrap">'
                   . '<a href="install.php" style="background:#0f766e;color:#fff;padding:8px 14px;border-radius:8px;text-decoration:none">باز کردن install.php</a>'
                   . '<a href="doctor.php" style="background:#fff;color:#0f766e;padding:8px 14px;border-radius:8px;text-decoration:none;border:1px solid #0f766e">بررسی سلامت (doctor.php)</a>'
                   . '</p>';
                echo '<pre style="direction:ltr">' . htmlspecialchars($e->getMessage()) . '</pre>';
                echo '</div>';
                exit;
            }
        }
        return self::$pdo;
    }

    /**
     * اجرای کوئری با پارامترهای امن.
     * اگر دیتابیس نصب قدیمی باشد (ستون یا جدول تازه نداشته باشد)، ساختار
     * خودکار ترمیم می‌شود و کوئری یک بار دیگر اجرا می‌گردد — تا خطای
     * «Unknown column / Table doesn't exist» هیچ‌وقت کاربر را متوقف نکند.
     */
    public static function q(string $sql, array $params = []): PDOStatement
    {
        self::$queries++;
        self::$lastSql = $sql;
        try {
            $st = self::pdo()->prepare($sql);
            $st->execute($params);
            return $st;
        } catch (PDOException $e) {
            if (!self::repairable($e)) {
                throw $e;
            }
            // یک بار تلاش برای ترمیم ساختار (همیشه نمی‌شود؛ گارد با static)
            if (!self::autoRepair()) {
                throw $e;
            }
            $st = self::pdo()->prepare($sql);
            $st->execute($params);
            return $st;
        }
    }

    /** آیا این خطا با ترمیم ساختار حل می‌شود؟ */
    private static function repairable(PDOException $e): bool
    {
        $c = $e->getCode();
        $m = $e->getMessage();
        return $c === '42S22' || $c === '42S02' || $c === '3D000'
            || stripos($m, 'Unknown column') !== false
            || stripos($m, "doesn't exist") !== false
            || stripos($m, 'Unknown database') !== false;
    }

    /** ترمیم خودکار ساختار — در هر درخواست فقط یک بار */
    private static function autoRepair(): bool
    {
        static $tried = false;
        if ($tried) {
            return false;
        }
        $tried = true;
        if (!function_exists('fr_ensure_schema') || !defined('FR_ROOT')) {
            return false;
        }
        try {
            $res = fr_ensure_schema();
            if (!empty($_SESSION) && function_exists('fr_schema_version')) {
                $_SESSION['fr_schema_v'] = fr_schema_version();
                $_SESSION['fr_schema_msg'] = 'ساختار دیتابیس خودکار بروزرسانی شد — معلومات شما محفوظ است.';
            }
            return !empty($res['applied']) || $res['applied'] === 0;
        } catch (Throwable $ex) {
            return false;
        }
    }

    /**
     * ترجمه خطای دیتابیس به زبان ساده دری — تا کاربر پیام ترسناک SQL نبیند
     */
    public static function userError(Throwable $e): string
    {
        $msg = $e->getMessage();
        // کد خطای MySQL داخل متن پیام است
        $code = 0;
        if (preg_match('/SQLSTATE\[(\w+)\][^0-9]*(\d+)?/', $msg, $m)) {
            $code = (int) ($m[2] ?? 0);
        }
        if (stripos($msg, 'Duplicate entry') !== false) {
            return 'این مقدار قبلاً ثبت شده است (شماره/نام تکراری). یک مقدار دیگر وارد کنید.';
        }
        if ($code === 1265 || stripos($msg, 'Data truncated') !== false) {
            return 'مقدار یکی از فیلدها با نوع سند نمی‌خواند — لطفاً مقدار درست را از فهرست انتخاب کنید.';
        }
        if ($code === 1406 || stripos($msg, 'Data too long') !== false) {
            return 'متن واردشده برای یکی از فیلدها زیاد طولانی است — کمی کوتاه‌تر بنویسید.';
        }
        if ($code === 1048 || stripos($msg, 'cannot be null') !== false) {
            return 'یکی از فیلدهای حتمی خالی مانده است — همه فیلدهای ستاره‌دار را پر کنید.';
        }
        if (in_array($code, [1451, 1452], true) || stripos($msg, 'foreign key') !== false) {
            return 'این ردیف به اسناد دیگر وصل است — اول آن اسناد را بررسی کنید (حذف یا ویرایش).';
        }
        if ($code === 1064 || stripos($msg, 'syntax') !== false) {
            return 'درخواست به دیتابیس نادرست بود. اگر تکرار شد، صفحه «بررسی سلامت» را باز کنید.';
        }
        if (stripos($msg, "doesn't exist") !== false || stripos($msg, 'Unknown column') !== false) {
            return 'ساختار دیتابیس قدیمی است — صفحه «تنظیمات → دیتابیس و ساختار آن» را باز کنید و دکمه ترمیم را بزنید.';
        }
        if (stripos($msg, 'Connection') !== false || stripos($msg, 'gone away') !== false) {
            return 'ارتباط با دیتابیس قطع شد — مطمئن شوید MySQL/MariaDB در XAMPP روشن است.';
        }
        return 'مشکلی پیش آمد. اگر تکرار شد، صفحه «بررسی سلامت» را باز کنید.';
    }

    public static function all(string $sql, array $params = []): array
    {
        return self::q($sql, $params)->fetchAll();
    }

    public static function one(string $sql, array $params = []): ?array
    {
        $row = self::q($sql, $params)->fetch();
        return $row === false ? null : $row;
    }

    public static function val(string $sql, array $params = [], $default = null)
    {
        $v = self::q($sql, $params)->fetchColumn();
        return $v === false ? $default : $v;
    }

    public static function num(string $sql, array $params = []): float
    {
        return (float) self::val($sql, $params, 0);
    }

    public static function insert(string $table, array $data): int
    {
        $cols = array_keys($data);
        $sql  = 'INSERT INTO `' . $table . '` (`' . implode('`,`', $cols) . '`) VALUES ('
              . implode(',', array_fill(0, count($cols), '?')) . ')';
        self::q($sql, array_values($data));
        return (int) self::pdo()->lastInsertId();
    }

    public static function update(string $table, array $data, string $where, array $whereParams = []): int
    {
        $sets = [];
        foreach (array_keys($data) as $c) {
            $sets[] = '`' . $c . '`=?';
        }
        $sql = 'UPDATE `' . $table . '` SET ' . implode(',', $sets) . ' WHERE ' . $where;
        $st  = self::q($sql, array_merge(array_values($data), $whereParams));
        return $st->rowCount();
    }

    public static function delete(string $table, string $where, array $params = []): int
    {
        return self::q('DELETE FROM `' . $table . '` WHERE ' . $where, $params)->rowCount();
    }

    public static function exists(string $table, string $col, $value, $exceptId = null, string $idCol = 'id'): bool
    {
        $sql = "SELECT 1 FROM `$table` WHERE `$col` = ?";
        $p   = [$value];
        if ($exceptId !== null) {
            $sql .= " AND `$idCol` <> ?";
            $p[] = $exceptId;
        }
        return (bool) self::val($sql . ' LIMIT 1', $p);
    }

    public static function begin(): void { self::pdo()->beginTransaction(); }
    public static function commit(): void { self::pdo()->commit(); }
    public static function rollback(): void
    {
        if (self::pdo()->inTransaction()) {
            self::pdo()->rollBack();
        }
    }

    /** شماره سند بعدی: مثال S-1405-0001 */
    public static function nextNumber(string $prefix, int $year, int $pad = 4): string
    {
        $st = self::q('SELECT `value` FROM `counters` WHERE `series`=? AND `yr`=? FOR UPDATE', [$prefix, $year]);
        $cur = $st->fetchColumn();
        if ($cur === false) {
            self::q('INSERT INTO `counters` (`series`,`yr`,`value`) VALUES (?,?,1)', [$prefix, $year]);
            $n = 1;
        } else {
            $n = (int) $cur + 1;
            self::q('UPDATE `counters` SET `value`=? WHERE `series`=? AND `yr`=?', [$n, $prefix, $year]);
        }
        return sprintf('%s-%d-%s', $prefix, $year, str_pad((string) $n, $pad, '0', STR_PAD_LEFT));
    }

    /** شماره بعدی را بدون مصرف کردن برگرداند (برای پیش‌نمایش در فرم) */
    public static function peekNumber(string $prefix, int $year, int $pad = 4): string
    {
        $cur = (int) self::val('SELECT `value` FROM `counters` WHERE `series`=? AND `yr`=?', [$prefix, $year], 0);
        return sprintf('%s-%d-%s', $prefix, $year, str_pad((string) ($cur + 1), $pad, '0', STR_PAD_LEFT));
    }

    /**
     * ترمیم ساختار از بیرون (وقتی جدولی کم باشد) — در هر درخواست یک بار
     */
    public static function repairSchema(): bool
    {
        return self::autoRepair();
    }

    public static function tableExists(string $table): bool
    {
        try {
            self::q("SELECT 1 FROM `$table` LIMIT 1");
            return true;
        } catch (PDOException $e) {
            // جدول‌های اصلی اگر کم باشند، ساختار خودکار ترمیم و یک بار دیگر بررسی می‌شود
            if (self::repairable($e) && self::isCoreTable($table) && self::autoRepair()) {
                try {
                    self::q("SELECT 1 FROM `$table` LIMIT 1");
                    return true;
                } catch (PDOException $e2) {
                    return false;
                }
            }
            return false;
        }
    }

    /** آیا این جدول از جدول‌های اصلی سیستم است؟ */
    private static function isCoreTable(string $table): bool
    {
        if (!function_exists('fr_required_columns')) {
            return false;
        }
        return isset(fr_required_columns()[$table]);
    }
}
