import { createServer, IncomingMessage, RequestListener } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { APIGatewayProxyWithCognitoAuthorizerEvent, Context } from "aws-lambda";
import serverless from "serverless-http";

import { CognitoAuthService } from "./auth-service.ts";
import { TodoMcpServer } from "./server.ts";

const createServerless = (listener: RequestListener) => serverless(createServer(listener));

export const handler = async (event: APIGatewayProxyWithCognitoAuthorizerEvent, context: Context) => {
  const transport = new StreamableHTTPServerTransport({
    enableJsonResponse: true,
    sessionIdGenerator: undefined,
  });

  const server = new TodoMcpServer({ authService: new CognitoAuthService(event.requestContext.authorizer) });
  await server.connect(transport);

  const handleRequest = createServerless((req, res) => {
    populateRawHeaders(req);
    transport.handleRequest(req, res);
  });

  return handleRequest(event, context);
};

function populateRawHeaders(req: IncomingMessage) {
  req.rawHeaders = Object.entries(req.headers)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .flat();
}
