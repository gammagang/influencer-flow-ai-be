# Sample Express REST API Template

## Project Overview

A sample REST API template for any backend Express starter project with TypeScript, featuring best practices in place. This template includes comprehensive logging, seamless error handling, standardized error responses, input validation, and bundling.

## Features

- **Express**: Fast, unopinionated, minimalist web framework for Node.js
- **TypeScript**: Typed superset of JavaScript that compiles to plain JavaScript
- **Winston**: Versatile logging library with support for multiple transports
- **Error Handling**: Seamless error handling with standardized responses following `RFC 7807` and `RFC 9457`
- **Webpack**: Bundling for both development and production environments
- **Docker**: Fully Dockerized setup for easy containerization and deployment
- **Zod**: Validation of API inputs with verbose, easy-to-understand error messages
- **Request Tracking**: Each request is tracked by a thread memory-based request ID using `cls-hooked`, facilitating easy debugging by tracking the entire API call lifecycle

## Installation

To install and run the project locally, follow these steps:

1. Enable Corepack and prepare `pnpm`:
   ```bash
   corepack enable && corepack prepare pnpm@9.4.0 --activate
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Start the development server:
   ```bash
   pnpm dev
   ```

## Usage

This is a simple template that exposes a health check endpoint and places all APIs behind the `/api` path. A Not Found handler is already included.

## Development

To start the development server, run:

```bash
pnpm dev
```

## Deployment

This project can be deployed in various ways. A sample Kubernetes deployment and service file will be added in the future.

## License

This project is licensed under the MIT License.

## Input Validation

API inputs are validated using Zod, which provides verbose and easy-to-understand error messages, ensuring robust and clear input validation.

## Request Tracking

Each request is tracked by a thread memory-based request ID using `cls-hooked`, making debugging easy by allowing you to follow the entire API call lifecycle.
