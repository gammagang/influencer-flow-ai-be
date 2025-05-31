import { Schema } from 'zod'
import { log } from '@/libs/logger'
import { RequestValidationError } from '@/errors/request-validation-error'

export function validateRequest<T>(schema: Schema<T>, payload: any, instance: string) {
  log.info('Validator Validating :::', { schema, payload })

  const info = schema.safeParse(payload)
  if (info.success) return info.data

  throw new RequestValidationError(instance, info.error)
}
