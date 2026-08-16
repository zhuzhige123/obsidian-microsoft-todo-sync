import type { GraphChecklistItem } from "../types/graph";
import type { ParsedSubtask, ParsedSyncTask } from "../types/sync";
import { sanitizeTaskDisplayText } from "../parse/task-text";
import { serializeMtdComment } from "../parse/mtd-comment";

export function mergeRemoteChecklistIntoSubtasks(
  task: ParsedSyncTask,
  checklist: GraphChecklistItem[],
  steps: Record<string, string>
): { subtasks: ParsedSubtask[]; steps: Record<string, string> } {
  const mergedSteps = { ...steps };
  const mappedGraphIds = new Set(Object.values(mergedSteps).filter(Boolean));

  const subtasks = task.subtasks.map((sub) => {
    const stepId = sub.mtd.step ?? `step-${sub.line}`;
    const graphStepId = mergedSteps[stepId];
    const remote = graphStepId ? checklist.find((item) => item.id === graphStepId) : undefined;
    if (!remote) {
      return sub;
    }
    mappedGraphIds.add(graphStepId);
    return {
      ...sub,
      title: remote.displayName,
      checked: remote.isChecked,
      mtd: { ...sub.mtd, step: stepId },
    };
  });

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
