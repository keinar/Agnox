# Stage 1: Build stage using Node 22 (better ARM64 support)
FROM node:22-alpine AS builder

# Install compatibility libraries for ARM64 and native modules
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Step 1: Copy ONLY package files first to leverage Docker cache
COPY package*.json ./
COPY packages/shared-types/package*.json ./packages/shared-types/
COPY apps/dashboard-client/package*.json ./apps/dashboard-client/

# Step 2: Install ALL dependencies from the root
# We use --legacy-peer-deps to avoid monorepo conflicts
RUN npm install --legacy-peer-deps

# Step 3: Explicitly fix the Rollup ARM64 issue for Oracle Ampere
RUN npm install @rollup/rollup-linux-arm64-musl --save-optional --legacy-peer-deps

# Step 4: Copy the rest of the source code
COPY tsconfig.json ./
COPY packages/shared-types ./packages/shared-types
COPY apps/dashboard-client ./apps/dashboard-client

# Step 5: Build the dashboard app
WORKDIR /app/apps/dashboard-client
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
# Ensure React and other dependencies are linked properly for the build
RUN npm run build

# Stage 2: Production stage with Nginx
FROM nginx:alpine

# Copy the built files
COPY --from=builder /app/apps/dashboard-client/dist /usr/share/nginx/html

# Custom Nginx configuration for SPA routing
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