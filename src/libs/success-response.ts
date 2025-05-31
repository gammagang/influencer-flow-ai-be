import { Response } from 'express'
import { Messages } from './constants'

type SuccessCodes = 200 | 201 | 204

interface ISuccessResponse {
  res: Response
  data?: any
  title?: string
  detail?: string
  status?: SuccessCodes
}

/**
 * Static class for sending back all Success responses with a data and message in the res.body
 */
export abstract class SuccessResponse {
  static send(params: ISuccessResponse) {
    const { res, data = null, title = Messages.Success, status = 200, detail = '' } = params
    res.status(status).send({ title, detail, status, data })
  }
}
