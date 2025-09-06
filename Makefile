# Makefile for Go Cache Server

.PHONY: build run dev clean setup test docker help

# Default Go commands
GO_CMD = go
GO_BUILD = $(GO_CMD) build
GO_CLEAN = $(GO_CMD) clean
GO_TEST = $(GO_CMD) test
GO_GET = $(GO_CMD) get
BINARY_NAME = cache-server
BINARY_PATH = ./$(BINARY_NAME)

# Build the application
build:
	@echo "🔨 Building Go cache server..."
	$(GO_BUILD) -o $(BINARY_NAME) -v .
	@echo "✅ Build completed: $(BINARY_NAME)"

# Run the application directly with go run
run:
	@echo "🚀 Starting Go cache server..."
	$(GO_CMD) run .

# Run with auto-reload for development
dev:
	@echo "🔄 Starting development server with auto-reload..."
	@if command -v air > /dev/null; then \
		air; \
	else \
		echo "📦 Installing air for auto-reload..."; \
		go install github.com/cosmtrek/air@latest; \
		air; \
	fi

# Run the built binary
start: build
	@echo "⚡ Starting cache server binary..."
	$(BINARY_PATH)

# Setup dependencies and tools
setup:
	@echo "📦 Setting up Go dependencies..."
	$(GO_CMD) mod download
	$(GO_CMD) mod tidy
	@echo "📦 Installing development tools..."
	$(GO_CMD) install github.com/cosmtrek/air@latest
	@echo "✅ Setup completed"

# Test the application
test:
	@echo "🧪 Running tests..."
	$(GO_TEST) -v ./...

# Clean build files
clean:
	@echo "🧹 Cleaning build files..."
	$(GO_CLEAN)
	rm -f $(BINARY_NAME)
	@echo "✅ Clean completed"

# Check Redis connection
check-redis:
	@echo "🔍 Checking Redis connection..."
	@if redis-cli ping > /dev/null 2>&1; then \
		echo "✅ Redis is running"; \
	else \
		echo "❌ Redis is not running. Start it with: redis-server"; \
		exit 1; \
	fi

# Start Redis server
start-redis:
	@echo "🔄 Starting Redis server..."
	@if ! pgrep -x "redis-server" > /dev/null; then \
		redis-server --daemonize yes; \
		echo "✅ Redis server started"; \
	else \
		echo "ℹ️ Redis server is already running"; \
	fi

# Stop Redis server
stop-redis:
	@echo "🛑 Stopping Redis server..."
	@if pgrep -x "redis-server" > /dev/null; then \
		redis-cli shutdown; \
		echo "✅ Redis server stopped"; \
	else \
		echo "ℹ️ Redis server is not running"; \
	fi

# Full development setup
dev-setup: setup start-redis
	@echo "🎯 Development environment ready!"
	@echo "Run 'make dev' to start the server with auto-reload"

# Production build
prod-build:
	@echo "🏗️ Building for production..."
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 $(GO_BUILD) -ldflags="-w -s" -o $(BINARY_NAME) .
	@echo "✅ Production build completed"

# Quick start (setup + start)
quick-start: setup start-redis run
	@echo "🚀 Server started!"

# Show help
help:
	@echo "Available commands:"
	@echo "  build        - Build the cache server binary"
	@echo "  run          - Run the server directly with go run"
	@echo "  dev          - Run with auto-reload for development"
	@echo "  start        - Build and run the binary"
	@echo "  setup        - Install dependencies and tools"
	@echo "  test         - Run tests"
	@echo "  clean        - Clean build files"
	@echo "  check-redis  - Check if Redis is running"
	@echo "  start-redis  - Start Redis server"
	@echo "  stop-redis   - Stop Redis server"
	@echo "  dev-setup    - Complete development setup"
	@echo "  prod-build   - Build for production"
	@echo "  quick-start  - Setup and start everything"
