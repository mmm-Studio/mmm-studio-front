"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { createClient } from "@/lib/supabase/client";
import { datasets } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { SectionHeader, InfoTooltip } from "@/components/marketing";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Database,
  Upload,
  Loader2,
  FileSpreadsheet,
  Calendar,
  Hash,
  Columns3,
  Globe,
  ChevronDown,
  ChevronUp,
  Eye,
  ArrowDownToLine,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";

interface MmmDataSummary {
  country: string;
  rows: number;
  min_date: string;
  max_date: string;
  columns: string[];
  spend_columns: string[];
  control_columns: string[];
}

interface MmmDataRow {
  date_week: string;
  country: string;
  year: number;
  month: number;
  spend_Display: number;
  spend_Social: number;
  spend_SEM: number;
  spend_TikTok: string;
  black_friday: string;
  christmas: string;
  summer_sale: string;
  sales: number;
}

const countryLabels: Record<string, string> = {
  ES: "Espana",
  FR: "Francia",
  IT: "Italia",
};

export default function DatasetsPage() {
  const { currentOrgId } = useAuthStore();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [viewProject, setViewProject] = useState<string>("");
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("preloaded");
  const [previewCountry, setPreviewCountry] = useState<string | null>(null);
  const [importCountry, setImportCountry] = useState<string | null>(null);
  const [importProject, setImportProject] = useState<string>("");
  const [newProjectName, setNewProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const router = useRouter();

  // Quick project creation
  async function handleCreateProject() {
    if (!newProjectName.trim() || !currentOrgId) return;
    setCreatingProject(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("projects")
        .insert({ org_id: currentOrgId, name: newProjectName.trim() })
        .select()
        .single();
      if (error) throw new Error(error.message);
      queryClient.invalidateQueries({ queryKey: ["projects", currentOrgId] });
      toast.success("Proyecto creado");
      setNewProjectName("");
      // Auto-select the new project
      if (data?.id) {
        setImportProject(data.id);
        setSelectedProject(data.id);
        setViewProject(data.id);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al crear proyecto");
    } finally {
      setCreatingProject(false);
    }
  }

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

  const { data: datasetList, isLoading } = useQuery({
    queryKey: ["datasets", currentOrgId, viewProject],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("datasets")
        .select("*")
        .eq("org_id", currentOrgId!)
        .eq("project_id", viewProject)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrgId && !!viewProject,
  });

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !selectedProject || !currentOrgId) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", name);
      formData.append("project_id", selectedProject);

      await datasets.upload(currentOrgId, formData);
      toast.success("Datos subidos y validados correctamente");
      queryClient.invalidateQueries({ queryKey: ["datasets"] });
      setOpen(false);
      setName("");
      setFile(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al subir datos";
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }

  const { data: mmmSummary, isLoading: mmmLoading } = useQuery({
    queryKey: ["mmm-data-summary"],
    queryFn: async (): Promise<MmmDataSummary[]> => {
      const supabase = createClient();
      const countries = ["ES", "FR", "IT"];
      const summaries: MmmDataSummary[] = [];
      for (const country of countries) {
        const { count } = await supabase
          .from("mmm_data")
          .select("*", { count: "exact", head: true })
          .eq("country", country);
        const { data: minMax } = await supabase
          .from("mmm_data")
          .select("date_week")
          .eq("country", country)
          .order("date_week", { ascending: true })
          .limit(1);
        const { data: maxDate } = await supabase
          .from("mmm_data")
          .select("date_week")
          .eq("country", country)
          .order("date_week", { ascending: false })
          .limit(1);
        summaries.push({
          country,
          rows: count || 0,
          min_date: minMax?.[0]?.date_week || "",
          max_date: maxDate?.[0]?.date_week || "",
          columns: ["date_week", "country", "year", "month", "spend_Display", "spend_Social", "spend_SEM", "spend_TikTok", "black_friday", "christmas", "summer_sale", "sales"],
          spend_columns: ["spend_Display", "spend_Social", "spend_SEM", "spend_TikTok"],
          control_columns: ["black_friday", "christmas", "summer_sale"],
        });
      }
      return summaries;
    },
  });

  const { data: previewData, isLoading: previewLoading } = useQuery({
    queryKey: ["mmm-data-preview", previewCountry],
    queryFn: async (): Promise<MmmDataRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("mmm_data")
        .select("*")
        .eq("country", previewCountry!)
        .order("date_week", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data as MmmDataRow[]) || [];
    },
    enabled: !!previewCountry,
  });

  const importMut = useMutation({
    mutationFn: async ({ country, projectId }: { country: string; projectId: string }) => {
      const supabase = createClient();
      const summary = mmmSummary?.find((s) => s.country === country);
      if (!summary) throw new Error("Datos del pais no encontrados");

      const { error } = await supabase.from("datasets").insert({
        org_id: currentOrgId!,
        project_id: projectId,
        name: `Datos Marketing - ${countryLabels[country] || country}`,
        file_path: `mmm_data:${country}`,
        status: "validated",
        row_count: summary.rows,
        column_names: summary.columns,
        spend_columns: summary.spend_columns,
        control_columns: summary.control_columns,
        date_column: "date_week",
        target_column: "sales",
        countries: [country],
        date_range: { min: summary.min_date, max: summary.max_date },
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["datasets"] });
      toast.success("Datos importados correctamente. Ya puedes lanzar un analisis.");
      setImportCountry(null);
      setImportProject("");
      setActiveTab("uploaded");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  useEffect(() => {
    if (projectList?.length && !viewProject) {
      setViewProject(projectList[0].id);
    }
  }, [projectList, viewProject]);

  return (
    <div className="space-y-8">
      <SectionHeader
        icon={Database}
        title="Mis Datos"
        description="Aqui gestionas tus datos de inversion publicitaria y ventas. Sube un CSV con tus datos semanales o usa los datos de ejemplo para empezar."
      >
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Upload className="h-4 w-4" />
              Subir datos
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Subir datos de inversion</DialogTitle>
              <DialogDescription>
                Sube un archivo CSV con tus datos semanales de gasto publicitario y ventas.
                Lo validaremos automaticamente.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="space-y-2">
                <Label>Proyecto</Label>
                {projectList && projectList.length > 0 ? (
                  <Select value={selectedProject} onValueChange={setSelectedProject}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar proyecto" />
                    </SelectTrigger>
                    <SelectContent>
                      {projectList.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Ej: Marketing Espana 2024"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      className="flex-1"
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleCreateProject())}
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={!newProjectName.trim() || creatingProject}
                      onClick={handleCreateProject}
                    >
                      {creatingProject ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear"}
                    </Button>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="dataset-name">Nombre del conjunto de datos</Label>
                <Input
                  id="dataset-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Datos Marketing Espana 2024"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="csv-file">Archivo CSV</Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Max 10MB. Debe contener una columna de fecha, una de ventas y columnas de gasto por canal.
                </p>
              </div>

              {/* Requirements hint */}
              <div className="rounded-lg bg-muted/50 border border-border/50 p-3 space-y-2">
                <p className="text-xs font-medium text-foreground">Tu archivo debe incluir:</p>
                <ul className="text-xs text-muted-foreground space-y-1.5">
                  <li className="flex items-start gap-2">
                    <Calendar className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
                    <span>Columna de fecha (semanal), ej: <code className="text-[10px] bg-muted px-1 rounded">date_week</code></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Hash className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
                    <span>Columna de ventas o KPI objetivo, ej: <code className="text-[10px] bg-muted px-1 rounded">sales</code></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Columns3 className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
                    <span>Columnas de gasto por canal con prefijo <code className="text-[10px] bg-muted px-1 rounded">spend_</code></span>
                  </li>
                </ul>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={uploading || !selectedProject || !file}
              >
                {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Subir y validar
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </SectionHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="preloaded" className="gap-2">
            <Sparkles className="h-3.5 w-3.5" />
            Datos de ejemplo
          </TabsTrigger>
          <TabsTrigger value="uploaded" className="gap-2">
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Mis archivos
          </TabsTrigger>
        </TabsList>

        {/* ── Pre-loaded data ──────────────────────────────────────────── */}
        <TabsContent value="preloaded" className="mt-6 space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 px-5 py-4">
            <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Datos de ejemplo listos para usar
              </p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Estos datos de marketing por pais ya estan cargados en la plataforma.
                Puedes usarlos para probar el analisis sin necesidad de subir nada.
              </p>
            </div>
          </div>

          {mmmLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-52" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(mmmSummary || []).map((summary) => (
                  <div
                    key={summary.country}
                    className={`rounded-xl border bg-card p-5 space-y-4 transition-all cursor-pointer ${
                      previewCountry === summary.country
                        ? "border-primary shadow-sm"
                        : "hover:border-primary/40 hover:shadow-sm"
                    }`}
                    onClick={() =>
                      setPreviewCountry(
                        previewCountry === summary.country ? null : summary.country
                      )
                    }
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Globe className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold">
                            {countryLabels[summary.country] || summary.country}
                          </h3>
                          <p className="text-[11px] text-muted-foreground">
                            {summary.rows.toLocaleString("es-ES")} semanas de datos
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {summary.country}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {new Date(summary.min_date).toLocaleDateString("es-ES", { month: "short", year: "numeric" })}
                        {" — "}
                        {new Date(summary.max_date).toLocaleDateString("es-ES", { month: "short", year: "numeric" })}
                      </span>
                    </div>

                    <div>
                      <p className="text-[11px] text-muted-foreground mb-1.5 flex items-center gap-1">
                        Canales de inversion
                        <InfoTooltip content="Columnas que representan el gasto semanal en cada canal publicitario" />
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {summary.spend_columns.map((col) => (
                          <span
                            key={col}
                            className="inline-flex items-center rounded-md bg-primary/8 px-2 py-0.5 text-[11px] font-medium text-primary"
                          >
                            {col.replace("spend_", "")}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] text-muted-foreground mb-1.5 flex items-center gap-1">
                        Eventos
                        <InfoTooltip content="Eventos especiales que pueden afectar las ventas, como rebajas o festivos" />
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {summary.control_columns.map((col) => (
                          <span
                            key={col}
                            className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                          >
                            {col.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1.5 h-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          setImportCountry(summary.country);
                          if (projectList?.length) setImportProject(projectList[0].id);
                        }}
                      >
                        <ArrowDownToLine className="h-3 w-3" />
                        Usar estos datos
                      </Button>
                      <Button variant="ghost" size="sm" className="text-xs gap-1 h-8">
                        <Eye className="h-3 w-3" />
                        {previewCountry === summary.country ? "Ocultar" : "Vista previa"}
                        {previewCountry === summary.country ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Import dialog */}
              <Dialog open={!!importCountry} onOpenChange={(v) => { if (!v) setImportCountry(null); }}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Importar datos de ejemplo</DialogTitle>
                    <DialogDescription>
                      Importar datos de{" "}
                      {importCountry ? countryLabels[importCountry] || importCountry : ""}{" "}
                      a un proyecto para poder lanzar un analisis.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Proyecto destino</Label>
                      {projectList && projectList.length > 0 ? (
                        <Select value={importProject} onValueChange={setImportProject}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar proyecto" />
                          </SelectTrigger>
                          <SelectContent>
                            {projectList.map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 dark:bg-amber-950/30 dark:border-amber-800">
                            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-800 dark:text-amber-200">
                              Necesitas un proyecto para organizar tus datos. Crea uno rapido:
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Ej: Marketing Espana 2024"
                              value={newProjectName}
                              onChange={(e) => setNewProjectName(e.target.value)}
                              className="flex-1"
                              onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                            />
                            <Button
                              size="sm"
                              disabled={!newProjectName.trim() || creatingProject}
                              onClick={handleCreateProject}
                            >
                              {creatingProject ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                    <Button
                      className="w-full gap-2"
                      disabled={!importProject || !importCountry || importMut.isPending}
                      onClick={() => importMut.mutate({ country: importCountry!, projectId: importProject })}
                    >
                      {importMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                      <ArrowDownToLine className="h-4 w-4" />
                      Importar datos
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Data preview */}
              {previewCountry && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Vista previa — {countryLabels[previewCountry] || previewCountry}
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        Ultimas 20 semanas
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {previewLoading ? (
                      <Skeleton className="h-64 w-full" />
                    ) : previewData && previewData.length > 0 ? (
                      <div className="rounded-lg border overflow-auto max-h-96">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Semana</TableHead>
                              <TableHead className="text-xs">Display</TableHead>
                              <TableHead className="text-xs">Social</TableHead>
                              <TableHead className="text-xs">SEM</TableHead>
                              <TableHead className="text-xs">TikTok</TableHead>
                              <TableHead className="text-xs font-semibold">Ventas</TableHead>
                              <TableHead className="text-xs">Black Friday</TableHead>
                              <TableHead className="text-xs">Navidad</TableHead>
                              <TableHead className="text-xs">Rebajas</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {previewData.map((row, i) => (
                              <TableRow key={i}>
                                <TableCell className="font-mono text-xs">
                                  {new Date(row.date_week).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "2-digit" })}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {Number(row.spend_Display).toLocaleString("es-ES", { maximumFractionDigits: 0 })}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {Number(row.spend_Social).toLocaleString("es-ES", { maximumFractionDigits: 0 })}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {Number(row.spend_SEM).toLocaleString("es-ES", { maximumFractionDigits: 0 })}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {row.spend_TikTok || "—"}
                                </TableCell>
                                <TableCell className="text-xs font-semibold text-foreground">
                                  {Number(row.sales).toLocaleString("es-ES", { maximumFractionDigits: 0 })}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {row.black_friday === "1" ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                  ) : (
                                    <span className="text-muted-foreground/40">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {row.christmas === "1" ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                  ) : (
                                    <span className="text-muted-foreground/40">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {row.summer_sale === "1" ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                  ) : (
                                    <span className="text-muted-foreground/40">—</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Sin datos disponibles</p>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ── Uploaded datasets ────────────────────────────────────────── */}
        <TabsContent value="uploaded" className="mt-6 space-y-4">
          {projectList && projectList.length > 0 && (
            <div className="flex items-center gap-3">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">Proyecto:</Label>
              <Select value={viewProject} onValueChange={setViewProject}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Seleccionar proyecto" />
                </SelectTrigger>
                <SelectContent>
                  {projectList.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!viewProject ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-muted-foreground/20 bg-muted/30 px-8 py-16 text-center">
              <Database className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold">Selecciona un proyecto</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                Crea un proyecto primero para poder organizar tus datos de marketing
              </p>
            </div>
          ) : isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          ) : !datasetList?.length ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-muted-foreground/20 bg-muted/30 px-8 py-16 text-center">
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold">Sin datos subidos</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm mb-4">
                Sube un CSV con tus datos de marketing o usa los datos de ejemplo para empezar
              </p>
              <Button onClick={() => setOpen(true)} className="gap-2">
                <Upload className="h-4 w-4" />
                Subir datos
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* CTA: guide to training */}
              <div className="flex items-start gap-4 rounded-xl border border-emerald-200 bg-emerald-50/80 px-5 py-4 dark:bg-emerald-950/30 dark:border-emerald-800">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                    Tus datos estan listos
                  </p>
                  <p className="text-xs text-emerald-700/70 dark:text-emerald-300/70 mt-0.5">
                    Ya puedes lanzar un analisis para descubrir que canales te funcionan mejor.
                  </p>
                </div>
                <Button asChild size="sm" className="shrink-0 gap-1.5">
                  <Link href="/models">
                    <Sparkles className="h-3.5 w-3.5" />
                    Lanzar analisis
                  </Link>
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {datasetList.map((ds) => (
                <Link key={ds.id} href={`/datasets/${ds.id}?project=${viewProject}`}>
                  <div className="rounded-xl border bg-card p-5 space-y-3 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer h-full">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <FileSpreadsheet className="h-4 w-4" />
                        </div>
                        <h3 className="text-sm font-semibold truncate">{ds.name}</h3>
                      </div>
                      <Badge
                        variant={ds.status === "validated" ? "outline" : "destructive"}
                        className={`text-[10px] shrink-0 ${
                          ds.status === "validated"
                            ? "border-emerald-200 text-emerald-700"
                            : ""
                        }`}
                      >
                        {ds.status === "validated" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                        {ds.status === "validated" ? "Validado" : ds.status}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Hash className="h-3 w-3" />
                        {ds.row_count?.toLocaleString("es-ES")} semanas
                      </span>
                      <span className="flex items-center gap-1">
                        <Columns3 className="h-3 w-3" />
                        {ds.column_names?.length} columnas
                      </span>
                    </div>

                    {ds.spend_columns && ds.spend_columns.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {ds.spend_columns.slice(0, 4).map((col: string) => (
                          <span
                            key={col}
                            className="inline-flex items-center rounded-md bg-primary/8 px-2 py-0.5 text-[11px] font-medium text-primary"
                          >
                            {col.replace("spend_", "")}
                          </span>
                        ))}
                        {ds.spend_columns.length > 4 && (
                          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                            +{ds.spend_columns.length - 4}
                          </span>
                        )}
                      </div>
                    )}

                    {ds.date_range && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(ds.date_range.min).toLocaleDateString("es-ES", { month: "short", year: "numeric" })}
                        {" — "}
                        {new Date(ds.date_range.max).toLocaleDateString("es-ES", { month: "short", year: "numeric" })}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
