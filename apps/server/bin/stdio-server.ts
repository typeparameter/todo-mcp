import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { MockAuthService } from "../src/auth-service.ts";
import { logger } from "../src/logger.ts";
import { TodoMcpServer } from "../src/server.ts";

const server = new TodoMcpServer({ authService: new MockAuthService() });

logger.info("Started todo-mcp server over stdio");
await server.connect(new StdioServerTransport());
