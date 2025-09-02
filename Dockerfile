FROM node:20-alpine

# Create non-root user (UID/GID fixed)
RUN addgroup -g 1001 -S monitor && adduser -S monitor -u 1001 -G monitor

WORKDIR /app

# OS deps: docker-cli for discovery, curl for healthcheck, tzdata, su-exec to drop privileges
RUN apk update && apk add --no-cache curl docker-cli tzdata su-exec

# Install production deps
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# App files
COPY write_status.js static-server.js status-updater.js ./
COPY public/ ./public/
COPY config.json.example ./config/config.json

# Entry point script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Writable dirs
RUN mkdir -p /app/data /app/logs /app/config && chown -R monitor:monitor /app

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -fsS http://localhost:8080/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "static-server.js"]
