import { z } from "zod";
import { ToolUtils, PerformanceTracker } from "../agents/mcp.js";

/**
 * 💾 Persistent Memory Engine
 * Enhanced memory with semantic search, embeddings, and intelligent storage
 */

const MemoryActionSchema = z.object({
  action: z.enum([
    "store",
    "retrieve",
    "search",
    "delete",
    "list_sessions",
    "semantic_search",
    "bulk_import",
    "export_session",
    "analyze_memory",
    "tag_memories",
    "get_related"
  ]),
  memory_id: z.string().optional(),
  content: z.string().optional(),
  tags: z.array(z.string()).optional(),
  session_id: z.string().optional(),
  query: z.string().optional(),
  context: z.record(z.any()).optional(),
  limit: z.number().max(100).optional(),
  similarity_threshold: z.number().min(0).max(1).optional(),
  include_embeddings: z.boolean().optional(),
  format: z.enum(["json", "markdown", "text"]).optional(),
  memories: z.array(z.object({
    content: z.string(),
    tags: z.array(z.string()).optional(),
    context: z.record(z.any()).optional()
  })).optional()
});

export class MemoryEngine {
  private db: any;
  private kv: any;
  private ai: any;

  constructor(db: any, kv: any, ai: any) {
    this.db = db;
    this.kv = kv;
    this.ai = ai;
  }

  async execute(args: z.infer<typeof MemoryActionSchema>) {
    const validArgs = ToolUtils.validateArgs(MemoryActionSchema, args);
    
    return PerformanceTracker.trackExecution(
      () => this.performAction(validArgs),
      `memory_${validArgs.action}`
    );
  }

  private async performAction(args: z.infer<typeof MemoryActionSchema>) {
    await this.ensureSchema();

    switch (args.action) {
      case "store":
        if (!args.content) throw new Error("content is required for store action");
        return this.storeMemory(args);
      
      case "retrieve":
        if (!args.memory_id) throw new Error("memory_id is required for retrieve action");
        return this.retrieveMemory(args.memory_id);
      
      case "search":
        if (!args.query) throw new Error("query is required for search action");
        return this.searchMemories(args);
      
      case "semantic_search":
        if (!args.query) throw new Error("query is required for semantic_search action");
        return this.semanticSearch(args);
      
      case "delete":
        if (!args.memory_id) throw new Error("memory_id is required for delete action");
        return this.deleteMemory(args.memory_id);
      
      case "list_sessions":
        return this.listSessions(args);
      
      case "bulk_import":
        if (!args.memories) throw new Error("memories array is required for bulk_import");
        return this.bulkImport(args);
      
      case "export_session":
        if (!args.session_id) throw new Error("session_id is required for export_session");
        return this.exportSession(args);
      
      case "analyze_memory":
        return this.analyzeMemory(args);
      
      case "tag_memories":
        if (!args.memory_id || !args.tags) throw new Error("memory_id and tags are required for tag_memories");
        return this.tagMemories(args.memory_id, args.tags);
      
      case "get_related":
        if (!args.memory_id) throw new Error("memory_id is required for get_related");
        return this.getRelatedMemories(args.memory_id, args.limit || 5);
      
      default:
        throw new Error(`Unknown memory action: ${args.action}`);
    }
  }

  private async ensureSchema() {
    // Create memories table if it doesn't exist
    await this.db.prepare(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        session_id TEXT DEFAULT 'default',
        tags TEXT DEFAULT '[]',
        context TEXT DEFAULT '{}',
        embedding TEXT,
        content_hash TEXT,
        updated_at TEXT
      )
    `).run();

    // Create session index
    await this.db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_memories_session 
      ON memories(session_id, timestamp DESC)
    `).run();

    // Create content hash index for deduplication
    await this.db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_memories_hash 
      ON memories(content_hash)
    `).run();
  }

  private async storeMemory(args: any) {
    const memoryId = args.memory_id || this.generateId();
    const sessionId = args.session_id || 'default';
    const timestamp = new Date().toISOString();
    const contentHash = await this.hashContent(args.content);
    
    // Check for duplicates
    const existing = await this.db.prepare(
      "SELECT id FROM memories WHERE content_hash = ?"
    ).bind(contentHash).first();

    if (existing) {
      return {
        action: "store",
        status: "duplicate_detected",
        existing_id: existing.id,
        message: "Similar content already exists in memory"
      };
    }

    // Generate embedding
    const embedding = await this.generateEmbedding(args.content);
    
    // Store memory
    await this.db.prepare(`
      INSERT OR REPLACE INTO memories 
      (id, content, timestamp, session_id, tags, context, embedding, content_hash, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      memoryId,
      args.content,
      timestamp,
      sessionId,
      JSON.stringify(args.tags || []),
      JSON.stringify(args.context || {}),
      JSON.stringify(embedding),
      contentHash,
      timestamp
    ).run();

    // Cache recent memories
    await this.cacheRecentMemory(memoryId, {
      id: memoryId,
      content: args.content,
      timestamp,
      session_id: sessionId,
      tags: args.tags || []
    });

    return {
      action: "store",
      memory_id: memoryId,
      session_id: sessionId,
      timestamp,
      status: "stored",
      embedding_dimensions: embedding.length,
      content_preview: args.content.substring(0, 100) + (args.content.length > 100 ? "..." : "")
    };
  }

  private async retrieveMemory(memoryId: string) {
    const memory = await this.db.prepare(
      "SELECT * FROM memories WHERE id = ?"
    ).bind(memoryId).first();

    if (!memory) {
      throw new Error(`Memory not found: ${memoryId}`);
    }

    return {
      action: "retrieve",
      memory: {
        id: memory.id,
        content: memory.content,
        timestamp: memory.timestamp,
        session_id: memory.session_id,
        tags: JSON.parse(memory.tags || '[]'),
        context: JSON.parse(memory.context || '{}'),
        updated_at: memory.updated_at
      }
    };
  }

  private async searchMemories(args: any) {
    const limit = args.limit || 10;
    const sessionFilter = args.session_id ? "AND session_id = ?" : "";
    
    let query = `
      SELECT * FROM memories 
      WHERE content LIKE ? 
      ${sessionFilter}
      ORDER BY timestamp DESC 
      LIMIT ?
    `;

    const bindings = [`%${args.query}%`];
    if (args.session_id) bindings.push(args.session_id);
    bindings.push(limit);

    const memories = await this.db.prepare(query).bind(...bindings).all();

    return {
      action: "search",
      query: args.query,
      session_id: args.session_id,
      total_found: memories.length,
      memories: memories.map(this.formatMemory)
    };
  }

  private async semanticSearch(args: any) {
    const threshold = args.similarity_threshold || 0.7;
    const limit = args.limit || 10;
    
    // Generate query embedding
    const queryEmbedding = await this.generateEmbedding(args.query);
    
    // Get all memories with embeddings
    const sessionFilter = args.session_id ? "AND session_id = ?" : "";
    const query = `
      SELECT * FROM memories 
      WHERE embedding IS NOT NULL 
      ${sessionFilter}
      ORDER BY timestamp DESC
    `;

    const bindings = args.session_id ? [args.session_id] : [];
    const allMemories = await this.db.prepare(query).bind(...bindings).all();

    // Calculate similarities
    const memoriesWithSimilarity = allMemories
      .map(memory => {
        const embedding = JSON.parse(memory.embedding);
        const similarity = this.cosineSimilarity(queryEmbedding, embedding);
        
        return {
          ...memory,
          similarity,
          formatted: this.formatMemory(memory)
        };
      })
      .filter(item => item.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return {
      action: "semantic_search",
      query: args.query,
      similarity_threshold: threshold,
      total_found: memoriesWithSimilarity.length,
      memories: memoriesWithSimilarity.map(item => ({
        ...item.formatted,
        similarity_score: Math.round(item.similarity * 100) / 100
      }))
    };
  }

  private async deleteMemory(memoryId: string) {
    const result = await this.db.prepare(
      "DELETE FROM memories WHERE id = ?"
    ).bind(memoryId).run();

    if (result.changes === 0) {
      throw new Error(`Memory not found: ${memoryId}`);
    }

    // Remove from cache
    await this.kv.delete(`recent_memory:${memoryId}`);

    return {
      action: "delete",
      memory_id: memoryId,
      status: "deleted"
    };
  }

  private async listSessions(args: any) {
    const sessions = await this.db.prepare(`
      SELECT 
        session_id,
        COUNT(*) as memory_count,
        MAX(timestamp) as last_activity,
        MIN(timestamp) as first_activity
      FROM memories 
      GROUP BY session_id 
      ORDER BY last_activity DESC
    `).all();

    return {
      action: "list_sessions",
      total_sessions: sessions.length,
      sessions: sessions.map(session => ({
        session_id: session.session_id,
        memory_count: session.memory_count,
        last_activity: session.last_activity,
        first_activity: session.first_activity,
        duration_days: Math.ceil(
          (new Date(session.last_activity).getTime() - new Date(session.first_activity).getTime()) 
          / (1000 * 60 * 60 * 24)
        )
      }))
    };
  }

  private async bulkImport(args: any) {
    const sessionId = args.session_id || 'bulk_import_' + Date.now();
    const results = [];

    for (const memoryData of args.memories) {
      try {
        const result = await this.storeMemory({
          content: memoryData.content,
          tags: memoryData.tags,
          context: memoryData.context,
          session_id: sessionId
        });
        results.push({ success: true, ...result });
      } catch (error) {
        results.push({ 
          success: false, 
          content_preview: memoryData.content.substring(0, 50),
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;

    return {
      action: "bulk_import",
      session_id: sessionId,
      total_processed: results.length,
      successful,
      failed,
      results: args.include_embeddings ? results : results.map(r => ({
        success: r.success,
        memory_id: r.memory_id,
        error: r.error
      }))
    };
  }

  private async exportSession(args: any) {
    const memories = await this.db.prepare(
      "SELECT * FROM memories WHERE session_id = ? ORDER BY timestamp ASC"
    ).bind(args.session_id).all();

    if (memories.length === 0) {
      throw new Error(`No memories found for session: ${args.session_id}`);
    }

    const format = args.format || 'json';
    const exportData = memories.map(this.formatMemory);

    let formattedOutput;
    switch (format) {
      case 'markdown':
        formattedOutput = this.formatAsMarkdown(exportData);
        break;
      case 'text':
        formattedOutput = this.formatAsText(exportData);
        break;
      default:
        formattedOutput = JSON.stringify(exportData, null, 2);
    }

    return {
      action: "export_session",
      session_id: args.session_id,
      format,
      memory_count: memories.length,
      exported_at: new Date().toISOString(),
      data: formattedOutput
    };
  }

  private async analyzeMemory(args: any) {
    const sessionFilter = args.session_id ? "WHERE session_id = ?" : "";
    const bindings = args.session_id ? [args.session_id] : [];

    const [stats, tagStats, recentActivity] = await Promise.all([
      // Basic stats
      this.db.prepare(`
        SELECT 
          COUNT(*) as total_memories,
          COUNT(DISTINCT session_id) as unique_sessions,
          AVG(LENGTH(content)) as avg_content_length,
          MAX(timestamp) as latest_memory,
          MIN(timestamp) as earliest_memory
        FROM memories ${sessionFilter}
      `).bind(...bindings).first(),

      // Tag analysis
      this.db.prepare(`
        SELECT tags FROM memories ${sessionFilter}
      `).bind(...bindings).all(),

      // Recent activity (last 7 days)
      this.db.prepare(`
        SELECT 
          DATE(timestamp) as date,
          COUNT(*) as count
        FROM memories 
        ${sessionFilter ? sessionFilter + " AND" : "WHERE"} 
        timestamp >= datetime('now', '-7 days')
        GROUP BY DATE(timestamp)
        ORDER BY date DESC
      `).bind(...bindings).all()
    ]);

    // Analyze tags
    const allTags = tagStats
      .map(row => JSON.parse(row.tags || '[]'))
      .flat()
      .reduce((acc: Record<string, number>, tag: string) => {
        acc[tag] = (acc[tag] || 0) + 1;
        return acc;
      }, {});

    const topTags = Object.entries(allTags)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    return {
      action: "analyze_memory",
      session_id: args.session_id,
      analysis: {
        overview: {
          total_memories: stats.total_memories,
          unique_sessions: stats.unique_sessions,
          avg_content_length: Math.round(stats.avg_content_length || 0),
          memory_span_days: stats.earliest_memory ? Math.ceil(
            (new Date(stats.latest_memory).getTime() - new Date(stats.earliest_memory).getTime())
            / (1000 * 60 * 60 * 24)
          ) : 0
        },
        tags: {
          total_unique_tags: Object.keys(allTags).length,
          top_tags: topTags
        },
        recent_activity: recentActivity,
        insights: this.generateMemoryInsights(stats, allTags, recentActivity)
      },
      generated_at: new Date().toISOString()
    };
  }

  private async tagMemories(memoryId: string, tags: string[]) {
    const memory = await this.retrieveMemory(memoryId);
    const currentTags = memory.memory.tags || [];
    const newTags = [...new Set([...currentTags, ...tags])];

    await this.db.prepare(
      "UPDATE memories SET tags = ?, updated_at = ? WHERE id = ?"
    ).bind(
      JSON.stringify(newTags),
      new Date().toISOString(),
      memoryId
    ).run();

    return {
      action: "tag_memories",
      memory_id: memoryId,
      tags_added: tags,
      all_tags: newTags,
      status: "updated"
    };
  }

  private async getRelatedMemories(memoryId: string, limit: number) {
    const sourceMemory = await this.retrieveMemory(memoryId);
    
    if (!sourceMemory.memory.content) {
      throw new Error("Source memory has no content for relation analysis");
    }

    // Use semantic search to find related memories
    const related = await this.semanticSearch({
      query: sourceMemory.memory.content,
      limit: limit + 1, // +1 to exclude the source memory
      similarity_threshold: 0.3
    });

    // Filter out the source memory
    const relatedMemories = related.memories.filter(
      (mem: any) => mem.id !== memoryId
    ).slice(0, limit);

    return {
      action: "get_related",
      source_memory_id: memoryId,
      related_memories: relatedMemories,
      total_related: relatedMemories.length
    };
  }

  // Helper Methods
  private generateId(): string {
    return 'mem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private async hashContent(content: string): Promise<string> {
    // Simple hash for deduplication
    const encoder = new TextEncoder();
    const data = encoder.encode(content.toLowerCase().trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Clean and limit text
      const cleanText = text
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s.-]/g, '')
        .trim()
        .substring(0, 1500);

      const response = await this.ai.run('@cf/baai/bge-base-en-v1.5', { 
        text: [cleanText] 
      });
      
      return response?.data?.[0] || this.fallbackEmbedding(cleanText);
    } catch (error) {
      console.error('Embedding generation failed:', error);
      return this.fallbackEmbedding(text);
    }
  }

  private fallbackEmbedding(text: string, dimensions: number = 384): number[] {
    const hash = this.simpleHash(text);
    const embedding = new Array(dimensions);
    
    for (let i = 0; i < dimensions; i++) {
      const seed = hash + i;
      embedding[i] = ((seed * 9301 + 49297) % 233280) / 233280 * 2 - 1;
    }
    
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  private async cacheRecentMemory(memoryId: string, memory: any) {
    try {
      await this.kv.put(
        `recent_memory:${memoryId}`,
        JSON.stringify(memory),
        { expirationTtl: 3600 } // 1 hour cache
      );
    } catch (error) {
      console.warn('Failed to cache memory:', error);
    }
  }

  private formatMemory(memory: any) {
    return {
      id: memory.id,
      content: memory.content,
      timestamp: memory.timestamp,
      session_id: memory.session_id,
      tags: JSON.parse(memory.tags || '[]'),
      context: JSON.parse(memory.context || '{}'),
      updated_at: memory.updated_at
    };
  }

  private formatAsMarkdown(memories: any[]): string {
    let output = `# Memory Export\n\nExported: ${new Date().toISOString()}\nTotal Memories: ${memories.length}\n\n`;
    
    memories.forEach((memory, index) => {
      output += `## Memory ${index + 1}\n\n`;
      output += `**ID:** ${memory.id}\n`;
      output += `**Timestamp:** ${memory.timestamp}\n`;
      output += `**Tags:** ${memory.tags.join(', ')}\n\n`;
      output += `${memory.content}\n\n---\n\n`;
    });
    
    return output;
  }

  private formatAsText(memories: any[]): string {
    return memories.map((memory, index) => 
      `[${index + 1}] ${memory.timestamp}\n${memory.content}\nTags: ${memory.tags.join(', ')}\n`
    ).join('\n---\n\n');
  }

  private generateMemoryInsights(stats: any, tags: Record<string, number>, activity: any[]) {
    const insights = [];
    
    if (stats.total_memories > 100) {
      insights.push("Large memory collection - consider organizing with more specific tags");
    }
    
    if (stats.avg_content_length < 50) {
      insights.push("Short average content length - consider adding more context to memories");
    }
    
    if (Object.keys(tags).length < 5) {
      insights.push("Limited tag usage - consider adding more descriptive tags for better organization");
    }
    
    if (activity.length > 0) {
      const recentCount = activity.reduce((sum, day) => sum + day.count, 0);
      if (recentCount > 20) {
        insights.push("High recent activity - memories are being actively used");
      } else if (recentCount < 3) {
        insights.push("Low recent activity - consider reviewing and organizing existing memories");
      }
    }
    
    return insights;
  }
}