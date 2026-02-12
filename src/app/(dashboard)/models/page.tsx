"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
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
  PlayCircle,
  Database,
  Sparkles,
  StopCircle,
  Zap,
  Shield,
  Target,
  Info,
  ChevronDown,
} from "lucide-react";

/* ── Quality presets (hide technical MCMC params from business users) ── */
const qualityPresets = [
  {
    id: "rapido",
    label: "Rapido",
    description: "Resultados orientativos en ~5 min. Ideal para explorar datos nuevos.",
    icon: Zap,
    color: "text-amber-600",
    bg: "bg-amber-50 border-amber-200 hover:border-amber-400",
    bgSelected: "bg-amber-50 border-amber-500 ring-2 ring-amber-200",
    draws: 300,
    tune: 300,
    chains: 2,
    testWeeks: 4,
  },
  {
    id: "estandar",
    label: "Estandar",
    description: "Buen equilibrio entre velocidad y precision. Recomendado para la mayoria de casos.",
    icon: Target,
    color: "text-blue-600",
    bg: "bg-blue-50 border-blue-200 hover:border-blue-400",
    bgSelected: "bg-blue-50 border-blue-500 ring-2 ring-blue-200",
    draws: 500,
    tune: 500,
    chains: 2,
    testWeeks: 8,
  },
  {
    id: "preciso",
    label: "Alta precision",
    description: "Maxima fiabilidad estadistica. Ideal para decisiones de presupuesto importantes.",
    icon: Shield,
    color: "text-emerald-600",
    bg: "bg-emerald-50 border-emerald-200 hover:border-emerald-400",
    bgSelected: "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-200",
    draws: 1000,
    tune: 1000,
    chains: 4,
    testWeeks: 8,
  },
] as const;

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
  const searchParams = useSearchParams();
  const router = useRouter();

  const [selectedProject, setSelectedProject] = useState("");
  const [trainOpen, setTrainOpen] = useState(false);
  const [trainProject, setTrainProject] = useState("");
  const [trainDataset, setTrainDataset] = useState("");
  const [modelName, setModelName] = useState("");
  const [qualityPreset, setQualityPreset] = useState("estandar");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [draws, setDraws] = useState(500);
  const [tune, setTune] = useState(500);
  const [chains, setChains] = useState(2);
  const [testWeeks, setTestWeeks] = useState(8);
  const [justLaunched, setJustLaunched] = useState(false);

  // Auto-open dialog when coming from datasets page with ?launch=true
  useEffect(() => {
    if (searchParams.get("launch") === "true") {
      setTrainOpen(true);
      // Clean up the URL
      router.replace("/models", { scroll: false });
    }
  }, [searchParams, router]);

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
      const hasActive = data && data.length > 0;
      // Also refetch models when jobs complete
      if (!hasActive && justLaunched) {
        queryClient.invalidateQueries({ queryKey: ["models"] });
        setJustLaunched(false);
      }
      return hasActive ? 5000 : false;
    },
    refetchIntervalInBackground: true,
  });

  // Apply preset values when selection changes
  useEffect(() => {
    const preset = qualityPresets.find((p) => p.id === qualityPreset);
    if (preset && !showAdvanced) {
      setDraws(preset.draws);
      setTune(preset.tune);
      setChains(preset.chains);
      setTestWeeks(preset.testWeeks);
    }
  }, [qualityPreset, showAdvanced]);

  // Auto-generate model name when dataset changes
  useEffect(() => {
    if (trainDataset && trainDatasets) {
      const ds = trainDatasets.find((d) => d.id === trainDataset);
      if (ds && !modelName) {
        const now = new Date();
        const dateStr = now.toLocaleDateString("es-ES", { month: "short", year: "numeric" });
        setModelName(`${ds.name?.replace("Datos Marketing - ", "") || "Analisis"} — ${dateStr}`);
      }
    }
  }, [trainDataset, trainDatasets, modelName]);

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
      toast.success("Analisis lanzado correctamente");
      setTrainOpen(false);
      setModelName("");
      setTrainDataset("");
      setJustLaunched(true);
    },
    onError: (err: Error) => toast.error(`Error al lanzar: ${err.message}`),
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
  const hasProjects = projectList && projectList.length > 0;

  return (
    <div className="space-y-8">
      <SectionHeader
        icon={BarChart3}
        title="Mis Analisis"
        description="Tus modelos de Marketing Mix entrenados. Haz clic en cualquiera para ver el rendimiento detallado de cada canal."
      >
        {hasProjects && (
          <Dialog open={trainOpen} onOpenChange={(open) => {
            setTrainOpen(open);
            if (!open) { setShowAdvanced(false); }
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <PlayCircle className="h-4 w-4" />
                Lanzar nuevo analisis
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Lanzar nuevo analisis</DialogTitle>
                <DialogDescription>
                  Selecciona tus datos y la calidad del analisis. El proceso suele tardar entre 5 y 30 minutos.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={(e) => { e.preventDefault(); trainMutation.mutate(); }}
                className="space-y-5"
              >
                {/* Step 1: Project + Dataset */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                    <Label className="text-sm font-semibold">Elige tus datos</Label>
                  </div>

                  <Select value={trainProject} onValueChange={(v) => { setTrainProject(v); setTrainDataset(""); setModelName(""); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar proyecto" />
                    </SelectTrigger>
                    <SelectContent>
                      {projectList?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={trainDataset} onValueChange={(v) => { setTrainDataset(v); setModelName(""); }} disabled={!trainProject}>
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

                {/* Step 2: Model name */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
                    <Label className="text-sm font-semibold">Nombre del analisis</Label>
                  </div>
                  <Input
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder="Ej: Espana Q1 2024"
                    required
                    minLength={2}
                  />
                </div>

                {/* Step 3: Quality preset */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
                    <Label className="text-sm font-semibold">Calidad del analisis</Label>
                  </div>

                  <div className="grid gap-2">
                    {qualityPresets.map((preset) => {
                      const PresetIcon = preset.icon;
                      const isSelected = qualityPreset === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setQualityPreset(preset.id)}
                          className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all ${
                            isSelected ? preset.bgSelected : preset.bg
                          }`}
                        >
                          <PresetIcon className={`h-5 w-5 mt-0.5 shrink-0 ${preset.color}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold">{preset.label}</span>
                              {preset.id === "estandar" && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Recomendado</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{preset.description}</p>
                          </div>
                          <div className={`h-4 w-4 shrink-0 rounded-full border-2 mt-0.5 transition-colors ${
                            isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"
                          }`}>
                            {isSelected && (
                              <CheckCircle2 className="h-3 w-3 text-primary-foreground -mt-0.5 -ml-0.5" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Advanced toggle */}
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
                    Configuracion avanzada
                  </button>

                  {showAdvanced && (
                    <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="draws" className="text-xs text-muted-foreground">Muestras MCMC</Label>
                        <Input id="draws" type="number" value={draws} onChange={(e) => setDraws(Number(e.target.value))} min={100} max={2000} className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="tune" className="text-xs text-muted-foreground">Calentamiento</Label>
                        <Input id="tune" type="number" value={tune} onChange={(e) => setTune(Number(e.target.value))} min={100} max={2000} className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="chains" className="text-xs text-muted-foreground">Cadenas paralelas</Label>
                        <Input id="chains" type="number" value={chains} onChange={(e) => setChains(Number(e.target.value))} min={1} max={4} className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="test-weeks" className="text-xs text-muted-foreground">Semanas de validacion</Label>
                        <Input id="test-weeks" type="number" value={testWeeks} onChange={(e) => setTestWeeks(Number(e.target.value))} min={0} max={52} className="h-8 text-sm" />
                      </div>
                      <p className="col-span-2 text-[10px] text-muted-foreground flex items-start gap-1">
                        <Info className="h-3 w-3 shrink-0 mt-0.5" />
                        Mas muestras y cadenas = mayor precision pero mas tiempo de procesamiento.
                      </p>
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full gap-2"
                  size="lg"
                  disabled={trainMutation.isPending || !trainDataset || !modelName}
                >
                  {trainMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {trainMutation.isPending ? "Lanzando..." : "Lanzar analisis"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </SectionHeader>

      {/* Active jobs banner — shown prominently at top */}
      {activeJobs && activeJobs.length > 0 && (
        <div className="space-y-3">
          {activeJobs.map((job) => {
            const progressPct = job.progress || 0;
            const elapsed = job.started_at
              ? Math.round((Date.now() - new Date(job.started_at).getTime()) / 60000)
              : 0;
            return (
              <div
                key={job.id}
                className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50/50 px-5 py-4 dark:from-blue-950/30 dark:to-indigo-950/30 dark:border-blue-800"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                        {job.models?.name || "Analisis en curso"}
                      </p>
                      <Badge variant="secondary" className="text-[10px]">
                        {job.status === "running" ? `${progressPct}%` : "En cola"}
                      </Badge>
                      {elapsed > 0 && (
                        <span className="text-[10px] text-blue-600/60">{elapsed} min</span>
                      )}
                    </div>
                    {job.message && (
                      <p className="text-xs text-blue-700/70 dark:text-blue-300/70 mt-0.5">{job.message}</p>
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
                {job.status === "running" && (
                  <div className="mt-3 ml-14">
                    <Progress value={progressPct} className="h-2 w-full" />
                  </div>
                )}
              </div>
            );
          })}
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
