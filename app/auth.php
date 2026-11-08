<?php
/**
 * ورود و دسترسی کاربران
 */

/** آیا کاربر وارد شده است؟ */
function current_user(): ?array
{
    return $_SESSION['user'] ?? null;
}

function is_logged_in(): bool
{
    return current_user() !== null;
}

/** ورود با نام کاربری و رمز */
function attempt_login(string $username, string $password): bool
{
    $u = Db::one('SELECT * FROM `users` WHERE `username`=? LIMIT 1', [$username]);
    if (!$u || (int) $u['active'] !== 1) {
        return false;
    }
    if (!password_verify($password, $u['password_hash'])) {
        return false;
    }
    $_SESSION['user'] = [
        'id'        => (int) $u['id'],
        'username'  => $u['username'],
        'full_name' => $u['full_name'],
        'role'      => $u['role'],
    ];
    Db::update('users', ['last_login_at' => date('Y-m-d H:i:s')], '`id`=?', [$u['id']]);
    log_activity('login', 'users', $u['id'], 'ورود به سیستم');
    return true;
}

function logout(): void
{
    if (is_logged_in()) {
        log_activity('logout', 'users', current_user()['id'] ?? null, 'خروج از سیستم');
    }
    unset($_SESSION['user']);
}

/** الزام ورود به سیستم */
function require_login(): void
{
    if (!is_logged_in()) {
        $self = basename($_SERVER['SCRIPT_NAME'] ?? 'index.php');
        $qs = $_SERVER['QUERY_STRING'] ?? '';
        $back = $self . ($qs ? '?' . $qs : '');
        redirect('login.php?next=' . urlencode($back));
    }
}

/** تنها مدیر اجازه دارد */
function is_admin(): bool
{
    return (($_SESSION['user']['role'] ?? '') === 'مدیر');
}

function require_admin(): void
{
    require_login();
    if (!is_admin()) {
        http_response_code(403);
        page_header('عدم دسترسی');
        echo '<div class="alert alert-error">شما اجازه دسترسی به این بخش را ندارید. تنها مدیر سیستم می‌تواند این کار را انجام دهد.</div>';
        page_footer();
        exit;
    }
}

/** تغییر رمز کاربر جاری */
function change_password(int $userId, string $newPassword): void
{
    Db::update('users', ['password_hash' => password_hash($newPassword, PASSWORD_DEFAULT)], '`id`=?', [$userId]);
}
