"use client";

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

  const { data: roasData, isLoading: roasLoading } = useQuery({
    queryKey: ["roas", currentOrgId, modelId],
    queryFn: () => analysis.roas(currentOrgId!, modelId),
    enabled: !!currentOrgId && !!modelId && isReady,
  });

  const { data: contribData, isLoading: contribLoading } = useQuery({
    queryKey: ["contributions", currentOrgId, modelId],
    queryFn: () => analysis.contributions(currentOrgId!, modelId),
    enabled: !!currentOrgId && !!modelId && isReady,
  });

  const { data: efficiencyData, isLoading: effLoading } = useQuery({
    queryKey: ["spend-vs-contrib", currentOrgId, modelId],
    queryFn: () => analysis.spendVsContribution(currentOrgId!, modelId),
    enabled: !!currentOrgId && !!modelId && isReady,
  });

  const { data: tsData, isLoading: tsLoading } = useQuery({
    queryKey: ["contrib-ts", currentOrgId, modelId],
    queryFn: () => analysis.contributionsTimeseries(currentOrgId!, modelId),
    enabled: !!currentOrgId && !!modelId && isReady,
  });

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
          value: Number((Number(pct) * 100).toFixed(1)),
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

      {/* Summary KPI cards */}
      {isReady && efficiencyData && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Spend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {fmt(efficiencyData.channels.reduce((s, c) => s + c.total_spend, 0))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Contribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {fmt(efficiencyData.channels.reduce((s, c) => s + c.total_contribution, 0))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg ROAS</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(efficiencyData.channels.reduce((s, c) => s + c.total_contribution, 0) /
                  efficiencyData.channels.reduce((s, c) => s + c.total_spend, 0)).toFixed(2)}x
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Channels</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{efficiencyData.channels.length}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Analysis Tabs */}
      {isReady && (
        <Tabs defaultValue="efficiency">
          <TabsList>
            <TabsTrigger value="efficiency">Channel Efficiency</TabsTrigger>
            <TabsTrigger value="roas">ROAS</TabsTrigger>
            <TabsTrigger value="contributions">Contributions</TabsTrigger>
            <TabsTrigger value="timeseries">Over Time</TabsTrigger>
          </TabsList>

          {/* Efficiency Tab - Spend vs Contribution table + chart */}
          <TabsContent value="efficiency" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Spend vs Contribution by Channel</CardTitle>
                <CardDescription>
                  Compare how much each channel spends vs how much it contributes to sales
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
                      <BarChart data={efficiencyData.channels} margin={{ left: 20 }}>
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
                            <TableHead className="text-right">Efficiency</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {efficiencyData.channels
                            .sort((a, b) => b.roas - a.roas)
                            .map((ch) => {
                              const isEfficient = ch.contribution_share > ch.spend_share;
                              return (
                                <TableRow key={ch.channel}>
                                  <TableCell className="font-medium">{ch.label}</TableCell>
                                  <TableCell className="text-right">{fmt(ch.total_spend)}</TableCell>
                                  <TableCell className="text-right">{ch.spend_share}%</TableCell>
                                  <TableCell className="text-right">{fmt(ch.total_contribution)}</TableCell>
                                  <TableCell className="text-right">{ch.contribution_share}%</TableCell>
                                  <TableCell className="text-right font-medium">{ch.roas.toFixed(2)}x</TableCell>
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

          {/* ROAS Tab */}
          <TabsContent value="roas" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Return on Ad Spend (ROAS)</CardTitle>
                <CardDescription>
                  Revenue generated per unit of spend for each channel
                </CardDescription>
              </CardHeader>
              <CardContent>
                {roasLoading ? (
                  <Skeleton className="h-80 w-full" />
                ) : roasChartData.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No ROAS data available
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={roasChartData} layout="vertical" margin={{ left: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="channel" type="category" width={80} tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value) => [Number(value).toFixed(2), "ROAS"]}
                        contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }}
                      />
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
          </TabsContent>

          {/* Contributions Tab */}
          <TabsContent value="contributions" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Channel Contributions</CardTitle>
                <CardDescription>
                  Share of total contribution by each marketing channel
                </CardDescription>
              </CardHeader>
              <CardContent>
                {contribLoading ? (
                  <Skeleton className="h-80 w-full" />
                ) : contribChartData.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No contribution data available
                  </p>
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
          </TabsContent>

          {/* Time Series Tab */}
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
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No time series data available
                  </p>
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

            {/* Sales line overlay */}
            {tsChartData.length > 0 && tsData?.target?.length ? (
              <Card>
                <CardHeader>
                  <CardTitle>Sales vs Total Channel Contribution</CardTitle>
                  <CardDescription>
                    Actual sales overlaid with the sum of all channel contributions
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
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
