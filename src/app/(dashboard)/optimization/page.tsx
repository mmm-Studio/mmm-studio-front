"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { createClient } from "@/lib/supabase/client";
import { optimization, scenarios, type HistoricalOptInput, type BudgetOptInput, type PeriodCompareInput } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "recharts";

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(1);
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

  if (projectList?.length && !selectedProject) {
    setSelectedProject(projectList[0].id);
  }

  const readyModels = modelList?.filter((m) => m.status === "ready") || [];

  // When model changes, pre-fill dates from the model's training range
  const currentModel = readyModels.find((m) => m.id === selectedModel);
  const modelStartDate = currentModel?.start_date || "";
  const modelEndDate = currentModel?.end_date || "";

  // Auto-fill dates when model is selected and dates are empty
  if (currentModel && !hStartDate && modelStartDate) {
    setHStartDate(modelStartDate);
  }
  if (currentModel && !hEndDate && modelEndDate) {
    // Use a date ~2 months before end as default end for historical opt
    const endD = new Date(modelEndDate);
    const testWeeks = currentModel?.config?.test_weeks || 8;
    endD.setDate(endD.getDate() - testWeeks * 7);
    setHEndDate(endD.toISOString().split("T")[0]);
  }

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

    return (
      <div className="space-y-6 mt-6">
        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Uplift</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold flex items-center gap-1 ${uplift > 0 ? "text-green-600" : "text-red-600"}`}>
                {uplift > 0 ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                {Number(uplift).toFixed(1)}%
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Original Response</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fmt(origResp || 0)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Optimized Response</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{fmt(optResp || 0)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Total Budget</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fmt(totalOriginal)}</div>
              <p className="text-xs text-muted-foreground">Same budget, better allocation</p>
            </CardContent>
          </Card>
        </div>

        {/* Chart + save */}
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

        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="channel" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
            <Tooltip formatter={(value: number) => [fmt(value), ""]} contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }} />
            <Legend />
            <Bar dataKey="original" fill="#94a3b8" name="Original" radius={[4, 4, 0, 0]} />
            <Bar dataKey="optimized" fill="#6366f1" name="Optimized" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>

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
              </TableRow>
            </TableHeader>
            <TableBody>
              {chartData.map((row) => (
                <TableRow key={row.channel}>
                  <TableCell className="font-medium">{row.channel}</TableCell>
                  <TableCell className="text-right">{fmt(row.original)}</TableCell>
                  <TableCell className="text-right">{fmt(row.optimized)}</TableCell>
                  <TableCell className="text-right">{fmt(row.optimized - row.original)}</TableCell>
                  <TableCell className="text-right">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${row.change > 0 ? "text-green-600" : row.change < 0 ? "text-red-600" : "text-muted-foreground"}`}>
                      {row.change > 0 ? <ArrowUpRight className="h-3 w-3" /> : row.change < 0 ? <ArrowDownRight className="h-3 w-3" /> : null}
                      {row.change > 0 ? "+" : ""}{row.change.toFixed(1)}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold border-t-2">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{fmt(totalOriginal)}</TableCell>
                <TableCell className="text-right">{fmt(totalOptimized)}</TableCell>
                <TableCell className="text-right">{fmt(totalOptimized - totalOriginal)}</TableCell>
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
    })).sort((a, b) => b.change - a.change);

    return (
      <div className="space-y-6 mt-6">
        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Expected Response</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{fmt(respMean || 0)}</div>
              {respCi5 != null && respCi95 != null && (
                <p className="text-xs text-muted-foreground">CI: {fmt(respCi5)} — {fmt(respCi95)}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Expected ROAS</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Number(expectedRoas || 0).toFixed(2)}x</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Weekly Budget</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fmt(totalOptimal)}</div>
              <p className="text-xs text-muted-foreground">per week</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Channels</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{channels.length}</div>
            </CardContent>
          </Card>
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

        {/* Chart */}
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="channel" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
            <Tooltip formatter={(value: number) => [fmt(value), ""]} contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }} />
            <Legend />
            <Bar dataKey="baseline" fill="#94a3b8" name="Baseline/week" radius={[4, 4, 0, 0]} />
            <Bar dataKey="optimal" fill="#6366f1" name="Optimal/week" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>

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
                <TableHead className="text-right">Direction</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chartData.map((row) => (
                <TableRow key={row.channel}>
                  <TableCell className="font-medium">{row.channel}</TableCell>
                  <TableCell className="text-right">{fmt(row.baseline)}</TableCell>
                  <TableCell className="text-right">{fmt(row.optimal)}</TableCell>
                  <TableCell className="text-right">{fmt(row.total)}</TableCell>
                  <TableCell className="text-right">
                    <span className={`text-xs font-medium ${row.change > 0 ? "text-green-600" : row.change < 0 ? "text-red-600" : "text-muted-foreground"}`}>
                      {row.change > 0 ? "+" : ""}{row.change.toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={`inline-flex items-center gap-1 text-xs ${row.change > 5 ? "text-green-600" : row.change < -5 ? "text-red-600" : "text-muted-foreground"}`}>
                      {row.change > 5 ? <><ArrowUpRight className="h-3 w-3" />Increase</> : row.change < -5 ? <><ArrowDownRight className="h-3 w-3" />Decrease</> : "Maintain"}
                    </span>
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
                  const p1Spend = cr.period1_spend as Record<string, number> || {};
                  const p2Spend = cr.period2_spend as Record<string, number> || {};
                  const p1Resp = cr.period1_response as number;
                  const p2Resp = cr.period2_response as number;
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

                  return (
                    <div className="space-y-6 mt-6">
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground">P1 Total Spend</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">{fmt(totalP1)}</div>
                            <p className="text-xs text-muted-foreground">{cP1Start} — {cP1End}</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground">P2 Total Spend</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">{fmt(totalP2)}</div>
                            <p className="text-xs text-muted-foreground">{cP2Start} — {cP2End}</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground">Spend Change</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className={`text-2xl font-bold flex items-center gap-1 ${spendChange > 0 ? "text-amber-600" : "text-green-600"}`}>
                              {spendChange > 0 ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                              {spendChange > 0 ? "+" : ""}{spendChange.toFixed(1)}%
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground">Response Change</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className={`text-2xl font-bold flex items-center gap-1 ${respChange > 0 ? "text-green-600" : "text-red-600"}`}>
                              {respChange > 0 ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                              {respChange > 0 ? "+" : ""}{respChange.toFixed(1)}%
                            </div>
                          </CardContent>
                        </Card>
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
                            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => fmt(v)} />
                            <Tooltip formatter={(value: number) => [fmt(value), ""]} contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }} />
                            <Legend />
                            <Bar dataKey="period1" fill="#94a3b8" name={`P1 (${cP1Start})`} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="period2" fill="#6366f1" name={`P2 (${cP2Start})`} radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}

                      <div className="rounded-md border overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Channel</TableHead>
                              <TableHead className="text-right">Period 1</TableHead>
                              <TableHead className="text-right">Period 2</TableHead>
                              <TableHead className="text-right">Difference</TableHead>
                              <TableHead className="text-right">Change</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {compChartData.map((row) => {
                              const diff = row.period2 - row.period1;
                              const pctChange = row.period1 > 0 ? (diff / row.period1 * 100) : 0;
                              return (
                                <TableRow key={row.channel}>
                                  <TableCell className="font-medium">{row.channel}</TableCell>
                                  <TableCell className="text-right">{fmt(row.period1)}</TableCell>
                                  <TableCell className="text-right">{fmt(row.period2)}</TableCell>
                                  <TableCell className="text-right">{fmt(diff)}</TableCell>
                                  <TableCell className="text-right">
                                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${pctChange > 0 ? "text-green-600" : pctChange < 0 ? "text-red-600" : "text-muted-foreground"}`}>
                                      {pctChange > 0 ? "+" : ""}{pctChange.toFixed(1)}%
                                    </span>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
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
