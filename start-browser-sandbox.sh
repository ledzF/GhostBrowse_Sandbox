#!/bin/bash

echo "🔒 Starting Browser Sandbox..."

# Kill any existing node processes
pkill -f "server.js" 2>/dev/null
sleep 1

# Clean up old containers
docker ps -a | grep "browser-" | awk '{print $1}' | xargs -r docker stop 2>/dev/null
docker ps -a | grep "browser-" | awk '{print $1}' | xargs -r docker rm 2>/dev/null

# Make sure we're in the right directory
cd ~/browser-sandbox

# Install dependencies if needed
if [ ! -d "node_modules/express" ]; then
    echo "Installing dependencies..."
    npm install express http-proxy
fi

# Start server
echo "Starting server..."
node server.js
