FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.json ./

COPY packages/shared-types ./packages/shared-types

COPY apps/dashboard-client ./apps/dashboard-client

RUN npm ci

WORKDIR /app/apps/dashboard-client
RUN npx vite build

FROM nginx:alpine

COPY --from=builder /app/apps/dashboard-client/dist /usr/share/nginx/html

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