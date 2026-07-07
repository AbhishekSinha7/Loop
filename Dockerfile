# Loop — multi-tenant Slack agent.
# node:sqlite needs Node >= 22.5 (see "engines" in package.json).
FROM node:22-slim

WORKDIR /app

# Install production deps first for better layer caching.
COPY package*.json ./
RUN npm ci --omit=dev

# App source.
COPY . .

# SQLite file lives on a mounted volume so installs/data survive restarts.
ENV NODE_ENV=production
ENV LOOP_DB_PATH=/data/loop.db
ENV PORT=3000
VOLUME /data
EXPOSE 3000

# OAuth/HTTP entry (multi-tenant). Socket Mode (npm start) is for local dev only.
CMD ["npm", "run", "start:oauth"]
