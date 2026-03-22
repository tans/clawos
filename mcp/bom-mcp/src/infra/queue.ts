import { logInfo, logWarn } from "./logger";

const tasks: Array<() => Promise<void>> = [];
let running = false;

async function flush(): Promise<void> {
  if (running) {
    return;
  }
  running = true;
  while (tasks.length > 0) {
    const task = tasks.shift();
    if (!task) {
      continue;
    }
    try {
      await task();
    } catch (error) {
      logWarn("queue.task.failed", { error: (error as Error).message });
    }
  }
  running = false;
}

export function enqueue(task: () => Promise<void>): void {
  tasks.push(task);
  logInfo("queue.enqueued", { size: tasks.length });
  queueMicrotask(() => {
    void flush();
  });
}
