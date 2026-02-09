"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { createClient } from "@/lib/supabase/client";
import { datasets, projects } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import Link from "next/link";
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

  const { data: projectList } = useQuery({
    queryKey: ["projects", currentOrgId],
    queryFn: () => projects.list(currentOrgId!),
    enabled: !!currentOrgId,
  });

  const { data: datasetList, isLoading } = useQuery({
    queryKey: ["datasets", currentOrgId, viewProject],
    queryFn: () => datasets.list(currentOrgId!, viewProject),
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

      await datasets.upload(currentOrgId, selectedProject, formData);
      toast.success("Dataset uploaded and validated");
      queryClient.invalidateQueries({ queryKey: ["datasets"] });
      setOpen(false);
      setName("");
      setFile(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload failed";
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }

  // Fetch pre-loaded mmm_data summary per country
  const { data: mmmSummary, isLoading: mmmLoading } = useQuery({
    queryKey: ["mmm-data-summary"],
    queryFn: async (): Promise<MmmDataSummary[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("get_mmm_data_summary").select();
      if (error) {
        // Fallback: query directly
        const { data: rawData, error: rawError } = await supabase
          .from("mmm_data")
          .select("country")
          .limit(1);
        if (rawError) throw rawError;

        // Get distinct countries and stats via separate queries
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
      }
      return data as MmmDataSummary[];
    },
  });

  // Fetch preview rows for a specific country
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

  // Auto-select first project for viewing
  if (projectList?.length && !viewProject) {
    setViewProject(projectList[0].id);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Datasets</h1>
          <p className="text-muted-foreground mt-1">
            Pre-loaded Supabase data and uploaded CSV files
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="mr-2 h-4 w-4" />
              Upload Dataset
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Dataset</DialogTitle>
              <DialogDescription>
                Upload a CSV file with your marketing spend and KPI data.
                The file will be validated for MMM compatibility.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="space-y-2">
                <Label>Project</Label>
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectList?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dataset-name">Dataset Name</Label>
                <Input
                  id="dataset-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. US Marketing Data 2024"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="csv-file">CSV File</Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Max 10MB. Must contain a date column, target column, and spend columns.
                </p>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={uploading || !selectedProject || !file}
              >
                {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Upload & Validate
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="preloaded">
            <Database className="mr-2 h-4 w-4" />
            Pre-loaded Data
          </TabsTrigger>
          <TabsTrigger value="uploaded">
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Uploaded Datasets
          </TabsTrigger>
        </TabsList>

        {/* ========== PRE-LOADED DATA TAB ========== */}
        <TabsContent value="preloaded" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Supabase Pre-loaded Data
              </CardTitle>
              <CardDescription>
                Marketing data already stored in the <code className="text-xs bg-muted px-1 py-0.5 rounded">mmm_data</code> table.
                Available for training models directly.
              </CardDescription>
            </CardHeader>
          </Card>

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
                  <Card
                    key={summary.country}
                    className={`transition-colors cursor-pointer ${
                      previewCountry === summary.country
                        ? "border-primary"
                        : "hover:border-primary/50"
                    }`}
                    onClick={() =>
                      setPreviewCountry(
                        previewCountry === summary.country ? null : summary.country
                      )
                    }
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Globe className="h-4 w-4 text-primary" />
                          {summary.country === "ES"
                            ? "Spain"
                            : summary.country === "FR"
                            ? "France"
                            : summary.country === "IT"
                            ? "Italy"
                            : summary.country}
                        </CardTitle>
                        <Badge variant="outline" className="text-xs">
                          {summary.country}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Hash className="h-3 w-3" />
                          {summary.rows.toLocaleString()} rows
                        </span>
                        <span className="flex items-center gap-1">
                          <Columns3 className="h-3 w-3" />
                          {summary.columns.length} cols
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {summary.min_date} — {summary.max_date}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Spend channels</p>
                        <div className="flex flex-wrap gap-1">
                          {summary.spend_columns.map((col) => (
                            <Badge key={col} variant="secondary" className="text-xs">
                              {col.replace("spend_", "")}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Controls</p>
                        <div className="flex flex-wrap gap-1">
                          {summary.control_columns.map((col) => (
                            <Badge key={col} variant="outline" className="text-xs">
                              {col}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center justify-end">
                        <Button variant="ghost" size="sm" className="text-xs gap-1">
                          <Eye className="h-3 w-3" />
                          {previewCountry === summary.country ? "Hide" : "Preview"}
                          {previewCountry === summary.country ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Data preview table */}
              {previewCountry && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Data Preview — {previewCountry}
                      <Badge variant="outline" className="ml-2 text-xs">
                        Latest 20 rows
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {previewLoading ? (
                      <Skeleton className="h-64 w-full" />
                    ) : previewData && previewData.length > 0 ? (
                      <div className="rounded-md border overflow-auto max-h-96">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Display</TableHead>
                              <TableHead>Social</TableHead>
                              <TableHead>SEM</TableHead>
                              <TableHead>TikTok</TableHead>
                              <TableHead>Sales</TableHead>
                              <TableHead>BF</TableHead>
                              <TableHead>Xmas</TableHead>
                              <TableHead>Summer</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {previewData.map((row, i) => (
                              <TableRow key={i}>
                                <TableCell className="font-mono text-xs">
                                  {row.date_week}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {Number(row.spend_Display).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {Number(row.spend_Social).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {Number(row.spend_SEM).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {row.spend_TikTok || "\u2014"}
                                </TableCell>
                                <TableCell className="text-xs font-medium">
                                  {Number(row.sales).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {row.black_friday === "1" ? "\u2713" : "\u2014"}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {row.christmas === "1" ? "\u2713" : "\u2014"}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {row.summer_sale === "1" ? "\u2713" : "\u2014"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No data available</p>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ========== UPLOADED DATASETS TAB ========== */}
        <TabsContent value="uploaded" className="mt-4 space-y-4">
          {/* Project filter */}
          {projectList && projectList.length > 0 && (
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">Filter by project:</Label>
              <Select value={viewProject} onValueChange={setViewProject}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select project" />
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

          {/* Dataset list */}
          {!viewProject ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Database className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">Select a project</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Create a project first, then upload your datasets
                </p>
              </CardContent>
            </Card>
          ) : isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          ) : !datasetList?.length ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileSpreadsheet className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">No uploaded datasets</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Upload a CSV or use the pre-loaded data to get started
                </p>
                <Button onClick={() => setOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Dataset
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {datasetList.map((ds) => (
                <Link key={ds.id} href={`/datasets/${ds.id}?project=${viewProject}`}>
                  <Card className="hover:border-primary/50 transition-colors h-full cursor-pointer">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4 text-primary" />
                          {ds.name}
                        </CardTitle>
                        <Badge
                          variant={ds.status === "validated" ? "outline" : "destructive"}
                          className="text-xs"
                        >
                          {ds.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Hash className="h-3 w-3" />
                          {ds.row_count?.toLocaleString()} rows
                        </span>
                        <span className="flex items-center gap-1">
                          <Columns3 className="h-3 w-3" />
                          {ds.column_names?.length} cols
                        </span>
                      </div>
                      {ds.spend_columns && ds.spend_columns.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {ds.spend_columns.slice(0, 4).map((col) => (
                            <Badge key={col} variant="secondary" className="text-xs">
                              {col.replace("spend_", "")}
                            </Badge>
                          ))}
                          {ds.spend_columns.length > 4 && (
                            <Badge variant="secondary" className="text-xs">
                              +{ds.spend_columns.length - 4}
                            </Badge>
                          )}
                        </div>
                      )}
                      {ds.date_range && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {ds.date_range.min} \u2014 {ds.date_range.max}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
