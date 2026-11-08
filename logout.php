<?php
require_once __DIR__ . '/app/bootstrap.php';
app_boot();
logout();
flash('از سیستم خارج شدید.', 'success');
redirect('login.php');
