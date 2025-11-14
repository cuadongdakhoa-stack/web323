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
  const { data: cases, isLoading: casesLoading } = useQuery({
    queryKey: ["/api/cases"],
  });

  const { data: userData } = useQuery({
    queryKey: ["/api/auth/me"],
  });

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
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold mb-3">
          Chào mừng trở lại, {userData?.user?.fullName}
        </h1>
        <p className="text-lg text-muted-foreground mb-8">
          Quản lý và phân tích các case lâm sàng của bạn với trợ lý AI
        </p>
        <Button 
          size="lg" 
          variant="default"
          className="text-lg font-semibold"
          asChild 
          data-testid="button-create-case-hero"
        >
          <Link href="/cases/new">
            <Plus className="w-6 h-6 mr-3" />
            TẠO CASE LÂM SÀNG
            <Sparkles className="w-5 h-5 ml-3" />
          </Link>
        </Button>
      </div>

      <Card>
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
              <div className="mb-4">
                <h2 className="text-xl font-semibold">Danh sách Case lâm sàng</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {cases.length} case trong hệ thống
                </p>
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
                  {cases.map((caseData: any) => (
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
                            <div className="font-medium">{caseData.egfr} ml/min/1.73m²</div>
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
              <h3 className="text-xl font-semibold mb-2">Chưa có case lâm sàng nào</h3>
              <p className="text-muted-foreground mb-6">
                Bắt đầu bằng cách tạo case lâm sàng đầu tiên của bạn
              </p>
              <Button 
                size="lg"
                variant="default"
                asChild 
                data-testid="button-create-first-case"
              >
                <Link href="/cases/new">
                  <Plus className="w-5 h-5 mr-2" />
                  TẠO CASE ĐẦU TIÊN
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
