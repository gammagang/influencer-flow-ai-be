export const configs = () => ({
  host: process.env.HOST || 'localhost',
  swaggerHost: process.env.SWAGGER_HOST || 'localhost',
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  cls: {
    namespace: process.env.CLS_REQ_NAMESPACE || 'req_session',
    correlationIdField: process.env.CORR_ID || 'x-correlation-id'
  },
  groqApiKey: process.env.GROQ_API_KEY || '',
  ylyticApiKey: process.env.YLYTIC_API_KEY || ''
})

export default configs()
