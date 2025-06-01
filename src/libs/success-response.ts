import { Response } from 'express'

type SuccessCodes = 200 | 201 | 204

export interface ISuccessResponse<T extends any> {
  res: Response
  data?: T
  title?: string
  detail?: string
  status?: SuccessCodes
}

/**
 * Static class for sending back all Success responses with a data and message in the res.body
 */
export abstract class SuccessResponse {
  static send<T>(params: ISuccessResponse<T>) {
    const { res, data = null, status = 200 } = params
    res.status(status).send({ data })
  }
}
