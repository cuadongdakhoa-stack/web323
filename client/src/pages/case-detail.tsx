import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft, FileText, Beaker, BookOpen, FileSignature, Pill, Loader2, CheckCircle2, AlertCircle, Search, ExternalLink, Edit, X, Save, Download, FileDown, ClipboardCheck, ShieldCheck, AlertTriangle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Case, Medication, MedicationWithStatus, Analysis, Evidence, ConsultationReport } from "@shared/schema";
import { reportContentSchema } from "@shared/schema";

type ReportContent = z.infer<typeof reportContentSchema>;
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const reportFormSchema = z.object({
  pharmacistName: z.string().min(1, "Tên dược sĩ không được để trống"),
  clinicalAssessment: z.string().min(1, "Đánh giá lâm sàng không được để trống"),
  recommendations: z.string().min(1, "Khuyến nghị không được để trống").refine(
    val => val.split('\n').filter(s => s.trim()).length > 0,
    { message: "Phải có ít nhất một khuyến nghị" }
  ),
  monitoring: z.string().min(1, "Theo dõi không được để trống").refine(
    val => val.split('\n').filter(s => s.trim()).length > 0,
    { message: "Phải có ít nhất một mục theo dõi" }
  ),
  patientEducation: z.string().min(1, "Hướng dẫn bệnh nhân không được để trống").refine(
    val => val.split('\n').filter(s => s.trim()).length > 0,
    { message: "Phải có ít nhất một hướng dẫn" }
  ),
  followUp: z.string().min(1, "Kế hoạch tái khám không được để trống"),
});

export default function CaseDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditingReport, setIsEditingReport] = useState(false);
  const [editedReport, setEditedReport] = useState<ReportContent | null>(null);
  const [evidencePage, setEvidencePage] = useState(1);
  const [evidenceSort, setEvidenceSort] = useState<"date" | "relevance" | "citations">("date");
  const evidencePerPage = 5;
  
  const { data: caseData, isLoading } = useQuery<Case>({
    queryKey: ["/api/cases", id],
    enabled: !!id,
  });

  const { data: medications, isLoading: medicationsLoading } = useQuery<MedicationWithStatus[]>({
    queryKey: ["/api/cases", id, "medications"],
    enabled: !!id,
  });

  const { data: analyses, isLoading: analysesLoading } = useQuery<Analysis[]>({
    queryKey: ["/api/cases", id, "analyses"],
    enabled: !!id,
  });

  const { data: evidence, isLoading: evidenceLoading } = useQuery<Evidence[]>({
    queryKey: ["/api/cases", id, "evidence"],
    enabled: !!id,
  });

  // ICD Check data
  const { data: icdCheckData, isLoading: icdCheckLoading } = useQuery<{
    patientICDList: string[];
    items: Array<{
      drugName: string;
      isInsurance: boolean;
      icdValid: boolean;
      matchedICD?: string;
      matchedPattern?: string;
      requiredPatterns?: string[];
      hasContraindication: boolean;
      contraindicationICD?: string;
      contraindicationPattern?: string;
      contraindicationPatterns?: string[];
    }>;
    summaryText: string;
  }>({
    queryKey: ["/api/cases", id, "icd-check"],
    enabled: !!id,
  });
  
  // Clamp evidencePage when evidence list changes
  useEffect(() => {
    if (evidence && evidence.length > 0) {
      const totalPages = Math.ceil(evidence.length / evidencePerPage);
      if (evidencePage > totalPages) {
        setEvidencePage(totalPages);
      }
    } else if (evidence && evidence.length === 0) {
      setEvidencePage(1);
    }
  }, [evidence, evidencePage, evidencePerPage]);

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const medicationCount = medications?.length || 0;
      if (medicationCount > 20) {
        toast({
          title: "Đang phân tích...",
          description: `Case có ${medicationCount} thuốc, quá trình có thể mất 2-5 phút`,
        });
      }
      return await apiRequest(`/api/cases/${id}/analyze`, {
        method: "POST",
        timeout: 300000,  // 300 seconds (5 minutes) for complex cases with many medications
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "analyses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "evidence"] });
      toast({
        title: "Phân tích thành công",
        description: "Kết quả AI và bằng chứng y khoa đã được lưu",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Lỗi phân tích",
        description: error.message || "Không thể phân tích ca lâm sàng",
      });
    },
  });

  const searchEvidenceMutation = useMutation({
    mutationFn: async (query: string) => {
      return await apiRequest(`/api/cases/${id}/evidence/search`, {
        method: "POST",
        body: JSON.stringify({ query }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "evidence"] });
      setEvidencePage(1); // Reset to page 1 to show newest results first
      toast({
        title: "Tìm kiếm thành công",
        description: "Đã lưu bằng chứng y khoa",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Lỗi tìm kiếm",
        description: error.message || "Không thể tìm kiếm bằng chứng",
      });
    },
  });

  const { data: report, isLoading: reportLoading } = useQuery<ConsultationReport | null>({
    queryKey: ["/api/cases", id, "consultation-report"],
    enabled: !!id,
  });

  const generateReportMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/cases/${id}/reports/generate`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "consultation-report"] });
      toast({
        title: "Tạo phiếu tư vấn thành công",
        description: "AI đã tạo phiếu tư vấn dựa trên kết quả phân tích",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Lỗi tạo phiếu tư vấn",
        description: error.message || "Không thể tạo phiếu tư vấn",
      });
    },
  });

  const updateReportMutation = useMutation({
    mutationFn: async (data: { reportId: string; reportContent: any }) => {
      return await apiRequest(`/api/consultation-reports/${data.reportId}`, {
        method: "PATCH",
        body: JSON.stringify({ reportContent: data.reportContent }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "consultation-report"] });
      setIsEditingReport(false);
      toast({
        title: "Lưu thành công",
        description: "Đã cập nhật phiếu tư vấn",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Lỗi lưu phiếu tư vấn",
        description: error.message || "Không thể lưu thay đổi",
      });
    },
  });

  const deleteAnalysisMutation = useMutation({
    mutationFn: async (analysisId: string) => {
      return await apiRequest(`/api/analyses/${analysisId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", id, "analyses"] });
      toast({
        title: "Đã xóa",
        description: "Phân tích đã được xóa",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Lỗi xóa phân tích",
        description: error.message || "Không thể xóa phân tích",
      });
    },
  });

  const reportForm = useForm<z.infer<typeof reportFormSchema>>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      pharmacistName: "",
      clinicalAssessment: "",
      recommendations: "",
      monitoring: "",
      patientEducation: "",
      followUp: "",
    },
  });

  useEffect(() => {
    if (isEditingReport && report?.reportContent) {
      const content = report.reportContent as ReportContent;
      reportForm.reset({
        pharmacistName: content.pharmacistName || "",
        clinicalAssessment: content.clinicalAssessment || "",
        recommendations: Array.isArray(content.recommendations) 
          ? content.recommendations.join('\n') 
          : "",
        monitoring: Array.isArray(content.monitoring)
          ? content.monitoring.join('\n')
          : "",
        patientEducation: Array.isArray(content.patientEducation)
          ? content.patientEducation.join('\n')
          : "",
        followUp: content.followUp || "",
      });
    }
  }, [isEditingReport, report]);

  const handleSaveReport = (values: z.infer<typeof reportFormSchema>) => {
    if (!report?.id) return;

    const currentContent = (report.reportContent as ReportContent) || {};
    const reportContent: ReportContent = {
      ...currentContent,
      pharmacistName: values.pharmacistName,
      clinicalAssessment: values.clinicalAssessment,
      recommendations: values.recommendations.split('\n').map(r => r.trim()).filter(Boolean),
      monitoring: values.monitoring.split('\n').map(m => m.trim()).filter(Boolean),
      patientEducation: values.patientEducation.split('\n').map(p => p.trim()).filter(Boolean),
      followUp: values.followUp,
      consultationDate: currentContent.consultationDate || new Date().toISOString(),
    };

    updateReportMutation.mutate({ reportId: report.id, reportContent });
  };

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
        <h2 className="text-2xl font-semibold mb-2">Không tìm thấy ca lâm sàng</h2>
        <p className="text-muted-foreground mb-4">Ca lâm sàng không tồn tại hoặc đã bị xóa</p>
        <Button asChild>
          <Link href="/cases">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Quay lại danh sách
          </Link>
        </Button>
      </div>
    );
  }

  // Type-cast reportContent for safe access in JSX
  const reportContent = report?.reportContent ? (report.reportContent as ReportContent) : null;

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
              {caseData.patientAge} tuổi (sinh năm {new Date().getFullYear() - caseData.patientAge}) • {caseData.patientGender}
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
          <TabsTrigger value="medications" data-testid="tab-medications">
            <Pill className="w-4 h-4 mr-2" />
            Đơn thuốc
          </TabsTrigger>
          <TabsTrigger value="icd-check" data-testid="tab-icd-check">
            <ClipboardCheck className="w-4 h-4 mr-2" />
            Kiểm tra mã ICD
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
                <p className="text-sm font-medium text-muted-foreground">Tuổi (năm sinh)</p>
                <p className="text-base">
                  {caseData.patientAge} tuổi (sinh năm {new Date().getFullYear() - caseData.patientAge})
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Giới tính</p>
                <p className="text-base">{caseData.patientGender}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Cân nặng</p>
                <p className="text-base">
                  {caseData.patientWeight ? `${caseData.patientWeight} kg` : "Chưa có dữ liệu"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Chiều cao</p>
                <p className="text-base">
                  {caseData.patientHeight ? `${caseData.patientHeight} cm` : "Chưa có dữ liệu"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Creatinine</p>
                <p className="text-base" data-testid="text-creatinine">
                  {caseData.creatinine 
                    ? `${caseData.creatinine} ${caseData.creatinineUnit || "mg/dL"}` 
                    : "Chưa có"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">CrCl (Cockcroft-Gault)</p>
                <p className="text-base" data-testid="text-egfr">
                  {caseData.egfr ? `${caseData.egfr} mL/min` : "Chưa tính"}
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
                <p className="text-sm font-medium text-muted-foreground mb-1">Chẩn đoán xác định</p>
                <p className="text-base">
                  {caseData.diagnosisMain || caseData.diagnosis}
                  {caseData.icdCodes && typeof caseData.icdCodes === 'object' && 'main' in caseData.icdCodes && caseData.icdCodes.main ? (
                    <span className="ml-2 text-muted-foreground">({String(caseData.icdCodes.main)})</span>
                  ) : null}
                </p>
              </div>

              {/* Hiển thị tất cả mã ICD (chính + phụ) */}
              {caseData.icdCodes && typeof caseData.icdCodes === 'object' && (
                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">📋 Mã bệnh (ICD-10)</p>
                  <div className="space-y-2">
                    {/* Mã bệnh chính */}
                    {caseData.icdCodes.main && (
                      <div>
                        <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Mã chính:</span>
                        <span className="ml-2 font-mono text-sm font-semibold text-blue-900 dark:text-blue-100">
                          {String(caseData.icdCodes.main)}
                        </span>
                      </div>
                    )}
                    
                    {/* Mã bệnh kèm theo */}
                    {Array.isArray(caseData.icdCodes.secondary) && (caseData.icdCodes.secondary as string[]).length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Mã kèm theo ({(caseData.icdCodes.secondary as string[]).length} mã):</span>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {Array.from(new Set(caseData.icdCodes.secondary as string[])).map((icdCode: string, idx: number) => (
                            <span 
                              key={`badge-${icdCode}-${idx}`}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700"
                            >
                              {icdCode}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {caseData.icdCodes && typeof caseData.icdCodes === 'object' && 'secondary' in caseData.icdCodes && Array.isArray(caseData.icdCodes.secondary) && (caseData.icdCodes.secondary as string[]).length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Bệnh kèm theo</p>
                  <ul className="text-base list-disc list-inside">
                    {/* Remove duplicate ICD codes before mapping */}
                    {Array.from(new Set(caseData.icdCodes.secondary as string[])).map((icdCode: string, idx: number) => {
                      // Map ICD codes to disease names
                      const icdNameMap: Record<string, string> = {
                        'N72': 'Viêm cổ tử cung',
                        'B19': 'Viêm gan virus không xác định',
                        'E78': 'Rối loạn chuyển hóa lipoprotein và tình trạng tăng lipid máu khác',
                        'E14': 'Các thể loại đái tháo đường không xác định',
                        'E07': 'Các rối loạn khác của tuyến giáp',
                        'K21': 'Bệnh trào ngược dạ dày - thực quản',
                        'M10': 'Gút (thống phong)',
                        'M19': 'Thoái hóa khớp khác',
                        'N05': 'Hội chứng viêm thận không đặc hiệu',
                        'N20': 'Sỏi thận và niệu quản',
                        'N64': 'Biến đổi khác ở vú',
                        'G55.1*': 'Chèn ép rễ và đám rối thần kinh trong bệnh đĩa đệm cột sống',
                        'G55.1': 'Chèn ép rễ và đám rối thần kinh trong bệnh đĩa đệm cột sống',
                      };
                      const diseaseName = icdNameMap[icdCode] || caseData.diagnosisSecondary?.[idx] || 'Chưa xác định';
                      return (
                        <li key={`${icdCode}-${idx}`}>
                          {diseaseName}
                          <span className="ml-2 text-muted-foreground">({icdCode})</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
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

        <TabsContent value="medications">
          <Card>
            <CardHeader>
              <CardTitle>Đơn thuốc</CardTitle>
              <CardDescription>
                {medications?.length || 0} loại thuốc
              </CardDescription>
            </CardHeader>
            <CardContent>
              {medicationsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : medications && medications.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tên thuốc</TableHead>
                      <TableHead>Hoạt chất</TableHead>
                      <TableHead>Liều dùng</TableHead>
                      <TableHead>Tần suất</TableHead>
                      <TableHead>Đường dùng</TableHead>
                      <TableHead>Thời gian dùng</TableHead>
                      <TableHead>Chỉ định</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {medications.map((med: any) => {
                      const status = med.status || "unknown";
                      const hasStartDate = med.usageStartDate;
                      const hasEndDate = med.usageEndDate;
                      
                      return (
                        <TableRow key={med.id} data-testid={`row-medication-${med.id}`}>
                          <TableCell className="font-medium" data-testid={`text-drug-name-${med.id}`}>
                            {med.drugName}
                          </TableCell>
                          <TableCell>
                            {med.activeIngredient ? (
                              <div className="flex flex-col" data-testid={`text-active-ingredient-${med.id}`}>
                                <span className="text-sm font-medium">{med.activeIngredient}</span>
                                {med.strength && med.unit && (
                                  <span className="text-xs text-muted-foreground">{med.strength} {med.unit}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground italic">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {med.adjustedDose || med.prescribedDose}
                            {med.adjustedDose && med.adjustedDose !== med.prescribedDose && (
                              <Badge variant="secondary" className="ml-2">Đã hiệu chỉnh</Badge>
                            )}
                          </TableCell>
                          <TableCell>{med.adjustedFrequency || med.prescribedFrequency}</TableCell>
                          <TableCell>{med.adjustedRoute || med.prescribedRoute}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1 min-w-[120px]">
                              {hasStartDate || hasEndDate ? (
                                <>
                                  {hasStartDate && (
                                    <div className="flex items-center gap-1 text-sm">
                                      <span className="text-muted-foreground">Từ:</span>
                                      <span className="font-medium text-nowrap">
                                        {new Date(med.usageStartDate).toLocaleDateString('vi-VN', { 
                                          day: '2-digit', 
                                          month: '2-digit', 
                                          year: 'numeric' 
                                        })}
                                      </span>
                                    </div>
                                  )}
                                  {hasEndDate && (
                                    <div className="flex items-center gap-1 text-sm">
                                      <span className="text-muted-foreground">Đến:</span>
                                      <span className="font-medium text-nowrap">
                                        {new Date(med.usageEndDate).toLocaleDateString('vi-VN', { 
                                          day: '2-digit', 
                                          month: '2-digit', 
                                          year: 'numeric' 
                                        })}
                                      </span>
                                    </div>
                                  )}
                                  {med.estimatedDays && med.estimatedDays > 0 && (
                                    <span className="text-xs text-blue-600 font-medium">
                                      ({med.estimatedDays} ngày{med.durationIsEstimated ? ' - ước tính' : ''})
                                    </span>
                                  )}
                                  {!hasEndDate && hasStartDate && (
                                    <span className="text-xs text-green-600 italic">Đang sử dụng</span>
                                  )}
                                </>
                              ) : (
                                <span className="text-sm text-muted-foreground">Chưa có dữ liệu</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">{med.indication || "-"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <Pill className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Chưa có thuốc nào được kê đơn</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>


        <TabsContent value="icd-check">
          <Card>
            <CardHeader>
              <CardTitle>Kiểm tra mã ICD - BHYT</CardTitle>
              <CardDescription>
                Xác minh các thuốc BHYT có đúng mã ICD theo quy định hay không
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {icdCheckLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : icdCheckData && icdCheckData.items && icdCheckData.items.length > 0 ? (
                <>
                  {/* Main Table */}
                  <Table className="table-fixed w-full">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[25%] border-r">Tên thuốc</TableHead>
                        <TableHead className="w-[25%] border-r">Mã ICD</TableHead>
                        <TableHead className="w-[20%] border-r">Chỉ Định</TableHead>
                        <TableHead className="w-[30%]">Chống Chỉ Định</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {icdCheckData.items
                        .filter(item => item.isInsurance !== false)
                        .map((item, idx) => (
                          <TableRow key={idx}>
                            {/* Tên thuốc */}
                            <TableCell className="font-medium border-r">
                              <div className="text-sm break-words">
                                {item.drugName}
                              </div>
                            </TableCell>
                            
                            {/* Mã ICD */}
                            <TableCell className="text-sm border-r">
                              {item.requiredPatterns && item.requiredPatterns.length > 0 ? (
                                <div className="break-words">
                                  <span className="text-blue-700 font-mono text-xs">
                                    {item.requiredPatterns.join(", ")}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground italic text-xs">Chưa cấu hình</span>
                              )}
                            </TableCell>
                            
                            {/* Chỉ Định */}
                            <TableCell className="border-r">
                              {!item.requiredPatterns || item.requiredPatterns.length === 0 ? (
                                <Badge variant="secondary" className="whitespace-nowrap">Chưa cấu hình</Badge>
                              ) : item.icdValid ? (
                                <Badge variant="default" className="bg-green-600 whitespace-nowrap">
                                  Hợp lệ BHYT
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="whitespace-nowrap">
                                  Không hợp lệ BHYT
                                </Badge>
                              )}
                            </TableCell>
                            
                            {/* Chống Chỉ Định */}
                            <TableCell className="text-sm">
                              {!item.contraindicationPatterns || item.contraindicationPatterns.length === 0 ? (
                                <Badge variant="secondary" className="bg-gray-200 text-gray-600 whitespace-nowrap">
                                  Chưa cấu hình
                                </Badge>
                              ) : item.hasContraindication ? (
                                <div className="flex flex-col gap-1">
                                  <Badge variant="destructive" className="gap-1 w-fit whitespace-nowrap">
                                    <AlertTriangle className="w-3 h-3" />
                                    Có ICD chống chỉ định
                                  </Badge>
                                  {item.contraindicationICD && (
                                    <span className="text-red-700 text-xs font-medium break-words">
                                      ICD: {item.contraindicationICD}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <Badge variant="default" className="bg-green-600 hover:bg-green-700 whitespace-nowrap">
                                  Không phát hiện ICD chống chỉ định
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>

                  {/* Patient ICD Info */}
                  {icdCheckData.patientICDList.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                      <p className="text-sm text-blue-900">
                        <strong>Mã ICD của bệnh nhân:</strong> {icdCheckData.patientICDList.join(", ")}
                      </p>
                    </div>
                  )}

                  {/* Info Section */}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4">
                    <h4 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Lưu ý
                    </h4>
                    <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
                      <li>Thuốc BHYT cần có mã ICD phù hợp để tránh bị xuất toán</li>
                      <li>Mã ICD dạng "K21.x" nghĩa là chấp nhận K21.0, K21.9, v.v.</li>
                      <li>Cần cấu hình mã ICD cho thuốc ở phần "Danh mục thuốc"</li>
                    </ul>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <ClipboardCheck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Không có dữ liệu kiểm tra</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Phân tích AI</CardTitle>
                <CardDescription>Kết quả phân tích từ DeepSeek AI</CardDescription>
              </div>
              <Button
                onClick={() => analyzeMutation.mutate()}
                disabled={analyzeMutation.isPending}
                data-testid="button-analyze"
              >
                {analyzeMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Đang phân tích...
                  </>
                ) : (
                  <>
                    <Beaker className="w-4 h-4 mr-2" />
                    Phân tích AI
                  </>
                )}
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {analysesLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : analyses && analyses.length > 0 ? (
                <div className="space-y-4">
                  {analyses.slice().reverse().map((analysis: any) => (
                    <Alert
                      key={analysis.id}
                      variant={analysis.status === "completed" ? "default" : "destructive"}
                      data-testid={`analysis-${analysis.id}`}
                    >
                      <div className="flex items-start gap-3">
                        {analysis.status === "completed" ? (
                          <CheckCircle2 className="w-5 h-5 mt-0.5 text-green-600" />
                        ) : (
                          <AlertCircle className="w-5 h-5 mt-0.5" />
                        )}
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{analysis.analysisType}</Badge>
                              <Badge variant="secondary">{analysis.model}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(analysis.createdAt).toLocaleString("vi-VN")}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={analysis.status === "completed" ? "default" : "destructive"}>
                                {analysis.status === "completed" ? "Hoàn thành" : "Thất bại"}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteAnalysisMutation.mutate(analysis.id)}
                                disabled={deleteAnalysisMutation.isPending}
                                data-testid={`button-delete-analysis-${analysis.id}`}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          
                          {analysis.status === "completed" && analysis.result ? (
                            <div className="space-y-4">
                              {/* Normalize result to object (handle string or object) */}
                              {(() => {
                                const resultObj = typeof analysis.result === 'string' 
                                  ? null  // String result → no structured data
                                  : analysis.result;  // Object result → use it
                                
                                return resultObj?.structuredAnalysis ? (
                                <div className="space-y-3">
                                  {/* Renal Assessment */}
                                  {resultObj.structuredAnalysis.renalAssessment && (
                                    <div>
                                      <h4 className="font-semibold text-sm mb-1" data-testid="heading-renal-assessment">Đánh giá chức năng thận:</h4>
                                      <p className="text-sm text-muted-foreground">{resultObj.structuredAnalysis.renalAssessment}</p>
                                    </div>
                                  )}
                                  
                                  {/* Drug-Drug Interactions (Grouped by Timeline) */}
                                  {resultObj.structuredAnalysis.drugDrugInteractionGroups && resultObj.structuredAnalysis.drugDrugInteractionGroups.length > 0 ? (
                                    <div className="space-y-2">
                                      {resultObj.structuredAnalysis.drugDrugInteractionGroups.map((group: any, idx: number) => (
                                        <div key={idx} className="border-l-2 border-primary pl-3">
                                          <h4 className="font-semibold text-sm mb-1" data-testid={`heading-interactions-group-${idx}`}>
                                            Tương tác thuốc ({group.rangeLabel}):
                                          </h4>
                                          <ul className="list-disc list-inside space-y-0.5">
                                            {group.interactions.map((interaction: string, iIdx: number) => (
                                              <li key={iIdx} className="text-sm text-muted-foreground" data-testid={`interaction-${idx}-${iIdx}`}>
                                                {interaction}
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      ))}
                                    </div>
                                  ) : resultObj.structuredAnalysis.drugDrugInteractions && resultObj.structuredAnalysis.drugDrugInteractions.length > 0 ? (
                                    <div>
                                      <h4 className="font-semibold text-sm mb-1" data-testid="heading-drug-interactions">Tương tác thuốc-thuốc:</h4>
                                      <ul className="list-disc list-inside space-y-0.5">
                                        {resultObj.structuredAnalysis.drugDrugInteractions.map((interaction: string, idx: number) => (
                                          <li key={idx} className="text-sm text-muted-foreground" data-testid={`flat-interaction-${idx}`}>{interaction}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  ) : null}
                                  
                                  {/* Drug-Disease Interactions */}
                                  {resultObj.structuredAnalysis.drugDiseaseInteractions && resultObj.structuredAnalysis.drugDiseaseInteractions.length > 0 && (
                                    <div>
                                      <h4 className="font-semibold text-sm mb-1" data-testid="heading-drug-disease-interactions">Tương tác thuốc-bệnh:</h4>
                                      <ul className="list-disc list-inside space-y-0.5">
                                        {resultObj.structuredAnalysis.drugDiseaseInteractions.map((interaction: string, idx: number) => (
                                          <li key={idx} className="text-sm text-muted-foreground" data-testid={`disease-interaction-${idx}`}>{interaction}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  
                                  {/* Dose Adjustments */}
                                  {resultObj.structuredAnalysis.doseAdjustments && resultObj.structuredAnalysis.doseAdjustments.length > 0 && (
                                    <div>
                                      <h4 className="font-semibold text-sm mb-1" data-testid="heading-dose-adjustments">Điều chỉnh liều:</h4>
                                      <ul className="list-disc list-inside space-y-0.5">
                                        {resultObj.structuredAnalysis.doseAdjustments.map((adjustment: string, idx: number) => (
                                          <li key={idx} className="text-sm text-muted-foreground" data-testid={`dose-adjustment-${idx}`}>{adjustment}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  
                                  {/* Monitoring */}
                                  {resultObj.structuredAnalysis.monitoring && resultObj.structuredAnalysis.monitoring.length > 0 && (
                                    <div>
                                      <h4 className="font-semibold text-sm mb-1" data-testid="heading-monitoring">Theo dõi:</h4>
                                      <ul className="list-disc list-inside space-y-0.5">
                                        {resultObj.structuredAnalysis.monitoring.map((item: string, idx: number) => (
                                          <li key={idx} className="text-sm text-muted-foreground" data-testid={`monitoring-${idx}`}>{item}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  
                                  {/* Warnings */}
                                  {resultObj.structuredAnalysis.warnings && resultObj.structuredAnalysis.warnings.length > 0 && (
                                    <div>
                                      <h4 className="font-semibold text-sm mb-1 text-destructive" data-testid="heading-warnings">Cảnh báo:</h4>
                                      <ul className="list-disc list-inside space-y-0.5">
                                        {resultObj.structuredAnalysis.warnings.map((warning: string, idx: number) => (
                                          <li key={idx} className="text-sm text-destructive" data-testid={`warning-${idx}`}>{warning}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  
                                  {/* Additional Info */}
                                  {resultObj.structuredAnalysis.additionalInfo && (
                                    <div>
                                      <h4 className="font-semibold text-sm mb-1" data-testid="heading-additional-info">Thông tin bổ sung:</h4>
                                      <p className="text-sm text-muted-foreground">{resultObj.structuredAnalysis.additionalInfo}</p>
                                    </div>
                                  )}
                                </div>
                                ) : (
                                /* Fallback to text display for legacy data */
                                <AlertDescription className="whitespace-pre-wrap text-sm" data-testid="analysis-text-fallback">
                                  {typeof analysis.result === 'string' 
                                    ? analysis.result 
                                    : analysis.result.finalAnalysis || JSON.stringify(analysis.result, null, 2)}
                                </AlertDescription>
                                );
                              })()}
                            </div>
                          ) : analysis.error ? (
                            <AlertDescription className="text-sm text-destructive">
                              {analysis.error}
                            </AlertDescription>
                          ) : null}
                        </div>
                      </div>
                    </Alert>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Beaker className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">Chưa có phân tích nào</p>
                  <p className="text-sm text-muted-foreground">
                    Nhấn "Phân tích AI" để bắt đầu phân tích ca lâm sàng
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evidence">
          <Card>
            <CardHeader>
              <CardTitle>Bằng chứng y khoa</CardTitle>
              <CardDescription>Guidelines và nghiên cứu liên quan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Tìm kiếm guidelines, nghiên cứu, khuyến nghị..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && searchQuery.trim()) {
                        searchEvidenceMutation.mutate(searchQuery.trim());
                      }
                    }}
                    disabled={searchEvidenceMutation.isPending}
                    data-testid="input-evidence-search"
                  />
                  <Button
                    onClick={() => searchQuery.trim() && searchEvidenceMutation.mutate(searchQuery.trim())}
                    disabled={!searchQuery.trim() || searchEvidenceMutation.isPending}
                    data-testid="button-search-evidence"
                  >
                    {searchEvidenceMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Đang tìm...
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4 mr-2" />
                        Tìm kiếm
                      </>
                    )}
                  </Button>
                </div>
                {evidence && evidence.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Sắp xếp:</span>
                    <Select 
                      value={evidenceSort} 
                      onValueChange={(v: any) => {
                        setEvidenceSort(v);
                        setEvidencePage(1); // Reset to page 1 when sort changes
                      }} 
                      data-testid="select-evidence-sort"
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date">Mới nhất</SelectItem>
                        <SelectItem value="relevance">Độ liên quan</SelectItem>
                        <SelectItem value="citations">Số trích dẫn</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {evidenceLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : evidence && evidence.length > 0 ? (
                <>
                  <div className="space-y-4">
                    {evidence
                      .slice()
                      .sort((a: any, b: any) => {
                        if (evidenceSort === "date") {
                          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                          return dateB - dateA;
                        } else if (evidenceSort === "relevance") {
                          return (b.relevanceScore || 0) - (a.relevanceScore || 0);
                        } else if (evidenceSort === "citations") {
                          return (b.citationCount || 0) - (a.citationCount || 0);
                        }
                        return 0;
                      })
                      .slice(
                        (evidencePage - 1) * evidencePerPage,
                        evidencePage * evidencePerPage
                      )
                      .map((item: any) => (
                        <Card key={item.id} data-testid={`evidence-${item.id}`}>
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <CardTitle className="text-lg flex items-center gap-2">
                              {item.title}
                              {item.url && (
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              )}
                            </CardTitle>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline">{item.source}</Badge>
                              {item.publicationYear && (
                                <Badge variant="secondary">{item.publicationYear}</Badge>
                              )}
                              {item.citationCount && (
                                <Badge variant="secondary">{item.citationCount} citations</Badge>
                              )}
                              {item.relevanceScore && (
                                <Badge variant="secondary">
                                  {(item.relevanceScore * 100).toFixed(0)}% relevant
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Badge variant={item.verificationStatus === "verified" ? "default" : "secondary"}>
                            {item.verificationStatus === "verified" ? "Đã xác minh" : "Chưa xác minh"}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {item.summary}
                        </p>
                        {item.query && (
                          <p className="text-xs text-muted-foreground mt-4 italic">
                            Query: {item.query}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                      ))}
                  </div>
                  
                  {Math.ceil(evidence.length / evidencePerPage) > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t" data-testid="evidence-pagination">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEvidencePage(p => Math.max(1, p - 1))}
                        disabled={evidencePage === 1}
                        data-testid="button-evidence-prev"
                      >
                        ← Trước
                      </Button>
                      <span className="text-sm text-muted-foreground" data-testid="text-evidence-page">
                        Trang {evidencePage} / {Math.ceil(evidence.length / evidencePerPage)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEvidencePage(p => Math.min(Math.ceil(evidence.length / evidencePerPage), p + 1))}
                        disabled={evidencePage === Math.ceil(evidence.length / evidencePerPage)}
                        data-testid="button-evidence-next"
                      >
                        Sau →
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">Chưa có bằng chứng nào</p>
                  <p className="text-sm text-muted-foreground">
                    Nhập từ khóa và nhấn "Tìm kiếm" để tìm guidelines và nghiên cứu
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="report">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Phiếu tư vấn sử dụng thuốc</CardTitle>
                <CardDescription>Tài liệu chuẩn hóa cho bệnh viện</CardDescription>
              </div>
              <div className="flex gap-2">
                {!isEditingReport ? (
                  <>
                    {report && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsEditingReport(true)}
                          data-testid="button-edit-report"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Chỉnh sửa
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`/api/cases/${id}/consultation-report/export/pdf`, '_blank')}
                          data-testid="button-download-pdf"
                        >
                          <FileDown className="w-4 h-4 mr-2" />
                          PDF
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`/api/cases/${id}/consultation-report/export/docx`, '_blank')}
                          data-testid="button-download-docx"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          DOCX
                        </Button>
                      </>
                    )}
                    <Button
                      onClick={() => generateReportMutation.mutate()}
                      disabled={generateReportMutation.isPending}
                      data-testid="button-generate-report"
                    >
                      {generateReportMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Đang tạo...
                        </>
                      ) : (
                        <>
                          <FileSignature className="w-4 h-4 mr-2" />
                          {report ? "Tạo lại" : "Tạo phiếu"}
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsEditingReport(false);
                        reportForm.reset();
                      }}
                      data-testid="button-cancel-edit"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Hủy
                    </Button>
                    <Button
                      size="sm"
                      onClick={reportForm.handleSubmit(handleSaveReport)}
                      disabled={updateReportMutation.isPending}
                      data-testid="button-save-report"
                    >
                      {updateReportMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Đang lưu...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Lưu
                        </>
                      )}
                    </Button>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {reportLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : report && reportContent ? (
                isEditingReport ? (
                  <Form {...reportForm}>
                    <form onSubmit={reportForm.handleSubmit(handleSaveReport)} className="space-y-6" data-testid="report-edit-form">
                      <FormField
                        control={reportForm.control}
                        name="pharmacistName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Dược sĩ phụ trách</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-pharmacist-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={reportForm.control}
                        name="clinicalAssessment"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Đánh giá lâm sàng</FormLabel>
                            <FormControl>
                              <Textarea {...field} rows={5} data-testid="input-clinical-assessment" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={reportForm.control}
                        name="recommendations"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Khuyến nghị (mỗi dòng một khuyến nghị)</FormLabel>
                            <FormControl>
                              <Textarea {...field} rows={5} data-testid="input-recommendations" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={reportForm.control}
                        name="monitoring"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Theo dõi (mỗi dòng một mục)</FormLabel>
                            <FormControl>
                              <Textarea {...field} rows={4} data-testid="input-monitoring" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={reportForm.control}
                        name="patientEducation"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Hướng dẫn bệnh nhân (mỗi dòng một hướng dẫn)</FormLabel>
                            <FormControl>
                              <Textarea {...field} rows={4} data-testid="input-patient-education" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={reportForm.control}
                        name="followUp"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Kế hoạch tái khám</FormLabel>
                            <FormControl>
                              <Textarea {...field} rows={3} data-testid="input-follow-up" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </form>
                  </Form>
                ) : (
                  <div className="space-y-6" data-testid="report-content">
                  {report.approved && (
                    <Alert>
                      <CheckCircle2 className="w-4 h-4" />
                      <AlertDescription>
                        Phiếu tư vấn đã được phê duyệt vào {new Date(report.approvedAt!).toLocaleString("vi-VN")}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-4">
                    {reportContent?.consultationDate && (
                      <div>
                        <h4 className="font-semibold text-sm text-muted-foreground mb-1">Ngày tư vấn</h4>
                        <p>{new Date(reportContent.consultationDate).toLocaleDateString("vi-VN")}</p>
                      </div>
                    )}

                    {reportContent?.pharmacistName && (
                      <div>
                        <h4 className="font-semibold text-sm text-muted-foreground mb-1">Dược sĩ phụ trách</h4>
                        <p>{reportContent.pharmacistName}</p>
                      </div>
                    )}

                    {reportContent?.clinicalAssessment && (
                      <div>
                        <h4 className="font-semibold mb-2">Đánh giá lâm sàng</h4>
                        <p className="text-sm whitespace-pre-wrap">{reportContent.clinicalAssessment}</p>
                      </div>
                    )}

                    {reportContent?.recommendations && reportContent.recommendations.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2">Khuyến nghị</h4>
                        <ul className="list-disc list-inside space-y-1">
                          {reportContent.recommendations.map((rec: string, idx: number) => (
                            <li key={idx} className="text-sm">{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {reportContent?.monitoring && reportContent.monitoring.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2">Theo dõi</h4>
                        <ul className="list-disc list-inside space-y-1">
                          {reportContent.monitoring.map((item: string, idx: number) => (
                            <li key={idx} className="text-sm">{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {reportContent?.patientEducation && reportContent.patientEducation.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2">Hướng dẫn bệnh nhân</h4>
                        <ul className="list-disc list-inside space-y-1">
                          {reportContent.patientEducation.map((item: string, idx: number) => (
                            <li key={idx} className="text-sm">{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {reportContent?.followUp && (
                      <div>
                        <h4 className="font-semibold mb-2">Kế hoạch tái khám</h4>
                        <p className="text-sm">{reportContent.followUp}</p>
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground pt-4 border-t">
                    Tạo lúc: {new Date(report.createdAt).toLocaleString("vi-VN")}
                  </div>
                  </div>
                )
              ) : (
                <div className="text-center py-12">
                  <FileSignature className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">Chưa có phiếu tư vấn</p>
                  <p className="text-sm text-muted-foreground">
                    Nhấn "Tạo phiếu tư vấn" để AI tạo phiếu dựa trên kết quả phân tích
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
