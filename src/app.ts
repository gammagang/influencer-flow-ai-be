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
import swaggerDocument from '@/gen/swagger-output.json' // New import

import { jwtMiddleware } from '@/middlewares/jwt'

import { allRoutes } from './routes'

const app = express()

// CORS configuration to allow frontend requests
app.use(
  cors({
    origin: ['http://localhost:8080', 'http://localhost:3000'], // Allow your frontend
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
  })
)

// Raw body parser for ElevenLabs - must come BEFORE express.json()
app.use('/api/elevenlabs', express.raw({ type: '*/*' }))

app.use(express.json())
app.use(helmet())
app.use(compression())

// Setup CLS first
app.use(mInitCLS)

// We do this, as we use a ingress as proxy. To trust the proxy, this line is needed
// X-Forwarded-For will be used to determine users exact IP
app.set('trust proxy', true)

// Swagger UI setup
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument)) // Use swagger-output.json

// Apply JWT middleware to all API routes except healthcheck
app.use('/api', jwtMiddleware, allRoutes)

// import { jwtMiddleware } from '@/middlewares/jwt'

app.get('/healthcheck', async (_: Request, res: Response) => {
  SuccessResponse.send({
    res,
    title: '⚡⚡⚡ Hello ⚡⚡⚡ - Server is healthy 💗'
  })
})

// // For all other routes, it throws a 404 error
app.all('*', async (req: Request) => {
  throw new NotFoundError('Route not found', 'The requested route does not exist', req.path)
})

app.use(mErrorHandler)

export { app }
