FROM node:20-alpine

# Create non-root user (adjust UID/GID if needed)
RUN addgroup -g 1001 -S monitor && adduser -S monitor -u 1001 -G monitor

WORKDIR /app

# OS deps
RUN apk update && apk add --no-cache curl docker-cli tzdata

# Copy package metadata and install production deps
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy runtime app files (exclude host-only helper scripts)
COPY write_status.js static-server.js status-updater.js ./
COPY public/ ./public/
COPY config.json.example ./config/config.json

# Create writable dirs
RUN mkdir -p /app/data /app/logs /app/config && chown -R monitor:monitor /app

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -fsS http://localhost:8080/health || exit 1

USER monitor

CMD ["node", "static-server.js"]
