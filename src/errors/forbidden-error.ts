import { CustomError } from './custom-error'

export class ForbiddenError extends CustomError {
  statusCode = 403
  // IANA reference
  type = 'https://www.rfc-editor.org/rfc/rfc9110.html#name-403-forbidden'

  constructor(public instance: string) {
    super('Unauthorized')
    Object.setPrototypeOf(this, ForbiddenError.prototype)
  }

  serializeErrors() {
    return {
      type: this.type,
      title: 'Forbidden',
      status: this.statusCode,
      detail: 'You do not have permission to access this resource.',
      instance: this.instance
    }
  }
}
