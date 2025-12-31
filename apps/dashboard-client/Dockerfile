# Stage 1: Build the React application
FROM node:20-alpine AS builder

# Install build essentials and compatibility libraries for ARM64
RUN apk add --no-cache libc6-compat

# Define build arguments
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

WORKDIR /app

# Copy configuration files first (for better caching)
COPY package.json package-lock.json tsconfig.json ./

# Copy the required packages for the build
COPY packages/shared-types ./packages/shared-types
COPY apps/dashboard-client ./apps/dashboard-client

# Clean install dependencies
# We also explicitly install the missing rollup binary to bypass the npm monorepo bug
RUN npm install --legacy-peer-deps && \
    npm install @rollup/rollup-linux-arm64-musl --save-optional --legacy-peer-deps

# Build the dashboard app
WORKDIR /app/apps/dashboard-client
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy build artifacts from builder stage
COPY --from=builder /app/apps/dashboard-client/dist /usr/share/nginx/html

# SPA config for Nginx
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]