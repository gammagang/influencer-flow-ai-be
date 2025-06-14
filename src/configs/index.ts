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
  groqModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', //'deepseek-r1-distill-llama-70b'
  yltic: {
    apiKey: process.env.YLYTIC_API_KEY || '',
    isMocked: process.env.IS_YLYTIC_MOCKED === 'true' || false
  },
  elevenLabs: {
    webhookSecret: process.env.ELEVENLABS_WEBHOOK_SECRET || '',
    bypassSecret: process.env.ELEVENLABS_BYPASS_SECRET || ''
  },
  resendApiKey: process.env.RESEND_API_KEY || '',
  docuseal: {
    apiKey: process.env.DOCUSEAL_API_KEY || '',
    templateId: process.env.DOCUSEAL_TEMPLATE_ID || '1',
    url: process.env.DOCUSEAL_URL || 'http://localhost:5000'
  },

  negotiationHostUrl: process.env.NEGOTIATION_HOST_URL || 'http://localhost:8080',
  db: {
    databaseUrl: process.env.DATABASE_URL || ''
  }
})

export default configs()
