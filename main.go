package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

type CacheServer struct {
	redis  *redis.Client
	ctx    context.Context
	router *gin.Engine
}

type CachedData struct {
	Email        string                 `json:"email"`
	Verification map[string]interface{} `json:"verification"`
	Timestamp    int64                  `json:"timestamp"`
}

type CacheResponse struct {
	Success  bool                   `json:"success"`
	Data     map[string]interface{} `json:"data,omitempty"`
	Cached   bool                   `json:"cached,omitempty"`
	CacheAge int64                  `json:"cacheAge,omitempty"`
	Message  string                 `json:"message,omitempty"`
	Deleted  bool                   `json:"deleted,omitempty"`
	Error    string                 `json:"error,omitempty"`
}

type HealthResponse struct {
	Status    string `json:"status"`
	Redis     string `json:"redis"`
	Timestamp string `json:"timestamp"`
	Version   string `json:"version"`
}

type StatsResponse struct {
	Success bool   `json:"success"`
	Stats   Stats  `json:"stats,omitempty"`
	Error   string `json:"error,omitempty"`
}

type Stats struct {
	TotalEntries int64 `json:"totalEntries"`
	NewestEntry  int64 `json:"newestEntry"`
	OldestEntry  int64 `json:"oldestEntry"`
}

type ClearResponse struct {
	Success      bool   `json:"success"`
	DeletedCount int64  `json:"deletedCount"`
	Message      string `json:"message,omitempty"`
	Error        string `json:"error,omitempty"`
}

const (
	CACHE_KEY_PREFIX = "email_verification_"
	SERVER_VERSION   = "1.0.0"
)

func NewCacheServer() *CacheServer {
	// Initialize Redis client
	rdb := redis.NewClient(&redis.Options{
		Addr:         "localhost:6379",
		Password:     "",
		DB:           0,
		DialTimeout:  10 * time.Second,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		PoolSize:     10,
		PoolTimeout:  30 * time.Second,
	})

	ctx := context.Background()

	// Test Redis connection
	_, err := rdb.Ping(ctx).Result()
	if err != nil {
		log.Printf("❌ Failed to connect to Redis: %v", err)
		log.Printf("Make sure Redis is running: redis-server")
		os.Exit(1)
	}

	log.Println("✅ Connected to Redis successfully")

	// Initialize Gin router
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()

	// Custom logging middleware
	router.Use(gin.LoggerWithConfig(gin.LoggerConfig{
		Formatter: func(param gin.LogFormatterParams) string {
			return fmt.Sprintf("%s - [%s] \"%s %s %s %d %s \"%s\" %s\"\n",
				param.ClientIP,
				param.TimeStamp.Format("2006/01/02 - 15:04:05"),
				param.Method,
				param.Path,
				param.Request.Proto,
				param.StatusCode,
				param.Latency,
				param.Request.UserAgent(),
				param.ErrorMessage,
			)
		},
	}))

	router.Use(gin.Recovery())

	// Configure CORS - Allow all origins for development (Chrome extensions need this)
	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	config.AllowCredentials = false // Set to false when allowing all origins
	config.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"}
	config.AllowHeaders = []string{
		"Origin",
		"Content-Length",
		"Content-Type",
		"Authorization",
		"X-Requested-With",
		"Accept",
		"Accept-Language",
		"Accept-Encoding",
	}
	config.ExposeHeaders = []string{"Content-Length"}
	router.Use(cors.New(config))

	server := &CacheServer{
		redis:  rdb,
		ctx:    ctx,
		router: router,
	}

	server.setupRoutes()
	return server
}

func (s *CacheServer) setupRoutes() {
	// Health check
	s.router.GET("/health", s.healthCheck)

	// Cache operations
	s.router.GET("/cache/:email", s.getCachedVerification)
	s.router.POST("/cache/:email", s.setCachedVerification)
	s.router.DELETE("/cache/:email", s.deleteCachedVerification)

	// Statistics and management
	s.router.GET("/stats", s.getCacheStats)
	s.router.DELETE("/cache", s.clearAllCache)

	// Additional utility endpoints
	s.router.GET("/ping", s.ping)
}

func (s *CacheServer) ping(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "pong", "timestamp": time.Now().Unix()})
}

func (s *CacheServer) healthCheck(c *gin.Context) {
	var redisStatus string
	_, err := s.redis.Ping(s.ctx).Result()
	if err != nil {
		redisStatus = "disconnected"
		log.Printf("Redis health check failed: %v", err)
	} else {
		redisStatus = "connected"
	}

	response := HealthResponse{
		Status:    "healthy",
		Redis:     redisStatus,
		Timestamp: time.Now().Format(time.RFC3339),
		Version:   SERVER_VERSION,
	}

	c.JSON(http.StatusOK, response)
}

func (s *CacheServer) getCachedVerification(c *gin.Context) {
	email := strings.ToLower(strings.TrimSpace(c.Param("email")))
	if email == "" {
		c.JSON(http.StatusBadRequest, CacheResponse{
			Success: false,
			Error:   "Email parameter is required",
		})
		return
	}

	cacheKey := CACHE_KEY_PREFIX + email

	cached, err := s.redis.Get(s.ctx, cacheKey).Result()
	if err != nil {
		if err == redis.Nil {
			log.Printf("Cache miss for %s", email)
			c.JSON(http.StatusOK, CacheResponse{
				Success: true,
				Data:    nil,
				Cached:  false,
			})
			return
		}

		log.Printf("Error getting from cache: %v", err)
		c.JSON(http.StatusInternalServerError, CacheResponse{
			Success: false,
			Error:   "Failed to read from cache",
		})
		return
	}

	var cachedData CachedData
	if err := json.Unmarshal([]byte(cached), &cachedData); err != nil {
		log.Printf("Error unmarshaling cached data for %s: %v", email, err)
		c.JSON(http.StatusInternalServerError, CacheResponse{
			Success: false,
			Error:   "Failed to parse cached data",
		})
		return
	}

	now := time.Now().UnixMilli()
	cacheAge := now - cachedData.Timestamp

	log.Printf("Cache hit for %s (cached %d minutes ago)", email, cacheAge/1000/60)

	c.JSON(http.StatusOK, CacheResponse{
		Success:  true,
		Data:     cachedData.Verification,
		Cached:   true,
		CacheAge: cacheAge,
	})
}

func (s *CacheServer) setCachedVerification(c *gin.Context) {
	email := strings.ToLower(strings.TrimSpace(c.Param("email")))
	if email == "" {
		c.JSON(http.StatusBadRequest, CacheResponse{
			Success: false,
			Error:   "Email parameter is required",
		})
		return
	}

	var verificationResult map[string]interface{}
	if err := c.ShouldBindJSON(&verificationResult); err != nil {
		log.Printf("Invalid JSON for %s: %v", email, err)
		c.JSON(http.StatusBadRequest, CacheResponse{
			Success: false,
			Error:   "Invalid JSON in request body",
		})
		return
	}

	cacheKey := CACHE_KEY_PREFIX + email
	cacheData := CachedData{
		Email:        email,
		Verification: verificationResult,
		Timestamp:    time.Now().UnixMilli(),
	}

	dataJSON, err := json.Marshal(cacheData)
	if err != nil {
		log.Printf("Error marshaling cache data for %s: %v", email, err)
		c.JSON(http.StatusInternalServerError, CacheResponse{
			Success: false,
			Error:   "Failed to serialize cache data",
		})
		return
	}

	// Set with no expiration (permanent cache)
	if err := s.redis.Set(s.ctx, cacheKey, dataJSON, 0).Err(); err != nil {
		log.Printf("Error saving to cache for %s: %v", email, err)
		c.JSON(http.StatusInternalServerError, CacheResponse{
			Success: false,
			Error:   "Failed to save to cache",
		})
		return
	}

	log.Printf("✅ Cached verification result for %s", email)
	c.JSON(http.StatusOK, CacheResponse{
		Success: true,
		Message: "Cached successfully",
	})
}

func (s *CacheServer) deleteCachedVerification(c *gin.Context) {
	email := strings.ToLower(strings.TrimSpace(c.Param("email")))
	if email == "" {
		c.JSON(http.StatusBadRequest, CacheResponse{
			Success: false,
			Error:   "Email parameter is required",
		})
		return
	}

	cacheKey := CACHE_KEY_PREFIX + email

	deleted, err := s.redis.Del(s.ctx, cacheKey).Result()
	if err != nil {
		log.Printf("Error removing from cache for %s: %v", email, err)
		c.JSON(http.StatusInternalServerError, CacheResponse{
			Success: false,
			Error:   "Failed to remove from cache",
		})
		return
	}

	log.Printf("🗑️ Removed cached verification for %s (deleted: %d)", email, deleted)
	c.JSON(http.StatusOK, CacheResponse{
		Success: true,
		Deleted: deleted > 0,
	})
}

func (s *CacheServer) getCacheStats(c *gin.Context) {
	keys, err := s.redis.Keys(s.ctx, CACHE_KEY_PREFIX+"*").Result()
	if err != nil {
		log.Printf("Error getting cache stats: %v", err)
		c.JSON(http.StatusInternalServerError, StatsResponse{
			Success: false,
			Error:   "Failed to get cache statistics",
		})
		return
	}

	stats := Stats{
		TotalEntries: int64(len(keys)),
		NewestEntry:  0,
		OldestEntry:  time.Now().UnixMilli(),
	}

	// Sample up to 100 keys to get timestamp statistics
	sampleSize := len(keys)
	if sampleSize > 100 {
		sampleSize = 100
	}

	if sampleSize > 0 {
		for i := 0; i < sampleSize; i++ {
			cached, err := s.redis.Get(s.ctx, keys[i]).Result()
			if err != nil {
				continue
			}

			var cachedData CachedData
			if err := json.Unmarshal([]byte(cached), &cachedData); err != nil {
				continue
			}

			if cachedData.Timestamp > stats.NewestEntry {
				stats.NewestEntry = cachedData.Timestamp
			}
			if cachedData.Timestamp < stats.OldestEntry {
				stats.OldestEntry = cachedData.Timestamp
			}
		}
	}

	log.Printf("📊 Cache stats: %d total entries", stats.TotalEntries)

	c.JSON(http.StatusOK, StatsResponse{
		Success: true,
		Stats:   stats,
	})
}

func (s *CacheServer) clearAllCache(c *gin.Context) {
	keys, err := s.redis.Keys(s.ctx, CACHE_KEY_PREFIX+"*").Result()
	if err != nil {
		log.Printf("Error getting cache keys for deletion: %v", err)
		c.JSON(http.StatusInternalServerError, ClearResponse{
			Success: false,
			Error:   "Failed to get cache keys",
		})
		return
	}

	if len(keys) > 0 {
		deleted, err := s.redis.Del(s.ctx, keys...).Result()
		if err != nil {
			log.Printf("Error clearing cache: %v", err)
			c.JSON(http.StatusInternalServerError, ClearResponse{
				Success: false,
				Error:   "Failed to clear cache",
			})
			return
		}

		log.Printf("🗑️ Cleared %d cached verification entries", deleted)
		c.JSON(http.StatusOK, ClearResponse{
			Success:      true,
			DeletedCount: deleted,
		})
	} else {
		c.JSON(http.StatusOK, ClearResponse{
			Success:      true,
			DeletedCount: 0,
			Message:      "No cache entries to clear",
		})
	}
}

func (s *CacheServer) Start(port string) {
	log.Printf("🚀 Go Redis Cache Server v%s starting on http://localhost:%s", SERVER_VERSION, port)
	log.Println("📊 Available endpoints:")
	log.Println("   GET    /health              - Health check and Redis status")
	log.Println("   GET    /ping                - Simple ping endpoint")
	log.Println("   GET    /cache/:email        - Get cached verification result")
	log.Println("   POST   /cache/:email        - Cache verification result")
	log.Println("   DELETE /cache/:email        - Remove specific cached verification")
	log.Println("   GET    /stats               - Get cache statistics")
	log.Println("   DELETE /cache               - Clear all cache entries")
	log.Println()

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      s.router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Start server in a goroutine
	go func() {
		log.Printf("⚡ Server listening on port %s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("❌ Server startup failed: %v", err)
		}
	}()

	// Wait for interrupt signal for graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("\n🛑 Shutting down server gracefully...")

	// Create a context with timeout for shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Shutdown HTTP server
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("❌ Server shutdown error: %v", err)
	}

	// Close Redis connection
	if err := s.redis.Close(); err != nil {
		log.Printf("❌ Redis close error: %v", err)
	}

	log.Println("✅ Server stopped successfully")
}

func main() {
	// Get port from environment or use default
	port := "3001"
	if p := os.Getenv("PORT"); p != "" {
		if portNum, err := strconv.Atoi(p); err == nil && portNum > 0 && portNum < 65536 {
			port = p
		} else {
			log.Printf("⚠️ Invalid PORT environment variable '%s', using default 3001", p)
		}
	}

	// Check if Redis is available before starting
	log.Println("🔍 Checking Redis connection...")

	server := NewCacheServer()
	server.Start(port)
}
