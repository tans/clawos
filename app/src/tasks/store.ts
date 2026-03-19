export type TaskStatus = "pending" | "running" | "success" | "failed";
export type LogLevel = "info" | "error";

export type TaskLog = {
  timestamp: string;
  level: LogLevel;
  message: string;
};

export type Task = {
  id: string;
  type: string;
  title: string;
  status: TaskStatus;
  startedAt: string;
  endedAt: string | null;
  step: number;
  totalSteps: number;
  logs: TaskLog[];
  error: string | null;
};

const MAX_TASKS = 30;
const tasks = new Map<string, Task>();

export function createTask(type: string, title: string, totalSteps: number): Task {
  const task: Task = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    title,
    status: "pending",
    startedAt: new Date().toISOString(),
    endedAt: null,
    step: 0,
    totalSteps,
    logs: [],
    error: null,
  };

  tasks.set(task.id, task);

  if (tasks.size > MAX_TASKS) {
    const oldestId = tasks.keys().next().value;
    if (oldestId) {
      tasks.delete(oldestId);
    }
  }

  return task;
}

export function appendTaskLog(task: Task, message: string, level: LogLevel = "info"): void {
  task.logs.push({
    timestamp: new Date().toISOString(),
    level,
    message,
  });
}

export function findRunningTask(type: string): Task | null {
  for (const task of tasks.values()) {
    if (task.type === type && task.status === "running") {
      return task;
    }
  }
  return null;
}

export function getTaskById(id: string): Task | undefined {
  return tasks.get(id);
}

export function listRecentTasks(limit = 20): Task[] {
  return Array.from(tasks.values())
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
    .slice(0, limit);
}
