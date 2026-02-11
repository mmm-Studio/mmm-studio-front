"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { createClient } from "@/lib/supabase/client";
import { analysis } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import {
  BarChart3,
  Calendar,
  HardDrive,
  TrendingUp,
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Target,
  Zap,
  Info,
  Award,
  AlertTriangle,
  TrendingDown,
  Layers,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  ZAxis,
  ReferenceLine,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
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

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function KpiCard({ title, value, subtitle, icon: Icon, trend, trendLabel, className = "" }: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        {trendLabel && (
          <p className={`text-xs mt-1 flex items-center gap-1 ${trend === "up" ? "text-green-600" : trend === "down" ? "text-red-500" : "text-muted-foreground"}`}>
            {trend === "up" ? <ArrowUpRight className="h-3 w-3" /> : trend === "down" ? <ArrowDownRight className="h-3 w-3" /> : null}
            {trendLabel}
          </p>
        )}
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

export default function ModelDetailPage() {
  const params = useParams();
  const modelId = params.modelId as string;
  const { currentOrgId } = useAuthStore();

  const { data: model, isLoading: modelLoading } = useQuery({
    queryKey: ["model", currentOrgId, modelId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("models")
        .select("*, datasets(name, file_path)")
        .eq("id", modelId)
        .eq("org_id", currentOrgId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId && !!modelId,
  });

  const isReady = model?.status === "ready";

  const { data: roasData, isLoading: roasLoading, error: roasError } = useQuery({
    queryKey: ["roas", currentOrgId, modelId],
    queryFn: () => analysis.roas(currentOrgId!, modelId),
    enabled: !!currentOrgId && !!modelId && isReady,
    retry: 1,
  });

  const { data: contribData, isLoading: contribLoading, error: contribError } = useQuery({
    queryKey: ["contributions", currentOrgId, modelId],
    queryFn: () => analysis.contributions(currentOrgId!, modelId),
    enabled: !!currentOrgId && !!modelId && isReady,
    retry: 1,
  });

  const { data: efficiencyData, isLoading: effLoading, error: effError } = useQuery({
    queryKey: ["spend-vs-contrib", currentOrgId, modelId],
    queryFn: () => analysis.spendVsContribution(currentOrgId!, modelId),
    enabled: !!currentOrgId && !!modelId && isReady,
    retry: 1,
  });

  const { data: tsData, isLoading: tsLoading, error: tsError } = useQuery({
    queryKey: ["contrib-ts", currentOrgId, modelId],
    queryFn: () => analysis.contributionsTimeseries(currentOrgId!, modelId),
    enabled: !!currentOrgId && !!modelId && isReady,
    retry: 1,
  });

  const analysisError = roasError || contribError || effError || tsError;

  // Derived insights
  const insights = useMemo(() => {
    if (!efficiencyData || !roasData || !contribData) return null;
    const channels = efficiencyData.channels;
    const totalSpend = channels.reduce((s, c) => s + c.total_spend, 0);
    const totalContrib = channels.reduce((s, c) => s + c.total_contribution, 0);
    const avgRoas = totalSpend > 0 ? totalContrib / totalSpend : 0;
    const bestChannel = [...channels].sort((a, b) => b.roas - a.roas)[0];
    const worstChannel = [...channels].sort((a, b) => a.roas - b.roas)[0];
    const topContributor = [...channels].sort((a, b) => b.total_contribution - a.total_contribution)[0];
    const mostSpent = [...channels].sort((a, b) => b.total_spend - a.total_spend)[0];
    const overPerformers = channels.filter(c => c.contribution_share > c.spend_share);
    const underPerformers = channels.filter(c => c.contribution_share < c.spend_share);
    const efficiencyGap = channels.map(c => Math.abs(c.contribution_share - c.spend_share));
    const avgGap = efficiencyGap.reduce((s, v) => s + v, 0) / efficiencyGap.length;
    // Concentration: top 3 channels contribution share
    const sortedByContrib = [...channels].sort((a, b) => b.contribution_share - a.contribution_share);
    const top3ContribShare = sortedByContrib.slice(0, 3).reduce((s, c) => s + c.contribution_share, 0);

    return {
      totalSpend, totalContrib, avgRoas,
      bestChannel, worstChannel, topContributor, mostSpent,
      overPerformers, underPerformers, avgGap, top3ContribShare,
      channelCount: channels.length,
    };
  }, [efficiencyData, roasData, contribData]);

  const roasChartData = roasData
    ? Object.entries(roasData.roas_by_channel)
        .map(([channel, value]) => ({
          channel: channel.replace("spend_", ""),
          roas: Number(Number(value).toFixed(2)),
        }))
        .sort((a, b) => b.roas - a.roas)
    : [];

  const contribChartData = contribData
    ? Object.entries(contribData.contribution_percentage)
        .map(([channel, pct]) => ({
          name: channel.replace("spend_", ""),
          value: Number(Number(pct).toFixed(1)),
        }))
        .sort((a, b) => b.value - a.value)
    : [];

  // Build time series chart data
  const tsChartData = tsData
    ? tsData.dates.map((date, i) => {
        const point: Record<string, string | number> = { date: date.slice(5) };
        tsData.channels.forEach((ch) => {
          point[ch.replace("spend_", "")] = tsData.series[ch][i];
        });
        if (tsData.target.length > i) point["Sales"] = tsData.target[i];
        return point;
      })
    : [];

  // Scatter data for efficiency quadrant
  const scatterData = efficiencyData
    ? efficiencyData.channels.map((ch, i) => ({
        ...ch,
        color: COLORS[i % COLORS.length],
      }))
    : [];

  // Radar data for channel performance
  const radarData = efficiencyData
    ? efficiencyData.channels.map((ch) => ({
        channel: ch.label,
        "Spend Share": ch.spend_share,
        "Contribution Share": ch.contribution_share,
        "ROAS (scaled)": Math.min(ch.roas * 20, 100),
      }))
    : [];

  if (modelLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!model) {
    return <p className="text-muted-foreground">Model not found.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/models"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{model.name}</h1>
            <Badge
              variant={isReady ? "outline" : "secondary"}
              className={isReady ? "border-green-200 text-green-700" : ""}
            >
              {model.status}
            </Badge>
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
            {model.start_date && model.end_date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {model.start_date} — {model.end_date}
              </span>
            )}
            {model.file_size_mb && (
              <span className="flex items-center gap-1">
                <HardDrive className="h-3.5 w-3.5" />
                {model.file_size_mb.toFixed(1)}MB
              </span>
            )}
            {model.config && (
              <span className="flex items-center gap-1">
                <Layers className="h-3.5 w-3.5" />
                {String((model.config as Record<string, unknown>).draws ?? "?")} draws / {String((model.config as Record<string, unknown>).chains ?? "?")} chains
              </span>
            )}
          </div>
        </div>
        <Button asChild>
          <Link href={`/optimization?model=${modelId}`}>
            <TrendingUp className="mr-2 h-4 w-4" />
            Optimize
          </Link>
        </Button>
      </div>

      {/* Channels */}
      {model.spend_columns && (
        <div className="flex flex-wrap gap-1.5">
          {model.spend_columns.map((col: string) => (
            <Badge key={col} variant="secondary">
              {col.replace("spend_", "")}
            </Badge>
          ))}
        </div>
      )}

      {/* Analysis Error Banner */}
      {isReady && analysisError && (
        <div className="flex items-start gap-3 p-4 rounded-lg border bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="text-sm">
            <strong>Error loading analysis data:</strong>{" "}
            {analysisError instanceof Error ? analysisError.message : "Unknown error. Check backend logs."}
          </div>
        </div>
      )}

      {/* Summary KPI cards - Enhanced */}
      {isReady && insights && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <KpiCard
              title="Total Spend"
              value={fmt(insights.totalSpend)}
              icon={DollarSign}
              subtitle={`Across ${insights.channelCount} channels`}
            />
            <KpiCard
              title="Total Contribution"
              value={fmt(insights.totalContrib)}
              icon={Target}
              subtitle="Media-driven sales"
            />
            <KpiCard
              title="Average ROAS"
              value={`${insights.avgRoas.toFixed(2)}x`}
              icon={TrendingUp}
              trend={insights.avgRoas >= 1 ? "up" : "down"}
              trendLabel={insights.avgRoas >= 1 ? "Profitable" : "Below breakeven"}
            />
            <KpiCard
              title="Best Channel"
              value={`${insights.bestChannel.roas.toFixed(2)}x`}
              icon={Award}
              subtitle={insights.bestChannel.label}
              trend="up"
              trendLabel="Highest ROAS"
            />
            <KpiCard
              title="Top 3 Concentration"
              value={`${insights.top3ContribShare.toFixed(0)}%`}
              icon={Zap}
              trend={insights.top3ContribShare > 80 ? "down" : "up"}
              trendLabel={insights.top3ContribShare > 80 ? "Highly concentrated" : "Well diversified"}
            />
          </div>

          {/* Auto-generated insights */}
          <div className="grid gap-3 sm:grid-cols-2">
            {insights.overPerformers.length > 0 && (
              <InsightBanner type="success">
                <strong>Over-performing channels:</strong>{" "}
                {insights.overPerformers.map(c => c.label).join(", ")} — these channels generate more contribution than their spend share. Consider increasing investment.
              </InsightBanner>
            )}
            {insights.underPerformers.length > 0 && (
              <InsightBanner type="warning">
                <strong>Under-performing channels:</strong>{" "}
                {insights.underPerformers.map(c => c.label).join(", ")} — these channels consume more budget relative to their contribution. Evaluate for possible reallocation.
              </InsightBanner>
            )}
            {insights.avgGap > 5 && (
              <InsightBanner type="info">
                <strong>Budget misallocation detected.</strong> Average efficiency gap is {insights.avgGap.toFixed(1)}pp. Running the optimizer could reallocate spend for a significant uplift.
              </InsightBanner>
            )}
            {insights.worstChannel.roas < 0.5 && (
              <InsightBanner type="warning">
                <strong>{insights.worstChannel.label}</strong> has a ROAS of only {insights.worstChannel.roas.toFixed(2)}x — each dollar returns less than $0.50. Consider testing spend reduction.
              </InsightBanner>
            )}
          </div>
        </>
      )}

      {/* Analysis Tabs */}
      {isReady && (
        <Tabs defaultValue="efficiency">
          <TabsList className="flex-wrap">
            <TabsTrigger value="efficiency">Channel Efficiency</TabsTrigger>
            <TabsTrigger value="roas">ROAS Analysis</TabsTrigger>
            <TabsTrigger value="contributions">Contributions</TabsTrigger>
            <TabsTrigger value="timeseries">Over Time</TabsTrigger>
            <TabsTrigger value="quadrant">Efficiency Map</TabsTrigger>
          </TabsList>

          {/* Efficiency Tab - Spend vs Contribution table + chart */}
          <TabsContent value="efficiency" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Spend vs Contribution by Channel</CardTitle>
                <CardDescription>
                  Compare how much each channel spends vs how much it contributes to sales.
                  Green bars indicate over-performers; channels where contribution share exceeds spend share.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {effLoading ? (
                  <Skeleton className="h-80 w-full" />
                ) : !efficiencyData ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No data available</p>
                ) : (
                  <div className="space-y-6">
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={[...efficiencyData.channels].sort((a, b) => b.roas - a.roas)} margin={{ left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
                        <Tooltip
                          formatter={(value) => [fmt(Number(value)), ""]}
                          contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }}
                        />
                        <Legend />
                        <Bar dataKey="total_spend" fill="#94a3b8" name="Spend" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="total_contribution" fill="#6366f1" name="Contribution" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>

                    {/* Spend Share vs Contribution Share comparison */}
                    <Card className="bg-muted/30">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Spend Share vs Contribution Share</CardTitle>
                        <CardDescription className="text-xs">Bars extending right mean the channel over-indexes on that metric</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {[...efficiencyData.channels].sort((a, b) => (b.contribution_share - b.spend_share) - (a.contribution_share - a.spend_share)).map((ch, i) => {
                            const delta = ch.contribution_share - ch.spend_share;
                            return (
                              <div key={ch.channel} className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-medium">{ch.label}</span>
                                  <span className={delta > 0 ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>
                                    {delta > 0 ? "+" : ""}{delta.toFixed(1)}pp
                                  </span>
                                </div>
                                <div className="flex gap-1 h-4">
                                  <div className="relative flex-1 bg-slate-200 dark:bg-slate-700 rounded-sm overflow-hidden">
                                    <div className="absolute inset-y-0 left-0 bg-slate-400 rounded-sm" style={{ width: `${ch.spend_share}%` }} />
                                  </div>
                                  <div className="relative flex-1 bg-indigo-100 dark:bg-indigo-900 rounded-sm overflow-hidden">
                                    <div className="absolute inset-y-0 left-0 bg-indigo-500 rounded-sm" style={{ width: `${ch.contribution_share}%` }} />
                                  </div>
                                </div>
                                <div className="flex gap-1 text-[10px] text-muted-foreground">
                                  <span className="flex-1">Spend: {ch.spend_share}%</span>
                                  <span className="flex-1">Contrib: {ch.contribution_share}%</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>

                    <div className="rounded-md border overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Channel</TableHead>
                            <TableHead className="text-right">Spend</TableHead>
                            <TableHead className="text-right">Spend %</TableHead>
                            <TableHead className="text-right">Contribution</TableHead>
                            <TableHead className="text-right">Contrib %</TableHead>
                            <TableHead className="text-right">ROAS</TableHead>
                            <TableHead className="text-right">Gap (pp)</TableHead>
                            <TableHead className="text-right">Efficiency</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[...efficiencyData.channels]
                            .sort((a, b) => b.roas - a.roas)
                            .map((ch) => {
                              const isEfficient = ch.contribution_share > ch.spend_share;
                              const gap = ch.contribution_share - ch.spend_share;
                              return (
                                <TableRow key={ch.channel}>
                                  <TableCell className="font-medium">{ch.label}</TableCell>
                                  <TableCell className="text-right">{fmt(ch.total_spend)}</TableCell>
                                  <TableCell className="text-right">{ch.spend_share}%</TableCell>
                                  <TableCell className="text-right">{fmt(ch.total_contribution)}</TableCell>
                                  <TableCell className="text-right">{ch.contribution_share}%</TableCell>
                                  <TableCell className="text-right font-medium">{ch.roas.toFixed(2)}x</TableCell>
                                  <TableCell className="text-right">
                                    <span className={gap > 0 ? "text-green-600" : "text-amber-600"}>
                                      {gap > 0 ? "+" : ""}{gap.toFixed(1)}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${isEfficient ? "text-green-600" : "text-amber-600"}`}>
                                      {isEfficient ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                      {isEfficient ? "Over-performing" : "Under-performing"}
                                    </span>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ROAS Tab - Enhanced with ranking + radar */}
          <TabsContent value="roas" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Return on Ad Spend (ROAS)</CardTitle>
                  <CardDescription>
                    Revenue generated per unit of spend. Green = profitable (&ge;1x), Yellow = below breakeven.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {roasLoading ? (
                    <Skeleton className="h-80 w-full" />
                  ) : roasChartData.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">No ROAS data available</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={roasChartData} layout="vertical" margin={{ left: 80 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="channel" type="category" width={80} tick={{ fontSize: 12 }} />
                        <Tooltip
                          formatter={(value) => [Number(value).toFixed(2) + "x", "ROAS"]}
                          contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }}
                        />
                        <ReferenceLine x={1} stroke="#ef4444" strokeDasharray="3 3" label={{ value: "Breakeven", position: "top", fontSize: 10 }} />
                        <Bar dataKey="roas" fill="#6366f1" radius={[0, 4, 4, 0]}>
                          {roasChartData.map((entry, i) => (
                            <Cell key={i} fill={entry.roas >= 1 ? "#22c55e" : "#f59e0b"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* ROAS Rankings */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Channel Rankings</CardTitle>
                  <CardDescription className="text-xs">By ROAS performance</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {roasChartData.map((item, i) => (
                    <div key={item.channel} className="flex items-center gap-3">
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        i === 0 ? "bg-yellow-100 text-yellow-700" : i === 1 ? "bg-slate-100 text-slate-600" : i === 2 ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"
                      }`}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.channel}</p>
                      </div>
                      <Badge variant={item.roas >= 1 ? "outline" : "secondary"} className={item.roas >= 1 ? "border-green-200 text-green-700" : ""}>
                        {item.roas.toFixed(2)}x
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* ROAS Distribution Summary */}
            {roasChartData.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-3">
                <InsightBanner type="success">
                  <strong>{roasChartData.filter(c => c.roas >= 1).length}</strong> of {roasChartData.length} channels are above breakeven (ROAS &ge; 1x)
                </InsightBanner>
                <InsightBanner type="info">
                  <strong>ROAS range:</strong> {roasChartData[roasChartData.length - 1]?.roas.toFixed(2)}x — {roasChartData[0]?.roas.toFixed(2)}x
                  (spread: {(roasChartData[0]?.roas - roasChartData[roasChartData.length - 1]?.roas).toFixed(2)}x)
                </InsightBanner>
                <InsightBanner type={roasChartData.filter(c => c.roas < 0.5).length > 0 ? "warning" : "success"}>
                  {roasChartData.filter(c => c.roas < 0.5).length > 0
                    ? <><strong>{roasChartData.filter(c => c.roas < 0.5).length}</strong> channel(s) with very low ROAS (&lt;0.5x) — review for cutback</>
                    : <>All channels show reasonable returns — no critical underperformers</>
                  }
                </InsightBanner>
              </div>
            )}
          </TabsContent>

          {/* Contributions Tab - Enhanced */}
          <TabsContent value="contributions" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Channel Contributions</CardTitle>
                <CardDescription>
                  Share of total media-driven contribution by each marketing channel
                </CardDescription>
              </CardHeader>
              <CardContent>
                {contribLoading ? (
                  <Skeleton className="h-80 w-full" />
                ) : contribChartData.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No contribution data available</p>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <ResponsiveContainer width="100%" height={400}>
                      <PieChart>
                        <Pie
                          data={contribChartData}
                          cx="50%"
                          cy="50%"
                          outerRadius={140}
                          innerRadius={60}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}%`}
                          labelLine
                        >
                          {contribChartData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`${Number(value)}%`, "Contribution"]} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>

                    <div className="space-y-3">
                      {contribChartData.map((item, i) => (
                        <div key={item.name} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className="h-3 w-3 rounded-full shrink-0"
                                style={{ backgroundColor: COLORS[i % COLORS.length] }}
                              />
                              <span className="text-sm">{item.name}</span>
                            </div>
                            <span className="text-sm font-medium">{item.value}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden ml-5">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${item.value}%`,
                                backgroundColor: COLORS[i % COLORS.length],
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Contribution Waterfall */}
            {contribData && (
              <Card>
                <CardHeader>
                  <CardTitle>Contribution Waterfall</CardTitle>
                  <CardDescription>
                    Cumulative channel contribution to total media-driven revenue
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart
                      data={(() => {
                        const sorted = Object.entries(contribData.contribution_by_channel)
                          .map(([ch, val]) => ({ channel: ch.replace("spend_", ""), value: Number(val) }))
                          .sort((a, b) => b.value - a.value);
                        let cumulative = 0;
                        return sorted.map((item, i) => {
                          const base = cumulative;
                          cumulative += item.value;
                          return { ...item, base, cumulative, color: COLORS[i % COLORS.length] };
                        });
                      })()}
                      margin={{ left: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="channel" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => fmt(v)} tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value, name) => [fmt(Number(value)), name === "base" ? "" : "Contribution"]}
                        contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }}
                      />
                      <Bar dataKey="base" stackId="waterfall" fill="transparent" />
                      <Bar dataKey="value" stackId="waterfall" radius={[4, 4, 0, 0]}>
                        {Object.entries(contribData.contribution_by_channel)
                          .sort(([, a], [, b]) => Number(b) - Number(a))
                          .map(([, ], i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Time Series Tab - Enhanced */}
          <TabsContent value="timeseries" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Channel Contributions Over Time</CardTitle>
                <CardDescription>
                  Stacked area chart showing how each channel contributes to sales weekly
                </CardDescription>
              </CardHeader>
              <CardContent>
                {tsLoading ? (
                  <Skeleton className="h-96 w-full" />
                ) : tsChartData.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No time series data available</p>
                ) : (
                  <ResponsiveContainer width="100%" height={450}>
                    <AreaChart data={tsChartData} margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
                      <Tooltip
                        formatter={(value) => [fmt(Number(value)), ""]}
                        contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }}
                      />
                      <Legend />
                      {tsData?.channels.map((ch, i) => (
                        <Area
                          key={ch}
                          type="monotone"
                          dataKey={ch.replace("spend_", "")}
                          stackId="1"
                          fill={COLORS[i % COLORS.length]}
                          stroke={COLORS[i % COLORS.length]}
                          fillOpacity={0.6}
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Sales vs contribution line overlay */}
            {tsChartData.length > 0 && tsData?.target?.length ? (
              <Card>
                <CardHeader>
                  <CardTitle>Model Fit: Sales vs Total Channel Contribution</CardTitle>
                  <CardDescription>
                    Actual sales overlaid with sum of all channel contributions. A close fit indicates the model explains sales well.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart
                      data={tsChartData.map((point) => {
                        const totalContrib = tsData.channels.reduce(
                          (sum, ch) => sum + (Number(point[ch.replace("spend_", "")]) || 0), 0
                        );
                        return { date: point.date, Sales: point.Sales, "Total Contribution": totalContrib };
                      })}
                      margin={{ left: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
                      <Tooltip
                        formatter={(value) => [fmt(Number(value)), ""]}
                        contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="Sales" stroke="#6366f1" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="Total Contribution" stroke="#f97316" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                    </LineChart>
                  </ResponsiveContainer>
                  {/* Model fit stats */}
                  {(() => {
                    const salesArr = tsChartData.map(p => Number(p.Sales) || 0);
                    const contribArr = tsChartData.map((p) => {
                      return tsData.channels.reduce((sum, ch) => sum + (Number(p[ch.replace("spend_", "")]) || 0), 0);
                    });
                    const meanSales = salesArr.reduce((s, v) => s + v, 0) / salesArr.length;
                    const ssRes = salesArr.reduce((s, v, i) => s + Math.pow(v - contribArr[i], 2), 0);
                    const ssTot = salesArr.reduce((s, v) => s + Math.pow(v - meanSales, 2), 0);
                    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
                    const mape = salesArr.reduce((s, v, i) => s + (v > 0 ? Math.abs((v - contribArr[i]) / v) : 0), 0) / salesArr.length * 100;
                    return (
                      <div className="mt-4 grid grid-cols-2 gap-4">
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground">R-squared (media contribution)</p>
                          <p className="text-lg font-bold">{r2.toFixed(3)}</p>
                          <p className="text-xs text-muted-foreground">{r2 > 0.7 ? "Good fit" : r2 > 0.4 ? "Moderate fit" : "Weak fit — base/intercept likely large"}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground">MAPE (mean absolute % error)</p>
                          <p className="text-lg font-bold">{mape.toFixed(1)}%</p>
                          <p className="text-xs text-muted-foreground">{mape < 15 ? "Excellent accuracy" : mape < 30 ? "Acceptable accuracy" : "High error — review model"}</p>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            ) : null}

            {/* Per-channel weekly trend mini-charts */}
            {tsChartData.length > 0 && tsData && (
              <Card>
                <CardHeader>
                  <CardTitle>Individual Channel Trends</CardTitle>
                  <CardDescription>Weekly contribution per channel — spot seasonality and trends</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tsData.channels.map((ch, i) => {
                      const label = ch.replace("spend_", "");
                      const values = tsData.series[ch];
                      const max = Math.max(...values);
                      const min = Math.min(...values);
                      const avg = values.reduce((s, v) => s + v, 0) / values.length;
                      return (
                        <div key={ch} className="p-3 rounded-lg border">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                              <span className="text-sm font-medium">{label}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">avg: {fmt(avg)}</span>
                          </div>
                          <ResponsiveContainer width="100%" height={80}>
                            <AreaChart data={values.map((v, idx) => ({ v, d: idx }))}>
                              <Area type="monotone" dataKey="v" fill={COLORS[i % COLORS.length]} stroke={COLORS[i % COLORS.length]} fillOpacity={0.3} />
                            </AreaChart>
                          </ResponsiveContainer>
                          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                            <span>Min: {fmt(min)}</span>
                            <span>Max: {fmt(max)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* NEW: Efficiency Quadrant Map */}
          <TabsContent value="quadrant" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Efficiency Scatter Plot</CardTitle>
                  <CardDescription>
                    Spend Share vs Contribution Share — channels above the diagonal line are efficient
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {scatterData.length === 0 ? (
                    <Skeleton className="h-80 w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height={400}>
                      <ScatterChart margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" dataKey="spend_share" name="Spend Share %" unit="%" tick={{ fontSize: 11 }} />
                        <YAxis type="number" dataKey="contribution_share" name="Contribution Share %" unit="%" tick={{ fontSize: 11 }} />
                        <ZAxis type="number" dataKey="total_spend" range={[100, 800]} name="Total Spend" />
                        <Tooltip
                          formatter={(value, name) => [typeof value === "number" ? value.toFixed(1) : value, name]}
                          contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }}
                        />
                        <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 50, y: 50 }]} stroke="#94a3b8" strokeDasharray="5 5" />
                        <Scatter data={scatterData} name="Channels">
                          {scatterData.map((entry, i) => (
                            <Cell key={i} fill={entry.contribution_share > entry.spend_share ? "#22c55e" : "#f59e0b"} />
                          ))}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Channel Radar</CardTitle>
                  <CardDescription>
                    Multi-dimensional view: Spend Share, Contribution Share, and ROAS per channel
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {radarData.length === 0 ? (
                    <Skeleton className="h-80 w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height={400}>
                      <RadarChart data={radarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="channel" tick={{ fontSize: 10 }} />
                        <PolarRadiusAxis tick={{ fontSize: 9 }} />
                        <Radar name="Spend Share" dataKey="Spend Share" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.3} />
                        <Radar name="Contribution Share" dataKey="Contribution Share" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                        <Radar name="ROAS (scaled)" dataKey="ROAS (scaled)" stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} />
                        <Legend />
                        <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }} />
                      </RadarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Channel classification */}
            {efficiencyData && (
              <Card>
                <CardHeader>
                  <CardTitle>Channel Classification</CardTitle>
                  <CardDescription>Strategic recommendations based on ROAS and spend share</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Stars: High ROAS, high spend */}
                    <div className="p-4 rounded-lg border-2 border-green-200 bg-green-50/50 dark:bg-green-950/30 dark:border-green-800">
                      <h4 className="text-sm font-semibold text-green-700 dark:text-green-400 mb-2 flex items-center gap-1">
                        <Award className="h-4 w-4" /> Stars
                      </h4>
                      <p className="text-xs text-muted-foreground mb-2">High ROAS + High Spend — protect and maintain</p>
                      <div className="space-y-1">
                        {efficiencyData.channels.filter(c => c.roas >= (insights?.avgRoas || 1) && c.spend_share >= 100 / efficiencyData.channels.length).map(c => (
                          <Badge key={c.channel} variant="outline" className="mr-1 border-green-300">{c.label}</Badge>
                        ))}
                        {efficiencyData.channels.filter(c => c.roas >= (insights?.avgRoas || 1) && c.spend_share >= 100 / efficiencyData.channels.length).length === 0 && (
                          <span className="text-xs text-muted-foreground">None</span>
                        )}
                      </div>
                    </div>
                    {/* Growth: High ROAS, low spend */}
                    <div className="p-4 rounded-lg border-2 border-blue-200 bg-blue-50/50 dark:bg-blue-950/30 dark:border-blue-800">
                      <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-1">
                        <TrendingUp className="h-4 w-4" /> Growth Opportunities
                      </h4>
                      <p className="text-xs text-muted-foreground mb-2">High ROAS + Low Spend — increase investment</p>
                      <div className="space-y-1">
                        {efficiencyData.channels.filter(c => c.roas >= (insights?.avgRoas || 1) && c.spend_share < 100 / efficiencyData.channels.length).map(c => (
                          <Badge key={c.channel} variant="outline" className="mr-1 border-blue-300">{c.label}</Badge>
                        ))}
                        {efficiencyData.channels.filter(c => c.roas >= (insights?.avgRoas || 1) && c.spend_share < 100 / efficiencyData.channels.length).length === 0 && (
                          <span className="text-xs text-muted-foreground">None</span>
                        )}
                      </div>
                    </div>
                    {/* Optimize: Low ROAS, high spend */}
                    <div className="p-4 rounded-lg border-2 border-amber-200 bg-amber-50/50 dark:bg-amber-950/30 dark:border-amber-800">
                      <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1">
                        <Target className="h-4 w-4" /> Needs Optimization
                      </h4>
                      <p className="text-xs text-muted-foreground mb-2">Low ROAS + High Spend — optimize or reduce</p>
                      <div className="space-y-1">
                        {efficiencyData.channels.filter(c => c.roas < (insights?.avgRoas || 1) && c.spend_share >= 100 / efficiencyData.channels.length).map(c => (
                          <Badge key={c.channel} variant="outline" className="mr-1 border-amber-300">{c.label}</Badge>
                        ))}
                        {efficiencyData.channels.filter(c => c.roas < (insights?.avgRoas || 1) && c.spend_share >= 100 / efficiencyData.channels.length).length === 0 && (
                          <span className="text-xs text-muted-foreground">None</span>
                        )}
                      </div>
                    </div>
                    {/* Question marks: Low ROAS, low spend */}
                    <div className="p-4 rounded-lg border-2 border-slate-200 bg-slate-50/50 dark:bg-slate-950/30 dark:border-slate-700">
                      <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-1">
                        <TrendingDown className="h-4 w-4" /> Question Marks
                      </h4>
                      <p className="text-xs text-muted-foreground mb-2">Low ROAS + Low Spend — test or drop</p>
                      <div className="space-y-1">
                        {efficiencyData.channels.filter(c => c.roas < (insights?.avgRoas || 1) && c.spend_share < 100 / efficiencyData.channels.length).map(c => (
                          <Badge key={c.channel} variant="outline" className="mr-1 border-slate-300">{c.label}</Badge>
                        ))}
                        {efficiencyData.channels.filter(c => c.roas < (insights?.avgRoas || 1) && c.spend_share < 100 / efficiencyData.channels.length).length === 0 && (
                          <span className="text-xs text-muted-foreground">None</span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
