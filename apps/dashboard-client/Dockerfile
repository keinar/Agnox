# Stage 1: Build the React application
FROM node:20-alpine AS builder

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

WORKDIR /app

# Copy configuration files
COPY package.json package-lock.json tsconfig.json ./

# Copy shared packages and the specific app (Monorepo structure)
COPY packages/shared-types ./packages/shared-types
COPY apps/dashboard-client ./apps/dashboard-client

# Install dependencies 
# We use --legacy-peer-deps for monorepo stability
# npm will automatically detect ARM64 and download correct binaries (like rollup)
RUN npm install --legacy-peer-deps

# Build the application
WORKDIR /app/apps/dashboard-client
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy the built files from the builder stage
COPY --from=builder /app/apps/dashboard-client/dist /usr/share/nginx/html

# Custom Nginx config for Single Page Application (SPA) routing
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