#!/bin/bash

# Start script for Go Redis Cache Server

echo "🚀 Starting Go Redis Cache Server..."

# Check if Redis is running
if ! redis-cli ping > /dev/null 2>&1; then
    echo "⚠️ Redis is not running. Starting Redis..."
    
    # Try different methods to start Redis
    if command -v brew > /dev/null; then
        brew services start redis
    elif systemctl --version > /dev/null 2>&1; then
        sudo systemctl start redis-server 2>/dev/null || redis-server --daemonize yes
    else
        redis-server --daemonize yes
    fi
    
    sleep 2
    
    if ! redis-cli ping > /dev/null 2>&1; then
        echo "❌ Failed to start Redis server"
        echo "Please start Redis manually: redis-server"
        exit 1
    fi
    echo "✅ Redis server started"
fi

# Start the cache server
if [ -f "./cache-server" ]; then
    echo "⚡ Starting cache server..."
    ./cache-server
else
    echo "🔨 Binary not found, building first..."
    if [ -f "main.go" ]; then
        go build -o cache-server .
        ./cache-server
    else
        echo "❌ main.go not found in current directory"
        exit 1
    fi
fi
