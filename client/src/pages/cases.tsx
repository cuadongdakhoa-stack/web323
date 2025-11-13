import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, FileText } from "lucide-react";
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

export default function Cases() {
  const { data: cases, isLoading } = useQuery({
    queryKey: ["/api/cases"],
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary" data-testid={`badge-status-${status}`}>Nháp</Badge>;
      case "analyzing":
        return <Badge variant="default" data-testid={`badge-status-${status}`}>Đang phân tích</Badge>;
      case "completed":
        return <Badge className="bg-green-600" data-testid={`badge-status-${status}`}>Hoàn thành</Badge>;
      default:
        return <Badge variant="outline" data-testid={`badge-status-${status}`}>{status}</Badge>;
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold mb-2">Ca bệnh</h1>
            <p className="text-muted-foreground">
              Quản lý và phân tích các ca bệnh của bạn
            </p>
          </div>
          <Button asChild data-testid="button-new-case">
            <Link href="/cases/new">
              <Plus className="w-4 h-4 mr-2" />
              Tạo ca bệnh mới
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách ca bệnh</CardTitle>
          <CardDescription>
            {cases?.length || 0} ca bệnh trong hệ thống
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : cases && cases.length > 0 ? (
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
          ) : (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">Chưa có ca bệnh nào</p>
              <Button asChild data-testid="button-create-first-case">
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
