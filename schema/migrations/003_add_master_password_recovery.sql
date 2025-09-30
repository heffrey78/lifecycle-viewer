-- Migration: Add Master Password Recovery System
-- Version: 3.0.0
-- Description: Adds backup codes system for master password recovery
-- Date: 2024-09-29

BEGIN TRANSACTION;

-- Master password recovery table for backup codes
CREATE TABLE IF NOT EXISTS master_password_recovery (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default-user',
    recovery_method TEXT NOT NULL DEFAULT 'backup_codes',
    code_hash TEXT NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    used_at DATETIME,
    UNIQUE(user_id, code_hash)
);

-- Master password settings table
CREATE TABLE IF NOT EXISTS master_password_settings (
    user_id TEXT PRIMARY KEY DEFAULT 'default-user',
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    session_duration_hours INTEGER DEFAULT 24,
    auto_lock_minutes INTEGER DEFAULT 60,
    backup_codes_remaining INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_recovery_user_unused ON master_password_recovery(user_id, is_used);
CREATE INDEX IF NOT EXISTS idx_recovery_code_hash ON master_password_recovery(code_hash);

-- Update schema version
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

INSERT OR REPLACE INTO schema_version (version, description)
VALUES (3, 'Added master password recovery system with backup codes');

COMMIT;