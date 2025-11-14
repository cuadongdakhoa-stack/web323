import { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileText, Loader2, Download, Trash2, File, Image } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface FileUploadSectionProps {
  caseId: string;
}

interface UploadedFile {
  id: string;
  fileName: string;
  fileType: string;
  fileGroup: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

const FILE_GROUP_LABELS: Record<string, string> = {
  admin: "Hành chính",
  lab: "Cận lâm sàng",
  prescription: "Đơn thuốc",
};

const FILE_GROUP_DESCRIPTIONS: Record<string, string> = {
  admin: "Giấy tờ hành chính (PDF, DOC, DOCX)",
  lab: "Kết quả xét nghiệm, chẩn đoán hình ảnh (PDF, DOC, DOCX, JPG, PNG)",
  prescription: "Đơn thuốc, phiếu y lệnh (PDF, JPG, PNG)",
};

const FILE_GROUP_ACCEPTS: Record<string, string> = {
  admin: ".pdf,.doc,.docx",
  lab: ".pdf,.doc,.docx,.jpg,.jpeg,.png",
  prescription: ".pdf,.jpg,.jpeg,.png",
};

function FileGroupUpload({ caseId, group }: { caseId: string; group: string }) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);

  const { data: files, isLoading } = useQuery<UploadedFile[]>({
    queryKey: ["/api/cases", caseId, "files", group],
    queryFn: async () => {
      const response = await fetch(`/api/cases/${caseId}/files?group=${group}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Không thể tải danh sách file");
      }
      return response.json();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append("files", file);
      });
      formData.append("fileGroup", group);

      const response = await fetch(`/api/cases/${caseId}/files`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Upload failed");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId, "files", group] });
      setSelectedFiles(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      toast({
        title: "Upload thành công",
        description: "File đã được lưu vào hệ thống",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Lỗi upload",
        description: error.message || "Không thể upload file",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const response = await fetch(`/api/files/${fileId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Không thể xóa file");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId, "files", group] });
      toast({
        title: "Đã xóa",
        description: "File đã được xóa khỏi hệ thống",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Lỗi xóa file",
        description: error.message || "Không thể xóa file",
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFiles(files);
    }
  };

  const handleUpload = () => {
    if (selectedFiles) {
      uploadMutation.mutate(selectedFiles);
    }
  };

  const handleDownload = async (fileId: string, fileName: string) => {
    try {
      const response = await fetch(`/api/files/${fileId}/download`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Không thể tải file");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Lỗi tải file",
        description: error.message || "Không thể tải file",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return <Image className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed rounded-lg p-6">
        <input
          ref={fileInputRef}
          type="file"
          accept={FILE_GROUP_ACCEPTS[group]}
          onChange={handleFileSelect}
          className="hidden"
          multiple
          data-testid={`input-file-${group}`}
        />

        <div className="text-center">
          {uploadMutation.isPending ? (
            <>
              <Loader2 className="w-12 h-12 mx-auto text-primary mb-4 animate-spin" />
              <p className="text-sm font-medium mb-2">Đang upload file...</p>
            </>
          ) : selectedFiles && selectedFiles.length > 0 ? (
            <>
              <File className="w-12 h-12 mx-auto text-green-600 mb-4" />
              <p className="text-sm font-medium mb-2">
                {selectedFiles.length} file đã chọn
              </p>
              <div className="flex gap-2 justify-center mt-4">
                <Button onClick={handleUpload} data-testid={`button-upload-${group}`}>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedFiles(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                >
                  Hủy
                </Button>
              </div>
            </>
          ) : (
            <>
              <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-2">
                {FILE_GROUP_DESCRIPTIONS[group]}
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => fileInputRef.current?.click()}
                data-testid={`button-choose-file-${group}`}
              >
                <Upload className="w-4 h-4 mr-2" />
                Chọn file
              </Button>
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-12 bg-muted animate-pulse rounded" />
          <div className="h-12 bg-muted animate-pulse rounded" />
        </div>
      ) : files && files.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên file</TableHead>
              <TableHead>Loại</TableHead>
              <TableHead>Kích thước</TableHead>
              <TableHead>Ngày upload</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {files.map((file) => (
              <TableRow key={file.id} data-testid={`row-file-${file.id}`}>
                <TableCell className="flex items-center gap-2">
                  {getFileIcon(file.mimeType)}
                  <span className="font-medium">{file.fileName}</span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{file.fileType.toUpperCase()}</Badge>
                </TableCell>
                <TableCell>{formatFileSize(file.fileSize)}</TableCell>
                <TableCell>
                  {new Date(file.createdAt).toLocaleDateString("vi-VN")}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDownload(file.id, file.fileName)}
                      data-testid={`button-download-${file.id}`}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(file.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${file.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Chưa có file nào được upload</p>
        </div>
      )}
    </div>
  );
}

export default function FileUploadSection({ caseId }: FileUploadSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tài liệu đính kèm</CardTitle>
        <CardDescription>
          Quản lý file theo nhóm: Hành chính, Cận lâm sàng, Đơn thuốc
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="admin" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="admin" data-testid="tab-files-admin">
              {FILE_GROUP_LABELS.admin}
            </TabsTrigger>
            <TabsTrigger value="lab" data-testid="tab-files-lab">
              {FILE_GROUP_LABELS.lab}
            </TabsTrigger>
            <TabsTrigger value="prescription" data-testid="tab-files-prescription">
              {FILE_GROUP_LABELS.prescription}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="admin">
            <FileGroupUpload caseId={caseId} group="admin" />
          </TabsContent>

          <TabsContent value="lab">
            <FileGroupUpload caseId={caseId} group="lab" />
          </TabsContent>

          <TabsContent value="prescription">
            <FileGroupUpload caseId={caseId} group="prescription" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
