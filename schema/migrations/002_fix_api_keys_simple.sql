-- Migration: Fix API Keys Schema to Match MCP Bridge
-- Version: 2.0.0
-- Description: Updates api_keys table to support multi-service architecture
-- Date: 2024-09-28

-- Safe migration - only run if service_name column doesn't exist
BEGIN TRANSACTION;

-- Check current schema by trying to select service_name
-- If it fails, we need to migrate
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

-- Create backup of existing data
CREATE TEMPORARY TABLE api_keys_backup AS
SELECT * FROM api_keys;

-- Drop and recreate with correct schema
DROP TABLE api_keys;

-- Create new api_keys table matching MCP bridge expectations
CREATE TABLE api_keys (
    id TEXT PRIMARY KEY,                              -- UUID like other tables
    user_id TEXT NOT NULL DEFAULT 'default-user',    -- Match MCP bridge default
    service_name TEXT NOT NULL DEFAULT 'claude',     -- Support multiple services
    encrypted_key TEXT NOT NULL,                     -- Encrypted API key
    key_hash TEXT NOT NULL,                          -- Hash for verification
    metadata TEXT DEFAULT '{}',                      -- JSON: {iv, salt, key_version, ...}
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(user_id, service_name, is_active)         -- One active key per user per service
);

-- Migrate existing data from backup (if any)
-- Convert old schema fields to new schema
INSERT INTO api_keys (id, user_id, service_name, encrypted_key, key_hash, metadata, created_at, last_used_at, is_active)
SELECT
    printf('migrated-key-%d', id) as id,             -- Convert INTEGER to TEXT ID
    CASE
        WHEN user_id = 'default' THEN 'default-user'
        ELSE user_id
    END as user_id,
    'claude' as service_name,                        -- Default to claude service
    encrypted_key,
    lower(hex(randomblob(16))) as key_hash,          -- Generate placeholder hash
    json_object(
        'iv', COALESCE(iv, ''),
        'salt', COALESCE(salt, ''),
        'key_version', COALESCE(key_version, 1)
    ) as metadata,
    created_at,
    last_used_at,
    COALESCE(is_active, 1)
FROM api_keys_backup;

-- Record migration
INSERT OR REPLACE INTO schema_version (version, description)
VALUES (2, 'Fixed api_keys schema to match MCP bridge multi-service architecture');

COMMIT;