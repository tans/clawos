import type { AnchorHTMLAttributes, ButtonHTMLAttributes, PropsWithChildren } from "react";
import { cn } from "../../lib/utils";

type Variant = "default" | "outline";

function classes(variant: Variant): string {
  if (variant === "outline") {
    return "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50";
  }
  return "border border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-500";
}

export function Button({
  className,
  variant = "default",
  ...props
}: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }>) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        classes(variant),
        className,
      )}
      {...props}
    />
  );
}

export function LinkButton({
  className,
  variant = "outline",
  ...props
}: PropsWithChildren<AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant }>) {
  return (
    <a
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        classes(variant),
        className,
      )}
      {...props}
    />
  );
}
