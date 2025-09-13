# Production Deployment Guide

This guide covers deploying the Lifecycle Viewer application to production.

## Production Environment Setup

### Prerequisites

- Node.js 18+
- MCP Server (lifecycle-mcp)
- Production environment variables configured

### Build & Deploy

1. **Install dependencies**

   ```bash
   npm ci --production=false
   ```

2. **Build application**

   ```bash
   npm run build
   ```

3. **Start production server**
   ```bash
   npm run production
   ```

## Environment Configuration

### Environment Variables

Create `.env.production` with:

```bash
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# MCP Server Configuration
MCP_SERVER_URL=ws://localhost:3000/mcp
MCP_BRIDGE_PORT=3000

# Security (update with your values)
SESSION_SECRET=your-secure-session-secret-here
ORIGIN=https://your-domain.com

# Performance
BODY_SIZE_LIMIT=1mb
LOG_LEVEL=info
```

### Production Checklist

- [ ] **Environment variables** properly configured
- [ ] **MCP Server** running and accessible
- [ ] **SSL/HTTPS** configured (recommended)
- [ ] **Process manager** (PM2, systemd) configured
- [ ] **Reverse proxy** (nginx, traefik) configured
- [ ] **Monitoring & logging** set up

## Process Management

### Using PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start npm --name "lifecycle-viewer" -- run start:production

# Save PM2 configuration
pm2 save
pm2 startup
```

### Using systemd

Create `/etc/systemd/system/lifecycle-viewer.service`:

```ini
[Unit]
Description=Lifecycle Viewer Application
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/lifecycle-viewer
ExecStart=/usr/bin/node .svelte-kit/output/server/index.js
Environment=NODE_ENV=production
Environment=PORT=3000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

## Performance Considerations

### Optimization Features Enabled

- ✅ **Server-side rendering (SSR)**
- ✅ **Code splitting** - Lazy loading of routes
- ✅ **Asset optimization** - Minification, compression
- ✅ **Bundle analysis** - Optimized chunk sizes

### Bundle Sizes

- Main bundle: ~31KB (gzipped)
- Largest route: ~118KB (gzipped)
- Total client: ~500KB (gzipped)

## Security Features

### Built-in Security

- ✅ **Input sanitization** - XSS prevention
- ✅ **HTML sanitization** - DOMPurify integration
- ✅ **Rate limiting** - Request throttling
- ✅ **Error message sanitization** - No internal exposure

### Recommended Security Headers

Configure your reverse proxy to add:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
```

## Monitoring & Health Checks

### Health Check Endpoint

The application provides health checks at:

- `GET /health` - Application status
- `GET /api/health` - API status

### Logging

Production logs include:

- Request/response logging
- Error tracking
- Performance metrics
- WebSocket connection status

## Troubleshooting

### Common Issues

1. **Port already in use**

   ```bash
   # Change PORT in .env.production or kill existing process
   lsof -ti:3000 | xargs kill -9
   ```

2. **MCP Server not connecting**
   - Verify MCP bridge server is running: `npm run mcp-bridge`
   - Check WebSocket URL in configuration
   - Ensure firewall allows connections

3. **Build errors**
   - Clear build cache: `rm -rf .svelte-kit node_modules && npm install`
   - Check Node.js version compatibility

## Deployment Architecture

```
[Client Browser]
    ↓ HTTPS
[Reverse Proxy (nginx)]
    ↓ HTTP
[SvelteKit App :3000]
    ↓ WebSocket
[MCP Bridge Server :3000]
    ↓ stdio
[Lifecycle MCP Server]
```

## Scaling Considerations

- **Load balancing**: Use sticky sessions for WebSocket connections
- **Database**: MCP server handles persistence
- **Caching**: Static assets cached by reverse proxy
- **CDN**: Consider CDN for static assets in global deployments
