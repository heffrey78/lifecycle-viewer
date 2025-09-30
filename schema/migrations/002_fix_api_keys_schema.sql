-- Migration: Fix API Keys Schema to Match MCP Bridge
-- Version: 2.0.0
-- Description: Updates api_keys table to support multi-service architecture
-- Date: 2024-09-28

BEGIN TRANSACTION;

-- First, check if we need to run this migration
-- If the api_keys table already has service_name column, skip
SELECT CASE
    WHEN EXISTS (
        SELECT 1 FROM pragma_table_info('api_keys')
        WHERE name = 'service_name'
    )
    THEN 0 -- Skip migration
    ELSE 1 -- Run migration
END AS should_migrate;

-- Create backup table with existing data (if any)
CREATE TABLE IF NOT EXISTS api_keys_backup AS
SELECT * FROM api_keys WHERE 1=0; -- Empty structure copy

INSERT INTO api_keys_backup SELECT * FROM api_keys;

-- Drop existing api_keys table
DROP TABLE IF EXISTS api_keys;

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

-- Migrate existing data if any (from backup)
-- Convert old schema to new schema format
INSERT INTO api_keys (id, user_id, service_name, encrypted_key, key_hash, metadata, created_at, last_used_at, is_active)
SELECT
    printf('api-key-%d', id) as id,                  -- Convert INTEGER to TEXT ID
    CASE
        WHEN user_id = 'default' THEN 'default-user'
        ELSE user_id
    END as user_id,
    'claude' as service_name,                        -- Default to claude service
    encrypted_key,
    substr(
        lower(hex(randomblob(32))), 1, 64
    ) as key_hash,                                   -- Generate placeholder hash
    json_object(
        'iv', COALESCE(iv, ''),
        'salt', COALESCE(salt, ''),
        'key_version', COALESCE(key_version, 1)
    ) as metadata,
    created_at,
    last_used_at,
    is_active
FROM api_keys_backup;

-- Drop backup table
DROP TABLE api_keys_backup;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_user_service ON api_keys(user_id, service_name);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_api_keys_last_used ON api_keys(last_used_at DESC);

-- Update schema version
INSERT OR REPLACE INTO chat_schema_version (version, description)
VALUES ('2.0.0', 'Fixed api_keys schema to match MCP bridge multi-service architecture');

COMMIT;