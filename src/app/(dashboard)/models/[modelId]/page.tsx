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
import { SectionHeader, MetricCard, InfoTooltip, ChannelHealthCard } from "@/components/marketing";
import Link from "next/link";
import {
  BarChart3,
  Calendar,
  TrendingUp,
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Target,
  Award,
  AlertTriangle,
  TrendingDown,
  Lightbulb,
  Clock,
  Sparkles,
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

function fmtEur(n: number): string {
  return `${fmt(n)} EUR`;
}

function cleanCh(name: string): string {
  return name.replace(/^spend_/i, "").replace(/_/g, " ");
}

function InsightBanner({ type, icon: Icon, children }: {
  type: "info" | "success" | "warning" | "opportunity";
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  const styles = {
    info: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-200",
    success: "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-200",
    warning: "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200",
    opportunity: "bg-primary/5 border-primary/20 text-foreground",
  };
  const defaultIcons = { info: Lightbulb, success: Award, warning: AlertTriangle, opportunity: Sparkles };
  const IconComp = Icon || defaultIcons[type];
  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border ${styles[type]}`}>
      <IconComp className="h-4 w-4 mt-0.5 shrink-0" />
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
        <div className="grid gap-4 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!model) {
    return <p className="text-muted-foreground">Analisis no encontrado.</p>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild className="mt-1">
          <Link href="/models"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <SectionHeader
            icon={BarChart3}
            title={model.name}
            description="Analisis detallado del rendimiento de cada canal de inversion. Descubre que canales generan mas ventas por euro invertido."
          >
            <Button asChild className="gap-2">
              <Link href={`/optimization?model=${modelId}`}>
                <TrendingUp className="h-4 w-4" />
                Optimizar presupuesto
              </Link>
            </Button>
          </SectionHeader>
          <div className="flex items-center gap-3 mt-3 ml-[52px]">
            {model.start_date && model.end_date && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {new Date(model.start_date).toLocaleDateString("es-ES", { month: "short", year: "numeric" })}
                {" — "}
                {new Date(model.end_date).toLocaleDateString("es-ES", { month: "short", year: "numeric" })}
              </span>
            )}
            {model.spend_columns && (
              <div className="flex flex-wrap gap-1.5">
                {model.spend_columns.map((col: string) => (
                  <span
                    key={col}
                    className="inline-flex items-center rounded-md bg-primary/8 px-2 py-0.5 text-[11px] font-medium text-primary"
                  >
                    {col.replace("spend_", "")}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Analysis Error Banner */}
      {isReady && analysisError && (
        <div className="flex items-start gap-3 p-4 rounded-xl border bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-200">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="text-sm">
            <strong>Error al cargar datos de analisis:</strong>{" "}
            {analysisError instanceof Error ? analysisError.message : "Error desconocido. Revisa los logs del backend."}
          </div>
        </div>
      )}

      {/* Summary KPI cards */}
      {isReady && insights && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              icon={DollarSign}
              label="Inversion total"
              value={fmtEur(insights.totalSpend)}
              tooltip="Suma de la inversion en todos los canales durante el periodo analizado"
              subtitle={`${insights.channelCount} canales analizados`}
              variant="default"
            />
            <MetricCard
              icon={Target}
              label="Ventas atribuidas"
              value={fmtEur(insights.totalContrib)}
              tooltip="Ventas que el modelo atribuye directamente a tu inversion en medios"
              variant="success"
            />
            <MetricCard
              icon={TrendingUp}
              label="Retorno medio (ROAS)"
              value={`${insights.avgRoas.toFixed(2)}x`}
              tooltip="Media del retorno por euro invertido. Por encima de 1x es rentable."
              subtitle={`Por cada euro invertido, recuperas ${insights.avgRoas.toFixed(2)} EUR`}
              variant={insights.avgRoas >= 1 ? "success" : "warning"}
            />
            <MetricCard
              icon={Award}
              label="Mejor canal"
              value={`${insights.bestChannel.roas.toFixed(1)}x`}
              tooltip={`${insights.bestChannel.label} es el canal con mayor retorno por euro invertido`}
              subtitle={insights.bestChannel.label}
              variant="success"
            />
          </div>

          {/* Auto-generated insights */}
          <div className="grid gap-3 sm:grid-cols-2">
            {insights.overPerformers.length > 0 && (
              <InsightBanner type="success">
                <strong>Canales estrella:</strong>{" "}
                {insights.overPerformers.map(c => c.label).join(", ")} — generan mas ventas proporcionalmente a lo que cuestan. Considera aumentar la inversion.
              </InsightBanner>
            )}
            {insights.underPerformers.length > 0 && (
              <InsightBanner type="warning">
                <strong>Canales a revisar:</strong>{" "}
                {insights.underPerformers.map(c => c.label).join(", ")} — consumen mas presupuesto del que justifican en ventas. Evalua redistribuir la inversion.
              </InsightBanner>
            )}
            {insights.avgGap > 5 && (
              <InsightBanner type="opportunity">
                <strong>Oportunidad de mejora.</strong> La diferencia media entre inversion y contribucion es de {insights.avgGap.toFixed(1)}pp. Optimizar el presupuesto podria mejorar significativamente los resultados.
              </InsightBanner>
            )}
            {insights.worstChannel.roas < 0.5 && (
              <InsightBanner type="warning">
                <strong>{insights.worstChannel.label}</strong> tiene un retorno de solo {insights.worstChannel.roas.toFixed(2)}x — por cada euro invertido, recuperas menos de 50 centimos. Considera reducir su presupuesto.
              </InsightBanner>
            )}
          </div>
        </>
      )}

      {/* Analysis Tabs */}
      {isReady && (
        <Tabs defaultValue="efficiency">
          <TabsList className="flex-wrap">
            <TabsTrigger value="efficiency">Eficiencia por canal</TabsTrigger>
            <TabsTrigger value="roas">Retorno (ROAS)</TabsTrigger>
            <TabsTrigger value="contributions">Contribucion</TabsTrigger>
            <TabsTrigger value="timeseries">Evolucion temporal</TabsTrigger>
            <TabsTrigger value="quadrant">Mapa estrategico</TabsTrigger>
          </TabsList>

          {/* Efficiency Tab - Spend vs Contribution table + chart */}
          <TabsContent value="efficiency" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Inversion vs Contribucion por canal</CardTitle>
                <CardDescription>
                  Compara cuanto inviertes en cada canal frente a cuantas ventas genera.
                  Los canales eficientes generan mas ventas proporcionalmente a su coste.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {effLoading ? (
                  <Skeleton className="h-80 w-full" />
                ) : !efficiencyData ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Sin datos disponibles</p>
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
                        <Bar dataKey="total_spend" fill="#94a3b8" name="Inversion" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="total_contribution" fill="#6366f1" name="Ventas atribuidas" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>

                    {/* Spend Share vs Contribution Share comparison */}
                    <Card className="bg-muted/30">
                      <CardHeader className="pb-2">
                <CardTitle className="text-sm">Cuota de inversion vs Cuota de ventas</CardTitle>
                        <CardDescription className="text-xs">Las barras muestran que proporcion del presupuesto y de las ventas corresponde a cada canal</CardDescription>
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
                                  <span className="flex-1">Inversion: {ch.spend_share}%</span>
                                  <span className="flex-1">Ventas: {ch.contribution_share}%</span>
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
                            <TableHead>Canal</TableHead>
                            <TableHead className="text-right">Inversion</TableHead>
                            <TableHead className="text-right">% Inv.</TableHead>
                            <TableHead className="text-right">Ventas</TableHead>
                            <TableHead className="text-right">% Ventas</TableHead>
                            <TableHead className="text-right">Retorno</TableHead>
                            <TableHead className="text-right">Dif. (pp)</TableHead>
                            <TableHead className="text-right">Estado</TableHead>
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
                                      {isEfficient ? "Eficiente" : "A revisar"}
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
                  <CardTitle>Retorno por euro invertido (ROAS)</CardTitle>
                  <CardDescription>
                    Cuántos euros genera cada canal por cada euro invertido. Verde = rentable (1x o más), Amarillo = por debajo del umbral.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {roasLoading ? (
                    <Skeleton className="h-80 w-full" />
                  ) : roasChartData.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">Sin datos de retorno disponibles</p>
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
                        <ReferenceLine x={1} stroke="#ef4444" strokeDasharray="3 3" label={{ value: "Umbral rentabilidad", position: "top", fontSize: 10 }} />
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
                  <CardTitle className="text-sm">Ranking de canales</CardTitle>
                  <CardDescription className="text-xs">Ordenados por retorno</CardDescription>
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
                  <strong>{roasChartData.filter(c => c.roas >= 1).length}</strong> de {roasChartData.length} canales son rentables (retorno mayor o igual a 1x)
                </InsightBanner>
                <InsightBanner type="info">
                  <strong>Rango de retorno:</strong> desde {roasChartData[roasChartData.length - 1]?.roas.toFixed(2)}x hasta {roasChartData[0]?.roas.toFixed(2)}x
                  (diferencia de {(roasChartData[0]?.roas - roasChartData[roasChartData.length - 1]?.roas).toFixed(2)}x)
                </InsightBanner>
                <InsightBanner type={roasChartData.filter(c => c.roas < 0.5).length > 0 ? "warning" : "success"}>
                  {roasChartData.filter(c => c.roas < 0.5).length > 0
                    ? <><strong>{roasChartData.filter(c => c.roas < 0.5).length}</strong> canal(es) con retorno muy bajo (&lt;0.5x) — considera reducir inversión</>
                    : <>Todos los canales muestran retornos razonables — sin casos críticos</>
                  }
                </InsightBanner>
              </div>
            )}
          </TabsContent>

          {/* Contributions Tab - Enhanced */}
          <TabsContent value="contributions" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Contribución por canal</CardTitle>
                <CardDescription>
                  Qué proporción de las ventas genera cada canal de inversión
                </CardDescription>
              </CardHeader>
              <CardContent>
                {contribLoading ? (
                  <Skeleton className="h-80 w-full" />
                ) : contribChartData.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Sin datos de contribución disponibles</p>
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
                        <Tooltip formatter={(value) => [`${Number(value)}%`, "Contribución"]} />
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
                  <CardTitle>Cascada de contribución</CardTitle>
                  <CardDescription>
                    Contribución acumulada de cada canal al total de ventas generadas por medios
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
                <CardTitle>Contribucion de canales a lo largo del tiempo</CardTitle>
                <CardDescription>
                  Evolucion semanal de la contribucion de cada canal a las ventas
                </CardDescription>
              </CardHeader>
              <CardContent>
                {tsLoading ? (
                  <Skeleton className="h-96 w-full" />
                ) : tsChartData.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Sin datos de serie temporal disponibles</p>
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
                  <CardTitle>Ajuste del modelo: Ventas reales vs Contribucion total</CardTitle>
                  <CardDescription>
                    Ventas reales comparadas con la suma de contribuciones de todos los canales. Un buen ajuste indica que el modelo explica bien las ventas.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart
                      data={tsChartData.map((point) => {
                        const totalContrib = tsData.channels.reduce(
                          (sum, ch) => sum + (Number(point[ch.replace("spend_", "")]) || 0), 0
                        );
                        return { date: point.date, Ventas: point.Sales, "Contribucion total": totalContrib };
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
                      <Line type="monotone" dataKey="Ventas" stroke="#6366f1" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="Contribucion total" stroke="#f97316" strokeWidth={2} dot={false} strokeDasharray="5 5" />
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
                          <p className="text-xs text-muted-foreground">R-cuadrado (contribucion de medios)</p>
                          <p className="text-lg font-bold">{r2.toFixed(3)}</p>
                          <p className="text-xs text-muted-foreground">{r2 > 0.7 ? "Buen ajuste" : r2 > 0.4 ? "Ajuste moderado" : "Ajuste debil — las ventas base son grandes"}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground">MAPE (error medio absoluto %)</p>
                          <p className="text-lg font-bold">{mape.toFixed(1)}%</p>
                          <p className="text-xs text-muted-foreground">{mape < 15 ? "Precision excelente" : mape < 30 ? "Precision aceptable" : "Error alto — revisa el modelo"}</p>
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
                  <CardTitle>Tendencia individual por canal</CardTitle>
                  <CardDescription>Contribucion semanal por canal — detecta estacionalidad y tendencias</CardDescription>
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
                  <CardTitle>Mapa de eficiencia</CardTitle>
                  <CardDescription>
                    Cuota de inversion vs Cuota de ventas — los canales por encima de la diagonal son eficientes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {scatterData.length === 0 ? (
                    <Skeleton className="h-80 w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height={400}>
                      <ScatterChart margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" dataKey="spend_share" name="% Inversion" unit="%" tick={{ fontSize: 11 }} />
                        <YAxis type="number" dataKey="contribution_share" name="% Ventas" unit="%" tick={{ fontSize: 11 }} />
                        <ZAxis type="number" dataKey="total_spend" range={[100, 800]} name="Inversion total" />
                        <Tooltip
                          formatter={(value, name) => [typeof value === "number" ? value.toFixed(1) : value, name]}
                          contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }}
                        />
                        <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 50, y: 50 }]} stroke="#94a3b8" strokeDasharray="5 5" />
                        <Scatter data={scatterData} name="Canales">
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
                  <CardTitle>Radar de canales</CardTitle>
                  <CardDescription>
                    Vista multidimensional: cuota de inversion, cuota de ventas y retorno por canal
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
                        <Radar name="% Inversion" dataKey="Spend Share" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.3} />
                        <Radar name="% Ventas" dataKey="Contribution Share" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                        <Radar name="Retorno (escalado)" dataKey="ROAS (scaled)" stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} />
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
                  <CardTitle>Clasificacion estrategica de canales</CardTitle>
                  <CardDescription>Recomendaciones basadas en retorno y cuota de inversion</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Stars: High ROAS, high spend */}
                    <div className="p-4 rounded-lg border-2 border-green-200 bg-green-50/50 dark:bg-green-950/30 dark:border-green-800">
                      <h4 className="text-sm font-semibold text-green-700 dark:text-green-400 mb-2 flex items-center gap-1">
                        <Award className="h-4 w-4" /> Estrellas
                      </h4>
                      <p className="text-xs text-muted-foreground mb-2">Alto retorno + Alta inversion — proteger y mantener</p>
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
                        <TrendingUp className="h-4 w-4" /> Oportunidades de crecimiento
                      </h4>
                      <p className="text-xs text-muted-foreground mb-2">Alto retorno + Baja inversion — aumentar inversion</p>
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
                        <Target className="h-4 w-4" /> Necesitan optimizacion
                      </h4>
                      <p className="text-xs text-muted-foreground mb-2">Bajo retorno + Alta inversion — optimizar o reducir</p>
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
                        <TrendingDown className="h-4 w-4" /> En duda
                      </h4>
                      <p className="text-xs text-muted-foreground mb-2">Bajo retorno + Baja inversion — probar o eliminar</p>
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
