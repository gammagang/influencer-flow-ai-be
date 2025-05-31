const swaggerAutogen = require('swagger-autogen')

const doc = {
  info: {
    version: '1.0.0',
    title: 'Influencer Flow AI API',
    description:
      'Automatically generated API documentation for the Influencer Flow AI backend services.'
  },
  servers: [
    {
      url: 'http://localhost:3000', // or your actual host
      description: 'Development server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: "Enter JWT Bearer token in the format 'Bearer <token>'"
      }
    },
    schemas: {
      HealthCheckResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'success' },
          message: { type: 'string', example: 'Server is up and running' },
          data: {
            type: 'object',
            properties: {
              uptime: { type: 'string', example: '123.45 seconds' },
              timestamp: {
                type: 'string',
                format: 'date-time',
                example: '2024-07-20T12:00:00.000Z'
              }
            }
          }
        }
      },
      // TODO: Add other schemas from mvp-apis.md here
      // Example for Company (based on common fields, adjust as per mvp-apis.md)
      Company: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef' },
          name: { type: 'string', example: 'Innovatech Solutions' },
          industry: { type: 'string', example: 'Technology' },
          // Add other company fields here
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        },
        required: ['name']
      },
      CreateCompanyRequest: {
        type: 'object',
        properties: {
          name: { type: 'string', example: 'Innovatech Solutions' },
          industry: { type: 'string', example: 'Technology' }
          // Add other required fields for creation
        },
        required: ['name']
      },
      UpdateCompanyRequest: {
        type: 'object',
        properties: {
          name: { type: 'string', example: 'Innovatech Solutions Inc.' },
          industry: { type: 'string', example: 'Advanced Technology' }
          // Add other fields that can be updated
        }
      }
    }
  }
  // consumes and produces are generally not needed at the top level in OpenAPI 3.0
  // They are defined per operation in requestBody.content and responses.content
}

const outputFile = 'src/gen/swagger-output.json' // Path relative to project root
const endpointsFiles = [
  '../app.ts' // Adjusted path
]

const autogenInstance = swaggerAutogen({ openapi: '3.0.0' })

autogenInstance(outputFile, endpointsFiles, doc).then(() => {
  console.log('Swagger documentation generated successfully: ' + outputFile)
  // If you need to start your server after generation (e.g. for testing with the new docs)
  // require('../../dist/main'); // or wherever your compiled server start script is - path adjusted
})
