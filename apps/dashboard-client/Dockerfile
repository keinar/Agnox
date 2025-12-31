# Stage 1: Build the React application
FROM node:18-alpine AS builder

# Define build arguments
ARG VITE_API_URL
# Set environment variable for build time
ENV VITE_API_URL=$VITE_API_URL

WORKDIR /app

# Copy root configurations
COPY package.json package-lock.json ./
COPY tsconfig.json ./

# Copy necessary packages for monorepo build
COPY packages/shared-types ./packages/shared-types
COPY apps/dashboard-client ./apps/dashboard-client

# Install dependencies using legacy-peer-deps for monorepo compatibility
RUN npm install --legacy-peer-deps

# Build the specific application
WORKDIR /app/apps/dashboard-client
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:alpine

# Fix: Copy from the correct stage name 'builder'
COPY --from=builder /app/apps/dashboard-client/dist /usr/share/nginx/html

# Custom Nginx configuration to handle React Router (SPA)
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