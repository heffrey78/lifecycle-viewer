-- Migration: Add Chat Tables to Lifecycle.db
-- Version: 1.0.0
-- Description: Adds secure chat persistence with encrypted API key storage
-- Date: 2024-09-28

-- Check if this migration has already been applied
-- If chat_schema_version table exists and contains this version, skip
-- This will be handled by the migration runner

BEGIN TRANSACTION;

-- API Keys table - stores encrypted Claude API keys
CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT 'default',
    encrypted_key TEXT NOT NULL,
    iv TEXT NOT NULL,
    salt TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    key_version INTEGER DEFAULT 1,

    UNIQUE(user_id, key_version)
);

-- Conversations table - chat conversation threads
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    title TEXT NOT NULL,
    description TEXT,
    model TEXT DEFAULT 'claude-3-7-sonnet-latest',
    system_prompt TEXT,
    temperature REAL DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 4000,
    is_archived BOOLEAN DEFAULT FALSE,
    is_starred BOOLEAN DEFAULT FALSE,
    tags TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_message_at DATETIME,
    message_count INTEGER DEFAULT 0,
    total_tokens_used INTEGER DEFAULT 0,
    estimated_cost REAL DEFAULT 0.0
);

-- Messages table - individual chat messages
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    attachments TEXT,
    metadata TEXT,
    is_streaming BOOLEAN DEFAULT FALSE,
    has_error BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sequence_number INTEGER NOT NULL,

    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    UNIQUE(conversation_id, sequence_number)
);

-- Tool calls table - tracks Claude API tool usage
CREATE TABLE IF NOT EXISTS tool_calls (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    tool_arguments TEXT NOT NULL,
    tool_result TEXT,
    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    execution_duration_ms INTEGER,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,

    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

-- File attachments table - stores processed file content
CREATE TABLE IF NOT EXISTS file_attachments (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    processed_content TEXT,
    content_summary TEXT,
    processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'success', 'error')),
    processing_error TEXT,
    is_safe BOOLEAN DEFAULT TRUE,
    security_warnings TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME,

    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

-- Usage analytics table - tracks API usage over time
CREATE TABLE IF NOT EXISTS usage_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT 'default',
    conversation_id TEXT,
    date DATE NOT NULL,
    model TEXT NOT NULL,
    message_count INTEGER DEFAULT 0,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    estimated_cost REAL DEFAULT 0.0,
    tool_calls_count INTEGER DEFAULT 0,
    unique_tools_used INTEGER DEFAULT 0,

    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL,
    UNIQUE(user_id, conversation_id, date, model)
);

-- Chat settings table - user preferences and configuration
CREATE TABLE IF NOT EXISTS chat_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT 'default',
    theme TEXT DEFAULT 'system',
    language TEXT DEFAULT 'en',
    timezone TEXT DEFAULT 'UTC',
    auto_save_conversations BOOLEAN DEFAULT TRUE,
    default_model TEXT DEFAULT 'claude-3-7-sonnet-latest',
    default_temperature REAL DEFAULT 0.7,
    default_max_tokens INTEGER DEFAULT 4000,
    enable_analytics BOOLEAN DEFAULT TRUE,
    auto_delete_after_days INTEGER,
    require_confirmation_for_delete BOOLEAN DEFAULT TRUE,
    export_format TEXT DEFAULT 'markdown',
    include_metadata_in_export BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id)
);

-- Version tracking for schema migrations
CREATE TABLE IF NOT EXISTS chat_schema_version (
    version TEXT PRIMARY KEY,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_user_updated ON conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_user_archived ON conversations(user_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_sequence ON messages(conversation_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);

CREATE INDEX IF NOT EXISTS idx_tool_calls_message ON tool_calls(message_id);
CREATE INDEX IF NOT EXISTS idx_tool_calls_tool_name ON tool_calls(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_calls_executed ON tool_calls(executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_file_attachments_message ON file_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_file_attachments_status ON file_attachments(processing_status);
CREATE INDEX IF NOT EXISTS idx_file_attachments_created ON file_attachments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usage_analytics_user_date ON usage_analytics(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_usage_analytics_conversation_date ON usage_analytics(conversation_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_usage_analytics_model ON usage_analytics(model);

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_messages_content_fts ON messages(content);
CREATE INDEX IF NOT EXISTS idx_conversations_title_fts ON conversations(title, description);

-- Create triggers for maintaining updated_at timestamps
CREATE TRIGGER IF NOT EXISTS update_conversations_timestamp
    AFTER UPDATE ON conversations
    FOR EACH ROW
BEGIN
    UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_messages_timestamp
    AFTER UPDATE ON messages
    FOR EACH ROW
BEGIN
    UPDATE messages SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Update conversation stats when messages are added
CREATE TRIGGER IF NOT EXISTS update_conversation_stats
    AFTER INSERT ON messages
    FOR EACH ROW
BEGIN
    UPDATE conversations
    SET
        message_count = message_count + 1,
        last_message_at = NEW.created_at,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.conversation_id;
END;

-- Create views for common queries
CREATE VIEW IF NOT EXISTS conversation_summary AS
SELECT
    c.id,
    c.title,
    c.description,
    c.created_at,
    c.updated_at,
    c.last_message_at,
    c.message_count,
    c.total_tokens_used,
    c.estimated_cost,
    c.is_archived,
    c.is_starred,
    (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY sequence_number DESC LIMIT 1) as latest_message,
    (SELECT role FROM messages WHERE conversation_id = c.id ORDER BY sequence_number DESC LIMIT 1) as latest_message_role
FROM conversations c
ORDER BY c.last_message_at DESC;

CREATE VIEW IF NOT EXISTS usage_summary AS
SELECT
    date,
    model,
    SUM(message_count) as total_messages,
    SUM(input_tokens) as total_input_tokens,
    SUM(output_tokens) as total_output_tokens,
    SUM(total_tokens) as total_tokens,
    SUM(estimated_cost) as total_cost,
    SUM(tool_calls_count) as total_tool_calls
FROM usage_analytics
GROUP BY date, model
ORDER BY date DESC, model;

-- Insert initial schema version
INSERT OR IGNORE INTO chat_schema_version (version, description)
VALUES ('1.0.0', 'Initial chat tables schema with secure API key storage');

-- Insert default settings for the default user
INSERT OR IGNORE INTO chat_settings (user_id) VALUES ('default');

COMMIT;