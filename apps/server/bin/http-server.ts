import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { MockAuthService } from "../src/auth-service.ts";
import { logger } from "../src/logger.ts";
import { TodoMcpServer } from "../src/server.ts";

const handler = async (req: IncomingMessage, res: ServerResponse) => {
  if (req.url !== "/mcp" || req.method !== "POST") {
    res.writeHead(404).end();
    return;
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  try {
    const server = new TodoMcpServer({ authService: new MockAuthService() });

    await server.connect(transport);
    await transport.handleRequest(req, res);
  } catch (error) {
    logger.error("Error while serving mcp request", error);
    if (!res.headersSent) res.writeHead(500).end();
  }
};

createServer(handler).listen(8080, () => {
  logger.info("Started todo-mcp server over http on port 8080");
});
