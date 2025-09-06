#!/bin/bash

echo "📊 LinkedIn Lead Generator Cache Server Status"
echo "============================================="

# Check Redis
if redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis: Running"
else
    echo "❌ Redis: Not running"
fi

# Check Cache Server
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ Cache Server: Running on http://localhost:3001"
    echo ""
    echo "Server Health:"
    curl -s http://localhost:3001/health | json_pp 2>/dev/null || curl -s http://localhost:3001/health
else
    echo "❌ Cache Server: Not running"
fi

echo ""
echo "Cache Statistics:"
curl -s http://localhost:3001/stats | json_pp 2>/dev/null || curl -s http://localhost:3001/stats
