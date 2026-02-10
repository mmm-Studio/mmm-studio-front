"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { createClient } from "@/lib/supabase/client";
import { jobs, type TrainJobInput } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import {
  Cpu,
  Plus,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  PlayCircle,
  StopCircle,
} from "lucide-react";

function JobStatusBadge({ status }: { status: string }) {
  const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode; className?: string }> = {
    queued: { variant: "secondary", icon: <Clock className="h-3 w-3" /> },
    running: { variant: "default", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    completed: { variant: "outline", icon: <CheckCircle2 className="h-3 w-3 text-green-500" />, className: "border-green-200 text-green-700" },
    failed: { variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
    cancelled: { variant: "secondary", icon: <StopCircle className="h-3 w-3" /> },
  };
  const c = config[status] || config.queued;
  return (
    <Badge variant={c.variant} className={`gap-1 ${c.className || ""}`}>
      {c.icon}
      {status}
    </Badge>
  );
}

export default function JobsPage() {
  const { currentOrgId } = useAuthStore();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedDataset, setSelectedDataset] = useState("");
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

  const { data: datasetList } = useQuery({
    queryKey: ["datasets", currentOrgId, selectedProject],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("datasets")
        .select("*")
        .eq("org_id", currentOrgId!)
        .eq("project_id", selectedProject)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrgId && !!selectedProject,
  });

  const { data: jobList, isLoading } = useQuery({
    queryKey: ["jobs", currentOrgId],
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
    refetchInterval: (query) => {
      const data = query.state.data as { status: string }[] | undefined;
      const hasActive = data?.some((j) => j.status === "queued" || j.status === "running");
      return hasActive ? 5000 : false;
    },
    refetchIntervalInBackground: true,
  });

  const trainMutation = useMutation({
    mutationFn: () => {
      const ds = datasetList?.find((d) => d.id === selectedDataset);
      if (!ds) throw new Error("Dataset not found");

      const input: TrainJobInput = {
        dataset_id: selectedDataset,
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
      return jobs.train(currentOrgId!, selectedProject, input);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast.success(`Training job started: ${data.job_id.slice(0, 8)}`);
      setOpen(false);
      setModelName("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: (jobId: string) => jobs.cancel(currentOrgId!, jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast.success("Job cancelled");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Training Jobs</h1>
          <p className="text-muted-foreground mt-1">
            Launch and monitor model training
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Training Job
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Start Training Job</DialogTitle>
              <DialogDescription>
                Select a dataset and configure training parameters.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                trainMutation.mutate();
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Project</Label>
                <Select value={selectedProject} onValueChange={(v) => { setSelectedProject(v); setSelectedDataset(""); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectList?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Dataset</Label>
                <Select value={selectedDataset} onValueChange={setSelectedDataset} disabled={!selectedProject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select dataset" />
                  </SelectTrigger>
                  <SelectContent>
                    {datasetList?.filter((d) => d.status === "validated").map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name} ({d.row_count} rows)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="model-name">Model Name</Label>
                <Input
                  id="model-name"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder="e.g. US_2024_v1"
                  required
                  minLength={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="draws">Draws</Label>
                  <Input
                    id="draws"
                    type="number"
                    value={draws}
                    onChange={(e) => setDraws(Number(e.target.value))}
                    min={100}
                    max={2000}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tune">Tune</Label>
                  <Input
                    id="tune"
                    type="number"
                    value={tune}
                    onChange={(e) => setTune(Number(e.target.value))}
                    min={100}
                    max={2000}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chains">Chains</Label>
                  <Input
                    id="chains"
                    type="number"
                    value={chains}
                    onChange={(e) => setChains(Number(e.target.value))}
                    min={1}
                    max={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="test-weeks">Test Weeks</Label>
                  <Input
                    id="test-weeks"
                    type="number"
                    value={testWeeks}
                    onChange={(e) => setTestWeeks(Number(e.target.value))}
                    min={0}
                    max={52}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={trainMutation.isPending || !selectedDataset}
              >
                {trainMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <PlayCircle className="mr-2 h-4 w-4" />
                Start Training
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Job list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : !jobList?.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Cpu className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">No training jobs yet</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Upload a dataset and start your first training
            </p>
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Training Job
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {jobList.map((job) => (
            <Card key={job.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-3">
                    <Cpu className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium text-sm truncate">
                      {job.models?.name || job.id.slice(0, 8)}
                    </span>
                    <JobStatusBadge status={job.status} />
                  </div>
                  {job.message && (
                    <p className="text-xs text-muted-foreground ml-7 truncate">
                      {job.message}
                    </p>
                  )}
                  {job.error && (
                    <p className="text-xs text-destructive ml-7 truncate">
                      {job.error}
                    </p>
                  )}
                  {(job.status === "running" || job.status === "queued") && (
                    <div className="ml-7 mt-2">
                      <Progress value={job.progress} className="h-2 w-64" />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(job.created_at).toLocaleString()}
                  </span>
                  {(job.status === "running" || job.status === "queued") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => cancelMutation.mutate(job.id)}
                      disabled={cancelMutation.isPending}
                    >
                      <StopCircle className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                  {job.status === "completed" && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={`/models/${job.model_id}`}>View Model</a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
