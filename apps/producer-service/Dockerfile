FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.json ./

COPY packages/shared-types ./packages/shared-types

COPY apps/producer-service ./apps/producer-service

RUN npm install

WORKDIR /app/packages/shared-types
RUN npm run build

WORKDIR /app/apps/producer-service
RUN npm run build

ENV NODE_ENV=production

WORKDIR /app/apps/producer-service
CMD ["node", "dist/apps/producer-service/src/index.js"]