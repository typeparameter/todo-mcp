import type { APIGatewayProxyCognitoAuthorizer } from "aws-lambda";

export interface AuthService {
  getUserId(): string;
}

export class CognitoAuthService implements AuthService {
  private readonly authorizer: APIGatewayProxyCognitoAuthorizer;

  constructor(authorizer: APIGatewayProxyCognitoAuthorizer) {
    this.authorizer = authorizer;
  }

  getUserId(): string {
    return this.authorizer.claims["sub"]!;
  }
}

export class MockAuthService implements AuthService {
  getUserId(): string {
    return "test-user";
  }
}
