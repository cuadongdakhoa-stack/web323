import { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, Loader2, Download, Trash2, File, Image, Sparkles } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { z } from "zod";

interface FileUploadSectionProps {
  caseId: string;
  initialCaseType?: "inpatient" | "outpatient";
  onCaseTypeChange?: (caseType: "inpatient" | "outpatient") => void;
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

interface DocumentSuggestion {
  needed: boolean;
  reason: string;
}

interface DocumentSuggestions {
  admin: DocumentSuggestion;
  lab: DocumentSuggestion;
  prescription: DocumentSuggestion;
}

const documentSuggestionSchema = z.object({
  needed: z.boolean(),
  reason: z.string(),
});

const documentSuggestionsSchema = z.object({
  admin: documentSuggestionSchema,
  lab: documentSuggestionSchema,
  prescription: documentSuggestionSchema,
});

const DEFAULT_SUGGESTIONS: DocumentSuggestions = {
  admin: { needed: false, reason: "Chưa có gợi ý" },
  lab: { needed: true, reason: "Cần kết quả xét nghiệm để đánh giá" },
  prescription: { needed: true, reason: "Cần đơn thuốc để kiểm tra tương tác" },
};

// File groups for INPATIENT (Nội trú)
const INPATIENT_FILE_GROUPS = [
  {
    key: "medical_record",
    label: "Bệnh án",
    description: "Bệnh án nội khoa, thông tin bệnh nhân (họ tên, tuổi, giới, cân nặng, chiều cao, chẩn đoán)",
    multiple: false,
    required: true,
  },
  {
    key: "treatment_sheet",
    label: "Tờ điều trị",
    description: "Tờ điều trị, y lệnh, thông tin thuốc và liều dùng",
    multiple: false,
    required: true,
  },
  {
    key: "lab_results",
    label: "Cận lâm sàng",
    description: "Kết quả xét nghiệm, chẩn đoán hình ảnh (có thể upload nhiều file)",
    multiple: true,
    required: false,
  },
];

// File groups for OUTPATIENT (Ngoại trú)
const OUTPATIENT_FILE_GROUPS = [
  {
    key: "prescription",
    label: "Đơn thuốc",
    description: "Đơn thuốc kê đơn, thông tin thuốc và liều dùng",
    multiple: false,
    required: true,
  },
  {
    key: "billing",
    label: "Bảng kê",
    description: "Bảng kê chi phí, danh sách thuốc và dịch vụ",
    multiple: false,
    required: false,
  },
  {
    key: "lab_tests",
    label: "Xét nghiệm",
    description: "Xét nghiệm máu, hóa sinh, nước tiểu, vi sinh, chẩn đoán hình ảnh (có thể upload nhiều file)",
    multiple: true,
    required: false,
  },
];

const FILE_ACCEPTS = ".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png";

function FileGroupUpload({ 
  caseId, 
  group, 
  label, 
  description, 
  multiple, 
  required 
}: { 
  caseId: string; 
  group: string;
  label: string;
  description: string;
  multiple: boolean;
  required: boolean;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState("");

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
      try {
        setUploadProgress(0);
        setUploadStage(`Đang chuẩn bị upload ${files.length} file...`);
        
        const formData = new FormData();
        Array.from(files).forEach((file) => {
          formData.append("files", file);
        });
        formData.append("fileGroup", group);

        setUploadProgress(20);
        setUploadStage("Gửi file lên server...");

        const response = await fetch(`/api/cases/${caseId}/files`, {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        setUploadProgress(60);
        setUploadStage("Đang xử lý file...");

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "Upload failed");
        }

        setUploadProgress(90);
        setUploadStage("Hoàn tất upload!");
        
        const result = await response.json();
        
        setUploadProgress(100);
        return result;
      } finally {
        setTimeout(() => {
          setUploadProgress(0);
          setUploadStage("");
        }, 1000);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId, "files", group] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId, "suggest-documents"] });
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
          accept={FILE_ACCEPTS}
          onChange={handleFileSelect}
          className="hidden"
          multiple={multiple}
          data-testid={`input-file-${group}`}
        />

        <div className="text-center">
          {uploadMutation.isPending ? (
            <div className="space-y-3">
              <Loader2 className="w-12 h-12 mx-auto text-primary mb-4 animate-spin" />
              <p className="text-sm font-medium mb-2">Đang upload file...</p>
              <div className="max-w-xs mx-auto space-y-2">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {uploadStage || "Đang xử lý..."}
                </p>
                <p className="text-xs font-mono text-muted-foreground">
                  {Math.round(uploadProgress)}%
                </p>
              </div>
            </div>
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
              <p className="text-sm font-medium mb-1">
                {label} {required && <span className="text-red-500">*</span>}
              </p>
              <p className="text-xs text-muted-foreground mb-2">
                {description}
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Hỗ trợ: PDF, DOC, DOCX, PPT, PPTX, JPG, PNG {multiple && "(có thể chọn nhiều file)"}
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

export default function FileUploadSection({ caseId, initialCaseType, onCaseTypeChange }: FileUploadSectionProps) {
  const [selectedCaseType, setSelectedCaseType] = useState<"inpatient" | "outpatient" | null>(initialCaseType || null);
  const fileGroups = selectedCaseType === "inpatient" ? INPATIENT_FILE_GROUPS : OUTPATIENT_FILE_GROUPS;
  const { toast } = useToast();

  const handleCaseTypeSelect = (type: "inpatient" | "outpatient") => {
    setSelectedCaseType(type);
    if (onCaseTypeChange) {
      onCaseTypeChange(type);
    }
  };

  const { data: suggestions, refetch } = useQuery<DocumentSuggestions>({
    queryKey: ["/api/cases", caseId, "suggest-documents"],
    queryFn: async () => {
      const response = await apiRequest(`/api/cases/${caseId}/suggest-documents`, {
        method: "POST",
      });
      const json = await response.json();
      const data = json.suggestions || json;
      
      const validated = documentSuggestionsSchema.safeParse(data);
      if (!validated.success) {
        console.error("Invalid AI suggestions:", validated.error);
        return DEFAULT_SUGGESTIONS;
      }
      return validated.data;
    },
    enabled: false,
    staleTime: 5 * 60 * 1000,
  });

  const showSuggestions = !!suggestions;

  const getSuggestionsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/cases/${caseId}/suggest-documents`, {
        method: "POST",
      });
      const json = await response.json();
      const data = json.suggestions || json;
      
      const validated = documentSuggestionsSchema.safeParse(data);
      if (!validated.success) {
        console.error("[AI Suggestions] Validation failed:", validated.error);
        throw new Error("Dữ liệu AI không hợp lệ");
      }
      return validated.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/cases", caseId, "suggest-documents"], data);
      
      const isRealAI = 
        data.admin.needed !== DEFAULT_SUGGESTIONS.admin.needed ||
        data.lab.needed !== DEFAULT_SUGGESTIONS.lab.needed ||
        data.prescription.needed !== DEFAULT_SUGGESTIONS.prescription.needed;
      
      toast({
        title: isRealAI ? "Gợi ý từ AI" : "Gợi ý mặc định",
        description: isRealAI ? "Đã nhận gợi ý tài liệu cần thiết" : "Hiển thị gợi ý mặc định",
      });
    },
    onError: (error: any) => {
      console.error("[AI Suggestions] Request failed:", {
        error: error.message,
        stack: error.stack,
        caseId,
        timestamp: new Date().toISOString(),
      });
      
      queryClient.setQueryData(["/api/cases", caseId, "suggest-documents"], DEFAULT_SUGGESTIONS);
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error.message || "Không thể lấy gợi ý từ AI. Hiển thị gợi ý mặc định.",
      });
    },
  });

  const handleGetSuggestions = () => {
    getSuggestionsMutation.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Upload tài liệu</CardTitle>
            <CardDescription>
              {selectedCaseType 
                ? (selectedCaseType === "inpatient" 
                    ? "Nội trú: Cần Bệnh án, Tờ điều trị, Cận lâm sàng" 
                    : "Ngoại trú: Cần Đơn thuốc, Bảng kê, Xét nghiệm")
                : "Chọn loại ca bệnh để bắt đầu upload tài liệu"}
            </CardDescription>
          </div>
          {selectedCaseType && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleGetSuggestions}
              disabled={getSuggestionsMutation.isPending}
              data-testid="button-ai-suggest"
            >
              {getSuggestionsMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              Gợi ý AI
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Case Type Selection */}
        {!selectedCaseType && (
          <div className="space-y-4">
            <div className="space-y-3">
              <Label className="text-base font-semibold">Loại ca bệnh <span className="text-red-500">*</span></Label>
              <p className="text-sm text-muted-foreground">
                Chọn loại ca bệnh để hệ thống hiển thị form upload phù hợp
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {/* Nội trú Card */}
              <button
                onClick={() => handleCaseTypeSelect("inpatient")}
                className="flex flex-col p-6 border-2 rounded-lg hover:border-primary hover:bg-accent transition-all text-left group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Nội trú (Inpatient)</h3>
                    <Badge variant="secondary" className="mt-1">Bệnh nhân nằm viện</Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Dành cho bệnh nhân điều trị nội trú, nằm viện
                </p>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>✓ Bệnh án nội khoa</div>
                  <div>✓ Tờ điều trị / Y lệnh</div>
                  <div>✓ Cận lâm sàng (xét nghiệm, chẩn đoán hình ảnh)</div>
                </div>
              </button>

              {/* Ngoại trú Card */}
              <button
                onClick={() => handleCaseTypeSelect("outpatient")}
                className="flex flex-col p-6 border-2 rounded-lg hover:border-primary hover:bg-accent transition-all text-left group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                    <FileText className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Ngoại trú (Outpatient)</h3>
                    <Badge variant="secondary" className="mt-1">Bệnh nhân khám ngoại</Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Dành cho bệnh nhân khám ngoại trú, không nằm viện
                </p>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>✓ Đơn thuốc kê đơn</div>
                  <div>✓ Bảng kê chi phí</div>
                  <div>✓ Xét nghiệm (máu, hóa sinh, nước tiểu, CT...)</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* File Upload Section - Only show after case type selected */}
        {selectedCaseType && (
          <>
            <div className="flex items-center justify-between mb-4 pb-3 border-b">
              <div className="flex items-center gap-2">
                <Badge variant={selectedCaseType === "inpatient" ? "default" : "secondary"}>
                  {selectedCaseType === "inpatient" ? "Nội trú" : "Ngoại trú"}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCaseType(null)}
                  className="text-xs"
                >
                  Đổi loại ca
                </Button>
              </div>
            </div>

            {showSuggestions && suggestions && (
              <div className="mb-4 space-y-2">
                {Object.entries(suggestions).map(([key, value]) => {
                  if (value?.needed) {
                    const group = fileGroups.find(g => g.key === key);
                    return (
                      <Alert key={key}>
                        <AlertDescription>
                          <strong>{group?.label || key}:</strong> {value.reason}
                        </AlertDescription>
                      </Alert>
                    );
                  }
                  return null;
                })}
              </div>
            )}

            <Tabs defaultValue={fileGroups[0].key} className="space-y-4">
              <TabsList className={`grid w-full grid-cols-${fileGroups.length}`}>
                {fileGroups.map(group => (
                  <TabsTrigger key={group.key} value={group.key} data-testid={`tab-files-${group.key}`}>
                    {group.label}
                    {group.required && <span className="text-red-500 ml-1">*</span>}
                  </TabsTrigger>
                ))}
              </TabsList>

              {fileGroups.map(group => (
                <TabsContent key={group.key} value={group.key}>
                  <FileGroupUpload 
                    caseId={caseId} 
                    group={group.key}
                    label={group.label}
                    description={group.description}
                    multiple={group.multiple}
                    required={group.required}
                  />
                </TabsContent>
              ))}
            </Tabs>
          </>
        )}
      </CardContent>
    </Card>
  );
}
