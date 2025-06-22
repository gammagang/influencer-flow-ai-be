'use strict'

import 'dotenv/config'

import http from 'http'

import configs from '@/configs'
import { app } from './app'
import { log } from '@/libs/logger'
import { testDbConnection } from './libs/db'
import { testDatabaseConnection, initializeDatabaseTables } from './libs/database'
import { logChatStartup } from '@/libs/chat-validation'

const { host, port } = configs

const server = http.createServer(app)

process.on('unhandledRejection', (e) => {
  log.error('Global unhandledRejection Handler', e)
})

process.on('uncaughtException', (e) => {
  log.error('Global uncaught exception Handler', e)
  process.exit(1)
})

server.listen(port, host, async () => {
  await testDbConnection()

  // Initialize database tables for conversations if using database store
  if (process.env.USE_DATABASE_CONVERSATION_STORE === 'true') {
    try {
      await testDatabaseConnection()
      await initializeDatabaseTables()
      log.info('Database conversation store initialized successfully')
    } catch (error) {
      log.error('Failed to initialize database conversation store:', error)
    }
  }

  log.info(`Server is up and running at ${host}:${port}`, { host, port })

  // Validate and log chat API status
  logChatStartup()
})
