'use strict'

import 'dotenv/config'

import http from 'http'

import configs from '@/configs'
import { app } from './app'
import { log } from '@/libs/logger'
import { testDbConnection } from './libs/db'

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
  log.info(`Server is up and running at ${host}:${port}`, { host, port })
})
