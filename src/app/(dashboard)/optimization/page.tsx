"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { createClient } from "@/lib/supabase/client";
import { optimization, scenarios, type HistoricalOptInput, type BudgetOptInput, type PeriodCompareInput } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  TrendingUp,
  Loader2,
  Save,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Target,
  Info,
  Award,
  AlertTriangle,
  Zap,
  PieChartIcon,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
  PieChart,
  Pie,
  RadialBarChart,
  RadialBar,
} from "recharts";

const COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4",
];

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(1);
}

function KpiCard({ title, value, subtitle, icon: Icon, color = "" }: {
  title: string;
  value: string | React.ReactNode;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function InsightBanner({ type, children }: { type: "info" | "success" | "warning"; children: React.ReactNode }) {
  const styles = {
    info: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200",
    success: "bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200",
    warning: "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200",
  };
  const icons = { info: Info, success: Award, warning: AlertTriangle };
  const Icon = icons[type];
  return (
    <div className={`flex items-start gap-3 p-4 rounded-lg border ${styles[type]}`}>
      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}

function DeltaIndicator({ value, suffix = "%", positiveIsGood = true }: { value: number; suffix?: string; positiveIsGood?: boolean }) {
  const isPositive = value > 0;
  const isGood = positiveIsGood ? isPositive : !isPositive;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${isGood ? "text-green-600" : value === 0 ? "text-muted-foreground" : "text-red-500"}`}>
      {isPositive ? <ArrowUpRight className="h-3 w-3" /> : value < 0 ? <ArrowDownRight className="h-3 w-3" /> : null}
      {isPositive ? "+" : ""}{value.toFixed(1)}{suffix}
    </span>
  );
}

export default function OptimizationPage() {
  const searchParams = useSearchParams();
  const preselectedModel = searchParams.get("model") || "";
  const { currentOrgId } = useAuthStore();

  const [selectedProject, setSelectedProject] = useState("");
  const [selectedModel, setSelectedModel] = useState(preselectedModel);

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    // Reset dates so they get re-populated from new model
    setHStartDate("");
    setHEndDate("");
    setCP1Start("");
    setCP1End("");
    setCP2Start("");
    setCP2End("");
    setHistoricalResult(null);
    setBudgetResult(null);
    setCompareResult(null);
  };
  const [activeTab, setActiveTab] = useState("historical");

  // Historical form
  const [hStartDate, setHStartDate] = useState("");
  const [hEndDate, setHEndDate] = useState("");
  const [hBounds, setHBounds] = useState(0.3);

  // Budget form
  const [bTotalBudget, setBTotalBudget] = useState(100000);
  const [bNumWeeks, setBNumWeeks] = useState(4);
  const [bDefaultLimit, setBDefaultLimit] = useState(0.5);

  // Compare form
  const [cP1Start, setCP1Start] = useState("");
  const [cP1End, setCP1End] = useState("");
  const [cP2Start, setCP2Start] = useState("");
  const [cP2End, setCP2End] = useState("");

  // Results
  const [historicalResult, setHistoricalResult] = useState<Record<string, unknown> | null>(null);
  const [budgetResult, setBudgetResult] = useState<Record<string, unknown> | null>(null);
  const [compareResult, setCompareResult] = useState<Record<string, unknown> | null>(null);

  const { data: projectList } = useQuery({
    queryKey: ["projects", currentOrgId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("org_id", currentOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrgId,
  });

  const { data: modelList } = useQuery({
    queryKey: ["models", currentOrgId, selectedProject],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("models")
        .select("*")
        .eq("org_id", currentOrgId!)
        .eq("project_id", selectedProject)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrgId && !!selectedProject,
  });

  useEffect(() => {
    if (projectList?.length && !selectedProject) {
      setSelectedProject(projectList[0].id);
    }
  }, [projectList, selectedProject]);

  const readyModels = modelList?.filter((m) => m.status === "ready") || [];

  // When model changes, pre-fill dates from the model's training range
  const currentModel = readyModels.find((m) => m.id === selectedModel);
  const modelStartDate = currentModel?.start_date || "";
  const modelEndDate = currentModel?.end_date || "";

  // Auto-fill dates when model is selected and dates are empty
  useEffect(() => {
    if (currentModel && !hStartDate && modelStartDate) {
      setHStartDate(modelStartDate);
    }
    if (currentModel && !hEndDate && modelEndDate) {
      const endD = new Date(modelEndDate);
      const testWeeks = currentModel?.config?.test_weeks || 8;
      endD.setDate(endD.getDate() - testWeeks * 7);
      setHEndDate(endD.toISOString().split("T")[0]);
    }
  }, [currentModel, hStartDate, hEndDate, modelStartDate, modelEndDate]);

  const historicalMut = useMutation({
    mutationFn: () => {
      const input: HistoricalOptInput = {
        start_date: hStartDate,
        end_date: hEndDate,
        budget_bounds_pct: hBounds,
      };
      return optimization.historical(currentOrgId!, selectedModel, input);
    },
    onSuccess: (data) => {
      setHistoricalResult(data as unknown as Record<string, unknown>);
      toast.success("Historical optimization complete");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const budgetMut = useMutation({
    mutationFn: () => {
      const input: BudgetOptInput = {
        total_budget: bTotalBudget,
        num_weeks: bNumWeeks,
        default_limit: bDefaultLimit,
      };
      return optimization.budget(currentOrgId!, selectedModel, input);
    },
    onSuccess: (data) => {
      setBudgetResult(data as unknown as Record<string, unknown>);
      toast.success("Budget optimization complete");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const compareMut = useMutation({
    mutationFn: () => {
      const input: PeriodCompareInput = {
        period1_start: cP1Start,
        period1_end: cP1End,
        period2_start: cP2Start,
        period2_end: cP2End,
      };
      return optimization.compare(currentOrgId!, selectedModel, input);
    },
    onSuccess: (data) => {
      setCompareResult(data as unknown as Record<string, unknown>);
      toast.success("Period comparison complete");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveMut = useMutation({
    mutationFn: (params: { name: string; type: "historical" | "budget" | "comparison"; input_params: Record<string, unknown>; results: Record<string, unknown> }) =>
      scenarios.save(currentOrgId!, selectedModel, params),
    onSuccess: () => toast.success("Scenario saved"),
    onError: (err: Error) => toast.error(err.message),
  });

  function renderHistoricalResults() {
    if (!historicalResult) return null;
    const r = historicalResult as Record<string, Record<string, number> | number>;
    const original = r.original_spend as Record<string, number> || {};
    const optimized = r.optimized_spend as Record<string, number> || {};
    const multipliers = r.multipliers as Record<string, number> || {};
    const chartData = Object.keys(original).map((ch) => ({
      channel: ch.replace("spend_", ""),
      original: Math.round(original[ch]),
      optimized: Math.round(optimized[ch]),
      change: multipliers[ch] ? ((multipliers[ch] - 1) * 100) : 0,
    })).sort((a, b) => b.change - a.change);
    const uplift = r.uplift_pct as number;
    const origResp = r.original_response as number;
    const optResp = r.optimized_response as number;
    const totalOriginal = Object.values(original).reduce((s, v) => s + v, 0);
    const totalOptimized = Object.values(optimized).reduce((s, v) => s + v, 0);
    const increaseChannels = chartData.filter(c => c.change > 2);
    const decreaseChannels = chartData.filter(c => c.change < -2);
    const maintainChannels = chartData.filter(c => Math.abs(c.change) <= 2);

    // Pie data
    const origPie = chartData.map((c, i) => ({ name: c.channel, value: c.original, fill: COLORS[i % COLORS.length] }));
    const optPie = chartData.map((c, i) => ({ name: c.channel, value: c.optimized, fill: COLORS[i % COLORS.length] }));

    return (
      <div className="space-y-6 mt-6">
        {/* KPI cards - Enhanced */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard
            title="Revenue Uplift"
            value={<span className="flex items-center gap-1">{uplift > 0 ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}{Number(uplift).toFixed(1)}%</span>}
            icon={Zap}
            color={uplift > 0 ? "text-green-600" : "text-red-600"}
            subtitle="Same budget, smarter allocation"
          />
          <KpiCard
            title="Original Response"
            value={fmt(origResp || 0)}
            icon={Target}
            subtitle="Actual revenue achieved"
          />
          <KpiCard
            title="Optimized Response"
            value={fmt(optResp || 0)}
            icon={TrendingUp}
            color="text-green-600"
            subtitle={`+${fmt((optResp || 0) - (origResp || 0))} additional revenue`}
          />
          <KpiCard
            title="Total Budget"
            value={fmt(totalOriginal)}
            icon={DollarSign}
            subtitle="Budget held constant"
          />
          <KpiCard
            title="Channels Moved"
            value={`${increaseChannels.length}↑ ${decreaseChannels.length}↓`}
            icon={BarChart3}
            subtitle={`${maintainChannels.length} unchanged`}
          />
        </div>

        {/* Insight banners */}
        <div className="grid gap-3 sm:grid-cols-2">
          {increaseChannels.length > 0 && (
            <InsightBanner type="success">
              <strong>Increase budget for:</strong>{" "}
              {increaseChannels.map(c => `${c.channel} (+${c.change.toFixed(0)}%)`).join(", ")}
            </InsightBanner>
          )}
          {decreaseChannels.length > 0 && (
            <InsightBanner type="warning">
              <strong>Reduce budget for:</strong>{" "}
              {decreaseChannels.map(c => `${c.channel} (${c.change.toFixed(0)}%)`).join(", ")}
            </InsightBanner>
          )}
        </div>

        {/* Save button */}
        <div className="flex items-center justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              saveMut.mutate({
                name: `Historical ${hStartDate} to ${hEndDate}`,
                type: "historical",
                input_params: { start_date: hStartDate, end_date: hEndDate, budget_bounds_pct: hBounds },
                results: historicalResult,
              })
            }
          >
            <Save className="mr-2 h-4 w-4" />
            Save Scenario
          </Button>
        </div>

        {/* Bar Chart */}
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="channel" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
            <Tooltip formatter={(value) => [fmt(Number(value)), ""]} contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }} />
            <Legend />
            <Bar dataKey="original" fill="#94a3b8" name="Original" radius={[4, 4, 0, 0]} />
            <Bar dataKey="optimized" fill="#6366f1" name="Optimized" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>

        {/* Allocation Pies: Original vs Optimized */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Original Allocation</CardTitle>
              <CardDescription className="text-xs">How budget was actually distributed</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={origPie} cx="50%" cy="50%" outerRadius={100} innerRadius={40} dataKey="value" label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine>
                    {origPie.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip formatter={(value) => [fmt(Number(value)), ""]} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Optimized Allocation</CardTitle>
              <CardDescription className="text-xs">How the optimizer recommends distributing budget</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={optPie} cx="50%" cy="50%" outerRadius={100} innerRadius={40} dataKey="value" label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine>
                    {optPie.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip formatter={(value) => [fmt(Number(value)), ""]} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Change magnitude bars */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Budget Reallocation Magnitude</CardTitle>
            <CardDescription className="text-xs">How much each channel changes from original allocation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {chartData.map((row, i) => (
                <div key={row.channel} className="flex items-center gap-3">
                  <span className="text-xs font-medium w-20 truncate">{row.channel}</span>
                  <div className="flex-1 flex items-center">
                    <div className="relative w-full h-6 bg-muted rounded-full overflow-hidden">
                      {row.change >= 0 ? (
                        <div className="absolute left-1/2 top-0 h-full bg-green-500 rounded-r-full" style={{ width: `${Math.min(Math.abs(row.change), 50)}%` }} />
                      ) : (
                        <div className="absolute right-1/2 top-0 h-full bg-red-400 rounded-l-full" style={{ width: `${Math.min(Math.abs(row.change), 50)}%` }} />
                      )}
                      <div className="absolute left-1/2 top-0 h-full w-px bg-border" />
                    </div>
                  </div>
                  <DeltaIndicator value={row.change} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Detailed table */}
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Channel</TableHead>
                <TableHead className="text-right">Original</TableHead>
                <TableHead className="text-right">Optimized</TableHead>
                <TableHead className="text-right">Difference</TableHead>
                <TableHead className="text-right">Change</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chartData.map((row) => (
                <TableRow key={row.channel}>
                  <TableCell className="font-medium">{row.channel}</TableCell>
                  <TableCell className="text-right">{fmt(row.original)}</TableCell>
                  <TableCell className="text-right">{fmt(row.optimized)}</TableCell>
                  <TableCell className="text-right">{fmt(row.optimized - row.original)}</TableCell>
                  <TableCell className="text-right"><DeltaIndicator value={row.change} /></TableCell>
                  <TableCell className="text-right">
                    <Badge variant={row.change > 2 ? "outline" : row.change < -2 ? "secondary" : "default"}
                      className={row.change > 2 ? "border-green-300 text-green-700" : row.change < -2 ? "text-red-600" : ""}>
                      {row.change > 2 ? "Increase" : row.change < -2 ? "Decrease" : "Maintain"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold border-t-2">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{fmt(totalOriginal)}</TableCell>
                <TableCell className="text-right">{fmt(totalOptimized)}</TableCell>
                <TableCell className="text-right">{fmt(totalOptimized - totalOriginal)}</TableCell>
                <TableCell className="text-right">—</TableCell>
                <TableCell className="text-right">—</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  function renderBudgetResults() {
    if (!budgetResult) return null;
    const r = budgetResult as Record<string, unknown>;
    const baseline = r.baseline_per_week as Record<string, number> || {};
    const optimal = r.optimal_per_week as Record<string, number> || {};
    const optimalTotal = r.optimal_total as Record<string, number> || {};
    const changePct = r.change_pct as Record<string, number> || {};
    const expectedResp = r.expected_response as Record<string, number> | number;
    const expectedRoas = r.expected_roas as number;

    const respMean = typeof expectedResp === "object" ? (expectedResp as Record<string, number>).mean : (expectedResp as number);
    const respCi5 = typeof expectedResp === "object" ? (expectedResp as Record<string, number>).ci_5 : undefined;
    const respCi95 = typeof expectedResp === "object" ? (expectedResp as Record<string, number>).ci_95 : undefined;

    const channels = Object.keys(optimal);
    const totalBaseline = Object.values(baseline).reduce((s, v) => s + v, 0);
    const totalOptimal = Object.values(optimal).reduce((s, v) => s + v, 0);

    const chartData = channels.map((ch) => ({
      channel: ch.replace("spend_", ""),
      baseline: Math.round(baseline[ch] || 0),
      optimal: Math.round(optimal[ch]),
      change: changePct[ch] || 0,
      total: Math.round(optimalTotal[ch] || 0),
    })).sort((a, b) => b.optimal - a.optimal);

    const increaseChannels = chartData.filter(c => c.change > 5);
    const decreaseChannels = chartData.filter(c => c.change < -5);
    const allocPie = chartData.map((c, i) => ({ name: c.channel, value: c.optimal, fill: COLORS[i % COLORS.length] }));
    const topChannel = chartData[0];
    const topChannelPct = totalOptimal > 0 ? (topChannel.optimal / totalOptimal * 100) : 0;

    return (
      <div className="space-y-6 mt-6">
        {/* KPI cards - Enhanced */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard
            title="Expected Response"
            value={fmt(respMean || 0)}
            icon={Target}
            color="text-green-600"
            subtitle={respCi5 != null && respCi95 != null ? `CI: ${fmt(respCi5)} — ${fmt(respCi95)}` : `Over ${bNumWeeks} weeks`}
          />
          <KpiCard
            title="Expected ROAS"
            value={`${Number(expectedRoas || 0).toFixed(2)}x`}
            icon={TrendingUp}
            color={expectedRoas >= 1 ? "text-green-600" : "text-amber-600"}
            subtitle={expectedRoas >= 1 ? "Profitable allocation" : "Below breakeven"}
          />
          <KpiCard
            title="Weekly Budget"
            value={fmt(totalOptimal)}
            icon={DollarSign}
            subtitle={`${fmt(bTotalBudget)} total / ${bNumWeeks} weeks`}
          />
          <KpiCard
            title="Top Channel"
            value={`${topChannelPct.toFixed(0)}%`}
            icon={Award}
            subtitle={topChannel.channel}
          />
          <KpiCard
            title="Channels"
            value={`${channels.length}`}
            icon={PieChartIcon}
            subtitle={`${increaseChannels.length} up, ${decreaseChannels.length} down`}
          />
        </div>

        {/* Insight banners */}
        <div className="grid gap-3 sm:grid-cols-2">
          {expectedRoas >= 1 && (
            <InsightBanner type="success">
              <strong>Profitable allocation!</strong> Expected ROAS of {Number(expectedRoas).toFixed(2)}x means every dollar invested returns ${Number(expectedRoas).toFixed(2)}.
            </InsightBanner>
          )}
          {topChannelPct > 40 && (
            <InsightBanner type="info">
              <strong>{topChannel.channel}</strong> receives {topChannelPct.toFixed(0)}% of the budget — high concentration. The model sees this as the highest-return channel.
            </InsightBanner>
          )}
          {increaseChannels.length > 0 && (
            <InsightBanner type="success">
              <strong>Scale up:</strong> {increaseChannels.map(c => c.channel).join(", ")} — optimizer allocates more budget to these high-return channels.
            </InsightBanner>
          )}
          {decreaseChannels.length > 0 && (
            <InsightBanner type="warning">
              <strong>Scale down:</strong> {decreaseChannels.map(c => c.channel).join(", ")} — lower marginal returns suggest reducing investment.
            </InsightBanner>
          )}
        </div>

        {/* Save button */}
        <div className="flex items-center justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              saveMut.mutate({
                name: `Budget $${bTotalBudget.toLocaleString()} / ${bNumWeeks}w`,
                type: "budget",
                input_params: { total_budget: bTotalBudget, num_weeks: bNumWeeks },
                results: budgetResult,
              })
            }
          >
            <Save className="mr-2 h-4 w-4" />
            Save Scenario
          </Button>
        </div>

        {/* Charts: Bar + Pie */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Baseline vs Optimal Weekly Spend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="channel" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
                  <Tooltip formatter={(value) => [fmt(Number(value)), ""]} contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }} />
                  <Legend />
                  <Bar dataKey="baseline" fill="#94a3b8" name="Baseline/week" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="optimal" fill="#6366f1" name="Optimal/week" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Optimal Allocation Mix</CardTitle>
              <CardDescription className="text-xs">Weekly budget distribution</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={allocPie} cx="50%" cy="50%" outerRadius={95} innerRadius={35} dataKey="value" label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine>
                    {allocPie.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip formatter={(value) => [fmt(Number(value)), "per week"]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-2">
                {allocPie.map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: item.fill }} />
                      <span>{item.name}</span>
                    </div>
                    <span className="font-medium">{fmt(item.value)}/wk</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Change magnitude */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Budget Shift from Baseline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...chartData].sort((a, b) => b.change - a.change).map((row) => (
                <div key={row.channel} className="flex items-center gap-3">
                  <span className="text-xs font-medium w-20 truncate">{row.channel}</span>
                  <div className="flex-1 flex items-center">
                    <div className="relative w-full h-5 bg-muted rounded-full overflow-hidden">
                      {row.change >= 0 ? (
                        <div className="absolute left-1/2 top-0 h-full bg-green-500 rounded-r-full" style={{ width: `${Math.min(Math.abs(row.change) / 2, 50)}%` }} />
                      ) : (
                        <div className="absolute right-1/2 top-0 h-full bg-red-400 rounded-l-full" style={{ width: `${Math.min(Math.abs(row.change) / 2, 50)}%` }} />
                      )}
                      <div className="absolute left-1/2 top-0 h-full w-px bg-border" />
                    </div>
                  </div>
                  <DeltaIndicator value={row.change} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Allocation table */}
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Channel</TableHead>
                <TableHead className="text-right">Baseline/wk</TableHead>
                <TableHead className="text-right">Optimal/wk</TableHead>
                <TableHead className="text-right">Total ({bNumWeeks}wk)</TableHead>
                <TableHead className="text-right">Change</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chartData.map((row) => (
                <TableRow key={row.channel}>
                  <TableCell className="font-medium">{row.channel}</TableCell>
                  <TableCell className="text-right">{fmt(row.baseline)}</TableCell>
                  <TableCell className="text-right">{fmt(row.optimal)}</TableCell>
                  <TableCell className="text-right">{fmt(row.total)}</TableCell>
                  <TableCell className="text-right"><DeltaIndicator value={row.change} /></TableCell>
                  <TableCell className="text-right">
                    <Badge variant={row.change > 5 ? "outline" : row.change < -5 ? "secondary" : "default"}
                      className={row.change > 5 ? "border-green-300 text-green-700" : row.change < -5 ? "text-red-600" : ""}>
                      {row.change > 5 ? "Scale Up" : row.change < -5 ? "Scale Down" : "Maintain"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold border-t-2">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{fmt(totalBaseline)}</TableCell>
                <TableCell className="text-right">{fmt(totalOptimal)}</TableCell>
                <TableCell className="text-right">{fmt(totalOptimal * bNumWeeks)}</TableCell>
                <TableCell className="text-right">—</TableCell>
                <TableCell className="text-right">—</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Optimization</h1>
        <p className="text-muted-foreground mt-1">
          Optimize your marketing budget allocation using trained models
        </p>
      </div>

      {/* Model selector */}
      <div className="flex items-center gap-4">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Project</Label>
          <Select value={selectedProject} onValueChange={(v) => { setSelectedProject(v); setSelectedModel(""); }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {projectList?.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Model</Label>
          <Select value={selectedModel} onValueChange={handleModelChange} disabled={!readyModels.length}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder={readyModels.length ? "Select model" : "No ready models"} />
            </SelectTrigger>
            <SelectContent>
              {readyModels.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedModel ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <TrendingUp className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">Select a model</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Choose a trained model to run optimizations
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="historical">Historical Optimization</TabsTrigger>
            <TabsTrigger value="budget">Budget Calculator</TabsTrigger>
            <TabsTrigger value="compare">Period Comparison</TabsTrigger>
          </TabsList>

          {/* Historical */}
          <TabsContent value="historical" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Historical Budget Optimization
                </CardTitle>
                <CardDescription>
                  Optimize how you should have allocated spend in a past period
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input type="date" value={hStartDate} onChange={(e) => setHStartDate(e.target.value)} min={modelStartDate} max={modelEndDate} />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input type="date" value={hEndDate} onChange={(e) => setHEndDate(e.target.value)} min={modelStartDate} max={modelEndDate} />
                  </div>
                  <div className="space-y-2">
                    <Label>Budget Bounds (%)</Label>
                    <Input type="number" step="0.05" min="0" max="1" value={hBounds} onChange={(e) => setHBounds(Number(e.target.value))} />
                  </div>
                </div>
                {modelStartDate && (
                  <p className="text-xs text-muted-foreground">
                    Training data range: {modelStartDate} to {modelEndDate}
                  </p>
                )}
                <Button
                  onClick={() => historicalMut.mutate()}
                  disabled={historicalMut.isPending || !hStartDate || !hEndDate}
                >
                  {historicalMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Run Optimization
                </Button>
                {renderHistoricalResults()}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Budget */}
          <TabsContent value="budget" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Budget Calculator
                </CardTitle>
                <CardDescription>
                  Allocate a future budget optimally across channels
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Total Budget</Label>
                    <Input type="number" min="1000" step="1000" value={bTotalBudget} onChange={(e) => setBTotalBudget(Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Number of Weeks</Label>
                    <Input type="number" min="1" max="52" value={bNumWeeks} onChange={(e) => setBNumWeeks(Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Default Limit (%)</Label>
                    <Input type="number" step="0.05" min="0" max="1" value={bDefaultLimit} onChange={(e) => setBDefaultLimit(Number(e.target.value))} />
                  </div>
                </div>
                <Button
                  onClick={() => budgetMut.mutate()}
                  disabled={budgetMut.isPending}
                >
                  {budgetMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Calculate Optimal Allocation
                </Button>
                {renderBudgetResults()}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Compare */}
          <TabsContent value="compare" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Period Comparison</CardTitle>
                <CardDescription>
                  Compare marketing performance between two time periods
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Period 1</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Start</Label>
                        <Input type="date" value={cP1Start} onChange={(e) => setCP1Start(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">End</Label>
                        <Input type="date" value={cP1End} onChange={(e) => setCP1End(e.target.value)} />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Period 2</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Start</Label>
                        <Input type="date" value={cP2Start} onChange={(e) => setCP2Start(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">End</Label>
                        <Input type="date" value={cP2End} onChange={(e) => setCP2End(e.target.value)} />
                      </div>
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() => compareMut.mutate()}
                  disabled={compareMut.isPending || !cP1Start || !cP1End || !cP2Start || !cP2End}
                >
                  {compareMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Compare Periods
                </Button>
                {compareResult && (() => {
                  const cr = compareResult as Record<string, unknown>;
                  const p1 = cr.period1 as Record<string, unknown> || {};
                  const p2 = cr.period2 as Record<string, unknown> || {};
                  const comparison = cr.comparison as Record<string, unknown> || {};
                  // Try structured response first, fall back to flat keys
                  const p1Spend = (p1.spend_by_channel || cr.period1_spend) as Record<string, number> || {};
                  const p2Spend = (p2.spend_by_channel || cr.period2_spend) as Record<string, number> || {};
                  const p1Resp = (p1.total_response || cr.period1_response) as number || 0;
                  const p2Resp = (p2.total_response || cr.period2_response) as number || 0;
                  const channels = Object.keys(p1Spend);
                  const compChartData = channels.map((ch) => ({
                    channel: ch.replace("spend_", ""),
                    period1: Math.round(p1Spend[ch] || 0),
                    period2: Math.round(p2Spend[ch] || 0),
                  }));
                  const totalP1 = Object.values(p1Spend).reduce((s, v) => s + v, 0);
                  const totalP2 = Object.values(p2Spend).reduce((s, v) => s + v, 0);
                  const spendChange = totalP1 > 0 ? ((totalP2 - totalP1) / totalP1 * 100) : 0;
                  const respChange = p1Resp > 0 ? ((p2Resp - p1Resp) / p1Resp * 100) : 0;
                  const p1Roas = totalP1 > 0 ? p1Resp / totalP1 : 0;
                  const p2Roas = totalP2 > 0 ? p2Resp / totalP2 : 0;
                  const roasChange = p1Roas > 0 ? ((p2Roas - p1Roas) / p1Roas * 100) : 0;
                  // Find biggest movers
                  const channelChanges = compChartData.map(c => {
                    const diff = c.period2 - c.period1;
                    const pct = c.period1 > 0 ? (diff / c.period1 * 100) : 0;
                    return { ...c, diff, pct };
                  }).sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
                  const biggestIncrease = channelChanges.find(c => c.pct > 0);
                  const biggestDecrease = channelChanges.find(c => c.pct < 0);

                  return (
                    <div className="space-y-6 mt-6">
                      {/* Enhanced KPI cards */}
                      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                        <KpiCard title="P1 Spend" value={fmt(totalP1)} icon={DollarSign} subtitle={`${cP1Start} — ${cP1End}`} />
                        <KpiCard title="P2 Spend" value={fmt(totalP2)} icon={DollarSign} subtitle={`${cP2Start} — ${cP2End}`} />
                        <KpiCard
                          title="Spend Change"
                          value={<span className="flex items-center gap-1">{spendChange > 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}{Math.abs(spendChange).toFixed(1)}%</span>}
                          icon={BarChart3}
                          color={spendChange > 0 ? "text-amber-600" : "text-green-600"}
                        />
                        <KpiCard
                          title="Response Change"
                          value={<span className="flex items-center gap-1">{respChange > 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}{Math.abs(respChange).toFixed(1)}%</span>}
                          icon={Target}
                          color={respChange > 0 ? "text-green-600" : "text-red-500"}
                        />
                        <KpiCard title="P1 ROAS" value={`${p1Roas.toFixed(2)}x`} icon={TrendingUp} />
                        <KpiCard
                          title="P2 ROAS"
                          value={`${p2Roas.toFixed(2)}x`}
                          icon={TrendingUp}
                          color={p2Roas > p1Roas ? "text-green-600" : "text-red-500"}
                          subtitle={`${roasChange > 0 ? "+" : ""}${roasChange.toFixed(1)}% vs P1`}
                        />
                      </div>

                      {/* Insight banners */}
                      <div className="grid gap-3 sm:grid-cols-2">
                        {respChange > 0 && spendChange <= respChange && (
                          <InsightBanner type="success">
                            <strong>Efficiency improved!</strong> Response grew {respChange.toFixed(1)}% while spend {spendChange > 0 ? `only grew ${spendChange.toFixed(1)}%` : `decreased ${Math.abs(spendChange).toFixed(1)}%`}.
                          </InsightBanner>
                        )}
                        {respChange < 0 && spendChange > 0 && (
                          <InsightBanner type="warning">
                            <strong>Efficiency declined.</strong> Spend increased {spendChange.toFixed(1)}% but response dropped {Math.abs(respChange).toFixed(1)}%. Review channel allocation.
                          </InsightBanner>
                        )}
                        {biggestIncrease && (
                          <InsightBanner type="info">
                            <strong>Biggest increase:</strong> {biggestIncrease.channel} grew {biggestIncrease.pct.toFixed(0)}% ({fmt(biggestIncrease.diff)} more spend).
                          </InsightBanner>
                        )}
                        {biggestDecrease && (
                          <InsightBanner type="info">
                            <strong>Biggest decrease:</strong> {biggestDecrease.channel} fell {Math.abs(biggestDecrease.pct).toFixed(0)}% ({fmt(Math.abs(biggestDecrease.diff))} less spend).
                          </InsightBanner>
                        )}
                      </div>

                      <div className="flex items-center justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            saveMut.mutate({
                              name: `Compare ${cP1Start} vs ${cP2Start}`,
                              type: "comparison",
                              input_params: { period1_start: cP1Start, period1_end: cP1End, period2_start: cP2Start, period2_end: cP2End },
                              results: compareResult,
                            })
                          }
                        >
                          <Save className="mr-2 h-4 w-4" />
                          Save Scenario
                        </Button>
                      </div>

                      {compChartData.length > 0 && (
                        <ResponsiveContainer width="100%" height={350}>
                          <BarChart data={compChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="channel" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
                            <Tooltip formatter={(value) => [fmt(Number(value)), ""]} contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }} />
                            <Legend />
                            <Bar dataKey="period1" fill="#94a3b8" name={`P1 (${cP1Start})`} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="period2" fill="#6366f1" name={`P2 (${cP2Start})`} radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}

                      {/* Per-channel change bars */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Channel Spend Changes: P1 vs P2</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {channelChanges.map((row) => (
                              <div key={row.channel} className="flex items-center gap-3">
                                <span className="text-xs font-medium w-20 truncate">{row.channel}</span>
                                <div className="flex-1 flex items-center">
                                  <div className="relative w-full h-5 bg-muted rounded-full overflow-hidden">
                                    {row.pct >= 0 ? (
                                      <div className="absolute left-1/2 top-0 h-full bg-indigo-500 rounded-r-full" style={{ width: `${Math.min(Math.abs(row.pct) / 2, 50)}%` }} />
                                    ) : (
                                      <div className="absolute right-1/2 top-0 h-full bg-slate-400 rounded-l-full" style={{ width: `${Math.min(Math.abs(row.pct) / 2, 50)}%` }} />
                                    )}
                                    <div className="absolute left-1/2 top-0 h-full w-px bg-border" />
                                  </div>
                                </div>
                                <DeltaIndicator value={row.pct} />
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      <div className="rounded-md border overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Channel</TableHead>
                              <TableHead className="text-right">Period 1</TableHead>
                              <TableHead className="text-right">Period 2</TableHead>
                              <TableHead className="text-right">Difference</TableHead>
                              <TableHead className="text-right">Change</TableHead>
                              <TableHead className="text-right">Direction</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {channelChanges.map((row) => (
                              <TableRow key={row.channel}>
                                <TableCell className="font-medium">{row.channel}</TableCell>
                                <TableCell className="text-right">{fmt(row.period1)}</TableCell>
                                <TableCell className="text-right">{fmt(row.period2)}</TableCell>
                                <TableCell className="text-right">{fmt(row.diff)}</TableCell>
                                <TableCell className="text-right"><DeltaIndicator value={row.pct} /></TableCell>
                                <TableCell className="text-right">
                                  <Badge variant={row.pct > 5 ? "outline" : row.pct < -5 ? "secondary" : "default"}
                                    className={row.pct > 5 ? "border-indigo-300 text-indigo-700" : row.pct < -5 ? "text-slate-600" : ""}>
                                    {row.pct > 5 ? "Increased" : row.pct < -5 ? "Decreased" : "Stable"}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="font-bold border-t-2">
                              <TableCell>Total</TableCell>
                              <TableCell className="text-right">{fmt(totalP1)}</TableCell>
                              <TableCell className="text-right">{fmt(totalP2)}</TableCell>
                              <TableCell className="text-right">{fmt(totalP2 - totalP1)}</TableCell>
                              <TableCell className="text-right"><DeltaIndicator value={spendChange} /></TableCell>
                              <TableCell className="text-right">—</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
