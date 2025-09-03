#!/usr/bin/env sh
set -e

SOCK="/var/run/docker.sock"
APP_USER="monitor"

# If docker socket exists, align group permissions so non-root user can access it
if [ -S "$SOCK" ]; then
  SOCK_GID="$(stat -c '%g' "$SOCK" 2>/dev/null || echo "")"
  if [ -n "$SOCK_GID" ]; then
    # Create a group for the socket GID if missing
    if ! getent group "$SOCK_GID" >/dev/null 2>&1; then
      addgroup -g "$SOCK_GID" dockersock 2>/dev/null || true
    fi
    DOCKER_GRP_NAME="$(getent group "$SOCK_GID" | cut -d: -f1)"
    # Add monitor user to that group (Alpine syntax!)
    if ! id -nG "$APP_USER" | grep -qw "$DOCKER_GRP_NAME"; then
      addgroup "$APP_USER" "$DOCKER_GRP_NAME" 2>/dev/null || true
    fi
  fi
fi

# Drop privileges if currently root
if [ "$(id -u)" = "0" ]; then
  exec su-exec "$APP_USER" "$@"
else
  exec "$@"
fi
