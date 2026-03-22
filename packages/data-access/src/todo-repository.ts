import { randomUUID } from "node:crypto";
import { ConditionalCheckFailedException, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  paginateQuery,
  PutCommand,
  UpdateCommand,
  type QueryCommandInput,
  type UpdateCommandInput,
} from "@aws-sdk/lib-dynamodb";

import {
  TodoSchema,
  type CreateTodoInput,
  type CreateTodoOutput,
  type DeleteTodoInput,
  type DeleteTodoOutput,
  type ListTodosInput,
  type ListTodosOutput,
  type UpdateTodoInput,
  type UpdateTodoOutput,
} from "@typeparameter/todo-mcp-models";

import { ItemAlreadyExistsError, ItemNotFoundError, RepositoryError } from "./errors.ts";

interface TodoRepositoryConfig {
  readonly tableName: string;
}

export class TodoRepository {
  private readonly statusIndexName = "UserIdStatusIndex";

  private readonly tableName: string;
  private readonly documentClient: DynamoDBDocumentClient;

  constructor(config: TodoRepositoryConfig) {
    this.tableName = config.tableName;
    this.documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  }

  async listTodos(userId: string, input: ListTodosInput): Promise<ListTodosOutput> {
    const { show_all } = input;
    const items: Record<string, unknown>[] = [];

    const queryInput: QueryCommandInput = {
      TableName: this.tableName,
      KeyConditionExpression: "UserId = :userId",
      ExpressionAttributeValues: { ":userId": userId },
    };

    if (!show_all) {
      queryInput.IndexName = this.statusIndexName;
      queryInput.KeyConditionExpression = "UserId = :userId AND #status = :status";
      queryInput.ExpressionAttributeNames = { "#status": "Status" };
      queryInput.ExpressionAttributeValues = { ":userId": userId, ":status": "open" };
    }

    try {
      const paginator = paginateQuery({ client: this.documentClient }, queryInput);
      for await (const page of paginator) items.push(...(page.Items ?? []));
    } catch (error) {
      throw new RepositoryError("Repository operation failed", { cause: error });
    }

    return {
      todos: items.map((item) =>
        TodoSchema.parse({
          id: item["TodoId"],
          content: item["Content"],
          status: item["Status"],
          created_at: item["CreatedAt"],
          updated_at: item["UpdatedAt"],
        }),
      ),
    };
  }

  async createTodo(userId: string, input: CreateTodoInput): Promise<CreateTodoOutput> {
    const { content, status } = input;

    const id = randomUUID();
    const timestamp = new Date().toISOString();
    const item = {
      UserId: userId,
      TodoId: id,
      Content: content,
      Status: status,
      CreatedAt: timestamp,
      UpdatedAt: timestamp,
    };

    try {
      await this.documentClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
          ConditionExpression: "attribute_not_exists(UserId) AND attribute_not_exists(TodoId)",
        }),
      );
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        throw new ItemAlreadyExistsError(`Todo ${id} already exists for user ${userId}`, { cause: error });
      }

      throw new RepositoryError("Repository operation failed", { cause: error });
    }

    return { id };
  }

  async updateTodo(userId: string, input: UpdateTodoInput): Promise<UpdateTodoOutput> {
    const { id, content, status } = input;

    const expressionAttributeNames: Record<string, string> = {};

    const expressionAttributeValues: Record<string, string> = {
      ":updatedAt": new Date().toISOString(),
    };

    const updateInput: UpdateCommandInput = {
      TableName: this.tableName,
      Key: { UserId: userId, TodoId: id },
      ConditionExpression: "attribute_exists(UserId) AND attribute_exists(TodoId)",
      UpdateExpression: "SET UpdatedAt = :updatedAt",
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    };

    if (content !== undefined) {
      updateInput.UpdateExpression += ", Content = :content";
      expressionAttributeValues[":content"] = content;
    }

    if (status !== undefined) {
      updateInput.UpdateExpression += ", #status = :status";
      expressionAttributeNames["#status"] = "Status";
      expressionAttributeValues[":status"] = status;
    }

    try {
      await this.documentClient.send(new UpdateCommand(updateInput));
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        throw new ItemNotFoundError(`Todo ${id} does not exist for user ${userId}`, { cause: error });
      }

      throw new RepositoryError("Repository operation failed", { cause: error });
    }

    return {};
  }

  async deleteTodo(userId: string, input: DeleteTodoInput): Promise<DeleteTodoOutput> {
    const { id } = input;

    try {
      await this.documentClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { UserId: userId, TodoId: id },
          ConditionExpression: "attribute_exists(UserId) AND attribute_exists(TodoId)",
        }),
      );
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        throw new ItemNotFoundError(`Todo ${id} does not exist for user ${userId}`, { cause: error });
      }

      throw new RepositoryError("Repository operation failed", { cause: error });
    }

    return {};
  }
}
