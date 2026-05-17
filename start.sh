#!/bin/bash
# GA-Go UI Production Startup Script
# Usage: ./start.sh [port]
# Default port: 3000

PORT=${1:-3000}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Check if .next exists (built)
if [ ! -d ".next" ]; then
    echo "[GA-Go UI] No build found. Building..."
    npx next build || { echo "[GA-Go UI] Build failed!"; exit 1; }
fi

echo "[GA-Go UI] Starting on port $PORT..."
echo "[GA-Go UI] URL: http://127.0.0.1:$PORT"
echo "[GA-Go UI] Press Ctrl+C to stop."

NODE_ENV=production exec npx next start -p "$PORT"
