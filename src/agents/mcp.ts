import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Base MCP Agent class for Cloudflare Workers
 * Provides foundation for MCP server implementations
 */
export abstract class McpAgent {
  abstract server: McpServer;
  
  /**
   * Initialize the MCP agent
   */
  abstract init(): Promise<void>;
  
  /**
   * Static method to serve SSE (Server-Sent Events) for Claude.ai integration
   */
  static serveSSE(path: string) {
    return {
      fetch: async (request: Request, env: any, ctx: any) => {
        return new Response("MCP SSE endpoint - integration pending", {
          headers: { 
            "Content-Type": "text/plain",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
    };
  }
  
  /**
   * Static method to serve MCP endpoint
   */
  static serve(path: string) {
    return {
      fetch: async (request: Request, env: any, ctx: any) => {
        return new Response("MCP endpoint - integration pending", {
          headers: { 
            "Content-Type": "text/plain",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
    };
  }
}