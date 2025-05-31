import { getNamespace } from 'cls-hooked'
import winston, { format, transports } from 'winston'
import JsonStringifySafe from 'json-stringify-safe'
import { serializeError } from 'serialize-error'

import configs from '@/configs'

const { combine, timestamp, printf, colorize } = format

const bufferSerializer = (_: string, v: any) =>
  v && v.type === 'Buffer' && Array.isArray(v.data) ? '[Buffer]' : v

const stringify = (obj: any) => JsonStringifySafe(obj, bufferSerializer)

// Colored logs appear only in dev
const shouldColorize: winston.Logform.Colorizer[] =
  configs.nodeEnv !== 'production' ? [colorize()] : []

const logFormats = combine(
  ...shouldColorize,
  timestamp(),
  printf((log) => {
    const NS = getNamespace(configs.cls.namespace)
    const corrId = (NS?.get(configs.cls.correlationIdField) || '') as string

    const errorLog = log.error ? `\n - [ERROR] ::  ${stringify(serializeError(log.error))} \n` : ``
    const dataLog = log.data ? `- [DATA] :: ${stringify(log.data)}` : ``

    return `${log.timestamp} - <${corrId}> - [${log.level}] - ${log.message} ${dataLog} ${errorLog}`
  })
)

const logger = winston.createLogger({
  // defaultMeta: { service: configs.serviceName }, // If you want the name to be in every log, use it
  transports: [
    new transports.Console({
      format: logFormats
    })
    //
    // - Write all logs with level `error` and below to `error.log`
    // - Write all logs with level `info` and below to `combined.log`
    //
    // new transports.File({ filename: 'error.log', level: 'error' }),
    // new transports.File({ filename: 'combined.log' })
  ]
})

export const log = {
  info: (message: string, data?: any) => {
    logger.info({ message, data })
  },
  debug: (message: string, data: any) => {
    logger.debug({ message, data })
  },
  error: (message: string, error: any) => {
    logger.error({ message, error })
  }
}
