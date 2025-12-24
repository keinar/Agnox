FROM mcr.microsoft.com/playwright:v1.56.1-jammy

RUN apt-get update && apt-get install -y default-jre

RUN npm install -g allure-commandline

WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.json ./

COPY packages/shared-types ./packages/shared-types
COPY apps/worker-service ./apps/worker-service

RUN npm ci

WORKDIR /app/packages/shared-types
RUN npm run build

WORKDIR /app/apps/worker-service
RUN npm run build

ENV NODE_ENV=production

CMD ["node", "dist/worker.js"]