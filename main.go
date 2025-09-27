package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
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
	Email     string                 `json:"email"`
	LeadData  map[string]interface{} `json:"leadData"`
	Timestamp int64                  `json:"timestamp"`
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

type ValidLeadsCountResponse struct {
	Success          bool             `json:"success"`
	ValidUnexported  int64            `json:"validUnexported"`
	ValidExported    int64            `json:"validExported"`
	LeadCountPerList map[string]int64 `json:"leadCountPerList,omitempty"`
	InvalidCount     int64            `json:"invalidCount"`
	TotalLeads       int64            `json:"totalLeads"`
	Error            string           `json:"error,omitempty"`
}

type EmailGenerationRequest struct {
	CompanyInfo string `json:"companyInfo" binding:"required"`
	PersonName  string `json:"personName" binding:"required"`
}

type EmailGenerationResponse struct {
	Success bool   `json:"success"`
	Subject string `json:"subject,omitempty"`
	Body    string `json:"body,omitempty"`
	Error   string `json:"error,omitempty"`
}

type OpenAIRequest struct {
	Model string `json:"model"`
	Input string `json:"input"`
	Tools []Tool `json:"tools"`
}

type Tool struct {
	Type string `json:"type"`
}

type OpenAIResponse struct {
	Output []OutputItem `json:"output"`
}

type OutputItem struct {
	Type    string    `json:"type"`
	Content []Content `json:"content"`
}

type Content struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type EmailContent struct {
	Subject string `json:"subject"`
	Body    string `json:"body"`
}

const (
	CACHE_KEY_PREFIX = "lead_"
	SERVER_VERSION   = "1.0.0"
)

func NewCacheServer() *CacheServer {
	// Initialize Redis client with Redis Cloud
	rdb := redis.NewClient(&redis.Options{
		Addr:         "redis-19391.c305.ap-south-1-1.ec2.redns.redis-cloud.com:19391",
		Username:     "default",
		Password:     "NnYhD1fDHufXmeuRc0y2MLoaxEFuKdps",
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
		log.Printf("❌ Failed to connect to Redis Cloud: %v", err)
		log.Printf("Check Redis Cloud connection and credentials")
		os.Exit(1)
	}

	log.Println("✅ Connected to Redis Cloud successfully")

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
	s.router.GET("/leads/count", s.getValidLeadsCount)

	// Email generation
	s.router.POST("/generate-email-suggestion", s.generateEmailSuggestion)

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
		Data:     cachedData.LeadData,
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

	var leadData map[string]interface{}
	if err := c.ShouldBindJSON(&leadData); err != nil {
		log.Printf("Invalid JSON for %s: %v", email, err)
		c.JSON(http.StatusBadRequest, CacheResponse{
			Success: false,
			Error:   "Invalid JSON in request body",
		})
		return
	}

	cacheKey := CACHE_KEY_PREFIX + email
	cacheData := CachedData{
		Email:     email,
		LeadData:  leadData,
		Timestamp: time.Now().UnixMilli(),
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

func (s *CacheServer) getValidLeadsCount(c *gin.Context) {
	keys, err := s.redis.Keys(s.ctx, CACHE_KEY_PREFIX+"*").Result()
	if err != nil {
		log.Printf("Error getting lead keys: %v", err)
		c.JSON(http.StatusInternalServerError, ValidLeadsCountResponse{
			Success: false,
			Error:   "Failed to get lead keys from Redis",
		})
		return
	}

	totalLeads := int64(len(keys))
	var validUnexported, validExported, invalidCount int64
	leadCountPerList := make(map[string]int64)

	for _, key := range keys {
		value, err := s.redis.Get(s.ctx, key).Result()
		if err != nil {
			if err == redis.Nil {
				continue // Key doesn't exist anymore
			}
			log.Printf("Error getting value for key %s: %v", key, err)
			continue
		}

		if value == "" {
			continue
		}

		// Parse the JSON data
		var data map[string]interface{}
		if err := json.Unmarshal([]byte(value), &data); err != nil {
			log.Printf("⚠️ Could not parse JSON for key %s: %v", key, err)
			continue
		}

		// Get leadData and exported status
		leadData, exists := data["leadData"].(map[string]interface{})
		if !exists {
			invalidCount++
			continue
		}

		emailStatus, exists := leadData["emailStatus"].(string)
		if !exists {
			invalidCount++
			continue
		}

		if emailStatus == "valid" {
			exported, _ := data["exported"].(bool)
			if exported {
				validExported++
			} else {
				listName, exists := leadData["listLeadBelongsTo"].(string)
				if exists && listName != "" {
					leadCountPerList[listName] = leadCountPerList[listName] + 1
				}
				validUnexported++
			}
		} else {
			invalidCount++
		}
	}

	log.Printf("📊 Valid leads count - Total: %d, Valid Unexported: %d, Valid Exported: %d, Invalid: %d",
		totalLeads, validUnexported, validExported, invalidCount)

	c.JSON(http.StatusOK, ValidLeadsCountResponse{
		Success:          true,
		ValidUnexported:  validUnexported,
		ValidExported:    validExported,
		LeadCountPerList: leadCountPerList,
		InvalidCount:     invalidCount,
		TotalLeads:       totalLeads,
	})
}

func (s *CacheServer) generateEmailSuggestion(c *gin.Context) {
	var request EmailGenerationRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		log.Printf("Invalid JSON for email generation: %v", err)
		c.JSON(http.StatusBadRequest, EmailGenerationResponse{
			Success: false,
			Error:   "Invalid JSON in request body",
		})
		return
	}

	// Validate required fields
	if request.CompanyInfo == "" || request.PersonName == "" {
		c.JSON(http.StatusBadRequest, EmailGenerationResponse{
			Success: false,
			Error:   "Company name and person name are required",
		})
		return
	}

	log.Printf("🤖 Generating email for company: %s, person: %s", request.CompanyInfo, request.PersonName)

	// Generate email using OpenAI
	emailContent, err := s.callOpenAIForEmailGeneration(request.CompanyInfo, request.PersonName)
	if err != nil {
		log.Printf("Error generating email: %v", err)
		c.JSON(http.StatusInternalServerError, EmailGenerationResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to generate email: %v", err),
		})
		return
	}

	log.Printf("✅ Successfully generated email for %s", request.CompanyInfo)
	c.JSON(http.StatusOK, EmailGenerationResponse{
		Success: true,
		Subject: emailContent.Subject,
		Body:    emailContent.Body,
	})
}

func (s *CacheServer) callOpenAIForEmailGeneration(companyInfo, personName string) (*EmailContent, error) {
	// Reference emails from the Python script
	referenceEmails := []string{
		`Subject: Powering KreditBee's customer journey with tech

Hi [First Name],

I noticed KreditBee's strong focus on making credit simple and frictionless for first-time borrowers. That user journey—smooth onboarding, instant loan approval, reliable repayment flows—is exactly what keeps customers coming back.

We at devXworks specialize in helping fintechs improve customer-facing applications and backend workflows. Whether it's reducing KYC friction, speeding loan disbursements, or improving mobile app performance, we've helped teams boost user satisfaction while reducing engineering overhead.

If you're open, I'd love to share a couple of ways we could help KreditBee sharpen its customer experience through tech.`,

		`Subject: Helping GMP speed up integrations for global partners

Hi [First Name],

I've been following Get My Parking's mission of making urban parking smarter and more connected—really exciting to see how you're digitizing a space that has been offline for decades.

As GMP partners with parking operators worldwide, I imagine your engineering team is under constant pressure to deliver seamless API integrations with different payment systems, mobility apps, and hardware vendors.

That's where devXworks help. Our team specializes in scalable backend engineering and API-first architectures—helping SaaS companies reduce partner onboarding time and ship integrations 30–40% faster.

Would it make sense to explore if this could help GMP speed up deployments in your next growth markets?`,
	}

	// Combine reference emails
	referencesText := ""
	for i, email := range referenceEmails {
		referencesText += fmt.Sprintf("Reference Email %d:\n%s\n\n", i+1, email)
	}

	// Build the prompt based on the Python script
	prompt := fmt.Sprintf(`You are an expert B2B sales email writer. Your task is to write **one personalized cold email** for '%s' based on the style, tone, and structure of these reference emails:

%s

Company/Person Context: %s

Keep the email concise, professional, and actionable. Focus on how our devXworks software development services can add value to the company. along with some metrics write like this too At devXworks ...... Do not repeat content from the references; make it specific and personalized. Dont add any link or references in the mail ensure all important keywords and figure out the correct company name too and write it in bold using html tags every time it is used devXworks should always be in the mail, and in bold, its the name of our company Use a clear HTML structure with paragraphs (<p>) and (ul li) if needed end the mail with this: Would you be open to a quick call to see if this could help? If so, you can pick a time that works best: add a clickable Calendly link using <a href='https://calendly.com/ayush-devxworks/intro-call-with-ayush-devxworks'>Book a call</a>.
output should follow json format with keys subject and body only`,
		personName, referencesText, companyInfo)

	// Prepare OpenAI request
	openAIRequest := OpenAIRequest{
		Model: "gpt-5",
		Input: prompt,
		Tools: []Tool{
			{
				Type: "web_search",
			},
		},
	}

	// Convert to JSON
	requestBody, err := json.Marshal(openAIRequest)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %v", err)
	}

	// Make HTTP request to OpenAI
	req, err := http.NewRequest("POST", "https://api.openai.com/v1/responses", bytes.NewBuffer(requestBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %v", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer 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")

	// Make the request
	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request to OpenAI: %v", err)
	}
	defer resp.Body.Close()

	// Read response
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %v", err)
	}

	// Check status code
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("OpenAI API returned status %d: %s", resp.StatusCode, string(responseBody))
	}

	// Parse OpenAI response
	var openAIResponse OpenAIResponse
	if err := json.Unmarshal(responseBody, &openAIResponse); err != nil {
		return nil, fmt.Errorf("failed to parse OpenAI response: %v", err)
	}

	// Extract content from the nested structure
	var content string
	for _, output := range openAIResponse.Output {
		if output.Type == "message" {
			for _, contentItem := range output.Content {
				if contentItem.Type == "output_text" {
					content = contentItem.Text
					break
				}
			}
			if content != "" {
				break
			}
		}
	}

	if content == "" {
		return nil, fmt.Errorf("no output text found in OpenAI response")
	}

	// Log the extracted content for debugging
	log.Printf("📧 Extracted content from OpenAI: %s", content)

	// Parse the JSON response from OpenAI (it should contain subject and body)
	var emailContent EmailContent
	if err := json.Unmarshal([]byte(content), &emailContent); err != nil {
		// If JSON parsing fails, try to extract subject and body manually
		log.Printf("❌ Warning: Could not parse JSON response from OpenAI: %v", err)
		log.Printf("📝 Raw content: %s", content)
		return &EmailContent{
			Subject: content,
			Body:    content,
		}, nil
	}

	log.Printf("✅ Successfully parsed email - Subject: %s", emailContent.Subject)
	return &emailContent, nil
}

func (s *CacheServer) Start(port string) {
	log.Printf("🚀 Go Redis Cache Server v%s starting on http://localhost:%s", SERVER_VERSION, port)
	log.Println("📊 Available endpoints:")
	log.Println("   GET    /health                    - Health check and Redis status")
	log.Println("   GET    /ping                      - Simple ping endpoint")
	log.Println("   GET    /cache/:email              - Get cached verification result")
	log.Println("   POST   /cache/:email              - Cache verification result")
	log.Println("   DELETE /cache/:email              - Remove specific cached verification")
	log.Println("   GET    /stats                     - Get cache statistics")
	log.Println("   DELETE /cache                     - Clear all cache entries")
	log.Println("   GET    /leads/count               - Count valid unexported leads")
	log.Println("   POST   /generate-email-suggestion - Generate personalized email using AI")
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

	// Check if Redis Cloud is available before starting
	log.Println("🔍 Checking Redis Cloud connection...")

	server := NewCacheServer()
	server.Start(port)
}
