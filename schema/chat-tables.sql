-- Chat Tables Schema for Lifecycle Viewer
-- Integrates with existing lifecycle.db to add secure chat persistence
-- Version: 1.0.0

-- API Keys table - stores encrypted Claude API keys
CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    -- User identifier (future-proofing for multi-user support)
    user_id TEXT NOT NULL DEFAULT 'default',
    -- Encrypted API key using AES-256-GCM
    encrypted_key TEXT NOT NULL,
    -- Initialization vector for encryption
    iv TEXT NOT NULL,
    -- Key derivation salt
    salt TEXT NOT NULL,
    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    -- Key rotation support
    key_version INTEGER DEFAULT 1,

    UNIQUE(user_id, key_version)
);

-- Conversations table - chat conversation threads
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY, -- UUID format
    -- User identifier
    user_id TEXT NOT NULL DEFAULT 'default',
    -- Display information
    title TEXT NOT NULL,
    description TEXT,
    -- Conversation settings
    model TEXT DEFAULT 'claude-3-7-sonnet-latest',
    system_prompt TEXT,
    temperature REAL DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 4000,
    -- Status and organization
    is_archived BOOLEAN DEFAULT FALSE,
    is_starred BOOLEAN DEFAULT FALSE,
    tags TEXT, -- JSON array of tags for organization
    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_message_at DATETIME,
    -- Usage tracking
    message_count INTEGER DEFAULT 0,
    total_tokens_used INTEGER DEFAULT 0,
    estimated_cost REAL DEFAULT 0.0,

    -- Indexes for performance
    INDEX idx_conversations_user_updated (user_id, updated_at DESC),
    INDEX idx_conversations_user_archived (user_id, is_archived),
    INDEX idx_conversations_last_message (last_message_at DESC)
);

-- Messages table - individual chat messages
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY, -- UUID format
    conversation_id TEXT NOT NULL,
    -- Message content
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    -- File attachments (JSON array of file metadata)
    attachments TEXT, -- JSON: [{"id":"uuid","filename":"x.md","size":1024,"type":"text/markdown","processed":true}]
    -- Message metadata (JSON object)
    metadata TEXT, -- JSON: {"model":"claude-3.5-sonnet","tokens":{"input":100,"output":200},"toolCalls":[...]}
    -- Status and processing
    is_streaming BOOLEAN DEFAULT FALSE,
    has_error BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    -- Message ordering within conversation
    sequence_number INTEGER NOT NULL,

    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,

    -- Indexes for performance
    INDEX idx_messages_conversation_sequence (conversation_id, sequence_number),
    INDEX idx_messages_conversation_created (conversation_id, created_at),
    INDEX idx_messages_role (role),
    UNIQUE(conversation_id, sequence_number)
);

-- Tool calls table - tracks Claude API tool usage
CREATE TABLE IF NOT EXISTS tool_calls (
    id TEXT PRIMARY KEY, -- UUID format
    message_id TEXT NOT NULL,
    -- Tool execution details
    tool_name TEXT NOT NULL,
    tool_arguments TEXT NOT NULL, -- JSON object
    tool_result TEXT, -- JSON object or text result
    -- Execution metadata
    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    execution_duration_ms INTEGER,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,

    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,

    -- Indexes for analytics
    INDEX idx_tool_calls_message (message_id),
    INDEX idx_tool_calls_tool_name (tool_name),
    INDEX idx_tool_calls_executed (executed_at DESC)
);

-- File attachments table - stores processed file content
CREATE TABLE IF NOT EXISTS file_attachments (
    id TEXT PRIMARY KEY, -- UUID format
    message_id TEXT NOT NULL,
    -- File metadata
    filename TEXT NOT NULL,
    original_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    -- Processed content
    processed_content TEXT, -- The actual file content sent to Claude
    content_summary TEXT, -- Brief summary of file content
    processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'success', 'error')),
    processing_error TEXT,
    -- Security validation
    is_safe BOOLEAN DEFAULT TRUE,
    security_warnings TEXT, -- JSON array of security warnings
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME,

    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,

    -- Indexes
    INDEX idx_file_attachments_message (message_id),
    INDEX idx_file_attachments_status (processing_status),
    INDEX idx_file_attachments_created (created_at DESC)
);

-- Usage analytics table - tracks API usage over time
CREATE TABLE IF NOT EXISTS usage_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT 'default',
    conversation_id TEXT,
    -- Usage metrics
    date DATE NOT NULL, -- Daily aggregation
    model TEXT NOT NULL,
    message_count INTEGER DEFAULT 0,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    estimated_cost REAL DEFAULT 0.0,
    -- Tool usage
    tool_calls_count INTEGER DEFAULT 0,
    unique_tools_used INTEGER DEFAULT 0,

    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL,

    -- Indexes for analytics queries
    INDEX idx_usage_analytics_user_date (user_id, date DESC),
    INDEX idx_usage_analytics_conversation_date (conversation_id, date DESC),
    INDEX idx_usage_analytics_model (model),
    UNIQUE(user_id, conversation_id, date, model)
);

-- Chat settings table - user preferences and configuration
CREATE TABLE IF NOT EXISTS chat_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT 'default',
    -- UI preferences
    theme TEXT DEFAULT 'system',
    language TEXT DEFAULT 'en',
    timezone TEXT DEFAULT 'UTC',
    -- Chat behavior
    auto_save_conversations BOOLEAN DEFAULT TRUE,
    default_model TEXT DEFAULT 'claude-3-7-sonnet-latest',
    default_temperature REAL DEFAULT 0.7,
    default_max_tokens INTEGER DEFAULT 4000,
    -- Privacy and security
    enable_analytics BOOLEAN DEFAULT TRUE,
    auto_delete_after_days INTEGER, -- NULL = never delete
    require_confirmation_for_delete BOOLEAN DEFAULT TRUE,
    -- Export preferences
    export_format TEXT DEFAULT 'markdown',
    include_metadata_in_export BOOLEAN DEFAULT FALSE,
    -- Updated tracking
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

-- Insert initial schema version
INSERT OR IGNORE INTO chat_schema_version (version, description)
VALUES ('1.0.0', 'Initial chat tables schema with secure API key storage');

-- Triggers for maintaining updated_at timestamps
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

-- Create indexes for full-text search (if supported)
-- This will enable searching chat content
CREATE INDEX IF NOT EXISTS idx_messages_content_fts ON messages(content);
CREATE INDEX IF NOT EXISTS idx_conversations_title_fts ON conversations(title, description);

-- Views for common queries
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
    -- Latest message preview
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