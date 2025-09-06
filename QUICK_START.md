# 🚀 Quick Start Guide - Go Redis Cache Server

Get your LinkedIn Lead Generator extension up and running with the new Go Redis cache server in under 5 minutes!

## ⚡ Super Quick Start

```bash
# 1. Run setup (installs dependencies, starts Redis, builds server)
./setup.sh

# 2. Start the cache server
./start-server.sh

# 3. Reload Chrome extension at chrome://extensions/

# 4. Test on a LinkedIn profile - you're done! 🎉
```

## ✅ Verification Checklist

After setup, verify everything is working:

### 1. Check Server Status
```bash
curl http://localhost:3001/health
# Should return: {"status":"healthy","redis":"connected",...}
```

### 2. Check Redis Connection
```bash
redis-cli ping
# Should return: PONG
```

### 3. Test Extension
- Go to any LinkedIn profile (e.g., `linkedin.com/in/someone`)
- Click the extension icon to open sidebar
- Generate email suggestions and click verify
- Check browser console for `✅ Go Redis cache server is connected`

## 🔧 Alternative Start Methods

### Using Make Commands
```bash
make quick-start    # Full setup + start
make dev           # Development mode with auto-reload
```

### Manual Steps
```bash
# Install dependencies
go mod tidy

# Start Redis
redis-server --daemonize yes

# Run server
go run .
```

## 📊 What You Should See

### Server Output
```
🚀 Go Redis Cache Server v1.0.0 starting on http://localhost:3001
📊 Available endpoints:
   GET    /health              - Health check and Redis status
   GET    /cache/:email        - Get cached verification result
   ...
⚡ Server listening on port 3001
```

### Browser Console (Extension)
```
✅ Go Redis cache server is connected: {status: "healthy", redis: "connected"}
📊 Email Verification Cache Stats (Redis via Go):
   Total cached emails: 0
   Newest entry: None
   Oldest entry: None
```

### When Verifying Emails
```
✅ Redis cache hit for john.doe@company.com (cached 2 minutes ago)
✅ Cached verification result for john.doe@company.com in Go Redis server
```

## 🚨 Troubleshooting

### Problem: `go: command not found`
**Solution:** Install Go from https://golang.org/download/

### Problem: `redis-cli: command not found`  
**Solution:** Install Redis:
- macOS: `brew install redis`
- Ubuntu: `sudo apt install redis-server`

### Problem: Extension shows fallback mode
**Solution:** 
1. Check server: `curl http://localhost:3001/health`
2. Reload extension at `chrome://extensions/`
3. Check console for error messages

### Problem: Permission denied on setup.sh
**Solution:** `chmod +x setup.sh`

## 🎯 Success Indicators

You know it's working when you see:

✅ **Server started** - Go server shows "listening on port 3001"  
✅ **Redis connected** - `/health` endpoint returns "redis":"connected"  
✅ **Extension connected** - Browser console shows "Go Redis cache server is connected"  
✅ **Cache working** - Email verification shows Redis cache hits/misses  

## 📈 Performance Benefits

With the Go server, you should notice:

- **Faster email verification** (cached results load instantly)
- **Persistent cache** (survives browser restarts)
- **Better reliability** (dedicated cache server)
- **Cross-session caching** (cache shared across browser sessions)

## 🔄 Switching Back to Chrome Storage

If needed, you can temporarily disable the Go server:

1. Stop the server: `Ctrl+C`
2. Extension automatically falls back to Chrome storage
3. Console will show: `⚠️ Go cache server not available, falling back to Chrome storage`

## 📞 Need Help?

1. **Check logs**: Server output and browser console
2. **Run diagnostics**: `./status.sh` (if available)
3. **Test endpoints**: Use curl commands from README-Go-Server.md
4. **Restart services**: Stop server and Redis, run `./setup.sh` again

---

**🎊 Congratulations!** Your LinkedIn Lead Generator now has a high-performance Redis cache backend!

**Next Steps:**
- Try verifying some emails to see the cache in action
- Check out the full documentation in `README-Go-Server.md`
- Monitor cache statistics with `curl http://localhost:3001/stats`
