export type TaskLogEntry = {
  timestamp: string;
  level: string;
  message: string;
};

export type TaskRecord = {
  id: string;
  title: string;
  status: "pending" | "running" | "success" | "failed" | string;
  step: number;
  totalSteps: number;
  logs: TaskLogEntry[];
};
