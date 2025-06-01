import 'dotenv/config'

import swaggerAutoGen from 'swagger-autogen'

const doc = {
  info: {
    version: '1.0.0',
    title: 'Influencer Flow AI API',
    description:
      'Automatically generated API documentation for the Influencer Flow AI backend services.'
  },
  servers: [
    {
      url: `http://localhost:3000`, // Use environment variable or fallback
      description: 'Local server'
    },
    {
      url: 'https://influencer-flow-ai-be.onrender.com',
      description: 'Prod server'
    }
  ],
  // Adding security definitions for JWT Bearer token
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token in the format: Bearer <token>'
      }
    }
  },
  // Apply security globally to all operations
  security: [
    {
      bearerAuth: []
    }
  ]
  // consumes and produces are generally not needed at the top level in OpenAPI 3.0
  // They are defined per operation in requestBody.content and responses.content
}

const outputFile = 'src/gen/swagger-output.json' // Path relative to project root
const endpointsFiles = [
  '../app.ts' // Adjusted path
]

const swaggerGenerator = swaggerAutoGen({ openapi: '3.0.0' })

swaggerGenerator(outputFile, endpointsFiles, doc).then(() => {
  console.log('Swagger documentation generated successfully: ' + outputFile)
  // If you need to start your server after generation (e.g. for testing with the new docs)
  // require('../../dist/main'); // or wherever your compiled server start script is - path adjusted
})
