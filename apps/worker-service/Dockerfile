# Use a lightweight Node image as this is only an orchestrator
FROM node:20-slim

WORKDIR /app

# Copy monorepo configuration
COPY package.json package-lock.json tsconfig.json ./
COPY packages/shared-types ./packages/shared-types
COPY apps/worker-service ./apps/worker-service

# Install dependencies including 'dockerode'
RUN npm install --legacy-peer-deps

# Install Java (for Allure) and Allure Commandline
RUN apt-get update && apt-get install -y default-jre-headless && rm -rf /var/lib/apt/lists/*
RUN npm install -g allure-commandline

# Build shared types first
WORKDIR /app/packages/shared-types
RUN npm run build

# Build the worker manager
WORKDIR /app/apps/worker-service
RUN npm run build

ENV NODE_ENV=production

# The manager script runs as the entry point
CMD ["node", "dist/worker.js"]