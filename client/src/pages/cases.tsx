import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, FileText, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { useState, useMemo, useEffect } from "react";

export default function Cases() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { data: cases, isLoading } = useQuery({
    queryKey: ["/api/cases"],
  });

  const filteredCases = useMemo(() => {
    if (!cases) return [];
    
    return cases.filter((caseData: any) => {
      const matchesSearch = searchQuery === "" || 
        caseData.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        caseData.diagnosis.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || caseData.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [cases, searchQuery, statusFilter]);

  const totalPages = Math.ceil(filteredCases.length / itemsPerPage);

  useEffect(() => {
    const maxPage = Math.max(1, totalPages);
    if (currentPage > maxPage) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const paginatedCases = useMemo(() => {
    if (filteredCases.length === 0) return [];
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredCases.slice(startIndex, endIndex);
  }, [filteredCases, currentPage]);

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
            {filteredCases.length} / {cases?.length || 0} ca bệnh
          </CardDescription>
          <div className="flex gap-4 mt-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Tìm theo tên bệnh nhân hoặc chẩn đoán..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10"
                data-testid="input-search-cases"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-48" data-testid="select-status-filter">
                <SelectValue placeholder="Lọc trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                <SelectItem value="draft">Nháp</SelectItem>
                <SelectItem value="analyzing">Đang phân tích</SelectItem>
                <SelectItem value="completed">Hoàn thành</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : filteredCases.length > 0 ? (
            <>
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
                  {paginatedCases.map((caseData: any) => (
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
            
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Trang {currentPage} / {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    data-testid="button-prev-page"
                  >
                    Trước
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    data-testid="button-next-page"
                  >
                    Sau
                  </Button>
                </div>
              </div>
            )}
          </>
          ) : (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                {searchQuery || statusFilter !== "all" 
                  ? "Không tìm thấy ca bệnh nào" 
                  : "Chưa có ca bệnh nào"}
              </p>
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
