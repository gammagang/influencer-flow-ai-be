import path from 'path'

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Influencer Flow AI API with JSDoc',
      version: '1.0.0',
      description:
        'API documentation for the Influencer Flow AI backend services, generated with swagger-jsdoc.'
    },
    servers: [
      {
        url: '/api',
        description: 'Development server'
      }
    ],
    components: {} // Add an empty components object
  },
  // Path to the API docs
  // Note that this path is relative to the directory from which the app is run
  apis: [
    path.join(__dirname, '../app.ts'), // Path to the app.ts file for global definitions like healthcheck
    path.join(__dirname, '../routes/**/*.ts') // Path to all .ts files in the routes directory
  ]
}

export default options
