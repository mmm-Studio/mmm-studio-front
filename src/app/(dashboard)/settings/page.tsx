"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import { Settings, Users, Loader2, UserPlus, Trash2, Building2 } from "lucide-react";

export default function SettingsPage() {
  const { user, currentOrgId, fetchUser } = useAuthStore();
  const queryClient = useQueryClient();

  const [orgName, setOrgName] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");

  const currentOrg = user?.organizations.find((o) => o.id === currentOrgId);
  const isAdmin = currentOrg?.role === "owner" || currentOrg?.role === "admin";

  const { data: orgDetail } = useQuery({
    queryKey: ["org", currentOrgId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", currentOrgId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrgId,
  });

  const { data: memberList, isLoading: membersLoading } = useQuery({
    queryKey: ["members", currentOrgId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("memberships")
        .select("id, user_id, role, created_at")
        .eq("org_id", currentOrgId!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrgId,
  });

  const updateOrgMut = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from("organizations")
        .update({ name: orgName })
        .eq("id", currentOrgId!);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org", currentOrgId] });
      fetchUser();
      toast.success("Organization updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const inviteMut = useMutation({
    mutationFn: async () => {
      // Note: invite requires looking up user by email which needs admin privileges
      // For now this will use the backend API when available
      throw new Error("Invite requires backend API - coming soon");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members", currentOrgId] });
      toast.success(`Invited ${inviteEmail}`);
      setInviteOpen(false);
      setInviteEmail("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMut = useMutation({
    mutationFn: async (userId: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("memberships")
        .delete()
        .eq("org_id", currentOrgId!)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members", currentOrgId] });
      toast.success("Member removed");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Initialize org name
  if (orgDetail && !orgName) {
    setOrgName(orgDetail.name);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your organization and team
        </p>
      </div>

      {/* Organization settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Organization
          </CardTitle>
          <CardDescription>
            Your organization details. Role: <Badge variant="outline">{currentOrg?.role}</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Organization Name</Label>
            <div className="flex gap-2">
              <Input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                disabled={!isAdmin}
              />
              {isAdmin && (
                <Button
                  onClick={() => updateOrgMut.mutate()}
                  disabled={updateOrgMut.isPending || orgName === orgDetail?.name}
                >
                  {updateOrgMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Organization ID</Label>
            <Input value={currentOrgId || ""} disabled className="font-mono text-xs" />
          </div>
        </CardContent>
      </Card>

      {/* Team members */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Members
              </CardTitle>
              <CardDescription>
                {memberList?.length || 0} member{(memberList?.length || 0) !== 1 ? "s" : ""}
              </CardDescription>
            </div>
            {isAdmin && (
              <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Invite
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Invite Member</DialogTitle>
                    <DialogDescription>
                      The user must already have a MMM Studio account.
                    </DialogDescription>
                  </DialogHeader>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      inviteMut.mutate();
                    }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="user@company.com"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select value={inviteRole} onValueChange={setInviteRole}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" className="w-full" disabled={inviteMut.isPending}>
                      {inviteMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Send Invite
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <div className="space-y-2">
              {memberList?.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                      {m.user_id.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-mono text-muted-foreground">
                        {m.user_id.slice(0, 8)}...
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{m.role}</Badge>
                    {isAdmin && m.user_id !== user?.user_id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMut.mutate(m.user_id)}
                        disabled={removeMut.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email || ""} disabled />
          </div>
          <div className="space-y-2">
            <Label>User ID</Label>
            <Input value={user?.user_id || ""} disabled className="font-mono text-xs" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
