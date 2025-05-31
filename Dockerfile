FROM node:18.18.0-alpine as build

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.4.0 --activate

# Copy and install dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install

# Copy the source code and build
COPY . ./
RUN pnpm build

# Install only production dependencies
RUN pnpm prune --prod

# Use a new stage to create the final image
FROM node:18.18.0-alpine as production

WORKDIR /app

# Copy only the necessary files from the build stage
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
COPY --from=build /app/pnpm-lock.yaml ./

EXPOSE 3000

ENV NODE_ENV=production

CMD ["npm", "start"]
