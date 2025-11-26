import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Plus, Sparkles } from "lucide-react";
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
  const { data: cases, isLoading: casesLoading } = useQuery<any[]>({
    queryKey: ["/api/cases"],
  });

  const { data: userData } = useQuery<any>({
    queryKey: ["/api/auth/me"],
  });

  const recentCases = cases?.slice(0, 5) || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary" className="shadow-sm">Nháp</Badge>;
      case "analyzing":
        return <Badge variant="default" className="bg-tech-gradient shadow-md">Đang phân tích</Badge>;
      case "completed":
        return <Badge className="bg-gradient-to-r from-green-600 to-emerald-500 shadow-md">Hoàn thành</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-12 text-center relative">
        <div className="absolute inset-0 bg-tech-gradient-subtle rounded-3xl -z-10"></div>
        <div className="py-16 px-8">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Chào mừng trở lại,{" "}
            <span className="text-tech-gradient whitespace-nowrap inline-block">
              {userData?.user?.fullName}
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Quản lý và phân tích các ca lâm sàng của bạn với trợ lý AI
          </p>
          <Button 
            size="lg" 
            variant="default"
            className="text-lg font-semibold shadow-lg hover:shadow-xl transition-all border-tech-glow"
            asChild 
            data-testid="button-create-case-hero"
          >
            <Link href="/cases/new">
              <Plus className="w-6 h-6 mr-3" />
              TẠO CA LÂM SÀNG
              <Sparkles className="w-5 h-5 ml-3" />
            </Link>
          </Button>
        </div>
      </div>

      <Card className="card-tech">
        <CardContent className="pt-6">
          {casesLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : cases && cases.length > 0 ? (
            <>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-tech-gradient">Ca lâm sàng gần đây</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {recentCases.length} / {cases.length} ca gần nhất
                  </p>
                </div>
                <Button variant="outline" asChild data-testid="button-view-all-cases">
                  <Link href="/cases">
                    <FileText className="w-4 h-4 mr-2" />
                    Xem tất cả
                  </Link>
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bệnh nhân</TableHead>
                    <TableHead>Chẩn đoán</TableHead>
                    <TableHead>eGFR</TableHead>
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
                      <TableCell className="max-w-xs truncate">{caseData.diagnosis}</TableCell>
                      <TableCell>
                        {caseData.egfr ? (
                          <div>
                            <div className="font-medium">{caseData.egfr} mL/min</div>
                            {caseData.egfrCategory && (
                              <div className="text-xs text-muted-foreground">{caseData.egfrCategory}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Chưa tính</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(caseData.status)}</TableCell>
                      <TableCell>
                        {formatDistanceToNow(new Date(caseData.createdAt), {
                          addSuffix: true,
                          locale: vi,
                        })}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild data-testid={`button-view-${caseData.id}`}>
                          <Link href={`/cases/${caseData.id}`}>Xem chi tiết</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          ) : (
            <div className="text-center py-16">
              <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-6" />
              <h3 className="text-xl font-semibold mb-2">Chưa có ca lâm sàng nào</h3>
              <p className="text-muted-foreground mb-6">
                Bắt đầu bằng cách tạo ca lâm sàng đầu tiên của bạn
              </p>
              <Button 
                size="lg"
                variant="default"
                asChild 
                data-testid="button-create-first-case"
              >
                <Link href="/cases/new">
                  <Plus className="w-5 h-5 mr-2" />
                  TẠO CA ĐẦU TIÊN
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
