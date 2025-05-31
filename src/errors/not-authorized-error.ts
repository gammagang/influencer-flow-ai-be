import { CustomError } from './custom-error'

export class NotAuthorizedError extends CustomError {
  statusCode = 401
  // IANA reference
  type = 'https://www.rfc-editor.org/rfc/rfc9110.html#name-401-unauthorized'

  constructor(public instance: string) {
    super('Unauthorized')
  }

  serializeErrors() {
    return {
      type: this.type,
      title: 'Unauthorized',
      status: this.statusCode,
      detail: 'Authentication is required and has failed or has not yet been provided.',
      instance: this.instance
    }
  }
}
