# 🚀 ZEO ComposableAI MCP Server

**Advanced AI-native Model Context Protocol server with semantic search, intelligent workflows, and real integrations.**

[![Version](https://img.shields.io/badge/version-2.1.0-blue.svg)](https://github.com/myselfgus/zeo-composable-mcp)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)  
[![Deploy](https://img.shields.io/badge/deploy-Cloudflare%20Workers-orange.svg)](https://workers.cloudflare.com/)

## ✨ Features

### 🧠 **Enhanced AI Intelligence**
- **Semantic Search** - AI-powered memory search with similarity scoring
- **Advanced Embeddings** - Real vector embeddings using Cloudflare AI
- **Intelligent Caching** - Performance optimization for repeated operations
- **Real-time Analytics** - Usage tracking and performance monitoring

### 🛠️ **9 Specialized Tools**

1. **🔗 GitHub Orchestrator** - Real GitHub API integration with AI analysis
2. **💾 Persistent Memory Engine** - Enhanced memory with semantic search
3. **🌐 Web Intelligence** - Smart web scraping with content-type detection
4. **🧠 Unified Reasoner** - 7 AI reasoning strategies (step-by-step, creative, analytical, etc.)
5. **🎨 Ideation Engine** - 8 creative thinking modes for brainstorming
6. **🌉 Implementation Bridge** - Convert ideas to code in 8 formats
7. **🔄 Workflow Orchestrator** - AI workflow automation and optimization
8. **🏗️ Code Architect** - Software architecture design and analysis
9. **📊 Analytics Dashboard** - Usage insights and performance metrics

### 🔥 **ComposableAI Ready**
- Tools work independently and compose together seamlessly
- Rich outputs for tool chaining and workflows
- Context preservation across operations
- Smart auto-saving and cross-referencing

## 🚀 Quick Start

### Deploy to Cloudflare Workers

1. **Clone and setup:**
```bash
git clone https://github.com/myselfgus/zeo-composable-mcp.git
cd zeo-composable-mcp
npm install
```

2. **Configure environment:**
```bash
# Copy and edit wrangler.toml with your settings
cp wrangler.example.toml wrangler.toml
```

3. **Set up required services:**
```bash
# Create D1 database
wrangler d1 create zeo-production

# Create KV namespace
wrangler kv:namespace create "ZEO_STORAGE"

# Create R2 bucket (optional)
wrangler r2 bucket create zeo-files
```

4. **Deploy:**
```bash
npx wrangler deploy
```

## 🎯 Usage Examples

### Memory with Semantic Search
```javascript
// Store knowledge
await persistentMemoryEngine({
  action: "store",
  content: "React hooks allow functional components to use state",
  tags: ["react", "hooks", "frontend"]
});

// Semantic search finds related concepts
const results = await persistentMemoryEngine({
  action: "search",
  query: "state management in components"
});
// Returns memories about hooks, state, and components with similarity scores!
```

### Creative Problem Solving
```javascript
// Generate creative solutions
const ideas = await ideationEngine({
  challenge: "Improve user onboarding flow",
  thinking_mode: "lateral",
  target_audience: "developers"
});

// Convert ideas to implementation
const code = await implementationBridge({
  source_content: ideas.output,
  target_format: "code",
  programming_language: "typescript"
});
```

### Intelligent Workflows
```javascript
// Create AI-planned workflow
const workflow = await workflowOrchestrator({
  action: "create_workflow", 
  goal: "Analyze competitor websites and generate insights",
  tools_preferred: ["web_intelligence", "unified_reasoner", "persistent_memory_engine"],
  automation_level: "semi_auto"
});

// Execute with optimization
await workflowOrchestrator({
  action: "execute_workflow",
  workflow_id: workflow.id
});
```

## 🏗️ Architecture

### Technology Stack
- **Runtime:** Cloudflare Workers (Edge computing)
- **Database:** Cloudflare D1 (SQLite)
- **Storage:** Cloudflare R2 (S3-compatible)
- **Cache:** Cloudflare KV (Redis-like)
- **AI:** Cloudflare AI (Built-in models)
- **Framework:** TypeScript + MCP SDK

### Design Principles
- **AI-Native:** Every tool leverages AI for enhanced functionality
- **ComposableAI:** Tools designed to work together seamlessly
- **Performance-First:** Intelligent caching and optimization
- **Production-Ready:** Real error handling, monitoring, analytics
- **Zero Trust:** Secure by design with proper validation

## 📊 Performance

### Benchmarks
- **Cold Start:** <100ms (Cloudflare Workers)
- **Memory Search:** <200ms (with semantic similarity)
- **GitHub Analysis:** <2s (including AI processing)
- **Web Intelligence:** <3s (including content analysis)
- **Workflow Creation:** <1s (AI planning)

### Scaling
- **Concurrent Users:** Unlimited (Cloudflare edge)
- **Requests/month:** 100k+ on free tier
- **Storage:** 25GB+ databases, unlimited R2
- **Memory:** 50k+ memories with semantic search

## 🔧 Development

### Local Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Type checking
npm run type-check

# Deploy to staging
npm run deploy:staging
```

### Environment Variables

Required in `wrangler.toml`:
```toml
[env.production.vars]
GITHUB_TOKEN = "your_github_token"

[[env.production.d1_databases]]
binding = "D1_DATABASE"
database_name = "zeo-production"
database_id = "your_d1_id"

[[env.production.kv_namespaces]]
binding = "KV_STORAGE"
id = "your_kv_id"

[env.production.ai]
binding = "AI"
```

## 📈 Monitoring

### Analytics Dashboard
Access real-time analytics at your worker URL:
- `/health` - Server health and metrics
- `/docs` - API documentation  
- Analytics via `analytics_dashboard` tool

### Key Metrics
- Tool usage statistics
- Performance benchmarks
- Error rates and patterns
- Memory efficiency
- Cache hit rates

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🚀 Roadmap

### v2.2.0 (Next)
- [ ] Multi-language support
- [ ] Advanced workflow templates
- [ ] Real-time collaboration features
- [ ] Enhanced security scanning

### v3.0.0 (Future)
- [ ] GraphQL API
- [ ] WebSocket real-time updates
- [ ] Advanced AI model selection
- [ ] Plugin architecture

## 💬 Support

- 📧 Issues: [GitHub Issues](https://github.com/myselfgus/zeo-composable-mcp/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/myselfgus/zeo-composable-mcp/discussions)
- 📖 Docs: [Documentation](https://github.com/myselfgus/zeo-composable-mcp/wiki)

---

**Built with ❤️ using Cloudflare Workers, TypeScript, and AI**

*ZEO ComposableAI MCP Server - Making AI development truly composable and intelligent.*