import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  FileText,
  BookOpen,
  LogOut,
  Pill,
  BarChart3,
} from "lucide-react";
import type { AuthMeResponse } from "@shared/schema";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

const menuItems = [
  {
    title: "Tổng quan",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Ca lâm sàng",
    url: "/cases",
    icon: FileText,
  },
  {
    title: "Thư viện",
    url: "/library",
    icon: BookOpen,
  },
  {
    title: "Tổng hợp số liệu",
    url: "/reports",
    icon: BarChart3,
  },
];

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: userData } = useQuery<AuthMeResponse>({
    queryKey: ["/api/auth/me"],
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/auth/logout", {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({
        title: "Đăng xuất thành công",
        description: "Hẹn gặp lại bạn!",
      });
      setLocation("/login");
    },
  });

  return (
    <Sidebar>
      <SidebarHeader className="border-b p-4 bg-gradient-to-br from-primary/5 to-accent/5">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-full shadow-lg ring-2 ring-primary/20 bg-white flex items-center justify-center overflow-hidden">
              <img src="/logo.png" alt="Care Pharma Logo" className="w-10 h-10 object-contain" />
            </div>
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-primary/10 to-transparent animate-pulse"></div>
          </div>
          <div>
            <h2 className="font-bold text-base bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Cửa Đông Care+</h2>
            <p className="text-xs font-medium text-muted-foreground">Trợ lý dược lâm sàng</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu chính</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`link-${item.title.toLowerCase()}`}
                  >
                    <a href={item.url}>
                      <item.icon className="w-5 h-5" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {userData?.user?.role === "admin" && (
          <SidebarGroup>
            <SidebarGroupLabel>Quản trị</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location === "/drug-formulary"}
                    data-testid="link-drug-formulary"
                  >
                    <a href="/drug-formulary">
                      <Pill className="w-5 h-5" />
                      <span>Danh mục thuốc</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t p-4">
        {userData?.user && (
          <div className="mb-3">
            <p className="text-sm font-medium truncate">{userData.user.fullName}</p>
            <p className="text-xs text-muted-foreground truncate">
              {userData.user.role === "admin" && "Quản trị viên"}
              {userData.user.role === "pharmacist" && "Dược sĩ"}
              {userData.user.role === "doctor" && "Bác sĩ"}
            </p>
            {userData.user.department && (
              <p className="text-xs text-muted-foreground truncate">{userData.user.department}</p>
            )}
          </div>
        )}
        <Separator className="mb-3" />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              data-testid="button-logout"
            >
              <LogOut className="w-5 h-5" />
              <span>Đăng xuất</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
