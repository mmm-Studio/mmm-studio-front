"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { createClient } from "@/lib/supabase/client";
import { analysis } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { SectionHeader, MetricCard } from "@/components/marketing";
import Link from "next/link";
import {
  LayoutDashboard,
  Database,
  BarChart3,
  ArrowRight,
  Loader2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Award,
  AlertTriangle,
  Lightbulb,
  Upload,
  CheckCircle2,
  FileText,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatEur(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M EUR`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K EUR`;
  return `${value.toFixed(0)} EUR`;
}

function cleanChannelName(name: string): string {
  return name.replace(/^spend_/i, "").replace(/_/g, " ");
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { currentOrgId } = useAuthStore();

  // ── Data fetching ──────────────────────────────────────────────────────────

  const { data: datasetList, isLoading: datasetsLoading } = useQuery({
    queryKey: ["datasets-dashboard", currentOrgId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("datasets")
        .select("id, name, created_at")
        .eq("org_id", currentOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrgId,
  });

  const { data: modelList, isLoading: modelsLoading } = useQuery({
    queryKey: ["models-dashboard", currentOrgId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("models")
        .select("id, name, status, created_at, spend_columns, start_date, end_date")
        .eq("org_id", currentOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrgId,
  });

  const { data: jobList, isLoading: jobsLoading } = useQuery({
    queryKey: ["jobs-dashboard", currentOrgId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("training_jobs")
        .select("*, models(name, status)")
        .eq("org_id", currentOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrgId,
  });

  const { data: scenarioList } = useQuery({
    queryKey: ["scenarios-dashboard", currentOrgId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("scenarios")
        .select("id, name, type, created_at, results")
        .eq("org_id", currentOrgId!)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrgId,
  });

  // Pick the latest ready model for the ROAS overview
  const readyModels = modelList?.filter((m) => m.status === "ready") || [];
  const latestModel = readyModels[0];

  const { data: roasData, isLoading: roasLoading } = useQuery({
    queryKey: ["roas-dashboard", currentOrgId, latestModel?.id],
    queryFn: () => analysis.roas(currentOrgId!, latestModel!.id),
    enabled: !!currentOrgId && !!latestModel?.id,
  });

  const { data: contribData } = useQuery({
    queryKey: ["contributions-dashboard", currentOrgId, latestModel?.id],
    queryFn: () => analysis.contributions(currentOrgId!, latestModel!.id),
    enabled: !!currentOrgId && !!latestModel?.id,
  });

  const { data: efficiencyData } = useQuery({
    queryKey: ["efficiency-dashboard", currentOrgId, latestModel?.id],
    queryFn: () => analysis.spendVsContribution(currentOrgId!, latestModel!.id),
    enabled: !!currentOrgId && !!latestModel?.id,
  });

  // ── Derived metrics ────────────────────────────────────────────────────────

  const activeJobs =
    jobList?.filter((j) => j.status === "running" || j.status === "queued") || [];

  const channels = efficiencyData?.channels || [];
  const bestChannel = channels.length
    ? [...channels].sort((a, b) => b.roas - a.roas)[0]
    : null;
  const worstChannel = channels.length
    ? [...channels].sort((a, b) => a.roas - b.roas)[0]
    : null;

  const totalContribution = contribData?.total_contribution ?? 0;
  const totalSpend = channels.reduce((sum, ch) => sum + ch.total_spend, 0);
  const avgRoas = totalSpend > 0 ? totalContribution / totalSpend : 0;

  const hasData = (datasetList?.length ?? 0) > 0;
  const hasModels = readyModels.length > 0;
  const isLoading = datasetsLoading || modelsLoading || jobsLoading;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      <SectionHeader
        icon={LayoutDashboard}
        title="Resumen"
        description="Vista general del rendimiento de tu inversion en medios. Identifica oportunidades y decide tus proximos pasos."
      />

      {/* ── Status banner: active jobs ───────────────────────────────────── */}
      {activeJobs.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50/80 px-5 py-4 dark:bg-blue-950/30 dark:border-blue-800">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              {activeJobs.length === 1
                ? "Estamos analizando tus datos"
                : `${activeJobs.length} analisis en curso`}
            </p>
            <p className="text-xs text-blue-700/70 dark:text-blue-300/70 mt-0.5">
              Te avisaremos cuando los resultados esten listos. Esto suele tardar entre 3 y 20 minutos.
            </p>
          </div>
        </div>
      )}

      {/* ── Empty state: no data yet ─────────────────────────────────────── */}
      {!isLoading && !hasData && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-muted-foreground/20 bg-muted/30 px-8 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
            <Upload className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-semibold">Empieza subiendo tus datos</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-md">
            Sube un archivo CSV con tus datos semanales de inversion publicitaria y ventas.
            Nosotros nos encargamos del resto.
          </p>
          <Button asChild className="mt-6 gap-2">
            <Link href="/datasets">
              <Upload className="h-4 w-4" />
              Subir datos
            </Link>
          </Button>
        </div>
      )}

      {/* ── Empty state: has data but no models ──────────────────────────── */}
      {!isLoading && hasData && !hasModels && activeJobs.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-amber-300/40 bg-amber-50/30 px-8 py-12 text-center dark:bg-amber-950/10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 mb-4">
            <BarChart3 className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-semibold">Tus datos estan listos</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-md">
            Tienes {datasetList?.length} conjunto(s) de datos. Lanza un analisis para descubrir
            que canales te funcionan mejor.
          </p>
          <Button asChild className="mt-6 gap-2">
            <Link href="/jobs">
              <BarChart3 className="h-4 w-4" />
              Lanzar analisis
            </Link>
          </Button>
        </div>
      )}

      {/* ── KPIs: only when we have model data ───────────────────────────── */}
      {hasModels && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              icon={DollarSign}
              label="Inversion total"
              value={formatEur(totalSpend)}
              tooltip="Suma de la inversion en todos los canales durante el periodo del modelo"
              loading={roasLoading}
              variant="default"
            />
            <MetricCard
              icon={TrendingUp}
              label="Ventas atribuidas"
              value={formatEur(totalContribution)}
              tooltip="Ventas totales que el modelo atribuye a tu inversion en medios"
              loading={roasLoading}
              variant="success"
            />
            <MetricCard
              icon={Award}
              label="Retorno medio"
              value={`${avgRoas.toFixed(1)}x`}
              tooltip="Media del retorno por euro invertido en todos los canales. Por encima de 1x es rentable."
              subtitle={`Por cada euro invertido, recuperas ${avgRoas.toFixed(2)} EUR`}
              loading={roasLoading}
              variant={avgRoas >= 1 ? "success" : "warning"}
            />
            <MetricCard
              icon={BarChart3}
              label="Analisis disponibles"
              value={readyModels.length}
              subtitle={`${latestModel?.spend_columns?.length || 0} canales analizados`}
              loading={modelsLoading}
              variant="default"
            />
          </div>

          {/* ── Best & worst channels ────────────────────────────────────── */}
          {bestChannel && worstChannel && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-4 rounded-xl border bg-card p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
                  <Award className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Mejor canal
                  </p>
                  <p className="text-lg font-bold mt-0.5">
                    {cleanChannelName(bestChannel.channel)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Retorno de{" "}
                    <span className="font-semibold text-emerald-600">
                      {bestChannel.roas.toFixed(1)}x
                    </span>
                    {" "} — por cada euro invertido, genera{" "}
                    {bestChannel.roas.toFixed(2)} EUR en ventas
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 rounded-xl border bg-card p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Canal a revisar
                  </p>
                  <p className="text-lg font-bold mt-0.5">
                    {cleanChannelName(worstChannel.channel)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Retorno de{" "}
                    <span
                      className={
                        worstChannel.roas < 1
                          ? "font-semibold text-red-500"
                          : "font-semibold text-amber-600"
                      }
                    >
                      {worstChannel.roas.toFixed(1)}x
                    </span>
                    {worstChannel.roas < 1
                      ? " — no es rentable actualmente"
                      : " — rendimiento mas bajo de todos los canales"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Opportunity insight ──────────────────────────────────────── */}
          {bestChannel && worstChannel && bestChannel.roas > 2 * worstChannel.roas && (
            <div className="flex items-start gap-4 rounded-xl border border-primary/20 bg-primary/5 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Lightbulb className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">Oportunidad detectada</p>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  <span className="font-medium text-foreground">
                    {cleanChannelName(bestChannel.channel)}
                  </span>{" "}
                  rinde {(bestChannel.roas / (worstChannel.roas || 0.1)).toFixed(0)}x mas que{" "}
                  <span className="font-medium text-foreground">
                    {cleanChannelName(worstChannel.channel)}
                  </span>
                  . Reasignar parte del presupuesto podria mejorar tu retorno global.
                </p>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="mt-3 gap-1.5"
                >
                  <Link href="/optimization">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Simular redistribucion
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Quick actions ────────────────────────────────────────────────── */}
      {hasModels && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Link
            href={latestModel ? `/models/${latestModel.id}` : "/models"}
            className="flex items-center gap-4 rounded-xl border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all group"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Ver analisis de canales</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Rendimiento detallado por canal
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground/40 ml-auto shrink-0 group-hover:text-primary transition-colors" />
          </Link>

          <Link
            href="/optimization"
            className="flex items-center gap-4 rounded-xl border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all group"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Planificar presupuesto</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Optimiza tu proxima inversion
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground/40 ml-auto shrink-0 group-hover:text-primary transition-colors" />
          </Link>

          <Link
            href="/datasets"
            className="flex items-center gap-4 rounded-xl border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all group"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors">
              <Database className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Subir nuevos datos</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Actualiza tu informacion
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground/40 ml-auto shrink-0 group-hover:text-primary transition-colors" />
          </Link>
        </div>
      )}

      {/* ── Ready models list ────────────────────────────────────────────── */}
      {hasModels && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Tus analisis</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Modelos entrenados y listos para consultar
              </p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/models" className="gap-1">
                Ver todos <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {readyModels.slice(0, 4).map((model) => (
                <Link
                  key={model.id}
                  href={`/models/${model.id}`}
                  className="flex items-center justify-between rounded-xl border p-4 hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <BarChart3 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{model.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {model.spend_columns?.length || 0} canales
                        {model.start_date &&
                          ` · ${new Date(model.start_date).toLocaleDateString("es-ES", { month: "short", year: "numeric" })} — ${new Date(model.end_date!).toLocaleDateString("es-ES", { month: "short", year: "numeric" })}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant="outline"
                      className="border-emerald-200 text-emerald-700 text-[11px]"
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Listo
                    </Badge>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Saved scenarios ──────────────────────────────────────────────── */}
      {scenarioList && scenarioList.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Escenarios guardados</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Tus ultimas simulaciones de presupuesto
              </p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/results" className="gap-1">
                Ver todos <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {scenarioList.map((sc) => {
                const typeLabels: Record<string, string> = {
                  budget: "Presupuesto",
                  historical: "Historico",
                  comparison: "Comparacion",
                };
                return (
                  <div
                    key={sc.id}
                    className="flex items-center justify-between rounded-xl border p-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{sc.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(sc.created_at).toLocaleDateString("es-ES", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[11px]">
                      {typeLabels[sc.type] || sc.type}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
