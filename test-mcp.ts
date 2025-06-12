import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Simple test to check MCP SDK types
const server = new McpServer({
  name: "test-server",
  version: "1.0.0"
});

// Test tool registration to see the correct signature
server.tool(
  "test_tool",
  {
    test_param: z.string().describe("Test parameter")
  },
  async ({ test_param }, context) => {
    // Check what's available in context
    console.log("Context:", context);
    
    return {
      content: [{
        type: "text",
        text: `Test tool executed with: ${test_param}`
      }]
    };
  }
);

export { server };