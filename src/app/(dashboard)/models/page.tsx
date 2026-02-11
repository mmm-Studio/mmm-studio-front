"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
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
  const [selectedProject, setSelectedProject] = useState("");

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

  const { data: modelList, isLoading } = useQuery({
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
  const otherModels = modelList?.filter((m) => m.status !== "ready") || [];

  return (
    <div className="space-y-8">
      <SectionHeader
        icon={BarChart3}
        title="Mis Analisis"
        description="Tus modelos de Marketing Mix entrenados. Haz clic en cualquiera para ver el rendimiento detallado de cada canal."
      />

      {projectList && projectList.length > 0 && (
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

      {!selectedProject ? (
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
            Lanza tu primer analisis desde la seccion de datos o trabajos para descubrir como rinden tus canales
          </p>
          <Button asChild className="gap-2">
            <Link href="/jobs">
              <Cpu className="h-4 w-4" />
              Lanzar analisis
            </Link>
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
