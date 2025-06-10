import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

/**
 * 🤖 Base MCP Agent Class
 * Fornece infraestrutura base para MCP servers com tools management
 */
export abstract class McpAgent {
  protected server: Server;
  protected tools: Map<string, any> = new Map();

  constructor(serverInfo: { name: string; version: string }) {
    this.server = new Server(serverInfo, {
      capabilities: {
        tools: {},
      },
    });

    this.setupBasicHandlers();
  }

  private setupBasicHandlers() {
    // Lista tools disponíveis
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: Array.from(this.tools.values()).map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema || {
            type: "object",
            properties: {},
          },
        })),
      };
    });

    // Executa tools
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      const tool = this.tools.get(name);
      if (!tool) {
        throw new Error(`Tool '${name}' not found`);
      }

      try {
        const startTime = Date.now();
        const result = await tool.handler(args, this.getEnvironment());
        const duration = Date.now() - startTime;

        // Analytics tracking (se disponível)
        if (this.getEnvironment().trackUsage) {
          await this.getEnvironment().trackUsage(name, duration, true);
        }

        return {
          content: [
            {
              type: "text",
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        console.error(`Tool '${name}' failed:`, error);
        throw new Error(`Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });
  }

  /**
   * Adiciona uma tool ao servidor
   */
  protected addTool(tool: {
    name: string;
    description: string;
    inputSchema?: any;
    handler: (args: any, env: any) => Promise<any>;
  }) {
    this.tools.set(tool.name, tool);
  }

  /**
   * Get environment context (deve ser implementado por subclasses)
   */
  protected abstract getEnvironment(): any;

  /**
   * Initialize the agent (deve ser implementado por subclasses)
   */
  abstract init(): Promise<void>;

  /**
   * Start the server
   */
  async start() {
    await this.init();
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.log("MCP server running on stdio");
  }
}

/**
 * 🛠️ Utility functions para tools
 */
export class ToolUtils {
  /**
   * Valida argumentos usando schema Zod
   */
  static validateArgs<T>(schema: z.ZodSchema<T>, args: any): T {
    const result = schema.safeParse(args);
    if (!result.success) {
      throw new Error(`Invalid arguments: ${result.error.message}`);
    }
    return result.data;
  }

  /**
   * Formata response para MCP
   */
  static formatResponse(data: any, format: 'json' | 'text' = 'json') {
    if (format === 'text' && typeof data === 'string') {
      return data;
    }
    return JSON.stringify(data, null, 2);
  }

  /**
   * Error handling padrão
   */
  static handleError(error: unknown, toolName: string): never {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${toolName}] Error:`, error);
    throw new Error(`${toolName} failed: ${message}`);
  }

  /**
   * Timeout wrapper para operações
   */
  static async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage = 'Operation timed out'
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    );

    return Promise.race([promise, timeoutPromise]);
  }
}

/**
 * 📊 Performance tracking mixin
 */
export class PerformanceTracker {
  static async trackExecution<T>(
    operation: () => Promise<T>,
    operationName: string,
    env?: any
  ): Promise<{ result: T; duration: number; success: boolean }> {
    const startTime = Date.now();
    let success = false;
    let result: T;

    try {
      result = await operation();
      success = true;
      return { result, duration: Date.now() - startTime, success };
    } catch (error) {
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      
      // Log performance
      console.log(`[${operationName}] Duration: ${duration}ms, Success: ${success}`);
      
      // Track in analytics if available
      if (env?.trackUsage) {
        try {
          await env.trackUsage(operationName, duration, success);
        } catch (trackingError) {
          console.warn('Analytics tracking failed:', trackingError);
        }
      }
    }
  }
}