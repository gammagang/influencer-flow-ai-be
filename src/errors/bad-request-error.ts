import { CustomError } from './custom-error'

export class BadRequestError extends CustomError {
  statusCode = 400
  // IANA reference
  type = 'https://www.rfc-editor.org/rfc/rfc9110.html#name-400-bad-request'

  constructor(
    public override message: string,
    public detail: string,
    public instance: string
  ) {
    super(message)
  }

  serializeErrors() {
    return {
      type: this.type,
      title: this.message,
      status: this.statusCode,
      detail: this.detail,
      instance: this.instance
    }
  }
}
