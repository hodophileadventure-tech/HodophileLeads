#!/bin/sh
set -e

echo "Starting TRIPNEXUS backend..."
cd /app/backend
node dist/index.js &
BACKEND_PID=$!

echo "Backend PID: $BACKEND_PID"
sleep 3

echo "Starting TRIPNEXUS nginx..."
cd /
exec nginx -g 'daemon off;'
