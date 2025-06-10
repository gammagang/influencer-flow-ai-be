Implement a creator discovery service by integrating the Ylytic Discovery Search API with the following specifications:

1. Create a new TypeScript library `discover.ts` in the `api` folder to handle creator discovery operations:

   - Use the API endpoint: `GET https://docs.ylytic.com/ylytic/discovery-search-api`
   - Follow the official API documentation at https://docs.ylytic.com/ylytic/rest-apis/api-overview/discovery-search-api

2. Requirements for the library:

   - Export a primary function `discoverCreator` that interfaces with the Discovery Search API
   - Implement strict TypeScript type safety for all request parameters and response objects
   - Handle API authentication requirements as specified in the documentation
   - Include error handling and appropriate HTTP status codes
   - Follow RESTful best practices

3. Technical Specifications:

   - The `discoverCreator` function should:
     - Accept all valid query parameters as defined in the API documentation
     - Return properly typed response objects
     - Maintain a clean, single-responsibility architecture
     - Provide appropriate error handling and validation

4. Integration Requirements:
   - The library should be easily consumable by the `/creator` route
   - Maintain separation of concerns between API interaction and route handling
   - Implement proper error propagation to the route layer
   - Include appropriate logging and monitoring hooks

Please provide a production-ready implementation following these specifications, ensuring code quality and maintainability.
