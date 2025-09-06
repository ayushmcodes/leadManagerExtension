#!/bin/bash

# setup.sh - Setup script for Go Redis Cache Server

set -e

echo "🚀 Setting up Go Redis Cache Server for LinkedIn Lead Generator"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Go is installed
check_go() {
    if command -v go &> /dev/null; then
        GO_VERSION=$(go version | grep -o 'go[0-9]\+\.[0-9]\+\.[0-9]\+')
        print_success "Go is installed: $GO_VERSION"
    else
        print_error "Go is not installed!"
        echo ""
        echo "Please install Go from: https://golang.org/download/"
        echo ""
        echo "Installation commands:"
        echo "  macOS (Homebrew):    brew install go"
        echo "  Ubuntu/Debian:       sudo snap install go --classic"
        echo "  Windows:             Download installer from golang.org"
        exit 1
    fi
}

# Check if Redis is installed
check_redis() {
    if command -v redis-server &> /dev/null; then
        REDIS_VERSION=$(redis-server --version | head -n1)
        print_success "Redis is installed: $REDIS_VERSION"
    else
        print_error "Redis is not installed!"
        echo ""
        echo "Install Redis:"
        echo "  macOS:        brew install redis"
        echo "  Ubuntu:       sudo apt install redis-server"
        echo "  Windows:      https://redis.io/download"
        echo ""
        echo "Or use Docker: docker run -d -p 6379:6379 redis:latest"
        exit 1
    fi
}

# Check if Redis is running
check_redis_running() {
    if redis-cli ping > /dev/null 2>&1; then
        print_success "Redis server is running"
    else
        print_warning "Redis server is not running"
        print_status "Starting Redis server..."
        
        if command -v brew &> /dev/null; then
            # macOS with Homebrew
            brew services start redis || redis-server --daemonize yes
        elif systemctl --version &> /dev/null; then
            # Linux with systemd
            sudo systemctl start redis-server 2>/dev/null || redis-server --daemonize yes
        else
            # Fallback
            redis-server --daemonize yes
        fi
        
        sleep 2
        
        if redis-cli ping > /dev/null 2>&1; then
            print_success "Redis server started successfully"
        else
            print_error "Failed to start Redis server"
            print_status "Try starting Redis manually: redis-server"
            exit 1
        fi
    fi
}

# Initialize Go module
setup_go_module() {
    print_status "Setting up Go module..."
    
    if [ ! -f "go.mod" ]; then
        go mod init lead-generator-cache
        print_success "Go module initialized"
    else
        print_success "Go module already exists"
    fi
    
    print_status "Installing Go dependencies..."
    go mod download
    go mod tidy
    print_success "Dependencies installed successfully"
}

# Build the application
build_app() {
    print_status "Building the cache server..."
    go build -o cache-server .
    print_success "Cache server built successfully"
    
    # Make it executable
    chmod +x cache-server
}

# Create start script
create_start_script() {
    print_status "Creating start script..."
    
    cat > start-server.sh << 'EOF'
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
EOF
    
    chmod +x start-server.sh
    print_success "Start script created: ./start-server.sh"
}

# Create a simple status check script
create_status_script() {
    print_status "Creating status check script..."
    
    cat > status.sh << 'EOF'
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
EOF
    
    chmod +x status.sh
    print_success "Status script created: ./status.sh"
}

# Create systemd service (optional, for Linux)
create_systemd_service() {
    if systemctl --version &> /dev/null && [ "$EUID" -eq 0 ]; then
        print_status "Creating systemd service..."
        
        CURRENT_DIR=$(pwd)
        USER_NAME=$(whoami)
        
        cat > /etc/systemd/system/lead-generator-cache.service << EOF
[Unit]
Description=LinkedIn Lead Generator Cache Server
After=redis.service
Requires=redis.service

[Service]
Type=simple
User=$USER_NAME
WorkingDirectory=$CURRENT_DIR
ExecStart=$CURRENT_DIR/cache-server
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
        
        systemctl daemon-reload
        print_success "Systemd service created. Enable with: sudo systemctl enable lead-generator-cache"
    fi
}

# Update manifest.json to allow localhost requests
update_manifest() {
    print_status "Updating manifest.json for localhost access..."
    
    if [ -f "manifest.json" ]; then
        # Check if localhost permission already exists
        if grep -q "http://localhost:3001" manifest.json; then
            print_success "Manifest.json already configured for localhost access"
        else
            # Create a backup
            cp manifest.json manifest.json.backup
            
            # Add localhost permission (this is a simple approach)
            print_warning "You may need to manually add 'http://localhost:3001/*' to host_permissions in manifest.json"
        fi
    fi
}

# Main setup process
main() {
    echo ""
    print_status "Starting setup process..."
    echo ""
    
    check_go
    check_redis
    check_redis_running
    setup_go_module
    build_app
    create_start_script
    create_status_script
    update_manifest
    
    echo ""
    print_success "🎉 Setup completed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Start the cache server:"
    echo "   ./start-server.sh"
    echo ""
    echo "2. Or use make commands:"
    echo "   make run          # Run with go run"
    echo "   make dev          # Run with auto-reload"
    echo "   make quick-start  # Setup and start everything"
    echo ""
    echo "3. Check server status:"
    echo "   ./status.sh"
    echo ""
    echo "4. Test the server:"
    echo "   curl http://localhost:3001/health"
    echo ""
    echo "5. Reload your Chrome extension to use the new Go cache server!"
    echo ""
}

# Handle command line arguments
case "${1:-setup}" in
    "setup"|"")
        main
        ;;
    "check")
        check_go
        check_redis
        check_redis_running
        ;;
    "build")
        setup_go_module
        build_app
        ;;
    "start")
        check_redis_running
        if [ -f "cache-server" ]; then
            ./cache-server
        else
            print_error "Cache server binary not found. Run setup first."
            exit 1
        fi
        ;;
    "help"|"-h"|"--help")
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  setup (default)  - Full setup process"
        echo "  check           - Check prerequisites only"
        echo "  build           - Build the application only"
        echo "  start           - Start the cache server"
        echo "  help            - Show this help message"
        ;;
    *)
        print_error "Unknown command: $1"
        echo "Run '$0 help' for available commands"
        exit 1
        ;;
esac
