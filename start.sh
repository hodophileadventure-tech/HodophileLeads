#!/bin/sh
set -e

echo "Starting TRIPNEXUS backend..."
cd /app/backend
node dist/index.js > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Give backend time to start
echo "Waiting for backend to start..."
sleep 3

echo "Starting TRIPNEXUS frontend with nginx..."
cd /

# Start nginx in foreground (this will block)
exec nginx -g 'daemon off;'
