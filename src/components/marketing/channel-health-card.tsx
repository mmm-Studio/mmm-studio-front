"use client";

import { TrendingUp, TrendingDown, Minus, AlertTriangle, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "./info-tooltip";

interface ChannelHealthCardProps {
  name: string;
  roas: number;
  spend: number;
  contributionShare: number;
  spendShare: number;
  recommendation?: string;
  className?: string;
}

function getHealthLevel(roas: number) {
  if (roas >= 3)
    return {
      color: "emerald",
      label: "Canal estrella",
      icon: Award,
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      text: "text-emerald-700",
      barColor: "bg-emerald-500",
    };
  if (roas >= 1)
    return {
      color: "blue",
      label: "Canal rentable",
      icon: TrendingUp,
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
      text: "text-blue-700",
      barColor: "bg-blue-500",
    };
  if (roas >= 0.5)
    return {
      color: "amber",
      label: "Cerca del umbral",
      icon: Minus,
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
      text: "text-amber-700",
      barColor: "bg-amber-500",
    };
  return {
    color: "red",
    label: "No rentable",
    icon: AlertTriangle,
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    text: "text-red-600",
    barColor: "bg-red-500",
  };
}

function formatEur(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

export function ChannelHealthCard({
  name,
  roas,
  spend,
  contributionShare,
  spendShare,
  recommendation,
  className,
}: ChannelHealthCardProps) {
  const health = getHealthLevel(roas);
  const StatusIcon = health.icon;
  const efficiencyGap = contributionShare - spendShare;

  const GapIcon = efficiencyGap > 2 ? TrendingUp : efficiencyGap < -2 ? TrendingDown : Minus;

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 space-y-3 transition-shadow hover:shadow-sm",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">{name}</h4>
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
            health.bg,
            health.text
          )}
        >
          <StatusIcon className="h-3 w-3" />
          {health.label}
        </div>
      </div>

      {/* ROAS bar */}
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-bold tracking-tight">{roas.toFixed(1)}x</span>
            <InfoTooltip
              content={`Por cada euro invertido en ${name}, se generan ${roas.toFixed(2)} EUR en ventas`}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {formatEur(spend)} EUR/sem
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", health.barColor)}
            style={{ width: `${Math.min((roas / 15) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Shares */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">
            Presupuesto: <span className="font-medium text-foreground">{spendShare.toFixed(1)}%</span>
          </span>
          <span className="text-muted-foreground">
            Ventas: <span className="font-medium text-foreground">{contributionShare.toFixed(1)}%</span>
          </span>
        </div>
        <div
          className={cn(
            "flex items-center gap-1 font-medium",
            efficiencyGap > 2
              ? "text-emerald-600"
              : efficiencyGap < -2
                ? "text-red-500"
                : "text-muted-foreground"
          )}
        >
          <GapIcon className="h-3 w-3" />
          {efficiencyGap > 0 ? "+" : ""}
          {efficiencyGap.toFixed(1)}pp
        </div>
      </div>

      {/* Recommendation */}
      {recommendation && (
        <p className="text-xs text-muted-foreground leading-relaxed border-t pt-2.5">
          {recommendation}
        </p>
      )}
    </div>
  );
}
