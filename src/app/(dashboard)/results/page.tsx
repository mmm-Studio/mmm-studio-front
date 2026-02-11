"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { SectionHeader } from "@/components/marketing";
import Link from "next/link";
import {
  Bookmark,
  Trash2,
  Calendar,
  TrendingUp,
  DollarSign,
  GitCompare,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
} from "lucide-react";

const typeLabels: Record<string, string> = {
  historical: "Optimizacion historica",
  budget: "Planificacion de presupuesto",
  comparison: "Comparacion de periodos",
};

const typeIcons: Record<string, React.ReactNode> = {
  historical: <TrendingUp className="h-4 w-4 text-indigo-500" />,
  budget: <DollarSign className="h-4 w-4 text-emerald-500" />,
  comparison: <GitCompare className="h-4 w-4 text-amber-500" />,
};

const typeBg: Record<string, string> = {
  historical: "bg-indigo-50 dark:bg-indigo-950/30",
  budget: "bg-emerald-50 dark:bg-emerald-950/30",
  comparison: "bg-amber-50 dark:bg-amber-950/30",
};

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(1);
}

function ScenarioSummary({ type, results }: { type: string; results: Record<string, unknown> }) {
  if (type === "historical") {
    const uplift = results.uplift_pct as number;
    const origResp = results.original_response as number;
    const optResp = results.optimized_response as number;
    return (
      <div className="flex items-center gap-4 text-xs">
        {uplift != null && (
          <span className={`inline-flex items-center gap-1 font-semibold ${uplift > 0 ? "text-emerald-600" : "text-red-500"}`}>
            {uplift > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Number(uplift).toFixed(1)}% mejora
          </span>
        )}
        {origResp != null && <span className="text-muted-foreground">Original: {fmt(origResp)}</span>}
        {optResp != null && <span className="text-muted-foreground">Optimizado: {fmt(optResp)}</span>}
      </div>
    );
  }
  if (type === "budget") {
    const expectedRoas = results.expected_roas as number;
    const expectedResp = results.expected_response as Record<string, number> | number;
    const respMean = typeof expectedResp === "object" ? (expectedResp as Record<string, number>).mean : (expectedResp as number);
    return (
      <div className="flex items-center gap-4 text-xs">
        {respMean != null && <span className="text-muted-foreground">Ventas esperadas: {fmt(respMean)}</span>}
        {expectedRoas != null && (
          <span className={`inline-flex items-center gap-1 font-semibold ${expectedRoas >= 1 ? "text-emerald-600" : "text-amber-600"}`}>
            Retorno: {Number(expectedRoas).toFixed(2)}x
          </span>
        )}
      </div>
    );
  }
  return null;
}

export default function ResultsPage() {
  const { currentOrgId } = useAuthStore();
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const { data: scenarioList, isLoading } = useQuery({
    queryKey: ["scenarios", currentOrgId, selectedModel],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("scenarios")
        .select("*")
        .eq("model_id", selectedModel)
        .eq("org_id", currentOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrgId && !!selectedModel,
  });

  const deleteMut = useMutation({
    mutationFn: async (scenarioId: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("scenarios")
        .delete()
        .eq("id", scenarioId)
        .eq("org_id", currentOrgId!);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scenarios"] });
      toast.success("Escenario eliminado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  useEffect(() => {
    if (projectList?.length && !selectedProject) {
      setSelectedProject(projectList[0].id);
    }
  }, [projectList, selectedProject]);

  const readyModels = modelList?.filter((m) => m.status === "ready") || [];

  const grouped = (scenarioList || []).reduce<Record<string, typeof scenarioList>>((acc, s) => {
    const key = s.type || "historical";
    if (!acc[key]) acc[key] = [];
    acc[key]!.push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <SectionHeader
        icon={Bookmark}
        title="Mis Escenarios"
        description="Consulta y compara los escenarios de optimizacion que has guardado. Cada escenario captura una simulacion con sus parametros y resultados."
      />

      <div className="flex items-center gap-4">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Proyecto</Label>
          <Select value={selectedProject} onValueChange={(v) => { setSelectedProject(v); setSelectedModel(""); }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Seleccionar proyecto" />
            </SelectTrigger>
            <SelectContent>
              {projectList?.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Analisis</Label>
          <Select value={selectedModel} onValueChange={setSelectedModel} disabled={!readyModels.length}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder={readyModels.length ? "Seleccionar analisis" : "Sin analisis listos"} />
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
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Bookmark className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold">Selecciona un analisis</h3>
            <p className="text-sm text-muted-foreground mt-2 text-center max-w-md">
              Elige un modelo entrenado para ver los escenarios guardados
            </p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : !scenarioList?.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Sparkles className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold">Sin escenarios guardados</h3>
            <p className="text-sm text-muted-foreground mt-2 text-center max-w-md">
              Ejecuta una optimizacion y guarda los resultados para verlos aqui.
            </p>
            <Button asChild className="mt-4 gap-2">
              <Link href={`/optimization?model=${selectedModel}`}>
                <TrendingUp className="h-4 w-4" />
                Ir a Planificar Presupuesto
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([type, items]) => (
            <div key={type} className="space-y-3">
              <div className="flex items-center gap-2">
                {typeIcons[type]}
                <h3 className="text-sm font-semibold">{typeLabels[type] || type}</h3>
                <Badge variant="secondary" className="text-[10px]">{items!.length}</Badge>
              </div>
              {items!.map((s) => (
                <Card key={s.id} className={`transition-colors ${expandedId === s.id ? "ring-1 ring-primary/20" : ""}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div
                        className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                        onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                      >
                        <div className={`flex items-center justify-center h-8 w-8 rounded-lg shrink-0 ${typeBg[s.type] || "bg-muted"}`}>
                          {expandedId === s.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{s.name}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(s.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                            <ScenarioSummary type={s.type} results={(s.results || {}) as Record<string, unknown>} />
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={() => {
                          if (confirm("¿Eliminar este escenario?")) {
                            deleteMut.mutate(s.id);
                          }
                        }}
                        disabled={deleteMut.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                    {expandedId === s.id && (
                      <div className="mt-4 border-t pt-4 space-y-3">
                        <div>
                          <h4 className="text-xs font-medium text-muted-foreground mb-1">Parametros de entrada</h4>
                          <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-32">
                            {JSON.stringify(s.input_params, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <h4 className="text-xs font-medium text-muted-foreground mb-1">Resultados</h4>
                          <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-64">
                            {JSON.stringify(s.results, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
