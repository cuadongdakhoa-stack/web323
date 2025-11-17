import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, FileText, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Cases() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [caseToDelete, setCaseToDelete] = useState<any>(null);
  const itemsPerPage = 10;

  const { data: cases, isLoading } = useQuery({
    queryKey: ["/api/cases"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (caseId: string) => {
      return await apiRequest(`/api/cases/${caseId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      setDeleteDialogOpen(false);
      setCaseToDelete(null);
      toast({
        title: "Đã xóa",
        description: "Ca lâm sàng đã được xóa thành công",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Lỗi xóa ca lâm sàng",
        description: error.message || "Không thể xóa ca lâm sàng",
      });
    },
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
            <h1 className="text-3xl font-semibold mb-2">Ca lâm sàng</h1>
            <p className="text-muted-foreground">
              Quản lý và phân tích các ca lâm sàng của bạn
            </p>
          </div>
          <Button asChild data-testid="button-new-case">
            <Link href="/cases/new">
              <Plus className="w-4 h-4 mr-2" />
              Tạo ca lâm sàng mới
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách ca lâm sàng</CardTitle>
          <CardDescription>
            {filteredCases.length} / {cases?.length || 0} ca lâm sàng
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
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" asChild data-testid={`button-view-${caseData.id}`}>
                          <Link href={`/cases/${caseData.id}`}>Xem chi tiết</Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setCaseToDelete(caseData);
                            setDeleteDialogOpen(true);
                          }}
                          data-testid={`button-delete-${caseData.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  data-testid="button-prev-page"
                >
                  ← Trước
                </Button>
                <span className="text-sm text-muted-foreground" data-testid="text-page-info">
                  Trang {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  data-testid="button-next-page"
                >
                  Sau →
                </Button>
              </div>
            )}
          </>
          ) : (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                {searchQuery || statusFilter !== "all" 
                  ? "Không tìm thấy ca lâm sàng nào" 
                  : "Chưa có ca lâm sàng nào"}
              </p>
              <Button asChild data-testid="button-create-first-case">
                <Link href="/cases/new">
                  <Plus className="w-4 h-4 mr-2" />
                  Tạo ca lâm sàng đầu tiên
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa ca lâm sàng</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa ca lâm sàng của{" "}
              <span className="font-semibold">{caseToDelete?.patientName}</span>?
              <br />
              Hành động này không thể hoàn tác và sẽ xóa tất cả dữ liệu liên quan (thuốc, phân tích, bằng chứng).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (caseToDelete) {
                  deleteMutation.mutate(caseToDelete.id);
                }
              }}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Đang xóa..." : "Xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
