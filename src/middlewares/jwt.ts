import { Request, Response, NextFunction } from 'express'
import { log } from '@/libs/logger'
import jwt from 'jsonwebtoken'
import { NotAuthorizedError } from '@/errors/not-authorized-error'

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        [key: string]: any
      }
    }
  }
}

export function jwtMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer '))
      throw new NotAuthorizedError('No token provided')

    const token = authHeader.split(' ')[1]
    // Note: decode only, no signature verification as per requirement
    const decoded = jwt.decode(token)

    console.log('Decoded JWT:', decoded) // For debugging purposes

    if (!decoded) throw new NotAuthorizedError('Invalid token')

    req.user = decoded as { [key: string]: any }
    next()
  } catch (error) {
    log.error('JWT Middleware Error:', error)
    next(error)
  }
}
