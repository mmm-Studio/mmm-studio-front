"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "./info-tooltip";
import { Skeleton } from "@/components/ui/skeleton";

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tooltip?: string;
  subtitle?: string;
  trend?: { value: string; positive: boolean };
  loading?: boolean;
  variant?: "default" | "success" | "warning" | "danger";
  className?: string;
}

const variantStyles = {
  default: {
    icon: "bg-primary/10 text-primary",
    trend: "",
  },
  success: {
    icon: "bg-emerald-500/10 text-emerald-600",
    trend: "text-emerald-600",
  },
  warning: {
    icon: "bg-amber-500/10 text-amber-600",
    trend: "text-amber-600",
  },
  danger: {
    icon: "bg-red-500/10 text-red-600",
    trend: "text-red-600",
  },
};

export function MetricCard({
  icon: Icon,
  label,
  value,
  tooltip,
  subtitle,
  trend,
  loading = false,
  variant = "default",
  className,
}: MetricCardProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        "relative flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              styles.icon
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
        </div>
        {tooltip && <InfoTooltip content={tooltip} />}
      </div>

      {loading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <div className="flex items-end gap-2">
          <span className="text-2xl font-bold tracking-tight">{value}</span>
          {trend && (
            <span
              className={cn(
                "text-xs font-medium pb-0.5",
                trend.positive ? "text-emerald-600" : "text-red-500"
              )}
            >
              {trend.value}
            </span>
          )}
        </div>
      )}

      {subtitle && !loading && (
        <p className="text-xs text-muted-foreground leading-relaxed -mt-1">
          {subtitle}
        </p>
      )}
    </div>
  );
}
