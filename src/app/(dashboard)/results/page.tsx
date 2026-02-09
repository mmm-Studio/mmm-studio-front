"use client";

import { useState } from "react";
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
import {
  LineChart,
  Trash2,
  Calendar,
  TrendingUp,
  DollarSign,
  GitCompare,
} from "lucide-react";

const typeIcons: Record<string, React.ReactNode> = {
  historical: <TrendingUp className="h-4 w-4" />,
  budget: <DollarSign className="h-4 w-4" />,
  comparison: <GitCompare className="h-4 w-4" />,
};

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
      toast.success("Scenario deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (projectList?.length && !selectedProject) {
    setSelectedProject(projectList[0].id);
  }

  const readyModels = modelList?.filter((m) => m.status === "ready") || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Saved Results</h1>
        <p className="text-muted-foreground mt-1">
          View and manage your saved optimization scenarios
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Project</Label>
          <Select value={selectedProject} onValueChange={(v) => { setSelectedProject(v); setSelectedModel(""); }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {projectList?.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Model</Label>
          <Select value={selectedModel} onValueChange={setSelectedModel} disabled={!readyModels.length}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder={readyModels.length ? "Select model" : "No ready models"} />
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
          <CardContent className="flex flex-col items-center justify-center py-12">
            <LineChart className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">Select a model</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Choose a model to view its saved scenarios
            </p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : !scenarioList?.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <LineChart className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">No saved scenarios</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Run an optimization and save the results to see them here
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {scenarioList.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div
                    className="flex items-center gap-3 cursor-pointer flex-1"
                    onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                  >
                    {typeIcons[s.type] || typeIcons.historical}
                    <div>
                      <p className="font-medium text-sm">{s.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="secondary" className="text-xs">{s.type}</Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(s.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMut.mutate(s.id)}
                    disabled={deleteMut.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
                {expandedId === s.id && (
                  <div className="mt-4 border-t pt-4 space-y-3">
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-1">Input Parameters</h4>
                      <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-32">
                        {JSON.stringify(s.input_params, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-1">Results</h4>
                      <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-64">
                        {JSON.stringify(s.results, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
