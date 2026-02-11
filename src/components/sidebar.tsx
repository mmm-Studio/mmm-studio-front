"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import {
  BarChart3,
  Database,
  Settings,
  LogOut,
  ChevronDown,
  TrendingUp,
  LayoutDashboard,
  FileText,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const navItems = [
  {
    label: "Resumen",
    description: "Vista general de tu inversion",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Mis Datos",
    description: "Datos de inversion y ventas",
    href: "/datasets",
    icon: Database,
  },
  {
    label: "Analisis",
    description: "Rendimiento de tus canales",
    href: "/models",
    icon: BarChart3,
  },
  {
    label: "Presupuesto",
    description: "Planifica y optimiza",
    href: "/optimization",
    icon: TrendingUp,
  },
  {
    label: "Escenarios",
    description: "Simulaciones guardadas",
    href: "/results",
    icon: FileText,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, currentOrgId, setCurrentOrg, signOut } = useAuthStore();

  const currentOrg = user?.organizations.find((o) => o.id === currentOrgId);

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-card">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2.5 border-b px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <BarChart3 className="h-4 w-4" />
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-sm leading-none">MMM Studio</span>
          <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">
            Marketing Mix Modeling
          </span>
        </div>
      </div>

      {/* Org switcher */}
      <div className="border-b p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between text-left font-normal h-9"
            >
              <span className="flex items-center gap-2 truncate">
                <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm">
                  {currentOrg?.name || "Seleccionar organizacion"}
                </span>
              </span>
              <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="start">
            {user?.organizations.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onClick={() => setCurrentOrg(org.id)}
                className={cn(org.id === currentOrgId && "bg-accent")}
              >
                <span className="truncate">{org.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">{org.role}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/orgs/new">+ Nueva organizacion</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive =
            item.href === "/models"
              ? pathname.startsWith("/models")
              : item.href === "/dashboard"
                ? pathname === "/dashboard" || pathname === "/"
                : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all group",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "h-[18px] w-[18px] shrink-0 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground/70 group-hover:text-accent-foreground"
                )}
              />
              <div className="flex flex-col min-w-0">
                <span
                  className={cn(
                    "text-sm leading-none",
                    isActive ? "font-semibold" : "font-medium"
                  )}
                >
                  {item.label}
                </span>
                <span
                  className={cn(
                    "text-[11px] leading-tight mt-0.5 truncate",
                    isActive ? "text-primary/70" : "text-muted-foreground/60"
                  )}
                >
                  {item.description}
                </span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t p-3 space-y-0.5">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
            pathname.startsWith("/settings")
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <Settings className="h-4 w-4" />
          Configuracion
        </Link>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesion
        </button>
        <div className="px-3 pt-2 text-[11px] text-muted-foreground/60 truncate">
          {user?.email}
        </div>
      </div>
    </aside>
  );
}
