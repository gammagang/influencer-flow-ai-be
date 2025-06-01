export const configs = () => ({
  host: process.env.HOST || '0.0.0.0',
  swaggerHost: process.env.SWAGGER_HOST || '0.0.0.0',
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  cls: {
    namespace: process.env.CLS_REQ_NAMESPACE || 'req_session',
    correlationIdField: process.env.CORR_ID || 'x-correlation-id'
  },
  groqApiKey: process.env.GROQ_API_KEY || '',
  ylyticApiKey: process.env.YLYTIC_API_KEY || '',
  elevenLabsWebhookKey: process.env.ELEVENLABS_WEBHOOK_SECRET || ''
})

export default configs()
