# 🚀 ZEO ComposableAI MCP - Deployment Guide

## Quick Deploy to Cloudflare Workers

### Prerequisites

- Node.js 18+ installed
- Cloudflare account
- Wrangler CLI installed globally

### 1. Environment Setup

```bash
# Clone the repository
git clone https://github.com/myselfgus/zeo-composable-mcp.git
cd zeo-composable-mcp

# Install dependencies
npm install

# Install Wrangler CLI globally (if not already installed)
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

### 2. Configure Environment

```bash
# Copy example configuration
cp wrangler.example.toml wrangler.toml

# Edit wrangler.toml with your values:
# - Replace database IDs
# - Replace KV namespace IDs  
# - Replace R2 bucket names
# - Add your GitHub token
```

### 3. Create Cloudflare Resources

```bash
# Create D1 Database
wrangler d1 create zeo-composable-mcp

# Create KV Namespace
wrangler kv:namespace create "ZEO_STORAGE"

# Create R2 Bucket (optional)
wrangler r2 bucket create zeo-files
```

### 4. Database Setup

```bash
# Initialize D1 database schema
# (Tables are auto-created on first run)
wrangler d1 execute zeo-composable-mcp --command "SELECT 1"
```

### 5. Deploy

```bash
# Deploy to staging
npm run deploy:staging

# Deploy to production  
npm run deploy
```

### 6. Environment Variables

Set these in your wrangler.toml:

```toml
[vars]
GITHUB_TOKEN = "your_github_personal_access_token"

[[d1_databases]]
binding = "D1_DATABASE"
database_name = "zeo-composable-mcp"
database_id = "your_d1_database_id"

[[kv_namespaces]]
binding = "KV_STORAGE"
id = "your_kv_namespace_id"

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "zeo-files"

[ai]
binding = "AI"
```

## 🧪 Testing

### Health Check

```bash
curl https://your-worker.your-subdomain.workers.dev/health
```

### Test MCP Endpoint

```bash
curl https://your-worker.your-subdomain.workers.dev/sse
```

## 🔧 Configuration

### GitHub Token Requirements

Your GitHub token needs these permissions:
- `repo` (for repository access)
- `read:org` (for organization data)
- `read:user` (for user profile)

### Optional: Custom Domain

```bash
# Add custom route
wrangler route create "*example.com/*" your-worker-name
```

## 📊 Monitoring

### View Logs

```bash
wrangler tail
```

### Analytics

Access built-in analytics at:
```
https://your-worker.your-subdomain.workers.dev/docs
```

## 🛡️ Security Notes

- Keep your GitHub token secure
- Use different tokens for staging/production
- Monitor usage via Cloudflare dashboard
- Set appropriate rate limits

## 🚨 Troubleshooting

### Common Issues

1. **D1 Database not accessible**
   - Verify database ID in wrangler.toml
   - Check database exists: `wrangler d1 list`

2. **GitHub API errors**
   - Verify token permissions
   - Check token hasn't expired

3. **Memory/CPU limits**
   - Optimize queries in memory engine
   - Consider chunking large operations

### Debug Mode

Set `DEBUG=true` in environment variables for detailed logging.

## 📈 Performance Tips

- Use KV cache for frequently accessed data
- Implement proper pagination for large datasets
- Monitor Cloudflare analytics for optimization opportunities
- Consider geographic distribution for global users

## 🔄 Updates

```bash
# Pull latest changes
git pull origin main

# Deploy updates
npm run deploy
```

## 📞 Support

- GitHub Issues: [Create an issue](https://github.com/myselfgus/zeo-composable-mcp/issues)
- Documentation: See README.md
- API Reference: `/docs` endpoint on deployed worker