import type { GraphTodoTask } from "../types/graph";

export function graphIndexTimestamps(task: GraphTodoTask): {
  graphModified?: string;
  graphBodyModified?: string;
} {
  return {
    graphModified: task.lastModifiedDateTime,
    graphBodyModified: task.bodyLastModifiedDateTime,
  };
}
