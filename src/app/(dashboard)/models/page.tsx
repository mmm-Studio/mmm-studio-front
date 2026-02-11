"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import {
  BarChart3,
  Calendar,
  HardDrive,
  Columns3,
} from "lucide-react";

function ModelStatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
    ready: { variant: "outline", className: "border-green-200 text-green-700" },
    training: { variant: "default" },
    pending: { variant: "secondary" },
    failed: { variant: "destructive" },
    deleted: { variant: "secondary" },
  };
  const m = map[status] || map.pending;
  return <Badge variant={m.variant} className={m.className}>{status}</Badge>;
}

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Models</h1>
        <p className="text-muted-foreground mt-1">
          View and manage your trained Marketing Mix Models
        </p>
      </div>

      {projectList && projectList.length > 0 && (
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">Project:</Label>
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select project" />
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
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">Select a project</h3>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : !modelList?.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">No models yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Train your first model from the Jobs page
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modelList.map((model) => (
            <Link key={model.id} href={`/models/${model.id}`}>
              <Card className="hover:border-primary/50 transition-colors h-full cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      {model.name}
                    </CardTitle>
                    <ModelStatusBadge status={model.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {model.spend_columns && (
                    <div className="flex flex-wrap gap-1">
                      {model.spend_columns.slice(0, 4).map((col: string) => (
                        <Badge key={col} variant="secondary" className="text-xs">
                          {col.replace("spend_", "")}
                        </Badge>
                      ))}
                      {model.spend_columns.length > 4 && (
                        <Badge variant="secondary" className="text-xs">
                          +{model.spend_columns.length - 4}
                        </Badge>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {model.start_date && model.end_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {model.start_date} \u2014 {model.end_date}
                      </span>
                    )}
                    {model.file_size_mb && (
                      <span className="flex items-center gap-1">
                        <HardDrive className="h-3 w-3" />
                        {model.file_size_mb.toFixed(1)}MB
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
