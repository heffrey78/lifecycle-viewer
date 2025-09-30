# Chat Tables Schema Documentation

## Overview

This schema extends the existing `lifecycle.db` SQLite database with secure chat persistence capabilities. The design follows the same patterns as the existing lifecycle entities while adding comprehensive chat functionality.

## Key Design Principles

### 1. **Security First**

- API keys are encrypted using AES-256-GCM with unique IVs and salts
- User data is isolated by `user_id` for future multi-user support
- File uploads are validated and marked for safety
- No plaintext sensitive data in the database

### 2. **Performance Optimized**

- Strategic indexes on common query patterns
- Denormalized statistics (message_count, total_tokens) for fast access
- Efficient foreign key relationships with CASCADE deletes
- Full-text search capabilities for message content

### 3. **Analytics and Usage Tracking**

- Comprehensive token usage tracking for cost management
- Tool call analytics for understanding AI interaction patterns
- Daily aggregation for usage reports and trend analysis
- Export capabilities for data portability

### 4. **Future-Proof Architecture**

- Schema versioning for safe migrations
- User-based isolation ready for multi-user deployment
- Extensible metadata fields (JSON columns)
- Configurable settings and preferences

## Table Structure

### Core Tables

#### `api_keys`

Stores encrypted Claude API keys with rotation support.

**Key Features:**

- AES-256-GCM encryption with unique IV/salt per key
- Version tracking for key rotation
- Last-used tracking for security auditing
- Per-user isolation

**Security Model:**

```
plaintext_key -> PBKDF2(salt, iterations) -> derived_key
encrypted_data = AES-GCM(derived_key, iv, plaintext_key)
stored = {encrypted_data, iv, salt, user_id}
```

#### `conversations`

Chat conversation threads with settings and metadata.

**Features:**

- Hierarchical conversation organization
- Per-conversation model and prompt settings
- Usage statistics and cost tracking
- Archive/star organization system
- JSON tag support for categorization

#### `messages`

Individual chat messages with rich content support.

**Features:**

- Ordered messages with sequence numbers
- File attachment references
- Rich metadata (tokens, model, tool calls)
- Error tracking and streaming status
- Full-text search capabilities

#### `tool_calls`

Tracks Claude API tool usage for analytics and debugging.

**Features:**

- Complete tool execution history
- Performance metrics (execution time)
- Success/failure tracking with error details
- Arguments and results storage for debugging

#### `file_attachments`

Processed file content with security validation.

**Features:**

- Original file metadata preservation
- Processed content for Claude API
- Security scanning results
- Processing status tracking
- Content summarization

### Analytics Tables

#### `usage_analytics`

Daily aggregated usage statistics for cost and usage tracking.

**Aggregation Strategy:**

- Daily granularity per user/conversation/model
- Automatic aggregation via triggers or batch jobs
- Supports cost analysis and budgeting
- Tool usage patterns for optimization

#### `chat_settings`

User preferences and configuration.

**Configuration Areas:**

- UI preferences (theme, language)
- Default chat behavior (model, temperature)
- Privacy settings (analytics, retention)
- Export preferences

## Indexes and Performance

### Query Optimization

**Conversation Listing:**

```sql
-- Optimized for chat interface main view
INDEX idx_conversations_user_updated (user_id, updated_at DESC)
```

**Message History:**

```sql
-- Optimized for loading conversation messages
INDEX idx_messages_conversation_sequence (conversation_id, sequence_number)
```

**Search Operations:**

```sql
-- Full-text search support
INDEX idx_messages_content_fts ON messages(content)
INDEX idx_conversations_title_fts ON conversations(title, description)
```

**Analytics Queries:**

```sql
-- Optimized for usage reporting
INDEX idx_usage_analytics_user_date (user_id, date DESC)
INDEX idx_usage_analytics_model (model)
```

### Performance Considerations

1. **Denormalized Statistics**: `message_count`, `total_tokens_used` in conversations table
2. **Efficient Cascades**: Foreign key CASCADE deletes for data consistency
3. **Strategic Indexing**: Indexes align with common UI query patterns
4. **View Optimization**: Pre-built views for complex queries

## Security Architecture

### API Key Protection

**Encryption Flow:**

1. User enters plaintext API key
2. Generate random salt (32 bytes)
3. Derive encryption key using PBKDF2-SHA256 (100,000 iterations)
4. Generate random IV (12 bytes for GCM)
5. Encrypt using AES-256-GCM
6. Store: `{encrypted_data, iv, salt, version}`

**Key Retrieval:**

1. Load encrypted data, IV, and salt from database
2. Derive same encryption key using stored salt
3. Decrypt using AES-256-GCM
4. Use decrypted key for Claude API calls
5. Update `last_used_at` timestamp

### Data Isolation

- All tables include `user_id` for multi-tenant support
- Foreign key constraints ensure data integrity
- CASCADE deletes prevent orphaned records
- User-specific settings and preferences

## Migration Strategy

### Database Migration Process

1. **Version Check**: Query `chat_schema_version` table
2. **Migration Files**: Apply numbered migration scripts in order
3. **Transaction Safety**: All migrations wrapped in transactions
4. **Rollback Support**: Include rollback scripts for each migration
5. **Data Validation**: Verify data integrity after migration

### LocalStorage Migration

**Migration from Browser Storage:**

1. Export existing conversations from localStorage
2. Transform data format to match database schema
3. Insert conversations and messages with proper relationships
4. Preserve message ordering and timestamps
5. Migrate API key (re-encrypt with new system)
6. Validate migrated data integrity
7. Clear localStorage after successful migration

## Usage Patterns

### Common Queries

**Load Conversation List:**

```sql
SELECT * FROM conversation_summary
WHERE user_id = ? AND is_archived = false
ORDER BY last_message_at DESC
LIMIT 20;
```

**Load Conversation Messages:**

```sql
SELECT m.*, fa.filename, fa.original_size
FROM messages m
LEFT JOIN file_attachments fa ON m.id = fa.message_id
WHERE m.conversation_id = ?
ORDER BY m.sequence_number ASC;
```

**Usage Analytics:**

```sql
SELECT * FROM usage_summary
WHERE date >= date('now', '-30 days')
ORDER BY date DESC;
```

### Maintenance Operations

**Clean Old Data:**

```sql
-- Based on user settings (auto_delete_after_days)
DELETE FROM conversations
WHERE user_id = ?
  AND is_archived = true
  AND updated_at < date('now', '-' || ? || ' days');
```

**Update Usage Statistics:**

```sql
-- Aggregate daily usage (typically run via trigger or batch job)
INSERT OR REPLACE INTO usage_analytics (user_id, date, model, ...)
SELECT user_id, date(created_at), model, COUNT(*), ...
FROM messages m JOIN conversations c ON m.conversation_id = c.id
WHERE date(m.created_at) = date('now')
GROUP BY user_id, date(created_at), model;
```

## Integration Points

### MCP Server Integration

The schema integrates with the lifecycle-mcp server by:

1. **Tool Discovery**: Store tool usage in `tool_calls` table
2. **Database Sharing**: Use same SQLite file as lifecycle entities
3. **Migration Scripts**: Extend existing database with chat tables
4. **Consistent Patterns**: Follow same ID and timestamp conventions

### Frontend Integration

The schema supports frontend requirements:

1. **Reactive Updates**: Triggers maintain computed fields
2. **Search Capabilities**: Full-text indexes for message search
3. **Pagination**: Efficient ordering and limiting
4. **Export Features**: Views provide aggregated data for exports

## Schema Evolution

### Version Management

- `chat_schema_version` table tracks applied migrations
- Migration scripts are numbered and sequential
- Each migration includes description and timestamp
- Rollback scripts available for safe downgrades

### Future Enhancements

**Planned Extensions:**

1. **Conversation Sharing**: Add sharing permissions and links
2. **Team Collaboration**: Multi-user conversation support
3. **Plugin System**: Extensible tool integration
4. **Advanced Analytics**: ML-based usage insights
5. **Backup/Sync**: Cloud synchronization capabilities

### Backwards Compatibility

- New columns added with DEFAULT values
- Existing queries continue to work
- Optional features gracefully degrade
- Migration preserves all existing data

## Performance Benchmarks

**Expected Performance (SQLite):**

- Conversation list: < 10ms (indexed query)
- Message loading: < 50ms (500 messages with attachments)
- Search operations: < 100ms (full-text search)
- Usage analytics: < 200ms (30-day aggregation)

**Scaling Considerations:**

- 10,000+ conversations per user
- 100,000+ messages per conversation
- 1GB+ database size
- Efficient pagination and lazy loading required
