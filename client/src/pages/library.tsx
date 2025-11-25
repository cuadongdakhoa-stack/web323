import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Upload, FileText, Trash2, Calendar } from "lucide-react";

const CATEGORIES = [
  "All",
  "Guidelines",
  "Pharmacology",
  "Drug Information",
  "Clinical Practice",
  "Research",
  "Other"
];

const uploadFormSchema = z.object({
  title: z.string().min(1, "Tiêu đề là bắt buộc"),
  description: z.string().optional(),
  category: z.enum(["Guidelines", "Pharmacology", "Drug Information", "Clinical Practice", "Research", "Other"]),
  file: z.instanceof(File, { message: "File là bắt buộc" })
    .refine((file) => file.size <= 10 * 1024 * 1024, "File không được vượt quá 10MB")
    .refine(
      (file) => ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(file.type),
      "Chỉ chấp nhận file PDF hoặc DOCX"
    )
});

type UploadFormData = z.infer<typeof uploadFormSchema>;

type ReferenceDocument = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  fileName: string;
  fileType: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  extractedText: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function Library() {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  const form = useForm<UploadFormData>({
    resolver: zodResolver(uploadFormSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "Guidelines",
      file: undefined as any
    }
  });

  const { data: documents, isLoading } = useQuery<ReferenceDocument[]>({
    queryKey: selectedCategory === "All" ? ["/api/library"] : ["/api/library", selectedCategory],
    queryFn: async () => {
      if (selectedCategory === "All") {
        const res = await fetch("/api/library");
        if (!res.ok) throw new Error("Failed to fetch documents");
        return res.json();
      } else {
        const res = await fetch(`/api/library?category=${encodeURIComponent(selectedCategory)}`);
        if (!res.ok) throw new Error("Failed to fetch documents");
        return res.json();
      }
    }
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return await apiRequest("/api/library", {
        method: "POST",
        body: data
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library"], exact: false });
      setUploadDialogOpen(false);
      form.reset();
      toast({
        title: "Tải lên thành công",
        description: "Tài liệu đã được thêm vào thư viện"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi tải lên",
        description: error.message || "Không thể tải lên tài liệu",
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/library/${id}`, {
        method: "DELETE"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library"], exact: false });
      toast({
        title: "Đã xóa",
        description: "Tài liệu đã được xóa khỏi thư viện"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi xóa",
        description: error.message || "Không thể xóa tài liệu",
        variant: "destructive"
      });
    }
  });

  const handleUploadSubmit = (data: UploadFormData) => {
    const formData = new FormData();
    formData.append("file", data.file);
    formData.append("title", data.title);
    formData.append("description", data.description || "");
    formData.append("category", data.category);

    uploadMutation.mutate(formData);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold mb-2">Thư viện tài liệu dược học</h1>
          <p className="text-muted-foreground">
            Quản lý tài liệu tham khảo cho phân tích lâm sàng với AI
          </p>
        </div>
        
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-upload-document">
              <Upload className="w-4 h-4 mr-2" />
              Tải lên tài liệu
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Tải lên tài liệu mới</DialogTitle>
              <DialogDescription>
                Thêm tài liệu dược học để AI tham khảo khi phân tích ca bệnh
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleUploadSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="file"
                  render={({ field: { value, onChange, ...fieldProps } }) => (
                    <FormItem>
                      <FormLabel>File tài liệu (PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX)</FormLabel>
                      <FormControl>
                        <Input
                          {...fieldProps}
                          type="file"
                          accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                          data-testid="input-file"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            onChange(file);
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        Tối đa 10MB, hỗ trợ PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tiêu đề *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          data-testid="input-title"
                          placeholder="VD: KDIGO Guidelines 2024"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Danh mục *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-category">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CATEGORIES.filter(c => c !== "All").map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mô tả (tùy chọn)</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          data-testid="input-description"
                          placeholder="Mô tả ngắn gọn nội dung tài liệu..."
                          rows={3}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="outline" data-testid="button-cancel-upload" onClick={() => {
                    setUploadDialogOpen(false);
                    form.reset();
                  }}>
                    Hủy
                  </Button>
                  <Button type="submit" disabled={uploadMutation.isPending} data-testid="button-submit-upload">
                    {uploadMutation.isPending ? "Đang tải lên..." : "Tải lên"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="mb-6">
        <TabsList>
          {CATEGORIES.map(cat => (
            <TabsTrigger key={cat} value={cat} data-testid={`tab-${cat.toLowerCase().replace(" ", "-")}`}>
              {cat}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : documents && documents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {documents.map(doc => (
            <Card key={doc.id} data-testid={`card-document-${doc.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-1">{doc.title}</CardTitle>
                    <CardDescription className="text-xs">{doc.category}</CardDescription>
                  </div>
                  <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0 ml-2" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {doc.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {doc.description}
                  </p>
                )}
                
                <div className="flex items-center text-xs text-muted-foreground gap-4">
                  <div className="flex items-center">
                    <FileText className="w-3 h-3 mr-1" />
                    {doc.fileType.toUpperCase()}
                  </div>
                  <div>{formatFileSize(doc.fileSize)}</div>
                </div>

                <div className="flex items-center text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3 mr-1" />
                  {formatDate(doc.createdAt)}
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      className="w-full"
                      data-testid={`button-delete-${doc.id}`}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Xóa
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
                      <AlertDialogDescription>
                        Bạn có chắc muốn xóa tài liệu "{doc.title}"? Hành động này không thể hoàn tác.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel data-testid="button-cancel-delete">Hủy</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate(doc.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        data-testid="button-confirm-delete"
                      >
                        Xóa
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-16">
            <div className="text-center">
              <BookOpen className="w-16 h-16 mx-auto text-muted-foreground mb-6" />
              <h3 className="text-xl font-semibold mb-2">
                {selectedCategory === "All" 
                  ? "Chưa có tài liệu nào trong thư viện"
                  : `Không có tài liệu trong danh mục "${selectedCategory}"`
                }
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                {selectedCategory === "All"
                  ? "Bắt đầu xây dựng thư viện tài liệu dược học để AI tham khảo khi phân tích ca bệnh"
                  : `Thêm tài liệu ${selectedCategory} để làm phong phú thư viện của bạn`
                }
              </p>
              <Button 
                size="lg"
                onClick={() => setUploadDialogOpen(true)}
                data-testid="button-upload-from-empty"
              >
                <Upload className="w-5 h-5 mr-2" />
                Tải lên tài liệu đầu tiên
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
