import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, BookOpen, MessageSquare, Plus, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

export default function Dashboard() {
  const { data: cases, isLoading: casesLoading } = useQuery({
    queryKey: ["/api/cases"],
  });

  const { data: userData } = useQuery({
    queryKey: ["/api/auth/me"],
  });

  const recentCases = cases?.slice(0, 5) || [];
  const totalCases = cases?.length || 0;
  const draftCases = cases?.filter((c: any) => c.status === "draft").length || 0;
  const completedCases = cases?.filter((c: any) => c.status === "completed").length || 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Nháp</Badge>;
      case "analyzing":
        return <Badge variant="default">Đang phân tích</Badge>;
      case "completed":
        return <Badge className="bg-green-600">Hoàn thành</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold mb-2">Tổng quan</h1>
        <p className="text-muted-foreground">
          Chào mừng trở lại, {userData?.user?.fullName}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng ca bệnh</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCases}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {draftCases} ca đang soạn thảo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hoàn thành</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedCases}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalCases > 0 ? Math.round((completedCases / totalCases) * 100) : 0}% tổng số ca
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Truy cập nhanh</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="outline" asChild>
                <Link href="/library">
                  <BookOpen className="w-4 h-4 mr-2" />
                  Thư viện
                </Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href="/chat">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Chat AI
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Ca bệnh gần đây</CardTitle>
              <CardDescription>
                {recentCases.length > 0 
                  ? `${recentCases.length} ca bệnh mới nhất`
                  : "Chưa có ca bệnh nào"}
              </CardDescription>
            </div>
            <Button asChild data-testid="button-new-case">
              <Link href="/cases/new">
                <Plus className="w-4 h-4 mr-2" />
                Tạo ca bệnh
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {casesLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : recentCases.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bệnh nhân</TableHead>
                  <TableHead>Chẩn đoán</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Thời gian</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentCases.map((caseData: any) => (
                  <TableRow key={caseData.id} data-testid={`row-case-${caseData.id}`}>
                    <TableCell className="font-medium">
                      {caseData.patientName}
                      <div className="text-sm text-muted-foreground">
                        {caseData.patientAge} tuổi, {caseData.patientGender}
                      </div>
                    </TableCell>
                    <TableCell>{caseData.diagnosis}</TableCell>
                    <TableCell>{getStatusBadge(caseData.status)}</TableCell>
                    <TableCell>
                      {formatDistanceToNow(new Date(caseData.createdAt), {
                        addSuffix: true,
                        locale: vi,
                      })}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/cases/${caseData.id}`}>Xem chi tiết</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">Chưa có ca bệnh nào</p>
              <Button asChild>
                <Link href="/cases/new">
                  <Plus className="w-4 h-4 mr-2" />
                  Tạo ca bệnh đầu tiên
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
