# Database Conversation Store Setup

This project supports two methods for storing chat conversations:

1. **File-based storage** (default) - Stores conversations as JSON files on disk
2. **Database storage** - Stores conversations in PostgreSQL database

## Switching to Database Storage

To use the PostgreSQL database for conversation storage:

### 1. Set Environment Variable

```bash
# In your .env file
USE_DATABASE_CONVERSATION_STORE=true
```

### 2. Configure Database Connection

Either use individual environment variables:

```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=your_database_name
DB_USER=your_database_user
DB_PASSWORD=your_database_password
```

Or use a connection string:

```bash
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
```

### 3. Run Database Migration

The application will automatically create the required tables when it starts up if `USE_DATABASE_CONVERSATION_STORE=true`.

Alternatively, you can manually run the migration:

```sql
-- Run the SQL commands from docs/db/06_add_conversations_tables.sql
```

## Database Schema

The database conversation store creates two tables:

### `conversations`

- `id` (VARCHAR) - Unique conversation identifier
- `user_id` (VARCHAR) - User who owns the conversation
- `created_at` (TIMESTAMP) - When conversation was created
- `updated_at` (TIMESTAMP) - When conversation was last updated

### `chat_messages`

- `id` (UUID) - Unique message identifier
- `conversation_id` (VARCHAR) - References conversations.id
- `role` (VARCHAR) - Message role: 'system', 'user', 'assistant', 'tool'
- `content` (TEXT) - Message content
- `tool_calls` (JSONB) - Tool calls data (if any)
- `tool_call_id` (VARCHAR) - Tool call identifier (if any)
- `timestamp` (TIMESTAMP) - When message was created

## Features

### Message Limiting

- Automatically limits conversations to 50 messages maximum
- Preserves system messages and most recent messages
- Removes oldest user/assistant messages when limit is exceeded

### Conversation Cleanup

- Automatically removes conversations older than 7 days
- Limits total conversations to 1000 maximum
- Runs cleanup every hour

### One Conversation Per User

- Each user can only have one active conversation
- Creating a new conversation for a user deletes their previous one

## Switching Back to File Storage

To switch back to file-based storage:

1. Set environment variable:

```bash
USE_DATABASE_CONVERSATION_STORE=false
```

2. Restart the application

Note: Conversations stored in the database will not be accessible when using file storage and vice versa.
