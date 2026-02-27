FROM mcr.microsoft.com/playwright:v1.58.2-jammy

WORKDIR /app

# Set default Environment variables for CI testing against staging/prod
ENV BASE_URL=https://agnox.dev

COPY package*.json ./
RUN npm ci

COPY . .

RUN chmod +x /app/entrypoint.sh
