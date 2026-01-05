FROM node:20-slim AS builder

ARG VITE_API_URL

WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.json ./

COPY packages/shared-types ./packages/shared-types
COPY apps/dashboard-client ./apps/dashboard-client

RUN rm package-lock.json

RUN npm install --legacy-peer-deps

WORKDIR /app/apps/dashboard-client
ENV VITE_API_URL=$VITE_API_URL
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