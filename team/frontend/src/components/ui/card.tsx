import type { PropsWithChildren } from "react";
import { cn } from "../../lib/utils";

export function Card({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <div className={cn("rounded-xl border border-slate-200 bg-white shadow-sm", className)}>{children}</div>;
}

export function CardHeader({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <div className={cn("border-b border-slate-100 px-5 py-4", className)}>{children}</div>;
}

export function CardTitle({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <h2 className={cn("text-lg font-semibold text-slate-900", className)}>{children}</h2>;
}

export function CardDescription({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <p className={cn("mt-1 text-sm text-slate-600", className)}>{children}</p>;
}

export function CardContent({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}
