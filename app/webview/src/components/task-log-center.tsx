import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { TaskRecord } from "../lib/api";
import { buildDefaultTaskMeta, formatTaskLogs } from "../lib/task-logs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";

export type LogCenterTask = {
  taskId: string;
  title: string;
  owner: string;
  status: string;
  taskMeta: string;
  logsText: string;
  updatedAt: number;
  unread: boolean;
};

type TaskStartInput = {
  taskId: string;
  title?: string;
  taskMeta?: string;
};

type TaskLogCenterContextValue = {
  tasks: LogCenterTask[];
  activeTaskId: string | null;
  open: boolean;
  startTask: (owner: string, input: TaskStartInput) => void;
  reportTask: (owner: string, task: TaskRecord, taskMeta?: string) => void;
  openCenter: (taskId?: string) => void;
  closeCenter: () => void;
  selectTask: (taskId: string) => void;
};

const TaskLogCenterContext = createContext<TaskLogCenterContextValue | null>(null);

function upsertTaskList(prev: LogCenterTask[], next: LogCenterTask): LogCenterTask[] {
  const index = prev.findIndex((item) => item.taskId === next.taskId);
  if (index < 0) {
    return [next, ...prev];
  }
  const merged = [...prev];
  merged[index] = { ...merged[index], ...next };
  merged.sort((a, b) => b.updatedAt - a.updatedAt);
  return merged;
}

export function TaskLogCenterProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<LogCenterTask[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);

  openRef.current = open;

  const selectTask = useCallback((taskId: string) => {
    setActiveTaskId(taskId);
    setTasks((prev) => prev.map((item) => (item.taskId === taskId ? { ...item, unread: false } : item)));
  }, []);

  const openCenter = useCallback(
    (taskId?: string) => {
      setOpen(true);
      if (taskId) {
        selectTask(taskId);
        return;
      }
      const resolvedTaskId = activeTaskId || tasks[0]?.taskId || null;
      setActiveTaskId(resolvedTaskId);
      if (resolvedTaskId) {
        setTasks((prev) => prev.map((item) => (item.taskId === resolvedTaskId ? { ...item, unread: false } : item)));
      }
    },
    [activeTaskId, selectTask, tasks]
  );

  const closeCenter = useCallback(() => {
    setOpen(false);
  }, []);

  const startTask = useCallback(
    (owner: string, input: TaskStartInput) => {
      const now = Date.now();
      const nextTask: LogCenterTask = {
        taskId: input.taskId,
        title: input.title || owner,
        owner,
        status: "pending",
        taskMeta: input.taskMeta || `${input.title || owner} | 执行中`,
        logsText: "任务启动中...",
        updatedAt: now,
        unread: !openRef.current,
      };
      setTasks((prev) => upsertTaskList(prev, nextTask));
      setActiveTaskId((prev) => prev || input.taskId);
    },
    []
  );

  const reportTask = useCallback(
    (owner: string, task: TaskRecord, taskMeta?: string) => {
      const nextId = task.id;
      setTasks((prev) => {
        const current = prev.find((item) => item.taskId === nextId);
        const logsText = formatTaskLogs(task.logs);
        const resolvedMeta = taskMeta || buildDefaultTaskMeta(task);
        const hasUpdate = current?.logsText !== logsText || current?.status !== task.status || current?.taskMeta !== resolvedMeta;
        const shouldMarkUnread = hasUpdate && (!openRef.current || activeTaskId !== nextId);

        const nextTask: LogCenterTask = {
          taskId: nextId,
          title: task.title || current?.title || owner,
          owner,
          status: task.status,
          taskMeta: resolvedMeta,
          logsText,
          updatedAt: Date.now(),
          unread: shouldMarkUnread ? true : current?.unread || false,
        };

        return upsertTaskList(prev, nextTask);
      });
      setActiveTaskId((prev) => prev || nextId);
    },
    [activeTaskId]
  );

  const value = useMemo<TaskLogCenterContextValue>(
    () => ({
      tasks,
      activeTaskId,
      open,
      startTask,
      reportTask,
      openCenter,
      closeCenter,
      selectTask,
    }),
    [tasks, activeTaskId, open, startTask, reportTask, openCenter, closeCenter, selectTask]
  );

  return <TaskLogCenterContext.Provider value={value}>{children}</TaskLogCenterContext.Provider>;
}

export function useTaskLogCenter(): TaskLogCenterContextValue {
  const context = useContext(TaskLogCenterContext);
  if (!context) {
    throw new Error("useTaskLogCenter must be used within TaskLogCenterProvider");
  }
  return context;
}

function readOwnerLabel(owner: string): string {
  switch (owner) {
    case "dashboard":
      return "控制台";
    case "environment":
      return "环境设置";
    case "backups":
      return "备份回滚";
    case "browser":
      return "浏览器设置";
    case "desktop-control":
      return "桌面控制";
    default:
      return owner;
  }
}

function readSummary(tasks: LogCenterTask[]): string {
  const running = tasks.filter((item) => item.status === "running" || item.status === "pending").length;
  const failed = tasks.filter((item) => item.status === "failed").length;
  return `日志(${tasks.length}) | ${running} 执行中 | ${failed} 失败`;
}

export function TaskLogCenterDock() {
  const { tasks, activeTaskId, open, closeCenter, openCenter, selectTask } = useTaskLogCenter();
  const consoleRef = useRef<HTMLPreElement | null>(null);

  const activeTask = tasks.find((item) => item.taskId === activeTaskId) || tasks[0] || null;

  useEffect(() => {
    if (!open || !consoleRef.current) {
      return;
    }
    consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
  }, [open, activeTask?.taskId, activeTask?.logsText]);

  if (tasks.length === 0) {
    return null;
  }

  return (
    <>
      <button className="log-center-chip" type="button" onClick={() => openCenter()}>
        {readSummary(tasks)}
      </button>

      <Sheet open={open} onOpenChange={(next) => (next ? openCenter(activeTask?.taskId) : closeCenter())}>
        <SheetContent side="right" className="log-center-sheet">
          <SheetHeader className="log-center-header">
            <SheetTitle>日志中心</SheetTitle>
          </SheetHeader>
          <div className="log-center-body">
            <aside className="log-center-list" aria-label="任务列表">
              {tasks.map((item) => (
                <button
                  key={item.taskId}
                  className={`log-center-item ${item.taskId === activeTask?.taskId ? "is-active" : ""}`}
                  type="button"
                  onClick={() => selectTask(item.taskId)}
                >
                  <div className="log-center-item-copy">
                    <strong>{item.title}</strong>
                    <span>{readOwnerLabel(item.owner)}</span>
                    <span>{item.taskMeta}</span>
                  </div>
                  <div className="log-center-badges">
                    {item.unread ? <span className="badge-soft">新日志</span> : null}
                    <span className="badge-soft">{item.status}</span>
                  </div>
                </button>
              ))}
            </aside>

            <section className="log-center-detail" aria-label="日志详情">
              <div className="log-center-detail-head">
                <div>
                  <strong>{activeTask?.title || "暂无任务"}</strong>
                  <p>{activeTask?.taskMeta || "暂无日志"}</p>
                </div>
              </div>
              <pre ref={consoleRef} className="log-console log-center-console">
                {activeTask?.logsText || "暂无日志"}
              </pre>
            </section>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
