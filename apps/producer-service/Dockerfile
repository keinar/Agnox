FROM node:18-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.json ./

COPY packages/shared-types ./packages/shared-types

COPY apps/producer-service ./apps/producer-service

RUN npm ci

WORKDIR /app/packages/shared-types
RUN npm run build

WORKDIR /app/apps/producer-service
RUN npm run build

FROM node:18-alpine

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared-types ./packages/shared-types
COPY --from=builder /app/apps/producer-service/dist ./apps/producer-service/dist
COPY --from=builder /app/apps/producer-service/package.json ./apps/producer-service/

ENV NODE_ENV=production

WORKDIR /app/apps/producer-service
CMD ["node", "dist/index.js"]