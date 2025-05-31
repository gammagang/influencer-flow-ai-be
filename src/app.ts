import express, { type Request, type Response } from 'express'
import 'express-async-errors' // This handles all async errors seamlessly
import helmet from 'helmet'
import compression from 'compression'

import { SuccessResponse } from '@/libs/success-response'
import { NotFoundError } from '@/errors/not-found-error'
import { mInitCLS } from '@/middlewares/cls'
import { mErrorHandler } from '@/middlewares/error-handler'

import swaggerUi from 'swagger-ui-express'
// import swaggerDocument from '@/configs/swagger.json' // We will replace this with swagger-jsdoc
import swaggerJSDoc from 'swagger-jsdoc'
import swaggerJsdocOptions from '@/configs/swagger-jsdoc'

import { allRoutes } from './routes'

const app = express()

app.use(express.json())
app.use(helmet())
app.use(compression())

// Setup CLS first
app.use(mInitCLS)

// We do this, as we use a ingress as proxy. To trust the proxy, this line is needed
// X-Forwarded-For will be used to determine users exact IP
app.set('trust proxy', true)

// Swagger UI setup
const swaggerSpec = swaggerJSDoc(swaggerJsdocOptions)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

app.use('/api', allRoutes)

/**
 * @openapi
 * /healthcheck:
 *   get:
 *     summary: Server Health Check
 *     description: Responds if the server is healthy.
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 title:
 *                   type: string
 *                   example: ⚡⚡⚡ Hello ⚡⚡⚡ - Server is healthy 💗
 */
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
