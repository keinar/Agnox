FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.json ./
COPY packages/shared-types ./packages/shared-types
COPY apps/producer-service ./apps/producer-service

RUN npm install

RUN npm list zod || echo "Zod not found in root!"

WORKDIR /app/packages/shared-types
RUN npm run build

WORKDIR /app/apps/producer-service
RUN npm run build

ENV NODE_ENV=production

ENV NODE_PATH=/app/node_modules

WORKDIR /app/apps/producer-service

CMD ["node", "dist/apps/producer-service/src/index.js"]