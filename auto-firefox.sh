#!/bin/bash
# This script will be executed inside the container

# Wait for desktop to be fully ready
sleep 8

# Set display
export DISPLAY=:1

# Install Firefox if not present
if ! command -v firefox &> /dev/null; then
    apt-get update -qq
    apt-get install -y -qq firefox
fi

# Open Firefox with the target URL
firefox "$TARGET_URL" &

echo "Firefox launched with $TARGET_URL"
