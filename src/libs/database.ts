import postgres from 'postgres'
import configs from '@/configs'
import { log } from '@/libs/logger'

// Create PostgreSQL connection
const sql = postgres(configs.db.databaseUrl, {
  ssl: process.env.NODE_ENV === 'production' ? 'require' : false,
  max: 20, // Maximum number of connections
  idle_timeout: 20, // Idle timeout in seconds
  connect_timeout: 10, // Connection timeout in seconds
  onnotice: () => {} // Suppress notices
})

// Test database connection
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    await sql`SELECT 1`
    log.info('Database connection established successfully')
    return true
  } catch (error) {
    log.error('Failed to connect to database:', error)
    return false
  }
}

// Initialize database tables (run migrations)
export async function initializeDatabaseTables(): Promise<void> {
  try {
    // Create conversations table
    await sql`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `

    // Create unique index for user_id (one conversation per user)
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS conversations_user_id_unique ON conversations (user_id)`

    // Create index for cleanup queries
    await sql`CREATE INDEX IF NOT EXISTS conversations_updated_at_idx ON conversations (updated_at)`

    // Create chat_messages table
    await sql`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
        content TEXT NOT NULL,
        tool_calls JSONB,
        tool_call_id TEXT,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `

    // Create composite index for conversation message queries (more efficient)
    await sql`CREATE INDEX IF NOT EXISTS chat_messages_conversation_id_timestamp_idx ON chat_messages (conversation_id, timestamp)`

    // Create index for cleanup queries
    await sql`CREATE INDEX IF NOT EXISTS chat_messages_timestamp_idx ON chat_messages (timestamp)`

    log.info('Database tables initialized successfully')
  } catch (error) {
    log.error('Failed to initialize database tables:', error)
    throw error
  }
}

export { sql }
