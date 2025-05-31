import { CustomError, ExtendedProblemDetails } from './custom-error'

export class NotFoundError extends CustomError {
  statusCode = 404
  // IANA reference
  type = 'https://www.rfc-editor.org/rfc/rfc9110.html#name-404-not-found'

  constructor(
    public override message: string,
    public detail: string,
    public instance: string
  ) {
    super(message)
    Object.setPrototypeOf(this, NotFoundError.prototype)
  }

  serializeErrors(): ExtendedProblemDetails {
    return {
      type: this.type,
      title: this.message,
      status: this.statusCode,
      detail: this.detail,
      instance: this.instance
    }
  }
}
