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
} from "recharts";

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
    const chartData = Object.keys(original).map((ch) => ({
      channel: ch.replace("spend_", ""),
      original: Math.round(original[ch]),
      optimized: Math.round(optimized[ch]),
    }));
    const uplift = r.uplift_pct as number;

    return (
      <div className="space-y-4 mt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Card className="p-3">
              <div className="text-xs text-muted-foreground">Uplift</div>
              <div className={`text-xl font-bold flex items-center gap-1 ${uplift > 0 ? "text-green-600" : "text-red-600"}`}>
                {uplift > 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                {Number(uplift).toFixed(1)}%
              </div>
            </Card>
          </div>
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
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="original" fill="#94a3b8" name="Original" />
            <Bar dataKey="optimized" fill="#6366f1" name="Optimized" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  function renderBudgetResults() {
    if (!budgetResult) return null;
    const r = budgetResult as Record<string, Record<string, number> | number>;
    const baseline = r.baseline_per_week as Record<string, number> || {};
    const optimal = r.optimal_per_week as Record<string, number> || {};
    const chartData = Object.keys(optimal).map((ch) => ({
      channel: ch.replace("spend_", ""),
      baseline: Math.round(baseline[ch] || 0),
      optimal: Math.round(optimal[ch]),
    }));

    return (
      <div className="space-y-4 mt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Card className="p-3">
              <div className="text-xs text-muted-foreground">Expected Response</div>
              <div className="text-xl font-bold text-green-600">
                {Number(r.expected_response).toLocaleString()}
              </div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground">Expected ROAS</div>
              <div className="text-xl font-bold">
                {Number(r.expected_roas).toFixed(2)}
              </div>
            </Card>
          </div>
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
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="channel" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="baseline" fill="#94a3b8" name="Baseline/week" />
            <Bar dataKey="optimal" fill="#6366f1" name="Optimal/week" />
          </BarChart>
        </ResponsiveContainer>
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
                {compareResult && (
                  <div className="mt-4 rounded-lg border p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">Comparison Results</h4>
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
                        Save
                      </Button>
                    </div>
                    <pre className="text-xs overflow-auto max-h-64 bg-muted p-3 rounded">
                      {JSON.stringify(compareResult, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
