"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { createClient } from "@/lib/supabase/client";
import { jobs, type TrainJobInput } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { SectionHeader } from "@/components/marketing";
import Link from "next/link";
import {
  BarChart3,
  Calendar,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Clock,
  XCircle,
  Cpu,
  PlayCircle,
  Plus,
  Database,
  Sparkles,
  StopCircle,
} from "lucide-react";

const statusConfig: Record<string, {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  className?: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  ready: { label: "Listo", variant: "outline", className: "border-emerald-200 text-emerald-700", icon: CheckCircle2 },
  training: { label: "Analizando", variant: "default", className: "", icon: Loader2 },
  pending: { label: "Pendiente", variant: "secondary", className: "", icon: Clock },
  failed: { label: "Error", variant: "destructive", className: "", icon: XCircle },
  deleted: { label: "Eliminado", variant: "secondary", className: "", icon: XCircle },
};

export default function ModelsPage() {
  const { currentOrgId } = useAuthStore();
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = useState("");
  const [trainOpen, setTrainOpen] = useState(false);
  const [trainProject, setTrainProject] = useState("");
  const [trainDataset, setTrainDataset] = useState("");
  const [modelName, setModelName] = useState("");
  const [draws, setDraws] = useState(500);
  const [tune, setTune] = useState(500);
  const [chains, setChains] = useState(2);
  const [testWeeks, setTestWeeks] = useState(8);

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

  const { data: trainDatasets } = useQuery({
    queryKey: ["datasets-for-train", currentOrgId, trainProject],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("datasets")
        .select("*")
        .eq("org_id", currentOrgId!)
        .eq("project_id", trainProject)
        .eq("status", "validated")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrgId && !!trainProject,
  });

  const { data: modelList, isLoading } = useQuery({
    queryKey: ["models", currentOrgId, selectedProject],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from("models")
        .select("*")
        .eq("org_id", currentOrgId!)
        .order("created_at", { ascending: false });
      if (selectedProject) {
        query = query.eq("project_id", selectedProject);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrgId,
  });

  // Active jobs for progress display
  const { data: activeJobs } = useQuery({
    queryKey: ["active-jobs", currentOrgId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("training_jobs")
        .select("*, models(name, status)")
        .eq("org_id", currentOrgId!)
        .in("status", ["queued", "running"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrgId,
    refetchInterval: (query) => {
      const data = query.state.data as { status: string }[] | undefined;
      return data && data.length > 0 ? 5000 : false;
    },
    refetchIntervalInBackground: true,
  });

  const trainMutation = useMutation({
    mutationFn: () => {
      const ds = trainDatasets?.find((d) => d.id === trainDataset);
      if (!ds) throw new Error("Dataset no encontrado");
      const input: TrainJobInput = {
        dataset_id: trainDataset,
        name: modelName,
        spend_columns: ds.spend_columns || [],
        control_columns: ds.control_columns || [],
        date_column: ds.date_column || "date_week",
        target_column: ds.target_column || "sales",
        countries: ds.countries || [],
        draws,
        tune,
        chains,
        test_weeks: testWeeks,
      };
      return jobs.train(currentOrgId!, trainProject, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["models"] });
      queryClient.invalidateQueries({ queryKey: ["active-jobs"] });
      toast.success("Analisis lanzado. Te avisaremos cuando termine.");
      setTrainOpen(false);
      setModelName("");
      setTrainDataset("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: (jobId: string) => jobs.cancel(currentOrgId!, jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["models"] });
      toast.success("Analisis cancelado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  useEffect(() => {
    if (projectList?.length && !selectedProject) {
      setSelectedProject(projectList[0].id);
    }
  }, [projectList, selectedProject]);

  // Auto-select first project for training dialog
  useEffect(() => {
    if (projectList?.length && !trainProject) {
      setTrainProject(projectList[0].id);
    }
  }, [projectList, trainProject]);

  const readyModels = modelList?.filter((m) => m.status === "ready") || [];
  const otherModels = modelList?.filter((m) => m.status !== "ready") || [];
  const hasDatasets = trainDatasets && trainDatasets.length > 0;
  const hasProjects = projectList && projectList.length > 0;

  return (
    <div className="space-y-8">
      <SectionHeader
        icon={BarChart3}
        title="Mis Analisis"
        description="Tus modelos de Marketing Mix entrenados. Haz clic en cualquiera para ver el rendimiento detallado de cada canal."
      >
        {hasProjects && (
          <Dialog open={trainOpen} onOpenChange={setTrainOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <PlayCircle className="h-4 w-4" />
                Lanzar nuevo analisis
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Lanzar nuevo analisis</DialogTitle>
                <DialogDescription>
                  Selecciona un conjunto de datos y configura los parametros del analisis.
                  El proceso suele tardar entre 3 y 20 minutos.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={(e) => { e.preventDefault(); trainMutation.mutate(); }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label>Proyecto</Label>
                  <Select value={trainProject} onValueChange={(v) => { setTrainProject(v); setTrainDataset(""); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar proyecto" />
                    </SelectTrigger>
                    <SelectContent>
                      {projectList?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Conjunto de datos</Label>
                  <Select value={trainDataset} onValueChange={setTrainDataset} disabled={!trainProject}>
                    <SelectTrigger>
                      <SelectValue placeholder={trainProject ? "Seleccionar datos" : "Elige un proyecto primero"} />
                    </SelectTrigger>
                    <SelectContent>
                      {trainDatasets?.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name} ({d.row_count} semanas)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {trainProject && trainDatasets && trainDatasets.length === 0 && (
                    <p className="text-xs text-amber-600">
                      No hay datos validados en este proyecto.{" "}
                      <Link href="/datasets" className="underline">Importa datos primero</Link>.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model-name">Nombre del analisis</Label>
                  <Input
                    id="model-name"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder="Ej: Espana Q1 2024"
                    required
                    minLength={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="draws" className="text-xs">Muestras (draws)</Label>
                    <Input id="draws" type="number" value={draws} onChange={(e) => setDraws(Number(e.target.value))} min={100} max={2000} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tune" className="text-xs">Calentamiento (tune)</Label>
                    <Input id="tune" type="number" value={tune} onChange={(e) => setTune(Number(e.target.value))} min={100} max={2000} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="chains" className="text-xs">Cadenas</Label>
                    <Input id="chains" type="number" value={chains} onChange={(e) => setChains(Number(e.target.value))} min={1} max={4} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="test-weeks" className="text-xs">Semanas de test</Label>
                    <Input id="test-weeks" type="number" value={testWeeks} onChange={(e) => setTestWeeks(Number(e.target.value))} min={0} max={52} />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full gap-2"
                  disabled={trainMutation.isPending || !trainDataset || !modelName}
                >
                  {trainMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  <Sparkles className="h-4 w-4" />
                  Lanzar analisis
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </SectionHeader>

      {/* Active jobs banner */}
      {activeJobs && activeJobs.length > 0 && (
        <div className="space-y-3">
          {activeJobs.map((job) => (
            <div
              key={job.id}
              className="flex items-center gap-4 rounded-xl border border-blue-200 bg-blue-50/80 px-5 py-4 dark:bg-blue-950/30 dark:border-blue-800"
            >
              <Loader2 className="h-5 w-5 animate-spin text-blue-600 shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Analizando: {job.models?.name || job.id.slice(0, 8)}
                  </p>
                  <Badge variant="secondary" className="text-[10px]">
                    {job.status === "running" ? "En curso" : "En cola"}
                  </Badge>
                </div>
                {job.message && (
                  <p className="text-xs text-blue-700/70 dark:text-blue-300/70">{job.message}</p>
                )}
                {job.status === "running" && (
                  <Progress value={job.progress} className="h-1.5 w-full max-w-xs" />
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-blue-600 hover:text-red-600 shrink-0"
                onClick={() => cancelMutation.mutate(job.id)}
                disabled={cancelMutation.isPending}
              >
                <StopCircle className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {hasProjects && (
        <div className="flex items-center gap-3">
          <Label className="text-sm text-muted-foreground whitespace-nowrap">Proyecto:</Label>
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Seleccionar proyecto" />
            </SelectTrigger>
            <SelectContent>
              {projectList.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!hasProjects ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-muted-foreground/20 bg-muted/30 px-8 py-16 text-center">
          <Database className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold">Empieza con tus datos</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm mb-4">
            Para lanzar un analisis, primero necesitas importar tus datos de marketing.
          </p>
          <Button asChild className="gap-2">
            <Link href="/datasets">
              <Database className="h-4 w-4" />
              Ir a Mis Datos
            </Link>
          </Button>
        </div>
      ) : !selectedProject ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-muted-foreground/20 bg-muted/30 px-8 py-16 text-center">
          <BarChart3 className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold">Selecciona un proyecto</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Elige un proyecto para ver sus analisis
          </p>
        </div>
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-44" />)}
        </div>
      ) : !modelList?.length ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-muted-foreground/20 bg-muted/30 px-8 py-16 text-center">
          <BarChart3 className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold">Sin analisis todavia</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm mb-4">
            Lanza tu primer analisis para descubrir como rinden tus canales de marketing
          </p>
          <Button className="gap-2" onClick={() => setTrainOpen(true)}>
            <PlayCircle className="h-4 w-4" />
            Lanzar nuevo analisis
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Ready models — primary */}
          {readyModels.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Listos para consultar ({readyModels.length})
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {readyModels.map((model) => (
                  <Link key={model.id} href={`/models/${model.id}`}>
                    <div className="rounded-xl border bg-card p-5 space-y-3 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer h-full group">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <BarChart3 className="h-4 w-4" />
                          </div>
                          <h3 className="text-sm font-semibold truncate">{model.name}</h3>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
                      </div>

                      {model.spend_columns && (
                        <div className="flex flex-wrap gap-1.5">
                          {model.spend_columns.slice(0, 5).map((col: string) => (
                            <span
                              key={col}
                              className="inline-flex items-center rounded-md bg-primary/8 px-2 py-0.5 text-[11px] font-medium text-primary"
                            >
                              {col.replace("spend_", "")}
                            </span>
                          ))}
                          {model.spend_columns.length > 5 && (
                            <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                              +{model.spend_columns.length - 5}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        {model.start_date && model.end_date && (
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(model.start_date).toLocaleDateString("es-ES", { month: "short", year: "numeric" })}
                            {" — "}
                            {new Date(model.end_date).toLocaleDateString("es-ES", { month: "short", year: "numeric" })}
                          </span>
                        )}
                        <Badge
                          variant="outline"
                          className="border-emerald-200 text-emerald-700 text-[10px]"
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Listo
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Other models */}
          {otherModels.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                En proceso ({otherModels.length})
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {otherModels.map((model) => {
                  const cfg = statusConfig[model.status] || statusConfig.pending;
                  const StatusIcon = cfg.icon;
                  return (
                    <div
                      key={model.id}
                      className="rounded-xl border bg-card p-5 space-y-3 opacity-80"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                            <BarChart3 className="h-4 w-4" />
                          </div>
                          <h3 className="text-sm font-medium truncate text-muted-foreground">
                            {model.name}
                          </h3>
                        </div>
                        <Badge variant={cfg.variant} className={`text-[10px] ${cfg.className}`}>
                          <StatusIcon className={`h-3 w-3 mr-1 ${model.status === "training" ? "animate-spin" : ""}`} />
                          {cfg.label}
                        </Badge>
                      </div>

                      {model.spend_columns && (
                        <div className="flex flex-wrap gap-1.5">
                          {model.spend_columns.slice(0, 4).map((col: string) => (
                            <span
                              key={col}
                              className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                            >
                              {col.replace("spend_", "")}
                            </span>
                          ))}
                        </div>
                      )}

                      {model.start_date && model.end_date && (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {new Date(model.start_date).toLocaleDateString("es-ES", { month: "short", year: "numeric" })}
                          {" — "}
                          {new Date(model.end_date).toLocaleDateString("es-ES", { month: "short", year: "numeric" })}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
