import express, { type Request, type Response } from 'express'
import 'express-async-errors' // This handles all async errors seamlessly
import helmet from 'helmet'
import compression from 'compression'
import cors from 'cors'

import { SuccessResponse } from '@/libs/success-response'
import { NotFoundError } from '@/errors/not-found-error'
import { mInitCLS } from '@/middlewares/cls'
import { mErrorHandler } from '@/middlewares/error-handler'

import swaggerUi from 'swagger-ui-express'
import swaggerDocument from '@/gen/swagger-output.json'

import { jwtMiddleware } from '@/middlewares/jwt'

import { allRoutes } from './routes'

import configs from './configs'
import { publicRoutes } from './routes/public/route'

const app = express()

const { allowedOrigins } = configs

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl requests)
      if (!origin) return callback(null, true)

      if (!allowedOrigins.includes(origin)) callback(null, true)
      else {
        console.log(`Origin ${origin} not allowed by CORS`)
        callback(null, false)
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
  })
)

// Raw body parser for ElevenLabs - must come BEFORE express.json()
app.use('/public/elevenlabs', express.raw({ type: '*/*' }))

app.use(express.json())
app.use(helmet())
app.use(compression())

// Setup CLS first
app.use(mInitCLS)

// We do this, as we use a ingress as proxy. To trust the proxy, this line is needed
// X-Forwarded-For will be used to determine users exact IP
app.set('trust proxy', true)

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument)) // Use swagger-output.json
app.use('/api', jwtMiddleware, allRoutes)
app.use('/public', publicRoutes)

app.get('/', (_: Request, res: Response) => {
  SuccessResponse.send({
    res,
    data: 'Welcome to Influencer Flow AI Backend'
  })
})

app.get('/health-check', async (_: Request, res: Response) => {
  SuccessResponse.send({
    res,
    data: '⚡⚡⚡ Hello ⚡⚡⚡ - Server is healthy 💗'
  })
})

// For all other routes, it throws a 404 error
app.all('*', async (req: Request) => {
  throw new NotFoundError('Route not found', 'The requested route does not exist', req.path)
})

app.use(mErrorHandler)

export { app }
