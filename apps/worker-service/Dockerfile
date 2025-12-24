FROM mcr.microsoft.com/playwright:v1.56.1-jammy

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and lock file first to leverage Docker cache
COPY package.json package-lock.json ./
COPY tsconfig.json ./

COPY packages/shared-types ./packages/shared-types
COPY apps/worker-service ./apps/worker-service

# Install dependencies
RUN npm ci

WORKDIR /app/packages/shared-types
RUN npm run build

WORKDIR /app/apps/worker-service
RUN npm run build

ENV NODE_ENV=production

# Default command to run when the container starts
CMD ["node", "dist/worker.js"]