#!/usr/bin/env sh
set -e

APP_USER="monitor"

# Drop privileges if currently root
if [ "$(id -u)" = "0" ]; then
  exec su-exec "$APP_USER" "$@"
else
  exec "$@"
fi
