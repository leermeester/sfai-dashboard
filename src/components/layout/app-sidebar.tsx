"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  DollarSign,
  Inbox,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Overview", href: "/", icon: LayoutDashboard },
  { title: "Sales & Revenue", href: "/sales", icon: DollarSign },
  { title: "Capacity", href: "/capacity", icon: Users },
  { title: "Margins", href: "/margins", icon: BarChart3 },
  { title: "Resolution", href: "/resolution", icon: Inbox, showBadge: true },
  { title: "Settings", href: "/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    fetch("/api/resolution/stats")
      .then((r) => r.json())
      .then((data) => setPendingCount(data.pending ?? 0))
      .catch(() => {});
  }, [pathname]); // refetch on navigation

  return (
    <Sidebar>
      <SidebarHeader className="px-6 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground text-sm">
            S
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-foreground">SFAI Labs</h1>
            <p className="text-xs text-muted-foreground">Internal Dashboard</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2 pt-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] uppercase tracking-wider opacity-40 font-medium">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      item.href === "/"
                        ? pathname === "/"
                        : pathname.startsWith(item.href)
                    }
                  >
                    <Link href={item.href}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                  {"showBadge" in item && item.showBadge && pendingCount > 0 && (
                    <SidebarMenuBadge>{pendingCount}</SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
