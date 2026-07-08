# Loop — multi-tenant Slack agent.
FROM node:22-slim

WORKDIR /app

# Install production deps first for better layer caching.
COPY package*.json ./
RUN npm ci --omit=dev

# App source.
COPY . .

# Data lives in Turso (hosted libSQL) via TURSO_DATABASE_URL — no volume needed.
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# OAuth/HTTP entry (multi-tenant). Socket Mode (npm start) is for local dev only.
CMD ["npm", "run", "start:oauth"]
