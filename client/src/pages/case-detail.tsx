import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, Beaker, BookOpen, FileSignature } from "lucide-react";

export default function CaseDetail() {
  const { id } = useParams();
  
  const { data: caseData, isLoading } = useQuery({
    queryKey: ["/api/cases", id],
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <Skeleton className="h-12 w-64 mb-6" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="p-8 max-w-7xl mx-auto text-center">
        <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Không tìm thấy ca bệnh</h2>
        <p className="text-muted-foreground mb-4">Ca bệnh không tồn tại hoặc đã bị xóa</p>
        <Button asChild>
          <Link href="/cases">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Quay lại danh sách
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/cases">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Quay lại danh sách
          </Link>
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold mb-2">{caseData.patientName}</h1>
            <p className="text-muted-foreground">
              {caseData.patientAge} tuổi • {caseData.patientGender}
            </p>
          </div>
          <Badge variant="secondary" data-testid="badge-status">
            {caseData.status === "draft" && "Nháp"}
            {caseData.status === "analyzing" && "Đang phân tích"}
            {caseData.status === "completed" && "Hoàn thành"}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="info" className="space-y-6">
        <TabsList>
          <TabsTrigger value="info" data-testid="tab-info">
            <FileText className="w-4 h-4 mr-2" />
            Thông tin
          </TabsTrigger>
          <TabsTrigger value="analysis" data-testid="tab-analysis">
            <Beaker className="w-4 h-4 mr-2" />
            Phân tích AI
          </TabsTrigger>
          <TabsTrigger value="evidence" data-testid="tab-evidence">
            <BookOpen className="w-4 h-4 mr-2" />
            Bằng chứng
          </TabsTrigger>
          <TabsTrigger value="report" data-testid="tab-report">
            <FileSignature className="w-4 h-4 mr-2" />
            Phiếu tư vấn
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Thông tin bệnh nhân</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Họ tên</p>
                <p className="text-base">{caseData.patientName}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tuổi</p>
                <p className="text-base">{caseData.patientAge} tuổi</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Giới tính</p>
                <p className="text-base">{caseData.patientGender}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Cân nặng</p>
                <p className="text-base">{caseData.patientWeight || "Không có"} kg</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Chiều cao</p>
                <p className="text-base">{caseData.patientHeight || "Không có"} cm</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">eGFR</p>
                <p className="text-base">
                  {caseData.egfr ? `${caseData.egfr} ml/min/1.73m²` : "Chưa tính"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Thông tin lâm sàng</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Chẩn đoán</p>
                <p className="text-base">{caseData.diagnosis}</p>
              </div>
              {caseData.medicalHistory && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Tiền sử bệnh</p>
                  <p className="text-base">{caseData.medicalHistory}</p>
                </div>
              )}
              {caseData.allergies && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Dị ứng</p>
                  <p className="text-base">{caseData.allergies}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis">
          <Card>
            <CardHeader>
              <CardTitle>Phân tích AI</CardTitle>
              <CardDescription>Kết quả phân tích từ DeepSeek và Perplexity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Beaker className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">Chức năng đang được phát triển</p>
                <Button disabled>Bắt đầu phân tích</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evidence">
          <Card>
            <CardHeader>
              <CardTitle>Bằng chứng y khoa</CardTitle>
              <CardDescription>Guidelines và nghiên cứu liên quan</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">Chưa có bằng chứng nào</p>
                <Button disabled>Tìm kiếm bằng chứng</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="report">
          <Card>
            <CardHeader>
              <CardTitle>Phiếu tư vấn sử dụng thuốc</CardTitle>
              <CardDescription>Tài liệu chuẩn hóa cho bệnh viện</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <FileSignature className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">Chưa tạo phiếu tư vấn</p>
                <Button disabled>Tạo phiếu tư vấn</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
