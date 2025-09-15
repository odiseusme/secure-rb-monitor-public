FROM node:20-alpine

# Accept a build ARG for the Docker group GID, but do NOT default—force user to provide!
ARG DOCKER_GID

# Abort if DOCKER_GID is missing!
RUN if [ -z "$DOCKER_GID" ]; then \
      echo "ERROR: DOCKER_GID build arg not set. Run './select_host_port.sh' before building."; \
      exit 1; \
    fi

# Ensure docker group exists with correct GID (from DOCKER_GID build arg)
RUN addgroup -g ${DOCKER_GID} docker || true

# Create monitor user (Alpine syntax), add to both 'monitor' and 'docker' groups
RUN addgroup -S monitor && adduser -S monitor -G monitor && addgroup monitor docker

WORKDIR /app

# OS deps: docker-cli for discovery, curl for healthcheck, tzdata, su-exec to drop privileges
RUN apk update && apk add --no-cache curl docker-cli tzdata su-exec

# Install production deps
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# App files
COPY write_status.js static-server.js status-updater.js ./
COPY config.json ./
COPY public/ ./public/
COPY config.json.example ./config/config.json

# Entry point script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Ensure monitor owns ALL files (fixes permission for writes!)
RUN chown -R monitor:monitor /app

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -fsS http://localhost:8080/health || exit 1

COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh
RUN chown -R node:node /app
USER node
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "static-server.js"]
