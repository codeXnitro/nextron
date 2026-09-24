"use server";

import { db } from "@/lib/db";
import type { DatabaseDoc } from "@/lib/db/types";

export type TodoDoc = DatabaseDoc & {
  title: string;
  completed: boolean;
  priority?: "low" | "medium" | "high";
  source?: string;
};

export async function createTodoServerAction(title: string, priority: "low" | "medium" | "high" = "medium") {
  const sanitized = (title || "").trim();
  if (!sanitized) throw new Error("Title cannot be empty");

  const newTodo = await db.collection<TodoDoc>("todos").insert({
    title: sanitized,
    completed: false,
    priority,
    source: "Next.js Server Action",
  });

  return { success: true, todo: newTodo };
}

export async function toggleTodoServerAction(id: string, completed: boolean) {
  const updated = await db.collection<TodoDoc>("todos").update(id, {
    completed,
  });

  return { success: true, todo: updated };
}

export async function deleteTodoServerAction(id: string) {
  const deleted = await db.collection<TodoDoc>("todos").delete(id);
  return { success: deleted };
}

export async function getDatabaseStatsServerAction() {
  return db.getStats();
}
