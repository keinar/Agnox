FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/dashboard-client ./apps/dashboard-client
RUN npm ci
WORKDIR /app/apps/dashboard-client
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/apps/dashboard-client/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]