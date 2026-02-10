"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  FolderKanban,
  Database,
  Cpu,
  BarChart3,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  TrendingUp,
  Layers,
  Zap,
  Target,
  Activity,
} from "lucide-react";

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  loading,
  trend,
}: {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  loading?: boolean;
  trend?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <p className="text-xs text-green-600 mt-1">{trend}</p>
        )}
      </CardContent>
    </Card>
  );
}

function JobStatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
    queued: { variant: "secondary", icon: <Clock className="h-3 w-3" /> },
    running: { variant: "default", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    completed: { variant: "outline", icon: <CheckCircle2 className="h-3 w-3 text-green-500" /> },
    failed: { variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
    cancelled: { variant: "secondary", icon: <XCircle className="h-3 w-3" /> },
  };

  const v = variants[status] || variants.queued;

  return (
    <Badge variant={v.variant} className="gap-1">
      {v.icon}
      {status}
    </Badge>
  );
}

export default function DashboardPage() {
  const { currentOrgId } = useAuthStore();

  const { data: projectList, isLoading: projectsLoading } = useQuery({
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

  const { data: datasetList, isLoading: datasetsLoading } = useQuery({
    queryKey: ["datasets-dashboard", currentOrgId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("datasets")
        .select("id, name, created_at")
        .eq("org_id", currentOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrgId,
  });

  const { data: modelList, isLoading: modelsLoading } = useQuery({
    queryKey: ["models-dashboard", currentOrgId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("models")
        .select("id, name, status, created_at, spend_columns, start_date, end_date")
        .eq("org_id", currentOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrgId,
  });

  const { data: jobList, isLoading: jobsLoading } = useQuery({
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
  });

  const { data: scenarioList } = useQuery({
    queryKey: ["scenarios-dashboard", currentOrgId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("scenarios")
        .select("id, name, type, created_at")
        .eq("org_id", currentOrgId!)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrgId,
  });

  const recentJobs = jobList?.slice(0, 5) || [];
  const readyModels = modelList?.filter(m => m.status === "ready") || [];
  const completedJobs = jobList?.filter(j => j.status === "completed") || [];
  const failedJobs = jobList?.filter(j => j.status === "failed") || [];
  const activeJobs = jobList?.filter(j => j.status === "running" || j.status === "queued") || [];
  const successRate = jobList && jobList.length > 0
    ? ((completedJobs.length / jobList.length) * 100).toFixed(0)
    : "—";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overview of your marketing mix modeling workspace
        </p>
      </div>

      {/* Stats - Enhanced 6-card grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <StatCard
          title="Projects"
          value={projectList?.length ?? 0}
          icon={FolderKanban}
          loading={projectsLoading}
        />
        <StatCard
          title="Datasets"
          value={datasetList?.length ?? 0}
          icon={Database}
          loading={datasetsLoading}
        />
        <StatCard
          title="Models"
          value={readyModels.length}
          icon={Layers}
          loading={modelsLoading}
          description={`${modelList?.length ?? 0} total`}
        />
        <StatCard
          title="Training Jobs"
          value={jobList?.length ?? 0}
          icon={Cpu}
          loading={jobsLoading}
          description={activeJobs.length > 0 ? `${activeJobs.length} active` : undefined}
        />
        <StatCard
          title="Success Rate"
          value={`${successRate}%`}
          icon={Target}
          loading={jobsLoading}
          description={`${completedJobs.length} completed, ${failedJobs.length} failed`}
        />
        <StatCard
          title="Scenarios Saved"
          value={scenarioList?.length ?? 0}
          icon={TrendingUp}
          loading={false}
        />
      </div>

      {/* Quick Insights */}
      {!jobsLoading && !modelsLoading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {activeJobs.length > 0 && (
            <div className="flex items-start gap-3 p-4 rounded-lg border bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200">
              <Activity className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="text-sm">
                <strong>{activeJobs.length} job(s) running</strong> — your models are being trained. Check the Jobs page for progress.
              </div>
            </div>
          )}
          {readyModels.length > 0 && (
            <div className="flex items-start gap-3 p-4 rounded-lg border bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="text-sm">
                <strong>{readyModels.length} model(s) ready</strong> — view detailed analysis or run optimizations on your trained models.
              </div>
            </div>
          )}
          {readyModels.length === 0 && (datasetList?.length ?? 0) > 0 && (
            <div className="flex items-start gap-3 p-4 rounded-lg border bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
              <Zap className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="text-sm">
                <strong>No ready models yet.</strong> You have datasets uploaded — head to Jobs to start training your first model.
              </div>
            </div>
          )}
          {(datasetList?.length ?? 0) === 0 && (
            <div className="flex items-start gap-3 p-4 rounded-lg border bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
              <Database className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="text-sm">
                <strong>Get started!</strong> Upload a CSV dataset with your marketing spend and sales data to begin.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:border-primary/50 transition-colors cursor-pointer">
          <Link href="/projects">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FolderKanban className="h-5 w-5 text-primary" />
                Create Project
              </CardTitle>
              <CardDescription>
                Organize your datasets and models
              </CardDescription>
            </CardHeader>
          </Link>
        </Card>
        <Card className="hover:border-primary/50 transition-colors cursor-pointer">
          <Link href="/datasets">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Upload Dataset
              </CardTitle>
              <CardDescription>
                CSV with marketing spend & KPI data
              </CardDescription>
            </CardHeader>
          </Link>
        </Card>
        <Card className="hover:border-primary/50 transition-colors cursor-pointer">
          <Link href="/jobs">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Cpu className="h-5 w-5 text-primary" />
                Train Model
              </CardTitle>
              <CardDescription>
                Launch a new MMM training job
              </CardDescription>
            </CardHeader>
          </Link>
        </Card>
        <Card className="hover:border-primary/50 transition-colors cursor-pointer">
          <Link href="/optimization">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Optimize Budget
              </CardTitle>
              <CardDescription>
                Run budget optimization scenarios
              </CardDescription>
            </CardHeader>
          </Link>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Jobs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Training Jobs</CardTitle>
              <CardDescription>Latest model training activity</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/jobs" className="gap-1">
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {jobsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : recentJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No training jobs yet. Upload a dataset and start training!
              </p>
            ) : (
              <div className="space-y-3">
                {recentJobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Cpu className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">
                          {job.models?.name || job.id.slice(0, 8)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(job.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {job.status === "running" && (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${job.progress || 0}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {job.progress}%
                          </span>
                        </div>
                      )}
                      <JobStatusBadge status={job.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ready Models */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Ready Models</CardTitle>
              <CardDescription>Models available for analysis & optimization</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/models" className="gap-1">
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {modelsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : readyModels.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No ready models yet. Train a model to see it here.
              </p>
            ) : (
              <div className="space-y-3">
                {readyModels.slice(0, 5).map((model) => (
                  <Link
                    key={model.id}
                    href={`/models/${model.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{model.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {model.spend_columns?.length || 0} channels
                          {model.start_date && ` · ${model.start_date} — ${model.end_date}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-green-200 text-green-700">Ready</Badge>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Scenarios */}
      {scenarioList && scenarioList.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Saved Scenarios</CardTitle>
              <CardDescription>Recent optimization scenarios you have saved</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/results" className="gap-1">
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {scenarioList.map((sc) => (
                <div key={sc.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{sc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(sc.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">{sc.type}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
