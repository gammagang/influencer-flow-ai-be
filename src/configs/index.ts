const configs = () => ({
  host: process.env.HOST || 'localhost',
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  allowedOrigins: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
    : ['http://localhost:3000'],
  cls: {
    namespace: process.env.CLS_REQ_NAMESPACE || 'req_session',
    correlationIdField: process.env.CORR_ID || 'x-correlation-id'
  },
  groqApiKey: process.env.GROQ_API_KEY || '',
  ylyticApiKey: process.env.YLYTIC_API_KEY || '',
  elevenLabsWebhookKey: process.env.ELEVENLABS_WEBHOOK_SECRET || '',
  resendApiKey: process.env.RESEND_API_KEY || '',
  db: {
    databaseUrl: process.env.DATABASE_URL || ''
  }
})

export default configs()
