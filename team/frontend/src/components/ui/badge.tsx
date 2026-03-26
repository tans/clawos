import type { PropsWithChildren } from "react";
import { cn } from "../../lib/utils";

export function Badge({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <span className={cn("inline-flex items-center rounded-full border border-slate-200 px-2.5 py-0.5 text-xs", className)}>
      {children}
    </span>
  );
}
