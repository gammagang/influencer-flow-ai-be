import configs from '@/configs'
import swaggerAutogen from 'swagger-autogen'

const doc = {
  info: {
    version: '1.0.0',
    title: 'Influencer Flow AI API',
    description:
      'Automatically generated API documentation for the Influencer Flow AI backend services.'
  },
  servers: [
    {
      url: configs.host, // Use environment variable or fallback
      description: 'Development server'
    }
  ]
  // consumes and produces are generally not needed at the top level in OpenAPI 3.0
  // They are defined per operation in requestBody.content and responses.content
}

const outputFile = 'src/gen/swagger-output.json' // Path relative to project root
const endpointsFiles = [
  '../app.ts' // Adjusted path
]

const swaggerGenerator = swaggerAutogen({ openapi: '3.0.0' })

swaggerGenerator(outputFile, endpointsFiles, doc).then(() => {
  console.log('Swagger documentation generated successfully: ' + outputFile)
  // If you need to start your server after generation (e.g. for testing with the new docs)
  // require('../../dist/main'); // or wherever your compiled server start script is - path adjusted
})
