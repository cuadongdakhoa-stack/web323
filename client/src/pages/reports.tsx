import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, Download, Calendar, FileText, Pill, AlertTriangle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function ReportsPage() {
  const [reportType, setReportType] = useState<string>("monthly");
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM

  // Fetch reports data
  const { data: reportsData, isLoading } = useQuery({
    queryKey: ["/api/reports", reportType, selectedMonth],
    queryFn: async () => {
      const params = new URLSearchParams({
        type: reportType,
        month: selectedMonth,
      });
      const response = await fetch(`/api/reports?${params}`);
      if (!response.ok) throw new Error("Failed to fetch reports");
      return response.json();
    },
  });

  const handleExportCSV = () => {
    // TODO: Implement CSV export
    console.log("Exporting CSV...");
  };

  const handleExportPDF = () => {
    // TODO: Implement PDF export
    console.log("Exporting PDF...");
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <BarChart3 className="w-8 h-8" />
          Tổng hợp số liệu
        </h1>
        <p className="text-muted-foreground">
          Báo cáo và thống kê hoạt động dược lâm sàng
        </p>
      </div>

      <div className="grid gap-6">
        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Tùy chọn báo cáo</CardTitle>
            <CardDescription>Chọn loại báo cáo và khoảng thời gian</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Label>Loại báo cáo</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Báo cáo tháng</SelectItem>
                  <SelectItem value="quarterly">Báo cáo quý</SelectItem>
                  <SelectItem value="yearly">Báo cáo năm</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label>Tháng</Label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div className="flex gap-2 items-end">
              <Button onClick={handleExportCSV} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Xuất CSV
              </Button>
              <Button onClick={handleExportPDF} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Xuất PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tổng số ca</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reportsData?.totalCases || 0}</div>
              <p className="text-xs text-muted-foreground">
                {reportType === "monthly" ? "trong tháng" : reportType === "quarterly" ? "trong quý" : "trong năm"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Thuốc phân tích</CardTitle>
              <Pill className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reportsData?.totalMedications || 0}</div>
              <p className="text-xs text-muted-foreground">lượt thuốc được phân tích</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tương tác phát hiện</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reportsData?.totalInteractions || 0}</div>
              <p className="text-xs text-muted-foreground">tương tác thuốc được cảnh báo</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Điều chỉnh liều</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reportsData?.totalDoseAdjustments || 0}</div>
              <p className="text-xs text-muted-foreground">khuyến nghị điều chỉnh</p>
            </CardContent>
          </Card>
        </div>

        {/* Top Medications Table */}
        <Card>
          <CardHeader>
            <CardTitle>Top 10 thuốc thường gặp</CardTitle>
            <CardDescription>Thuốc được sử dụng nhiều nhất trong kỳ báo cáo</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Đang tải...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Tên thuốc</TableHead>
                    <TableHead>Hoạt chất</TableHead>
                    <TableHead className="text-right">Số lần sử dụng</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportsData?.topMedications?.length > 0 ? (
                    reportsData.topMedications.map((med: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{idx + 1}</TableCell>
                        <TableCell>{med.drugName}</TableCell>
                        <TableCell>{med.activeIngredient || "N/A"}</TableCell>
                        <TableCell className="text-right">{med.count}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Chưa có dữ liệu
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Top Drug Interactions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Tương tác thuốc thường gặp</CardTitle>
            <CardDescription>Các tương tác thuốc được phát hiện nhiều nhất</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Đang tải...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Tương tác</TableHead>
                    <TableHead className="text-right">Số lần phát hiện</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportsData?.topInteractions?.length > 0 ? (
                    reportsData.topInteractions.map((interaction: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{idx + 1}</TableCell>
                        <TableCell>{interaction.description}</TableCell>
                        <TableCell className="text-right">{interaction.count}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        Chưa có dữ liệu
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
