#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/../public"
echo "[*] Serving ./public on http://localhost:8000"
python3 -m http.server 8000
