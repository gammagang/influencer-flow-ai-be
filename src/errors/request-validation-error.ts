import { ZodError } from 'zod'
import { CustomError } from './custom-error'

export class RequestValidationError extends CustomError {
  statusCode = 400
  // IANA reference
  type = 'https://www.rfc-editor.org/rfc/rfc9110.html#name-400-bad-request'

  constructor(
    public instance: string,
    public error: ZodError
  ) {
    super('Bad Request')
    Object.setPrototypeOf(this, RequestValidationError.prototype)
  }

  serializeErrors() {
    return {
      type: this.type,
      title: 'Bad Request',
      status: this.statusCode,
      detail: 'The request could not be processed due to invalid request',
      instance: this.instance,
      validationErrors: this.error.errors
    }
  }
}
