import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Upload, Search, Plus, Trash2, Edit, FileSpreadsheet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DrugFormulary {
  id: string;
  tradeName: string;
  activeIngredient: string;
  strength: string;
  unit: string;
  manufacturer?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export default function DrugFormularyPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingDrug, setEditingDrug] = useState<DrugFormulary | null>(null);

  const [newDrug, setNewDrug] = useState({
    tradeName: "",
    activeIngredient: "",
    strength: "",
    unit: "",
    manufacturer: "",
    notes: "",
  });

  const { data: drugs = [], isLoading } = useQuery<DrugFormulary[]>({
    queryKey: ["/api/drugs", searchQuery],
    queryFn: async () => {
      const params = searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : "";
      const response = await fetch(`/api/drugs${params}`);
      if (!response.ok) throw new Error("Failed to fetch drugs");
      return response.json();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiRequest("/api/drugs/upload", {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Thành công",
        description: data.message || `Đã import ${data.count} thuốc`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/drugs"] });
      setIsUploadDialogOpen(false);
      setSelectedFile(null);
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể upload file",
        variant: "destructive",
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: (drug: typeof newDrug) =>
      apiRequest("/api/drugs", {
        method: "POST",
        body: JSON.stringify(drug),
      }),
    onSuccess: () => {
      toast({ title: "Thành công", description: "Đã thêm thuốc mới" });
      queryClient.invalidateQueries({ queryKey: ["/api/drugs"] });
      setIsAddDialogOpen(false);
      setNewDrug({
        tradeName: "",
        activeIngredient: "",
        strength: "",
        unit: "",
        manufacturer: "",
        notes: "",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...drug }: any) =>
      apiRequest(`/api/drugs/${id}`, {
        method: "PUT",
        body: JSON.stringify(drug),
      }),
    onSuccess: () => {
      toast({ title: "Thành công", description: "Đã cập nhật thông tin thuốc" });
      queryClient.invalidateQueries({ queryKey: ["/api/drugs"] });
      setEditingDrug(null);
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/drugs/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Thành công", description: "Đã xóa thuốc" });
      queryClient.invalidateQueries({ queryKey: ["/api/drugs"] });
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleUpload = () => {
    if (!selectedFile) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn file",
        variant: "destructive",
      });
      return;
    }
    uploadMutation.mutate(selectedFile);
  };

  const handleCreate = () => {
    if (!newDrug.tradeName || !newDrug.activeIngredient) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập tên thuốc và hoạt chất",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(newDrug);
  };

  const handleUpdate = () => {
    if (!editingDrug) return;
    updateMutation.mutate(editingDrug);
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">
          Danh mục thuốc bệnh viện
        </h1>
        <p className="text-muted-foreground">
          Quản lý danh sách thuốc với thông tin hoạt chất và hàm lượng chính xác
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Tác vụ nhanh
            </CardTitle>
            <CardDescription>
              Upload file Excel/CSV hoặc thêm thuốc từng cái
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button
              onClick={() => setIsUploadDialogOpen(true)}
              variant="default"
              data-testid="button-upload-excel"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Excel/CSV
            </Button>
            <Button
              onClick={() => setIsAddDialogOpen(true)}
              variant="outline"
              data-testid="button-add-drug"
            >
              <Plus className="w-4 h-4 mr-2" />
              Thêm thuốc
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle>Danh sách thuốc ({drugs.length})</CardTitle>
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm theo tên thuốc, hoạt chất, nhà sản xuất..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-drugs"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Đang tải...</div>
            ) : drugs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Chưa có thuốc nào. Vui lòng upload danh mục hoặc thêm thủ công.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tên thuốc</TableHead>
                      <TableHead>Hoạt chất</TableHead>
                      <TableHead>Hàm lượng</TableHead>
                      <TableHead>Đơn vị</TableHead>
                      <TableHead>Nhà sản xuất</TableHead>
                      <TableHead className="text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drugs.map((drug) => (
                      <TableRow key={drug.id} data-testid={`row-drug-${drug.id}`}>
                        <TableCell className="font-medium">{drug.tradeName}</TableCell>
                        <TableCell>{drug.activeIngredient}</TableCell>
                        <TableCell>{drug.strength}</TableCell>
                        <TableCell>{drug.unit}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {drug.manufacturer || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingDrug(drug)}
                              data-testid={`button-edit-${drug.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteMutation.mutate(drug.id)}
                              data-testid={`button-delete-${drug.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload danh mục thuốc</DialogTitle>
            <DialogDescription>
              Chọn file Excel (.xlsx, .xls) hoặc CSV. File phải có các cột: "Tên thuốc", "Hoạt chất",
              "Hàm lượng", "Đơn vị"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>File Excel/CSV</Label>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                data-testid="input-file-upload"
              />
              {selectedFile && (
                <p className="text-sm text-muted-foreground mt-2">
                  Đã chọn: {selectedFile.name}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsUploadDialogOpen(false);
                setSelectedFile(null);
              }}
              data-testid="button-cancel-upload"
            >
              Hủy
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploadMutation.isPending}
              data-testid="button-confirm-upload"
            >
              {uploadMutation.isPending ? "Đang upload..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thêm thuốc mới</DialogTitle>
            <DialogDescription>
              Nhập thông tin chi tiết về thuốc mới
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Tên thuốc *</Label>
              <Input
                value={newDrug.tradeName}
                onChange={(e) => setNewDrug({ ...newDrug, tradeName: e.target.value })}
                placeholder="VD: Paracetamol 500mg"
                data-testid="input-trade-name"
              />
            </div>
            <div>
              <Label>Hoạt chất *</Label>
              <Input
                value={newDrug.activeIngredient}
                onChange={(e) => setNewDrug({ ...newDrug, activeIngredient: e.target.value })}
                placeholder="VD: Paracetamol"
                data-testid="input-active-ingredient"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Hàm lượng</Label>
                <Input
                  value={newDrug.strength}
                  onChange={(e) => setNewDrug({ ...newDrug, strength: e.target.value })}
                  placeholder="VD: 500"
                  data-testid="input-strength"
                />
              </div>
              <div>
                <Label>Đơn vị</Label>
                <Input
                  value={newDrug.unit}
                  onChange={(e) => setNewDrug({ ...newDrug, unit: e.target.value })}
                  placeholder="VD: mg"
                  data-testid="input-unit"
                />
              </div>
            </div>
            <div>
              <Label>Nhà sản xuất</Label>
              <Input
                value={newDrug.manufacturer}
                onChange={(e) => setNewDrug({ ...newDrug, manufacturer: e.target.value })}
                placeholder="VD: Pymepharco"
                data-testid="input-manufacturer"
              />
            </div>
            <div>
              <Label>Ghi chú</Label>
              <Input
                value={newDrug.notes}
                onChange={(e) => setNewDrug({ ...newDrug, notes: e.target.value })}
                placeholder="Ghi chú bổ sung (nếu có)"
                data-testid="input-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddDialogOpen(false)}
              data-testid="button-cancel-add"
            >
              Hủy
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              data-testid="button-confirm-add"
            >
              {createMutation.isPending ? "Đang thêm..." : "Thêm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingDrug} onOpenChange={() => setEditingDrug(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chỉnh sửa thông tin thuốc</DialogTitle>
          </DialogHeader>
          {editingDrug && (
            <div className="space-y-4 py-4">
              <div>
                <Label>Tên thuốc *</Label>
                <Input
                  value={editingDrug.tradeName}
                  onChange={(e) =>
                    setEditingDrug({ ...editingDrug, tradeName: e.target.value })
                  }
                  data-testid="input-edit-trade-name"
                />
              </div>
              <div>
                <Label>Hoạt chất *</Label>
                <Input
                  value={editingDrug.activeIngredient}
                  onChange={(e) =>
                    setEditingDrug({ ...editingDrug, activeIngredient: e.target.value })
                  }
                  data-testid="input-edit-active-ingredient"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Hàm lượng</Label>
                  <Input
                    value={editingDrug.strength}
                    onChange={(e) =>
                      setEditingDrug({ ...editingDrug, strength: e.target.value })
                    }
                    data-testid="input-edit-strength"
                  />
                </div>
                <div>
                  <Label>Đơn vị</Label>
                  <Input
                    value={editingDrug.unit}
                    onChange={(e) =>
                      setEditingDrug({ ...editingDrug, unit: e.target.value })
                    }
                    data-testid="input-edit-unit"
                  />
                </div>
              </div>
              <div>
                <Label>Nhà sản xuất</Label>
                <Input
                  value={editingDrug.manufacturer || ""}
                  onChange={(e) =>
                    setEditingDrug({ ...editingDrug, manufacturer: e.target.value })
                  }
                  data-testid="input-edit-manufacturer"
                />
              </div>
              <div>
                <Label>Ghi chú</Label>
                <Input
                  value={editingDrug.notes || ""}
                  onChange={(e) =>
                    setEditingDrug({ ...editingDrug, notes: e.target.value })
                  }
                  data-testid="input-edit-notes"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingDrug(null)}
              data-testid="button-cancel-edit"
            >
              Hủy
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateMutation.isPending}
              data-testid="button-confirm-edit"
            >
              {updateMutation.isPending ? "Đang lưu..." : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
