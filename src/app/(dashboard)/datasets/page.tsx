"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { datasets, projects } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "lucide-react";

export default function DatasetsPage() {
  const { currentOrgId } = useAuthStore();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [viewProject, setViewProject] = useState<string>("");
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

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
            Upload and manage your marketing data CSV files
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
            <h3 className="text-lg font-medium">No datasets yet</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Upload your first CSV to get started
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
    </div>
  );
}
