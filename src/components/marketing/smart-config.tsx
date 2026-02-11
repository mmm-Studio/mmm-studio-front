"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ConfigOption<T = unknown> {
  id: string;
  icon: LucideIcon;
  label: string;
  description: string;
  technicalValue: T;
  badge?: string;
}

interface SmartConfigProps<T = unknown> {
  question: string;
  explanation?: string;
  options: ConfigOption<T>[];
  value: string;
  onChange: (id: string, technicalValue: T) => void;
  columns?: 2 | 3 | 4;
  showTechnical?: boolean;
  technicalLabel?: string;
  technicalSummary?: string;
  className?: string;
}

// ─── SmartConfig ─────────────────────────────────────────────────────────────

export function SmartConfig<T = unknown>({
  question,
  explanation,
  options,
  value,
  onChange,
  columns = 2,
  showTechnical = false,
  technicalLabel,
  technicalSummary,
  className,
}: SmartConfigProps<T>) {
  const [technicalOpen, setTechnicalOpen] = useState(false);

  const gridCols = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <h3 className="text-base font-semibold text-foreground">{question}</h3>
        {explanation && (
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-2xl">
            {explanation}
          </p>
        )}
      </div>

      <div className={cn("grid gap-3", gridCols[columns])}>
        {options.map((option) => {
          const isSelected = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id, option.technicalValue)}
              className={cn(
                "relative flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all",
                "hover:border-primary/40 hover:shadow-sm",
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-card"
              )}
            >
              {isSelected && (
                <div className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" />
                </div>
              )}
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                  isSelected
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <option.icon className="h-4.5 w-4.5" />
              </div>
              <div className="flex flex-col gap-1 min-w-0 pr-5">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isSelected ? "text-primary" : "text-foreground"
                    )}
                  >
                    {option.label}
                  </span>
                  {option.badge && (
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      {option.badge}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground leading-relaxed">
                  {option.description}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {showTechnical && technicalSummary && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setTechnicalOpen(!technicalOpen)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground/70 hover:text-muted-foreground transition-colors"
          >
            {technicalOpen ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            {technicalLabel || "Ver parametros tecnicos"}
          </button>
          {technicalOpen && (
            <div className="mt-2 rounded-lg bg-muted/50 border border-border/50 px-3 py-2">
              <code className="text-[11px] text-muted-foreground font-mono whitespace-pre-wrap">
                {technicalSummary}
              </code>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── SmartSlider ─────────────────────────────────────────────────────────────

interface SmartSliderProps {
  question: string;
  explanation?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
  formatExample?: (value: number) => string;
  labels?: { min: string; mid: string; max: string };
  className?: string;
}

export function SmartSlider({
  question,
  explanation,
  min,
  max,
  step,
  value,
  onChange,
  formatValue,
  formatExample,
  labels,
  className,
}: SmartSliderProps) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <h3 className="text-base font-semibold text-foreground">{question}</h3>
        {explanation && (
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-2xl">
            {explanation}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">
            {formatValue ? formatValue(value) : value}
          </span>
        </div>

        <div className="relative">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer bg-muted accent-primary
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:border-2
              [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
            style={{
              background: `linear-gradient(to right, hsl(var(--primary)) ${percentage}%, hsl(var(--muted)) ${percentage}%)`,
            }}
          />
        </div>

        {labels && (
          <div className="flex justify-between text-[11px] text-muted-foreground px-1">
            <span>{labels.min}</span>
            <span>{labels.mid}</span>
            <span>{labels.max}</span>
          </div>
        )}
      </div>

      {formatExample && (
        <div className="rounded-lg bg-muted/50 border border-border/50 px-3 py-2.5">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {formatExample(value)}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── SmartInput ──────────────────────────────────────────────────────────────

interface SmartInputProps {
  question: string;
  explanation?: string;
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  presets?: { label: string; value: number }[];
  formatHint?: (value: number) => string;
  className?: string;
}

export function SmartInput({
  question,
  explanation,
  value,
  onChange,
  prefix,
  suffix,
  presets,
  formatHint,
  className,
}: SmartInputProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <h3 className="text-base font-semibold text-foreground">{question}</h3>
        {explanation && (
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-2xl">
            {explanation}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {prefix && (
          <span className="text-sm font-medium text-muted-foreground">{prefix}</span>
        )}
        <input
          type="number"
          value={value || ""}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex h-10 w-full max-w-[200px] rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          placeholder="0"
        />
        {suffix && (
          <span className="text-sm font-medium text-muted-foreground">{suffix}</span>
        )}
      </div>

      {presets && presets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => onChange(preset.value)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                value === preset.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      {formatHint && value > 0 && (
        <p className="text-xs text-muted-foreground">{formatHint(value)}</p>
      )}
    </div>
  );
}
