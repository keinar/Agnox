# ============================================
# Docusaurus Documentation Site Dockerfile
# Multi-stage build for production deployment
# ============================================

# Stage 1: Build the Docusaurus static site
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files for dependency installation
COPY apps/docs/package*.json ./

# Install dependencies
RUN npm ci --only=production=false

# Copy Docusaurus configuration and source files
COPY apps/docs/docusaurus.config.ts ./
COPY apps/docs/sidebars.ts ./
COPY apps/docs/tsconfig.json ./
COPY apps/docs/src ./src
COPY apps/docs/static ./static

# Copy the root docs folder (content source)
COPY docs /docs

# Build the static site
# Note: docs path in config is relative to apps/docs, so we use /docs
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine AS production

# Copy nginx configuration for SPA routing
RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html; \
    \
    # Gzip compression \
    gzip on; \
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript; \
    \
    # Cache static assets \
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ { \
        expires 1y; \
        add_header Cache-Control "public, immutable"; \
    } \
    \
    # SPA fallback - serve index.html for all routes \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    \
    # Security headers \
    add_header X-Frame-Options "SAMEORIGIN" always; \
    add_header X-Content-Type-Options "nosniff" always; \
    add_header X-XSS-Protection "1; mode=block" always; \
}' > /etc/nginx/conf.d/default.conf

# Copy built static files from builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
