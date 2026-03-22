import { z } from "zod";

export const TodoSchema = z.object({
  id: z.string(),
  content: z.string().trim().min(1),
  status: z.enum(["open", "closed"]),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
});

export const ListTodosInputSchema = z.object({ show_all: z.boolean().default(false) });
export const ListTodosOutputSchema = z.object({ todos: TodoSchema.array() });

export const CreateTodoInputSchema = TodoSchema.omit({ id: true, created_at: true, updated_at: true }).extend({
  status: TodoSchema.shape.status.default("open"),
});
export const CreateTodoOutputSchema = TodoSchema.pick({ id: true });

export const UpdateTodoInputSchema = TodoSchema.omit({ created_at: true, updated_at: true }).extend({
  content: TodoSchema.shape.content.optional(),
  status: TodoSchema.shape.status.optional(),
});
export const UpdateTodoOutputSchema = z.object({});

export const DeleteTodoInputSchema = TodoSchema.pick({ id: true });
export const DeleteTodoOutputSchema = z.object({});

export type Todo = z.infer<typeof TodoSchema>;

export type ListTodosInput = z.infer<typeof ListTodosInputSchema>;
export type ListTodosOutput = z.infer<typeof ListTodosOutputSchema>;

export type CreateTodoInput = z.infer<typeof CreateTodoInputSchema>;
export type CreateTodoOutput = z.infer<typeof CreateTodoOutputSchema>;

export type UpdateTodoInput = z.infer<typeof UpdateTodoInputSchema>;
export type UpdateTodoOutput = z.infer<typeof UpdateTodoOutputSchema>;

export type DeleteTodoInput = z.infer<typeof DeleteTodoInputSchema>;
export type DeleteTodoOutput = z.infer<typeof DeleteTodoOutputSchema>;
