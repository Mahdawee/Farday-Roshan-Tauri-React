-- ============================================================================
--  سیستم مدیریت شرکت تولیدی فردای روشن  (مواد ساختمانی)
--  Database schema  |  MySQL 5.7+ / MariaDB 10.2+  |  utf8mb4
--  Farday Roshan Building Materials Company - Management System
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET time_zone = '+00:00';

-- ----------------------------------------------------------------------------
-- ۱) شیت مشخصات شرکت  (ثابت)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `company` (
  `id`               TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `name`             VARCHAR(120)  NOT NULL DEFAULT 'شرکت فردای روشن',
  `activity_type`    VARCHAR(120)  NOT NULL DEFAULT 'تولید مواد ساختمانی',
  `address`          VARCHAR(255)  DEFAULT NULL,
  `finance_manager`  VARCHAR(120)  DEFAULT NULL COMMENT 'مدیر مالی',
  `supervisor`       VARCHAR(120)  DEFAULT NULL COMMENT 'سرپرست',
  `fiscal_year_note` VARCHAR(60)   DEFAULT NULL COMMENT 'سال مالی جاری',
  `employees_count`  INT           NOT NULL DEFAULT 0 COMMENT 'تعداد کارمندان',
  `phone`            VARCHAR(60)   DEFAULT NULL,
  `email`            VARCHAR(120)  DEFAULT NULL,
  `license_no`       VARCHAR(60)   DEFAULT NULL COMMENT 'شماره جواز',
  `notes`            TEXT          DEFAULT NULL,
  `updated_at`       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- انواع و تعداد ماشینری
CREATE TABLE IF NOT EXISTS `machines` (
  `id`         INT AUTO_INCREMENT,
  `name`       VARCHAR(120) NOT NULL COMMENT 'نوع ماشین',
  `count`      INT          NOT NULL DEFAULT 1 COMMENT 'تعداد',
  `status`     ENUM('فعال','غیرفعال','تحت ترمیم') NOT NULL DEFAULT 'فعال',
  `notes`      VARCHAR(255) DEFAULT NULL,
  `sort_order` INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_machines_sort` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- ۲) تنظیمات سیستم (تقویم، سال مالی، روش حساب دخل و ...)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `settings` (
  `id`                TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `calendar`          ENUM('shamsi','miladi') NOT NULL DEFAULT 'shamsi' COMMENT 'تقویم سیستم',
  `fiscal_start_month` TINYINT NOT NULL DEFAULT 1 COMMENT 'ماه آغاز سال مالی در تقویم فعال',
  `fiscal_start_day`   TINYINT NOT NULL DEFAULT 1 COMMENT 'روز آغاز سال مالی',
  `cashbox_mode`      ENUM('all','cash_only') NOT NULL DEFAULT 'all' COMMENT 'روش محاسبه موجودی دخل',
  `opening_cash`      DECIMAL(16,2) NOT NULL DEFAULT 0 COMMENT 'موجودی اول دخل',
  `opening_cash_date` DATE DEFAULT NULL,
  `usd_label`         VARCHAR(10) NOT NULL DEFAULT 'دالر',
  `afn_label`         VARCHAR(10) NOT NULL DEFAULT 'افغانی',
  `display_digits`    ENUM('en','fa') NOT NULL DEFAULT 'en' COMMENT 'شکل ارقام',
  `print_header`      VARCHAR(255) DEFAULT NULL COMMENT 'سرصفحه چاپ',
  `theme_mode`        ENUM('light','dark','auto') NOT NULL DEFAULT 'auto' COMMENT 'حالت ظاهر سیستم',
  `accent`            VARCHAR(16) NOT NULL DEFAULT 'teal' COMMENT 'رنگ اصلی',
  `density`           ENUM('comfortable','compact') NOT NULL DEFAULT 'comfortable' COMMENT 'فشردگی چیدمان',
  `font_size`         ENUM('small','normal','large') NOT NULL DEFAULT 'normal' COMMENT 'اندازه خط',
  `corner_style`      ENUM('soft','medium','sharp') NOT NULL DEFAULT 'soft' COMMENT 'شکل گوشه‌ها',
  `table_stripes`     TINYINT NOT NULL DEFAULT 1 COMMENT 'ردیف‌های یک‌درمیان رنگی جدول',
  `font_family`       ENUM('poppins','vazirmatn','system') NOT NULL DEFAULT 'poppins' COMMENT 'فونت سیستم',
  `updated_at`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- ۳) کارمندان
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `employees` (
  `id`                INT AUTO_INCREMENT,
  `emp_code`          VARCHAR(20)  NOT NULL COMMENT 'کد کارمند',
  `full_name`         VARCHAR(120) NOT NULL COMMENT 'نام و تخلص',
  `father_name`       VARCHAR(120) DEFAULT NULL COMMENT 'نام پدر',
  `job_title`         VARCHAR(80)  DEFAULT NULL COMMENT 'وظیفه',
  `hire_date`         DATE         DEFAULT NULL COMMENT 'تاریخ استخدام',
  `base_salary`       DECIMAL(14,2) NOT NULL DEFAULT 0 COMMENT 'معاش ثابت',
  `phone`             VARCHAR(40)  DEFAULT NULL COMMENT 'شماره تماس',
  `tazkira_no`        VARCHAR(40)  DEFAULT NULL COMMENT 'شماره تذکره',
  `address`           VARCHAR(255) DEFAULT NULL COMMENT 'آدرس',
  `contract_duration` VARCHAR(60)  DEFAULT NULL COMMENT 'مدت قرارداد',
  `status`            ENUM('فعال','غیرفعال') NOT NULL DEFAULT 'فعال',
  `notes`             TEXT         DEFAULT NULL COMMENT 'توضیحات',
  `created_at`        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_employees_code` (`emp_code`),
  KEY `idx_employees_name` (`full_name`),
  KEY `idx_employees_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- ۴) حضور و غیاب
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `attendance` (
  `id`             INT AUTO_INCREMENT,
  `employee_id`    INT  NOT NULL,
  `work_date`      DATE NOT NULL,
  `status`         ENUM('حاضر','غایب','رخصت','مریض','رخصتی رسمی','جمعه') NOT NULL DEFAULT 'حاضر',
  `check_in`       TIME DEFAULT NULL,
  `check_out`      TIME DEFAULT NULL,
  `overtime_hours` DECIMAL(5,2) NOT NULL DEFAULT 0 COMMENT 'ساعات اضافه کاری',
  `notes`          VARCHAR(255) DEFAULT NULL,
  `created_at`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_attendance` (`employee_id`,`work_date`),
  KEY `idx_attendance_date` (`work_date`),
  CONSTRAINT `fk_attendance_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- ۵) مشتریان
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `customers` (
  `id`              INT AUTO_INCREMENT,
  `code`            VARCHAR(20)  NOT NULL COMMENT 'کد مشتری',
  `name`            VARCHAR(160) NOT NULL COMMENT 'نام مشتری / شرکت',
  `contact_person`  VARCHAR(120) DEFAULT NULL COMMENT 'شخص رابط',
  `phone`           VARCHAR(40)  DEFAULT NULL,
  `vehicle_plate`   VARCHAR(40)  DEFAULT NULL COMMENT 'پلیت موتر',
  `opening_balance` DECIMAL(16,2) NOT NULL DEFAULT 0 COMMENT 'باقی مانده بدهی اولیه',
  `address`         VARCHAR(255) DEFAULT NULL,
  `notes`           TEXT         DEFAULT NULL,
  `created_at`      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_customers_code` (`code`),
  KEY `idx_customers_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- ۶) جداول کشویی (قابل مدیریت از تنظیمات)
-- ----------------------------------------------------------------------------
-- نوع مواد
CREATE TABLE IF NOT EXISTS `material_types` (
  `id`         INT AUTO_INCREMENT,
  `name`       VARCHAR(80) NOT NULL,
  `unit`       VARCHAR(20) NOT NULL DEFAULT 'متر مکعب',
  `active`     TINYINT NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_material_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- انواع مصرف - مربوط
CREATE TABLE IF NOT EXISTS `expense_types` (
  `id`         INT AUTO_INCREMENT,
  `name`       VARCHAR(80) NOT NULL,
  `active`     TINYINT NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_expense_type_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- پرداخت کننده (دخل، احمد و ...)
CREATE TABLE IF NOT EXISTS `payers` (
  `id`         INT AUTO_INCREMENT,
  `name`       VARCHAR(80) NOT NULL,
  `kind`       ENUM('دخل','شخصی','بانک','شرکت') NOT NULL DEFAULT 'شخصی',
  `active`     TINYINT NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payer_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- منبع رسید (از درک: باقی داری، امانت، بیانیه ...)
CREATE TABLE IF NOT EXISTS `receipt_sources` (
  `id`              INT AUTO_INCREMENT,
  `name`            VARCHAR(80) NOT NULL,
  `affects_balance` TINYINT NOT NULL DEFAULT 1 COMMENT 'از باقی مانده بدهی مشتری کم شود؟',
  `active`          TINYINT NOT NULL DEFAULT 1,
  `sort_order`      INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_receipt_source_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- ۷) فروشات
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sales` (
  `id`            INT AUTO_INCREMENT,
  `sale_no`       VARCHAR(24)  NOT NULL COMMENT 'شماره',
  `sale_date`     DATE         NOT NULL COMMENT 'تاریخ',
  `customer_id`   INT          DEFAULT NULL COMMENT 'کد مشتری',
  `bill_no`       VARCHAR(30)  DEFAULT NULL COMMENT 'بلنمبر فروش',
  `driver_name`   VARCHAR(120) DEFAULT NULL COMMENT 'نام دریور',
  `vehicle_plate` VARCHAR(40)  DEFAULT NULL COMMENT 'پلیت موتر',
  `destination`   VARCHAR(160) DEFAULT NULL COMMENT 'مقصد',
  `material_id`   INT          NOT NULL COMMENT 'نوع مواد',
  `volume`        DECIMAL(12,3) NOT NULL DEFAULT 0 COMMENT 'متراژ (متر مکعب)',
  `unit_price`    DECIMAL(14,2) NOT NULL DEFAULT 0 COMMENT 'قیمت فی متر',
  `freight`       DECIMAL(14,2) NOT NULL DEFAULT 0 COMMENT 'کرایه',
  `total_amount`  DECIMAL(16,2) NOT NULL DEFAULT 0 COMMENT 'مجموع قیمت و کرایه',
  `related_to`    VARCHAR(160) DEFAULT NULL COMMENT 'مربوط',
  `payment_type`  ENUM('نقده','باقی') NOT NULL DEFAULT 'نقده' COMMENT 'نوع پرداخت',
  `notes`         TEXT DEFAULT NULL COMMENT 'توضیحات',
  `created_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sales_no` (`sale_no`),
  KEY `idx_sales_date` (`sale_date`),
  KEY `idx_sales_customer` (`customer_id`),
  KEY `idx_sales_material` (`material_id`),
  KEY `idx_sales_payment` (`payment_type`),
  CONSTRAINT `fk_sales_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_sales_material` FOREIGN KEY (`material_id`) REFERENCES `material_types` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- ۸) مصارف
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `expenses` (
  `id`               INT AUTO_INCREMENT,
  `expense_no`       VARCHAR(24) NOT NULL COMMENT 'شماره',
  `expense_date`     DATE NOT NULL COMMENT 'تاریخ',
  `description`      VARCHAR(255) NOT NULL COMMENT 'شرح',
  `expense_type_id`  INT DEFAULT NULL COMMENT 'انواع مصرف - مربوط',
  `related_to`       VARCHAR(160) DEFAULT NULL COMMENT 'مربوط',
  `purchase_bill_no` VARCHAR(40) DEFAULT NULL COMMENT 'نمبر بل خرید',
  `shop_name`        VARCHAR(160) DEFAULT NULL COMMENT 'نام فروشگاه / از دوکان',
  `amount_afn`       DECIMAL(16,2) NOT NULL DEFAULT 0 COMMENT 'مبلغ افغانی',
  `amount_usd`       DECIMAL(16,2) NOT NULL DEFAULT 0 COMMENT 'مبلغ دالری',
  `usd_rate`         DECIMAL(12,2) DEFAULT NULL COMMENT 'نرخ دالر (فقط جهت یادداشت)',
  `payer_id`         INT DEFAULT NULL COMMENT 'پرداخت کننده',
  `payment_method`   ENUM('نقده','باقی') NOT NULL DEFAULT 'نقده' COMMENT 'روش پرداخت',
  `notes`            TEXT DEFAULT NULL,
  `created_at`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_expenses_no` (`expense_no`),
  KEY `idx_expenses_date` (`expense_date`),
  KEY `idx_expenses_type` (`expense_type_id`),
  KEY `idx_expenses_payer` (`payer_id`),
  CONSTRAINT `fk_expenses_type` FOREIGN KEY (`expense_type_id`) REFERENCES `expense_types` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_expenses_payer` FOREIGN KEY (`payer_id`) REFERENCES `payers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- ۹) رسیدات
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `receipts` (
  `id`              INT AUTO_INCREMENT,
  `receipt_no`      VARCHAR(24) NOT NULL COMMENT 'شماره',
  `receipt_date`    DATE NOT NULL COMMENT 'تاریخ',
  `customer_id`     INT DEFAULT NULL COMMENT 'کد مشتری',
  `amount`          DECIMAL(16,2) NOT NULL DEFAULT 0 COMMENT 'مبلغ رسید',
  `related_bill_no` VARCHAR(40) DEFAULT NULL COMMENT 'شماره بل مربوط',
  `source_id`       INT DEFAULT NULL COMMENT 'از درک',
  `received_by`     VARCHAR(120) DEFAULT NULL COMMENT 'توسط',
  `notes`           TEXT DEFAULT NULL COMMENT 'شرح',
  `created_at`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_receipts_no` (`receipt_no`),
  KEY `idx_receipts_date` (`receipt_date`),
  KEY `idx_receipts_customer` (`customer_id`),
  CONSTRAINT `fk_receipts_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_receipts_source` FOREIGN KEY (`source_id`) REFERENCES `receipt_sources` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- ۱۰) معاشات
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `salaries` (
  `id`            INT AUTO_INCREMENT,
  `salary_no`     VARCHAR(24) NOT NULL COMMENT 'شماره',
  `pay_year`      SMALLINT NOT NULL COMMENT 'سال (به تقویم سیستم)',
  `pay_month`     TINYINT NOT NULL COMMENT 'ماه (به تقویم سیستم)',
  `pay_date`      DATE NOT NULL COMMENT 'تاریخ پرداخت',
  `employee_id`   INT NOT NULL COMMENT 'کد کارمند',
  `base_salary`   DECIMAL(14,2) NOT NULL DEFAULT 0 COMMENT 'معاش ثابت',
  `bonus`         DECIMAL(14,2) NOT NULL DEFAULT 0 COMMENT 'پاداش',
  `fine`          DECIMAL(14,2) NOT NULL DEFAULT 0 COMMENT 'جریمه',
  `overtime_pay`  DECIMAL(14,2) NOT NULL DEFAULT 0 COMMENT 'اضافه کاری',
  `total_pay`     DECIMAL(16,2) NOT NULL DEFAULT 0 COMMENT 'مجموع پرداخت',
  `payer_id`      INT DEFAULT NULL COMMENT 'پرداخت کننده',
  `payment_type`  ENUM('نقد','حواله') NOT NULL DEFAULT 'نقد' COMMENT 'نوع پرداخت',
  `notes`         TEXT DEFAULT NULL,
  `created_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_salaries_no` (`salary_no`),
  KEY `idx_salaries_period` (`pay_year`,`pay_month`),
  KEY `idx_salaries_employee` (`employee_id`),
  CONSTRAINT `fk_salaries_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_salaries_payer` FOREIGN KEY (`payer_id`) REFERENCES `payers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- ۱۱) کاربران سیستم
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id`            INT AUTO_INCREMENT,
  `username`      VARCHAR(40) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name`     VARCHAR(120) DEFAULT NULL,
  `role`          ENUM('مدیر','کارمند') NOT NULL DEFAULT 'مدیر',
  `active`        TINYINT NOT NULL DEFAULT 1,
  `last_login_at` DATETIME DEFAULT NULL,
  `created_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- ۱۲) شمارنده شماره اسناد
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `counters` (
  `series` VARCHAR(24) NOT NULL,
  `yr`     SMALLINT NOT NULL,
  `value`  INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`series`,`yr`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- ۱۳) یادداشت راپورهای ماهانه و سالانه
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `report_notes` (
  `scope`  ENUM('monthly','yearly') NOT NULL,
  `period` VARCHAR(20) NOT NULL COMMENT 'مثلاً 1405-07 یا 1405',
  `notes`  TEXT,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`scope`,`period`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- ۱۴) سابقه فعالیت‌ها (گزارش تغییرات)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `activity_log` (
  `id`         BIGINT AUTO_INCREMENT,
  `user_id`    INT DEFAULT NULL,
  `username`   VARCHAR(40) DEFAULT NULL,
  `action`     VARCHAR(20) NOT NULL,
  `entity`     VARCHAR(40) NOT NULL,
  `entity_id`  VARCHAR(40) DEFAULT NULL,
  `details`    VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_log_created` (`created_at`),
  KEY `idx_log_entity` (`entity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
