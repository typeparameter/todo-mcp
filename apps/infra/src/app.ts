import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";

import { getDependencyPath } from "./file-utils.ts";

const app = new cdk.App();
const stack = new cdk.Stack(app, "todo-mcp");

const todosTable = new dynamodb.Table(stack, "TodosTable", {
  partitionKey: {
    name: "UserId",
    type: dynamodb.AttributeType.STRING,
  },
  sortKey: {
    name: "TodoId",
    type: dynamodb.AttributeType.STRING,
  },
  billingMode: dynamodb.BillingMode.PROVISIONED,
  readCapacity: 5,
  writeCapacity: 5,
});

const mcpServerLambda = new lambda.Function(stack, "McpServerLambda", {
  code: lambda.Code.fromAsset(getDependencyPath("@typeparameter/todo-mcp-server/handler")),
  handler: "index.handler",
  architecture: lambda.Architecture.ARM_64,
  runtime: lambda.Runtime.NODEJS_24_X,
  environment: {
    NODE_OPTIONS: "--enable-source-maps",
    TODOS_TABLE_NAME: todosTable.tableName,
  },
});

todosTable.grantReadWriteData(mcpServerLambda);

const userPool = new cognito.UserPool(stack, "UserPool", {
  featurePlan: cognito.FeaturePlan.ESSENTIALS,
  signInAliases: { email: true },
  keepOriginal: { email: true },
  signInPolicy: {
    allowedFirstAuthFactors: {
      emailOtp: true,
      password: true,
    },
  },
  selfSignUpEnabled: false,
});

userPool.addDomain("Domain", {
  cognitoDomain: {
    domainPrefix: `todo-mcp-${userPool.env.account}`,
  },
});

const mcpApi = new apigateway.RestApi(stack, "McpApi", {
  restApiName: "TodoMcpRestApi",
  defaultCorsPreflightOptions: {
    allowOrigins: apigateway.Cors.ALL_ORIGINS,
    allowMethods: apigateway.Cors.ALL_METHODS,
  },
  deployOptions: {
    stageName: "prod",
    throttlingRateLimit: 10,
    throttlingBurstLimit: 20,
  },
});

const mcpApiUrl = `https://${mcpApi.restApiId}.execute-api.${mcpApi.env.region}.amazonaws.com/prod`;

const scopes = [new cognito.ResourceServerScope({ scopeName: "todos", scopeDescription: "Read and write todos" })];

const resourceServer = new cognito.UserPoolResourceServer(stack, "ResourceServer", {
  userPoolResourceServerName: "todo-mcp",
  identifier: `${mcpApiUrl}/mcp`,
  scopes,
  userPool,
});

const oauthScopes = scopes.map((scope) => cognito.OAuthScope.resourceServer(resourceServer, scope));

const authorizer = new apigateway.CognitoUserPoolsAuthorizer(mcpApi, "Authorizer", {
  cognitoUserPools: [userPool],
});

const mcpResource = mcpApi.root.addResource("mcp");
mcpResource.addMethod("POST", new apigateway.LambdaIntegration(mcpServerLambda), {
  authorizer,
  authorizationScopes: oauthScopes.map((scope) => scope.scopeName),
  authorizationType: apigateway.AuthorizationType.COGNITO,
});

const metadataResource = mcpApi.root
  .addResource(".well-known")
  .addResource("oauth-protected-resource")
  .addResource("mcp");

const metadataIntegration = new apigateway.MockIntegration({
  integrationResponses: [
    {
      statusCode: "200",
      responseParameters: {
        "method.response.header.Content-Type": "'application/json'",
        "method.response.header.Access-Control-Allow-Origin": "'*'",
      },
      responseTemplates: {
        "application/json": JSON.stringify({
          resource: `${mcpApiUrl}/mcp`,
          authorization_servers: [userPool.userPoolProviderUrl],
          bearer_methods_supported: ["header"],
          scopes_supported: oauthScopes.map((scope) => scope.scopeName),
        }),
      },
    },
  ],
  requestTemplates: {
    "application/json": '{"statusCode": 200}',
  },
});

metadataResource.addMethod("GET", metadataIntegration, {
  methodResponses: [
    {
      statusCode: "200",
      responseParameters: {
        "method.response.header.Content-Type": true,
        "method.response.header.Access-Control-Allow-Origin": true,
      },
    },
  ],
});

new apigateway.GatewayResponse(mcpApi, "UnauthorizedResponse", {
  restApi: mcpApi,
  type: apigateway.ResponseType.UNAUTHORIZED,
  statusCode: "401",
  responseHeaders: {
    "WWW-Authenticate": `'Bearer error="invalid_request", scope="${oauthScopes.map((scope) => scope.scopeName).join(" ")}", resource_metadata="${mcpApiUrl}/.well-known/oauth-protected-resource/mcp"'`,
  },
});

new apigateway.GatewayResponse(mcpApi, "AccessDeniedResponse", {
  restApi: mcpApi,
  type: apigateway.ResponseType.ACCESS_DENIED,
  statusCode: "403",
  responseHeaders: {
    "WWW-Authenticate": `'Bearer error="insufficient_scope", scope="${oauthScopes.map((scope) => scope.scopeName).join(" ")}"'`,
  },
});
