"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { createClient } from "@/lib/supabase/client";
import { analysis } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  BarChart3,
  Calendar,
  HardDrive,
  TrendingUp,
  ArrowLeft,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4",
];

export default function ModelDetailPage() {
  const params = useParams();
  const modelId = params.modelId as string;
  const { currentOrgId } = useAuthStore();

  const { data: model, isLoading: modelLoading } = useQuery({
    queryKey: ["model", currentOrgId, modelId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("models")
        .select("*, datasets(name, file_path)")
        .eq("id", modelId)
        .eq("org_id", currentOrgId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId && !!modelId,
  });

  const { data: roasData, isLoading: roasLoading } = useQuery({
    queryKey: ["roas", currentOrgId, modelId],
    queryFn: () => analysis.roas(currentOrgId!, modelId),
    enabled: !!currentOrgId && !!modelId && model?.status === "ready",
  });

  const { data: contribData, isLoading: contribLoading } = useQuery({
    queryKey: ["contributions", currentOrgId, modelId],
    queryFn: () => analysis.contributions(currentOrgId!, modelId),
    enabled: !!currentOrgId && !!modelId && model?.status === "ready",
  });

  const roasChartData = roasData
    ? Object.entries(roasData.roas_by_channel).map(([channel, value]) => ({
        channel: channel.replace("spend_", ""),
        roas: Number(value.toFixed(2)),
      }))
    : [];

  const contribChartData = contribData
    ? Object.entries(contribData.contribution_percentage).map(([channel, pct]) => ({
        name: channel.replace("spend_", ""),
        value: Number((pct * 100).toFixed(1)),
      }))
    : [];

  if (modelLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!model) {
    return <p className="text-muted-foreground">Model not found.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/models"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{model.name}</h1>
            <Badge
              variant={model.status === "ready" ? "outline" : "secondary"}
              className={model.status === "ready" ? "border-green-200 text-green-700" : ""}
            >
              {model.status}
            </Badge>
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
            {model.start_date && model.end_date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {model.start_date} \u2014 {model.end_date}
              </span>
            )}
            {model.file_size_mb && (
              <span className="flex items-center gap-1">
                <HardDrive className="h-3.5 w-3.5" />
                {model.file_size_mb.toFixed(1)}MB
              </span>
            )}
          </div>
        </div>
        <Button asChild>
          <Link href={`/optimization?model=${modelId}`}>
            <TrendingUp className="mr-2 h-4 w-4" />
            Optimize
          </Link>
        </Button>
      </div>

      {/* Channels */}
      {model.spend_columns && (
        <div className="flex flex-wrap gap-1.5">
          {model.spend_columns.map((col: string) => (
            <Badge key={col} variant="secondary">
              {col.replace("spend_", "")}
            </Badge>
          ))}
        </div>
      )}

      {/* Analysis Tabs */}
      {model.status === "ready" && (
        <Tabs defaultValue="roas">
          <TabsList>
            <TabsTrigger value="roas">ROAS</TabsTrigger>
            <TabsTrigger value="contributions">Contributions</TabsTrigger>
          </TabsList>

          <TabsContent value="roas" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Return on Ad Spend (ROAS)</CardTitle>
                <CardDescription>
                  Revenue generated per unit of spend for each channel
                </CardDescription>
              </CardHeader>
              <CardContent>
                {roasLoading ? (
                  <Skeleton className="h-80 w-full" />
                ) : roasChartData.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No ROAS data available
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={roasChartData} layout="vertical" margin={{ left: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="channel" type="category" width={80} tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value) => [Number(value).toFixed(2), "ROAS"]}
                        contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }}
                      />
                      <Bar dataKey="roas" fill="#6366f1" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contributions" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Channel Contributions</CardTitle>
                <CardDescription>
                  Share of total contribution by each marketing channel
                </CardDescription>
              </CardHeader>
              <CardContent>
                {contribLoading ? (
                  <Skeleton className="h-80 w-full" />
                ) : contribChartData.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No contribution data available
                  </p>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <ResponsiveContainer width="100%" height={400}>
                      <PieChart>
                        <Pie
                          data={contribChartData}
                          cx="50%"
                          cy="50%"
                          outerRadius={140}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}%`}
                          labelLine
                        >
                          {contribChartData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`${Number(value)}%`, "Contribution"]} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>

                    <div className="space-y-3">
                      {contribChartData
                        .sort((a, b) => b.value - a.value)
                        .map((item, i) => (
                          <div key={item.name} className="flex items-center gap-3">
                            <div
                              className="h-3 w-3 rounded-full shrink-0"
                              style={{ backgroundColor: COLORS[i % COLORS.length] }}
                            />
                            <span className="text-sm flex-1">{item.name}</span>
                            <span className="text-sm font-medium">{item.value}%</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
