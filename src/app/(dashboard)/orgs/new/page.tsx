"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Building2, Loader2 } from "lucide-react";

export default function NewOrgPage() {
  const router = useRouter();
  const { fetchUser, setCurrentOrg } = useAuthStore();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const createMut = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const finalSlug = (slug || name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""));

      const { error } = await supabase
        .from("organizations")
        .insert({ name, slug: finalSlug, created_by: user.id });

      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      // Trigger auto-created the membership; refresh user to pick up the new org
      await fetchUser();
      const { user: updatedUser } = useAuthStore.getState();
      if (updatedUser?.organizations?.[0]?.id) {
        setCurrentOrg(updatedUser.organizations[updatedUser.organizations.length - 1].id);
      }
      toast.success("Organization created");
      router.push("/dashboard");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleNameChange(value: string) {
    setName(value);
    setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""));
  }

  return (
    <div className="max-w-md mx-auto mt-12">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground mb-2">
            <Building2 className="h-6 w-6" />
          </div>
          <CardTitle>Create Organization</CardTitle>
          <CardDescription>
            An organization is your team workspace. You can invite members later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMut.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Acme Marketing"
                required
                minLength={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-slug">URL Slug</Label>
              <Input
                id="org-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="acme-marketing"
                pattern="[a-z0-9-]+"
              />
              <p className="text-xs text-muted-foreground">
                Lowercase letters, numbers, and hyphens only
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={createMut.isPending}>
              {createMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Organization
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
