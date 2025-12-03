import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Activity } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      return apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      });
    },
    onSuccess: async () => {
      toast({
        title: "Đăng nhập thành công",
        description: "Chào mừng đến với Cửa Đông Care+ Pharma",
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setTimeout(() => {
        setLocation("/");
      }, 500);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Đăng nhập thất bại",
        description: error.message || "Tên đăng nhập hoặc mật khẩu không đúng",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ username, password });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      <div className="absolute top-20 left-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-secondary/10 rounded-full blur-3xl"></div>
      
      <Card className="w-full max-w-md bg-[#f4f4f4] shadow-2xl border-tech-glow relative z-10">
        <CardHeader className="space-y-2 text-center pb-6">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-md animate-pulse"></div>
              <div className="w-20 h-20 relative z-10 ring-4 ring-primary/20 rounded-full bg-white flex items-center justify-center overflow-hidden">
                <img src="/logo.png" alt="Care Pharma Logo" className="w-16 h-16 object-contain" />
              </div>
            </div>
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            Cửa Đông Care+ Pharma
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            Hệ thống Quản lý dữ liệu lâm sàng chuyên nghiệp
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium">Tên đăng nhập</Label>
              <Input
                id="username"
                data-testid="input-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="bg-white/80 border-primary/20 focus:border-primary focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Mật khẩu</Label>
              <Input
                id="password"
                data-testid="input-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-white/80 border-primary/20 focus:border-primary focus:ring-primary/20"
              />
            </div>
            <Button
              data-testid="button-login"
              type="submit"
              className="w-full bg-gradient-to-r from-primary to-primary/90 shadow-lg"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? "Đang đăng nhập..." : "Đăng nhập"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Footer credit */}
      <footer className="mt-8 text-center text-sm text-muted-foreground relative z-10">
        <p className="font-semibold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          @Byhuonggiang2024
        </p>
      </footer>
    </div>
  );
}
