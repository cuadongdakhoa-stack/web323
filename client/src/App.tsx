import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { FloatingChatbot } from "@/components/floating-chatbot";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Cases from "@/pages/cases";
import NewCase from "@/pages/new-case";
import CaseDetail from "@/pages/case-detail";
import Library from "@/pages/library";
import NotFound from "@/pages/not-found";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect } from "react";

function AuthenticatedRouter() {
  const [location, setLocation] = useLocation();
  
  const { data: userData, isLoading } = useQuery({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  useEffect(() => {
    if (!isLoading && !userData) {
      setLocation("/login");
    }
  }, [userData, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="space-y-4 w-64">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (!userData) {
    return null;
  }

  const style = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <>
      <SidebarProvider style={style as React.CSSProperties}>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <header className="flex items-center justify-between h-16 px-6 border-b bg-background/95 backdrop-blur-md backdrop-saturate-180 shadow-sm">
              <div className="flex items-center gap-4">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
                <h1 className="text-lg font-semibold">
                  Xin chào, <span className="text-primary font-bold">{userData.user.fullName}</span> – <span className="text-tech-gradient">Cửa Đông Care+ Pharma</span>
                </h1>
              </div>
            </header>
            <main className="flex-1 overflow-auto bg-background">
              <Switch>
                <Route path="/" component={Dashboard} />
                <Route path="/cases" component={Cases} />
                <Route path="/cases/new" component={NewCase} />
                <Route path="/cases/:id" component={CaseDetail} />
                <Route path="/library" component={Library} />
                <Route component={NotFound} />
              </Switch>
            </main>
          </div>
        </div>
      </SidebarProvider>
      <FloatingChatbot />
    </>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route>
        <AuthenticatedRouter />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
