import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { TodoRepository } from "@typeparameter/todo-mcp-data-access";
import {
  CreateTodoInputSchema,
  CreateTodoOutputSchema,
  DeleteTodoInputSchema,
  DeleteTodoOutputSchema,
  ListTodosInputSchema,
  ListTodosOutputSchema,
  UpdateTodoInputSchema,
  UpdateTodoOutputSchema,
} from "@typeparameter/todo-mcp-models";

import type { AuthService } from "./auth-service.ts";
import { logger } from "./logger.ts";

interface InitOptions {
  readonly authService: AuthService;
}

export class TodoMcpServer extends McpServer {
  private readonly authService: AuthService;
  private readonly todoRepository: TodoRepository;

  constructor(opts: InitOptions) {
    super({ name: "todo-mcp", version: "1.0.0" });

    this.authService = opts.authService;
    this.todoRepository = new TodoRepository({ tableName: process.env["TODOS_TABLE_NAME"]! });

    this.registerTool(
      "list-todos",
      {
        description: "List out the todos for the current user",
        inputSchema: ListTodosInputSchema,
        outputSchema: ListTodosOutputSchema,
      },
      async () => {
        const userId = this.authService.getUserId();
        const { todos } = await this.todoRepository.listTodos(userId);
        return buildResult({ todos });
      },
    );

    this.registerTool(
      "create-todo",
      {
        description: "Create a new todo item",
        inputSchema: CreateTodoInputSchema,
        outputSchema: CreateTodoOutputSchema,
      },
      async (input) => {
        const userId = this.authService.getUserId();
        const { id } = await this.todoRepository.createTodo(userId, input);
        logger.info(`Todo with id ${id} was created by user ${userId}`);
        return buildResult({ id });
      },
    );

    this.registerTool(
      "update-todo",
      {
        description: "Update an existing todo item",
        inputSchema: UpdateTodoInputSchema,
        outputSchema: UpdateTodoOutputSchema,
      },
      async (input) => {
        const userId = this.authService.getUserId();
        await this.todoRepository.updateTodo(userId, input);
        logger.info(`Todo with id ${input.id} was updated by user ${userId}`);
        return buildResult({});
      },
    );

    this.registerTool(
      "delete-todo",
      {
        description: "Delete an existing todo item",
        inputSchema: DeleteTodoInputSchema,
        outputSchema: DeleteTodoOutputSchema,
      },
      async (input) => {
        const userId = this.authService.getUserId();
        await this.todoRepository.deleteTodo(userId, input);
        logger.info(`Todo with id ${input.id} was deleted by user ${userId}`);
        return buildResult({});
      },
    );
  }
}

function buildResult<T>(obj: T) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(obj) }],
    structuredContent: obj,
  };
}
