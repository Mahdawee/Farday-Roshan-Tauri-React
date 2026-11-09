-- Foundation only: not yet connected to Tauri commands or UI access controls.
-- Hashes and metadata are private local data. No default account is created.
CREATE TABLE local_users (
    id TEXT PRIMARY KEY NOT NULL,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin','staff')),
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
    auth_revision INTEGER NOT NULL DEFAULT 1 CHECK(auth_revision > 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
