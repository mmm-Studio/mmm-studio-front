"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { projects, jobs, models as modelsApi, datasets } from "@/lib/api";
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
} from "lucide-react";

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  loading,
}: {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  loading?: boolean;
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
    queryFn: () => projects.list(currentOrgId!),
    enabled: !!currentOrgId,
  });

  const { data: jobList, isLoading: jobsLoading } = useQuery({
    queryKey: ["jobs", currentOrgId],
    queryFn: () => jobs.list(currentOrgId!),
    enabled: !!currentOrgId,
  });

  const recentJobs = jobList?.slice(0, 5) || [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overview of your marketing mix modeling workspace
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Projects"
          value={projectList?.length ?? 0}
          icon={FolderKanban}
          loading={projectsLoading}
        />
        <StatCard
          title="Training Jobs"
          value={jobList?.length ?? 0}
          icon={Cpu}
          loading={jobsLoading}
        />
        <StatCard
          title="Active Jobs"
          value={jobList?.filter((j) => j.status === "running" || j.status === "queued").length ?? 0}
          icon={Loader2}
          loading={jobsLoading}
        />
        <StatCard
          title="Completed Models"
          value={jobList?.filter((j) => j.status === "completed").length ?? 0}
          icon={BarChart3}
          loading={jobsLoading}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/projects">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FolderKanban className="h-5 w-5 text-primary" />
                Create Project
              </CardTitle>
              <CardDescription>
                Organize your datasets and models into projects
              </CardDescription>
            </CardHeader>
          </Link>
        </Card>
        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/datasets">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Upload Dataset
              </CardTitle>
              <CardDescription>
                Upload a CSV with your marketing spend and KPI data
              </CardDescription>
            </CardHeader>
          </Link>
        </Card>
        <Card className="hover:border-primary/50 transition-colors">
          <Link href="/jobs">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Cpu className="h-5 w-5 text-primary" />
                Train Model
              </CardTitle>
              <CardDescription>
                Launch a new MMM training job from your datasets
              </CardDescription>
            </CardHeader>
          </Link>
        </Card>
      </div>

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
                      <span className="text-xs text-muted-foreground">
                        {job.progress}%
                      </span>
                    )}
                    <JobStatusBadge status={job.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
