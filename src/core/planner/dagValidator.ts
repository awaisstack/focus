import type { TaskItem } from '@/types/task';

export interface RemovedDependencyEdge {
  fromTaskId: string;
  dependsOnId: string;
  reason: string;
}

export interface DagValidationResult {
  tasks: TaskItem[];
  topologicalOrder: string[];
  hadCycle: boolean;
  removedEdges: RemovedDependencyEdge[];
  /** Number of downstream tasks that directly or transitively depend on each task ID */
  dependentCounts: Map<string, number>;
}

/**
 * Validates that task dependencies form a valid Directed Acyclic Graph (DAG).
 * Uses Kahn's topological sort algorithm. If a cycle exists, deterministically
 * breaks the cycle by removing a dependency from the blocking node with lowest priority
 * (or latest appearance) and re-runs until the graph is acyclic.
 */
export function validateAndResolveTaskDag(
  inputTasks: TaskItem[]
): DagValidationResult {
  const validIds = new Set(inputTasks.map((t) => t.id));
  const removedEdges: RemovedDependencyEdge[] = [];

  // Clone tasks and ensure only valid, non-self dependencies exist
  let workingTasks: TaskItem[] = inputTasks.map((task) => {
    const filteredDeps = Array.from(new Set(task.dependencies)).filter((depId) => {
      if (depId === task.id) {
        removedEdges.push({
          fromTaskId: task.id,
          dependsOnId: depId,
          reason: 'Self-dependency is not permitted.'
        });
        return false;
      }
      if (!validIds.has(depId)) {
        removedEdges.push({
          fromTaskId: task.id,
          dependsOnId: depId,
          reason: `Referenced dependency "${depId}" does not exist.`
        });
        return false;
      }
      return true;
    });

    return {
      ...task,
      dependencies: filteredDeps
    };
  });

  let hadCycle = false;
  let topologicalOrder: string[] = [];

  // Bounded loop (max N iterations) to break any cycles deterministically
  for (let attempt = 0; attempt <= workingTasks.length; attempt++) {
    const inDegree = new Map<string, number>();
    const dependentsMap = new Map<string, string[]>();

    for (const t of workingTasks) {
      inDegree.set(t.id, t.dependencies.length);
      dependentsMap.set(t.id, []);
    }

    for (const t of workingTasks) {
      for (const prereqId of t.dependencies) {
        dependentsMap.get(prereqId)?.push(t.id);
      }
    }

    // Seed queue with zero in-degree tasks in original list order for stability
    const queue: string[] = workingTasks
      .filter((t) => (inDegree.get(t.id) ?? 0) === 0)
      .map((t) => t.id);

    const currentOrder: string[] = [];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      currentOrder.push(currentId);

      const children = dependentsMap.get(currentId) ?? [];
      for (const childId of children) {
        const nextDeg = (inDegree.get(childId) ?? 1) - 1;
        inDegree.set(childId, nextDeg);
        if (nextDeg === 0) {
          queue.push(childId);
        }
      }
    }

    if (currentOrder.length === workingTasks.length) {
      topologicalOrder = currentOrder;
      break;
    }

    // Cycle detected among nodes not yet in currentOrder
    hadCycle = true;
    const cycleSet = new Set(
      workingTasks
        .map((t) => t.id)
        .filter((id) => !currentOrder.includes(id))
    );

    // Pick the cycle participant with the highest priority to free it from waiting on lower-priority nodes
    const cycleParticipants = workingTasks.filter((t) => cycleSet.has(t.id));
    cycleParticipants.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return workingTasks.indexOf(a) - workingTasks.indexOf(b);
    });

    const targetTask = cycleParticipants[0];
    const depToBreak =
      targetTask.dependencies.find((d) => cycleSet.has(d)) ??
      targetTask.dependencies[0];

    if (targetTask && depToBreak) {
      removedEdges.push({
        fromTaskId: targetTask.id,
        dependsOnId: depToBreak,
        reason: `Broken circular dependency between "${targetTask.title}" and "${depToBreak}".`
      });

      workingTasks = workingTasks.map((t) =>
        t.id === targetTask.id
          ? {
              ...t,
              dependencies: t.dependencies.filter((d) => d !== depToBreak)
            }
          : t
      );
    } else {
      topologicalOrder = workingTasks.map((t) => t.id);
      break;
    }
  }

  // Compute transitive dependent counts for each task
  const directDependents = new Map<string, string[]>();
  for (const t of workingTasks) {
    directDependents.set(t.id, []);
  }
  for (const t of workingTasks) {
    for (const prereqId of t.dependencies) {
      directDependents.get(prereqId)?.push(t.id);
    }
  }

  const dependentCounts = new Map<string, number>();
  for (const t of workingTasks) {
    const visited = new Set<string>();
    const stack = [...(directDependents.get(t.id) ?? [])];
    while (stack.length > 0) {
      const curr = stack.pop()!;
      if (!visited.has(curr)) {
        visited.add(curr);
        const nextChildren = directDependents.get(curr) ?? [];
        stack.push(...nextChildren);
      }
    }
    dependentCounts.set(t.id, visited.size);
  }

  return {
    tasks: workingTasks,
    topologicalOrder,
    hadCycle,
    removedEdges,
    dependentCounts
  };
}
