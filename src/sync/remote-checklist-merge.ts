import type { GraphChecklistItem } from "../types/graph";
import type { ParsedSubtask, ParsedSyncTask } from "../types/sync";
import { sanitizeTaskDisplayText } from "../parse/task-text";
import { serializeMtdComment } from "../parse/mtd-comment";

/**
 * Merge remote checklist into local subtasks.
 * Mapped local steps missing from Graph are dropped (To Do deleted the Step).
 */
export function mergeRemoteChecklistIntoSubtasks(
  task: ParsedSyncTask,
  checklist: GraphChecklistItem[],
  steps: Record<string, string>
): { subtasks: ParsedSubtask[]; steps: Record<string, string> } {
  const remoteById = new Map(checklist.map((item) => [item.id, item]));
  const mergedSteps: Record<string, string> = {};
  const mappedGraphIds = new Set<string>();

  const subtasks: ParsedSubtask[] = [];
  for (const sub of task.subtasks) {
    const stepId = sub.mtd.step ?? `step-${sub.line}`;
    const graphStepId = steps[stepId];
    if (graphStepId) {
      const remote = remoteById.get(graphStepId);
      if (!remote) {
        // Remote Step deleted — drop local mapped subtask.
        continue;
      }
      mergedSteps[stepId] = graphStepId;
      mappedGraphIds.add(graphStepId);
      subtasks.push({
        ...sub,
        title: remote.displayName,
        checked: remote.isChecked,
        mtd: { ...sub.mtd, step: stepId },
      });
      continue;
    }
    // Unmapped local subtask — keep until outbound creates a Graph step.
    subtasks.push(sub);
  }

  for (const remote of checklist) {
    if (mappedGraphIds.has(remote.id)) {
      continue;
    }
    const subtaskLine = task.line + 1 + subtasks.length;
    const stepId = `step-${subtaskLine}`;
    mergedSteps[stepId] = remote.id;
    mappedGraphIds.add(remote.id);
    const check = remote.isChecked ? "x" : " ";
    const title = sanitizeTaskDisplayText(remote.displayName?.trim() || "Step");
    const mtd = serializeMtdComment({ step: stepId });
    subtasks.push({
      line: subtaskLine,
      rawLine: `  - [${check}] ${title}${mtd ? ` ${mtd}` : ""}`,
      title,
      checked: remote.isChecked,
      mtd: { step: stepId },
    });
  }

  return { subtasks, steps: mergedSteps };
}
