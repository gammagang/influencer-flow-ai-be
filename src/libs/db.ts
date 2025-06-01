import configs from '@/configs'
import postgres from 'postgres'
import { log } from './logger'

// const { host, port, user, password, database } = configs.db
const sql = postgres(configs.db.databaseUrl)

// Test the database connection
export async function testDbConnection() {
  try {
    await sql`SELECT 1`
    log.info('Database connection successful!')
  } catch (error) {
    log.error('Database connection failed:', error)
    throw new Error('Failed to connect to the database.')
  }
}

export { sql }
