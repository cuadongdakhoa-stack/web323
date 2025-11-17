import { useState, useRef, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, Upload, Save, Plus, Trash2, FileText, Loader2, X, Calendar, AlertCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ICD10_CODES = [
  { code: "A09", name: "Tiêu chảy và viêm dạ dày ruột nhiễm trùng" },
  { code: "A41.9", name: "Nhiễm trùng huyết không xác định" },
  { code: "E11.9", name: "ĐTĐ typ 2 không biến chứng" },
  { code: "E78.5", name: "Rối loạn lipid máu" },
  { code: "I10", name: "Tăng huyết áp nguyên phát" },
  { code: "I21.9", name: "NMCT cấp không xác định" },
  { code: "I63.9", name: "Nhồi máu não không xác định" },
  { code: "I50.9", name: "Suy tim không xác định" },
  { code: "J18.9", name: "Viêm phổi không xác định" },
  { code: "J45.9", name: "Hen phế quản không biến chứng" },
  { code: "K35", name: "Viêm ruột thừa cấp" },
  { code: "K80.2", name: "Sỏi túi mật không viêm túi mật" },
  { code: "N18.5", name: "Bệnh thận mạn giai đoạn 5" },
  { code: "O80", name: "Đẻ thường" },
  { code: "S06.0", name: "Chấn động não" },
  { code: "Z51.11", name: "Hóa trị ung thư" },
];

interface SecondaryDiagnosis {
  id: string;
  text: string;
  icd: string;
}

interface Medication {
  id: string;
  drugName: string;
  prescribedDose: string;
  prescribedFrequency: string;
  prescribedRoute: string;
  indication: string;
  usageStartDate: string;
  usageEndDate: string;
}

const AUTOSAVE_KEY = "new-case-draft";
const AUTOSAVE_INTERVAL = 30000; // 30 seconds

const INITIAL_FORM_DATA = {
  patientName: "",
  patientAge: "",
  patientGender: "",
  patientWeight: "",
  patientHeight: "",
  creatinine: "",
  creatinineUnit: "mg/dL",
  admissionDate: new Date().toISOString().split('T')[0],
  diagnosisMain: "",
  diagnosisMainIcd: "",
  medicalHistory: "",
  allergies: "",
  status: "draft",
};

export default function NewCase() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const loadDraft = () => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed;
      }
    } catch (error) {
      console.error("Failed to load draft:", error);
    }
    return null;
  };

  const draft = loadDraft();
  
  const [formData, setFormData] = useState(draft?.formData || INITIAL_FORM_DATA);

  const [secondaryDiagnoses, setSecondaryDiagnoses] = useState<SecondaryDiagnosis[]>(draft?.secondaryDiagnoses || []);
  const [currentSecondary, setCurrentSecondary] = useState({ text: "", icd: "" });
  const [showSecondaryForm, setShowSecondaryForm] = useState(false);

  const [medications, setMedications] = useState<Medication[]>(draft?.medications || []);
  const [showMedForm, setShowMedForm] = useState(false);
  const [medFormErrors, setMedFormErrors] = useState<Record<string, string>>({});
  const [currentMed, setCurrentMed] = useState<Medication>({
    id: "",
    drugName: "",
    prescribedDose: "",
    prescribedFrequency: "",
    prescribedRoute: "Uống",
    indication: "",
    usageStartDate: "",
    usageEndDate: "",
  });

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (draft) {
      toast({
        title: "Đã khôi phục bản nháp",
        description: "Dữ liệu form đã được tự động lưu trước đó",
      });
    }
  }, []);

  useEffect(() => {
    const hasChanged = Object.keys(formData).some(key => {
      const currentValue = formData[key as keyof typeof formData];
      const initialValue = INITIAL_FORM_DATA[key as keyof typeof INITIAL_FORM_DATA];
      return currentValue !== initialValue;
    });
    const hasData = hasChanged || medications.length > 0 || secondaryDiagnoses.length > 0;
    
    if (!hasData) return;

    const interval = setInterval(() => {
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({
          formData,
          medications,
          secondaryDiagnoses,
          savedAt: new Date().toISOString(),
        }));
        console.log("Auto-saved draft at", new Date().toLocaleTimeString());
      } catch (error) {
        console.error("Failed to auto-save:", error);
      }
    }, AUTOSAVE_INTERVAL);

    return () => clearInterval(interval);
  }, [formData, medications, secondaryDiagnoses]);

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const allExtractedData: any[] = [];
      const errors: string[] = [];
      const failedFiles: File[] = [];
      
      try {
        setIsExtracting(true);
        
        for (const file of files) {
          try {
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetch('/api/cases/extract', {
              method: 'POST',
              body: formData,
              credentials: 'include',
            });

            if (!response.ok) {
              const error = await response.json();
              errors.push(`${file.name}: ${error.message || 'Upload failed'}`);
              failedFiles.push(file);
              continue;
            }

            const data = await response.json();
            allExtractedData.push(data);
          } catch (error: any) {
            errors.push(`${file.name}: ${error.message || 'Lỗi không xác định'}`);
            failedFiles.push(file);
          }
        }
        
        if (errors.length > 0 && allExtractedData.length === 0) {
          throw new Error(`Không thể phân tích file:\n${errors.join('\n')}`);
        }
        
        return { data: allExtractedData, errors, failedFiles };
      } finally {
        setIsExtracting(false);
      }
    },
    onSuccess: (result) => {
      const { data: allData, errors, failedFiles } = result;
      
      if (!allData || allData.length === 0) {
        toast({
          variant: "destructive",
          title: "Không có dữ liệu",
          description: "Không thể trích xuất thông tin từ bất kỳ file nào",
        });
        setSelectedFiles(failedFiles);
        return;
      }

      let totalMeds = 0;

      allData.forEach((data) => {
        if (!data || typeof data !== 'object') return;

        setFormData((prev: typeof formData) => {
          const smartMerge = (newVal: any, oldVal: any) => {
            if (newVal !== null && newVal !== undefined && newVal !== '') return newVal;
            return oldVal;
          };

          return {
            ...prev,
            patientName: smartMerge(data.patientName, prev.patientName),
            patientAge: smartMerge(data.patientAge?.toString(), prev.patientAge),
            patientGender: smartMerge(data.patientGender, prev.patientGender),
            patientWeight: smartMerge(data.patientWeight?.toString(), prev.patientWeight),
            patientHeight: smartMerge(data.patientHeight?.toString(), prev.patientHeight),
            admissionDate: smartMerge(data.admissionDate, prev.admissionDate),
            diagnosisMain: smartMerge(data.diagnosisMain || data.diagnosis, prev.diagnosisMain),
            diagnosisMainIcd: smartMerge(data.icdCodes?.main, prev.diagnosisMainIcd),
            medicalHistory: smartMerge(data.medicalHistory, prev.medicalHistory),
            allergies: smartMerge(data.allergies, prev.allergies),
            creatinine: smartMerge(data.labResults?.creatinine?.toString(), prev.creatinine),
            creatinineUnit: smartMerge(data.labResults?.creatinineUnit, prev.creatinineUnit),
          };
        });
        
        if (data.diagnosisSecondary && Array.isArray(data.diagnosisSecondary) && data.diagnosisSecondary.length > 0) {
          const baseTimestamp = Date.now();
          const newSecondaryDiagnoses = data.diagnosisSecondary.map((text: string, idx: number) => ({
            id: `extracted-secondary-${baseTimestamp + idx}`,
            text: text,
            icd: data.icdCodes?.secondary?.[idx] || "",
          }));
          setSecondaryDiagnoses(prev => [...prev, ...newSecondaryDiagnoses]);
        }

        if (data.medications && Array.isArray(data.medications) && data.medications.length > 0) {
          setMedications(prev => {
            const seenMedications = new Set<string>(
              prev.map(m => `${m.drugName.trim().toLowerCase()}_${m.usageStartDate || ''}_${m.usageEndDate || ''}`)
            );
            
            const extractedMeds = data.medications
              .filter((med: any) => {
                if (!med.drugName || !med.drugName.trim()) return false;
                
                const medKey = `${med.drugName.trim().toLowerCase()}_${med.usageStartDate || ''}_${med.usageEndDate || ''}`;
                if (seenMedications.has(medKey)) return false;
                seenMedications.add(medKey);
                return true;
              })
              .map((med: any) => {
                let startDate = '';
                let endDate = '';
                
                if (med.usageStartDate) {
                  try {
                    const start = new Date(med.usageStartDate);
                    if (!isNaN(start.getTime())) {
                      startDate = med.usageStartDate;
                    }
                  } catch (e) {}
                }
                
                if (med.usageEndDate) {
                  try {
                    const end = new Date(med.usageEndDate);
                    if (!isNaN(end.getTime())) {
                      if (startDate && med.usageEndDate < startDate) {
                        console.warn(`Medication ${med.drugName}: endDate < startDate, skipping endDate`);
                      } else {
                        endDate = med.usageEndDate;
                      }
                    }
                  } catch (e) {}
                }
                
                return {
                  id: crypto.randomUUID(),
                  drugName: med.drugName.trim(),
                  prescribedDose: med.dose || '',
                  prescribedFrequency: med.frequency || '',
                  prescribedRoute: med.route || 'Uống',
                  indication: '',
                  usageStartDate: startDate,
                  usageEndDate: endDate,
                };
              });
            
            totalMeds += extractedMeds.length;
            return [...prev, ...extractedMeds];
          });
        }
      });

      setSelectedFiles(failedFiles);
      
      const successMsg = `Đã phân tích ${allData.length} file${totalMeds > 0 ? ` và trích xuất ${totalMeds} loại thuốc` : ''}`;
      let errorMsg = '';
      
      if (errors.length > 0) {
        const failedNames = failedFiles.map(f => f.name).join(', ');
        errorMsg = `\n\nFile thất bại (${errors.length}): ${failedNames}`;
      }
      
      toast({
        title: errors.length > 0 ? "Phân tích một phần" : "Phân tích thành công",
        description: successMsg + errorMsg,
        variant: errors.length > 0 ? "default" : "default",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Lỗi upload",
        description: error.message || "Không thể trích xuất dữ liệu từ file",
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newFiles = Array.from(files);
      
      const existingKeys = new Set(
        selectedFiles.map(f => `${f.name}_${f.size}`)
      );
      
      const uniqueNewFiles = newFiles.filter(file => {
        const fileKey = `${file.name}_${file.size}`;
        if (existingKeys.has(fileKey)) {
          return false;
        }
        existingKeys.add(fileKey);
        return true;
      });
      
      if (uniqueNewFiles.length < newFiles.length) {
        const duplicateCount = newFiles.length - uniqueNewFiles.length;
        toast({
          title: "File trùng lặp",
          description: `Đã bỏ qua ${duplicateCount} file trùng lặp`,
        });
      }
      
      setSelectedFiles(prev => [...prev, ...uniqueNewFiles]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAnalyze = () => {
    if (selectedFiles.length > 0) {
      uploadMutation.mutate(selectedFiles);
    }
  };

  const createCaseMutation = useMutation({
    mutationFn: async (data: { caseData: any; medications: Medication[]; secondaryDiagnoses: SecondaryDiagnosis[] }) => {
      const icdCodes = {
        main: data.caseData.diagnosisMainIcd || "",
        secondary: data.secondaryDiagnoses.filter(d => d.icd).map(d => d.icd),
      };

      const { diagnosisMainIcd, ...caseDataWithoutUIFields } = data.caseData;

      const caseResponse = await apiRequest("/api/cases", {
        method: "POST",
        body: JSON.stringify({
          ...caseDataWithoutUIFields,
          diagnosis: data.caseData.diagnosisMain,
          diagnosisMain: data.caseData.diagnosisMain,
          diagnosisSecondary: data.secondaryDiagnoses.map(d => d.text),
          icdCodes,
          admissionDate: new Date(data.caseData.admissionDate).toISOString(),
          patientAge: parseInt(data.caseData.patientAge) || 0,
          patientWeight: data.caseData.patientWeight ? parseFloat(data.caseData.patientWeight) : null,
          patientHeight: data.caseData.patientHeight ? parseFloat(data.caseData.patientHeight) : null,
          creatinine: data.caseData.creatinine ? parseFloat(data.caseData.creatinine) : null,
          creatinineUnit: data.caseData.creatinineUnit || "mg/dL",
          labResults: {},
        }),
      });
      
      const caseResult = await caseResponse.json();
      
      for (let i = 0; i < data.medications.length; i++) {
        const med = data.medications[i];
        await apiRequest("/api/medications", {
          method: "POST",
          body: JSON.stringify({
            caseId: caseResult.id,
            drugName: med.drugName,
            prescribedDose: med.prescribedDose,
            prescribedFrequency: med.prescribedFrequency,
            prescribedRoute: med.prescribedRoute,
            indication: med.indication || "",
            usageStartDate: med.usageStartDate ? new Date(med.usageStartDate).toISOString() : null,
            usageEndDate: med.usageEndDate ? new Date(med.usageEndDate).toISOString() : null,
            orderIndex: i,
          }),
        });
      }
      
      return caseResult;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      localStorage.removeItem(AUTOSAVE_KEY);
      toast({
        title: "Tạo ca lâm sàng thành công",
        description: "Ca lâm sàng đã được lưu vào hệ thống",
      });
      setLocation(`/cases/${data.id}`);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error.message || "Không thể tạo ca lâm sàng",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const errors: string[] = [];
    
    if (!formData.patientName.trim()) errors.push("Họ và tên bệnh nhân");
    if (!formData.patientAge) errors.push("Tuổi bệnh nhân");
    if (!formData.patientGender) errors.push("Giới tính bệnh nhân");
    if (!formData.patientWeight) errors.push("Cân nặng bệnh nhân");
    if (!formData.diagnosisMain.trim()) errors.push("Chẩn đoán xác định");
    
    if (errors.length > 0) {
      setFormErrors(errors);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    
    setFormErrors([]);
    createCaseMutation.mutate({ caseData: formData, medications, secondaryDiagnoses });
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev: typeof formData) => ({ ...prev, [field]: value }));
    if (formErrors.length > 0) {
      setFormErrors([]);
    }
  };

  const addMedication = () => {
    if (!validateMedForm()) {
      return;
    }
    
    const newMed = {
      ...currentMed,
      id: Date.now().toString(),
    };
    setMedications(prev => [...prev, newMed]);
    setCurrentMed({
      id: "",
      drugName: "",
      prescribedDose: "",
      prescribedFrequency: "",
      prescribedRoute: "Uống",
      indication: "",
      usageStartDate: "",
      usageEndDate: "",
    });
    setMedFormErrors({});
    setShowMedForm(false);
    toast({
      title: "Đã thêm thuốc",
      description: `${newMed.drugName} đã được thêm vào danh sách`,
    });
  };

  const removeMedication = (id: string) => {
    setMedications(prev => prev.filter(m => m.id !== id));
    toast({
      title: "Đã xóa thuốc",
    });
  };

  const handleMedChange = (field: keyof Medication, value: string) => {
    setCurrentMed(prev => ({ ...prev, [field]: value }));
    if (medFormErrors[field]) {
      setMedFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateMedForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!currentMed.drugName.trim()) {
      errors.drugName = "Vui lòng nhập tên thuốc";
    }
    if (!currentMed.prescribedDose.trim()) {
      errors.prescribedDose = "Vui lòng nhập liều dùng";
    }
    if (!currentMed.usageStartDate) {
      errors.usageStartDate = "Bắt buộc để kiểm tra tương tác thuốc chính xác";
    }
    
    if (currentMed.usageStartDate && formData.admissionDate) {
      const startDate = new Date(currentMed.usageStartDate);
      const admissionDate = new Date(formData.admissionDate);
      if (startDate < admissionDate) {
        errors.usageStartDate = "Không thể trước ngày nhập viện";
      }
    }
    
    if (currentMed.usageEndDate && currentMed.usageStartDate) {
      const endDate = new Date(currentMed.usageEndDate);
      const startDate = new Date(currentMed.usageStartDate);
      if (endDate < startDate) {
        errors.usageEndDate = "Phải sau hoặc bằng ngày bắt đầu";
      }
    }
    
    setMedFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/cases">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Quay lại danh sách
          </Link>
        </Button>
        <h1 className="text-3xl font-semibold mb-2">Tạo ca lâm sàng mới</h1>
        <p className="text-muted-foreground">
          Nhập thông tin bệnh nhân hoặc upload file PDF/Word
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="space-y-6">
            {formErrors.length > 0 && (
              <Alert variant="destructive" className="sticky top-2 z-10 shadow-lg" data-testid="form-error-banner">
                <AlertCircle className="w-4 h-4" />
                <AlertTitle>Vui lòng kiểm tra lại thông tin</AlertTitle>
                <AlertDescription>
                  <p className="mb-2">Các trường sau đang thiếu hoặc không hợp lệ:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {formErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                    1
                  </div>
                  <div>
                    <CardTitle>Thông tin bệnh nhân</CardTitle>
                    <CardDescription>Nhập đầy đủ thông tin cơ bản của bệnh nhân</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="patientName">Họ và tên <span className="text-destructive">*</span></Label>
                    <Input
                      id="patientName"
                      data-testid="input-patient-name"
                      value={formData.patientName}
                      onChange={(e) => handleChange("patientName", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="patientAge">Tuổi <span className="text-destructive">*</span></Label>
                    <Input
                      id="patientAge"
                      data-testid="input-patient-age"
                      type="number"
                      value={formData.patientAge}
                      onChange={(e) => handleChange("patientAge", e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="patientGender">Giới tính <span className="text-destructive">*</span></Label>
                    <Select
                      value={formData.patientGender}
                      onValueChange={(value) => handleChange("patientGender", value)}
                    >
                      <SelectTrigger id="patientGender" data-testid="select-patient-gender">
                        <SelectValue placeholder="Chọn" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Nam">Nam</SelectItem>
                        <SelectItem value="Nữ">Nữ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="patientWeight">Cân nặng (kg) <span className="text-destructive">*</span></Label>
                    <Input
                      id="patientWeight"
                      data-testid="input-patient-weight"
                      type="number"
                      step="0.1"
                      value={formData.patientWeight}
                      onChange={(e) => handleChange("patientWeight", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="patientHeight">Chiều cao (cm)</Label>
                    <Input
                      id="patientHeight"
                      data-testid="input-patient-height"
                      type="number"
                      step="0.1"
                      value={formData.patientHeight}
                      onChange={(e) => handleChange("patientHeight", e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="creatinine">Creatinine huyết thanh</Label>
                    <Input
                      id="creatinine"
                      data-testid="input-creatinine"
                      type="number"
                      step="0.01"
                      placeholder="Ví dụ: 1.2 hoặc 106"
                      value={formData.creatinine}
                      onChange={(e) => handleChange("creatinine", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="creatinineUnit">Đơn vị</Label>
                    <Select
                      value={formData.creatinineUnit}
                      onValueChange={(value) => handleChange("creatinineUnit", value)}
                    >
                      <SelectTrigger id="creatinineUnit" data-testid="select-creatinine-unit">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mg/dL">mg/dL</SelectItem>
                        <SelectItem value="micromol/L">micromol/L</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <p className="text-sm text-muted-foreground">
                      eGFR tự động tính theo CKD-EPI
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admissionDate">Ngày nhập viện <span className="text-destructive">*</span></Label>
                  <Input
                    id="admissionDate"
                    data-testid="input-admission-date"
                    type="date"
                    value={formData.admissionDate}
                    onChange={(e) => handleChange("admissionDate", e.target.value)}
                    required
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                    2
                  </div>
                  <CardTitle>Thông tin lâm sàng</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="diagnosisMain">Chẩn đoán xác định <span className="text-destructive">*</span></Label>
                  <Textarea
                    id="diagnosisMain"
                    data-testid="textarea-diagnosis-main"
                    value={formData.diagnosisMain}
                    onChange={(e) => handleChange("diagnosisMain", e.target.value)}
                    rows={2}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="diagnosisMainIcd">Mã ICD chẩn đoán xác định</Label>
                  <Input
                    id="diagnosisMainIcd"
                    data-testid="input-diagnosis-main-icd"
                    value={formData.diagnosisMainIcd}
                    onChange={(e) => handleChange("diagnosisMainIcd", e.target.value)}
                    placeholder="Ví dụ: I10"
                    list="icd-suggestions"
                  />
                  <datalist id="icd-suggestions">
                    {ICD10_CODES.map((icd) => (
                      <option key={icd.code} value={icd.code}>{icd.code} - {icd.name}</option>
                    ))}
                  </datalist>
                </div>

                <div className="space-y-2">
                  <Label>Bệnh kèm theo</Label>
                  {secondaryDiagnoses.length > 0 && (
                    <div className="space-y-2 mb-2">
                      {secondaryDiagnoses.map((diag) => (
                        <div key={diag.id} className="flex items-center gap-2 p-2 border rounded-md" data-testid={`secondary-diagnosis-${diag.id}`}>
                          <div className="flex-1">
                            <p className="text-sm">{diag.text}</p>
                            {diag.icd && <Badge variant="outline" className="mt-1">{diag.icd}</Badge>}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setSecondaryDiagnoses(prev => prev.filter(d => d.id !== diag.id))}
                            data-testid={`button-remove-secondary-${diag.id}`}
                          >
                            <X className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {showSecondaryForm ? (
                    <div className="space-y-2 p-3 border rounded-md bg-muted/30">
                      <div className="space-y-2">
                        <Label htmlFor="secondaryText">Chẩn đoán</Label>
                        <Textarea
                          id="secondaryText"
                          data-testid="textarea-secondary-text"
                          value={currentSecondary.text}
                          onChange={(e) => setCurrentSecondary(prev => ({ ...prev, text: e.target.value }))}
                          rows={2}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="secondaryIcd">Mã ICD</Label>
                        <Input
                          id="secondaryIcd"
                          data-testid="input-secondary-icd"
                          value={currentSecondary.icd}
                          onChange={(e) => setCurrentSecondary(prev => ({ ...prev, icd: e.target.value }))}
                          placeholder="Ví dụ: E11.9"
                          list="icd-suggestions"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            if (currentSecondary.text) {
                              setSecondaryDiagnoses(prev => [...prev, { id: Date.now().toString(), ...currentSecondary }]);
                              setCurrentSecondary({ text: "", icd: "" });
                              setShowSecondaryForm(false);
                            }
                          }}
                          data-testid="button-confirm-add-secondary"
                        >
                          Thêm
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setCurrentSecondary({ text: "", icd: "" });
                            setShowSecondaryForm(false);
                          }}
                        >
                          Hủy
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSecondaryForm(true)}
                      data-testid="button-add-secondary"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Thêm bệnh kèm theo
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="medicalHistory">Tiền sử bệnh</Label>
                  <Textarea
                    id="medicalHistory"
                    data-testid="textarea-medical-history"
                    value={formData.medicalHistory}
                    onChange={(e) => handleChange("medicalHistory", e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="allergies">Dị ứng</Label>
                  <Textarea
                    id="allergies"
                    data-testid="textarea-allergies"
                    value={formData.allergies}
                    onChange={(e) => handleChange("allergies", e.target.value)}
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                    3
                  </div>
                  <div>
                    <CardTitle>Đơn thuốc</CardTitle>
                    <CardDescription>
                      Danh sách thuốc đang dùng ({medications.length} loại)
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {medications.length > 0 && (
                  <div className="mb-4 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tên thuốc</TableHead>
                          <TableHead>Liều dùng</TableHead>
                          <TableHead>Tần suất</TableHead>
                          <TableHead>Đường dùng</TableHead>
                          <TableHead className="min-w-[200px]">Thời gian dùng</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {medications.map((med) => (
                          <TableRow key={med.id} data-testid={`row-medication-${med.id}`}>
                            <TableCell className="font-medium">{med.drugName}</TableCell>
                            <TableCell>{med.prescribedDose}</TableCell>
                            <TableCell>{med.prescribedFrequency}</TableCell>
                            <TableCell>{med.prescribedRoute}</TableCell>
                            <TableCell className="text-sm">
                              {med.usageStartDate || med.usageEndDate ? (
                                <div className="space-y-1">
                                  {med.usageStartDate && (
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                      <Calendar className="w-3 h-3" />
                                      <span>Từ: {new Date(med.usageStartDate).toLocaleDateString('vi-VN')}</span>
                                    </div>
                                  )}
                                  {med.usageEndDate && (
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                      <Calendar className="w-3 h-3" />
                                      <span>Đến: {new Date(med.usageEndDate).toLocaleDateString('vi-VN')}</span>
                                    </div>
                                  )}
                                  {med.usageStartDate && !med.usageEndDate && (
                                    <span className="text-xs text-primary">(Đang dùng)</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">Chưa nhập ngày</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeMedication(med.id)}
                                data-testid={`button-remove-${med.id}`}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {showMedForm ? (
                  <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="drugName">Tên thuốc *</Label>
                        <Input
                          id="drugName"
                          data-testid="input-drug-name"
                          value={currentMed.drugName}
                          onChange={(e) => handleMedChange("drugName", e.target.value)}
                          placeholder="Ví dụ: Paracetamol"
                          className={medFormErrors.drugName ? "border-destructive" : ""}
                        />
                        {medFormErrors.drugName && (
                          <p className="text-sm text-destructive" data-testid="error-drug-name">
                            {medFormErrors.drugName}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="prescribedDose">Liều dùng *</Label>
                        <Input
                          id="prescribedDose"
                          data-testid="input-prescribed-dose"
                          value={currentMed.prescribedDose}
                          onChange={(e) => handleMedChange("prescribedDose", e.target.value)}
                          placeholder="Ví dụ: 500mg"
                          className={medFormErrors.prescribedDose ? "border-destructive" : ""}
                        />
                        {medFormErrors.prescribedDose && (
                          <p className="text-sm text-destructive" data-testid="error-prescribed-dose">
                            {medFormErrors.prescribedDose}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="prescribedFrequency">Tần suất</Label>
                        <Input
                          id="prescribedFrequency"
                          data-testid="input-prescribed-frequency"
                          value={currentMed.prescribedFrequency}
                          onChange={(e) => handleMedChange("prescribedFrequency", e.target.value)}
                          placeholder="Ví dụ: 3 lần/ngày"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="prescribedRoute">Đường dùng</Label>
                        <Select
                          value={currentMed.prescribedRoute}
                          onValueChange={(value) => handleMedChange("prescribedRoute", value)}
                        >
                          <SelectTrigger id="prescribedRoute" data-testid="select-prescribed-route">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Uống">Uống</SelectItem>
                            <SelectItem value="Tiêm tĩnh mạch">Tiêm tĩnh mạch</SelectItem>
                            <SelectItem value="Tiêm bắp">Tiêm bắp</SelectItem>
                            <SelectItem value="Bôi">Bôi</SelectItem>
                            <SelectItem value="Nhỏ">Nhỏ</SelectItem>
                            <SelectItem value="Khác">Khác</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="indication">Chỉ định</Label>
                      <Input
                        id="indication"
                        data-testid="input-indication"
                        value={currentMed.indication}
                        onChange={(e) => handleMedChange("indication", e.target.value)}
                        placeholder="Chỉ định sử dụng thuốc"
                      />
                    </div>

                    <div className="p-3 bg-primary/5 border border-primary/20 rounded-md space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-primary">
                        <Calendar className="w-4 h-4" />
                        <span>Thời gian sử dụng thuốc</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="usageStartDate" className="text-sm">
                            Ngày bắt đầu dùng <span className="text-primary">*</span>
                          </Label>
                          <Input
                            id="usageStartDate"
                            data-testid="input-usage-start-date"
                            type="date"
                            value={currentMed.usageStartDate}
                            onChange={(e) => handleMedChange("usageStartDate", e.target.value)}
                            min={formData.admissionDate}
                            className={medFormErrors.usageStartDate ? "border-destructive" : "border-primary/30"}
                          />
                          {medFormErrors.usageStartDate ? (
                            <p className="text-xs text-destructive" data-testid="error-usage-start-date">
                              {medFormErrors.usageStartDate}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Bắt buộc để kiểm tra tương tác thuốc chính xác
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="usageEndDate" className="text-sm">
                            Ngày kết thúc dùng
                          </Label>
                          <Input
                            id="usageEndDate"
                            data-testid="input-usage-end-date"
                            type="date"
                            value={currentMed.usageEndDate}
                            onChange={(e) => handleMedChange("usageEndDate", e.target.value)}
                            min={currentMed.usageStartDate || formData.admissionDate}
                            className={medFormErrors.usageEndDate ? "border-destructive" : "border-primary/30"}
                          />
                          {medFormErrors.usageEndDate ? (
                            <p className="text-xs text-destructive" data-testid="error-usage-end-date">
                              {medFormErrors.usageEndDate}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Để trống nếu thuốc đang dùng
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={addMedication}
                        data-testid="button-confirm-add-medication"
                      >
                        Thêm thuốc
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowMedForm(false)}
                      >
                        Hủy
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowMedForm(true)}
                    data-testid="button-add-medication"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Thêm thuốc
                  </Button>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={createCaseMutation.isPending}
                data-testid="button-save-case"
              >
                <Save className="w-4 h-4 mr-2" />
                {createCaseMutation.isPending ? "Đang lưu..." : "Lưu ca lâm sàng"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/cases">Hủy</Link>
              </Button>
            </div>
          </form>
        </div>

        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Upload tài liệu</CardTitle>
              <CardDescription>Tự động trích xuất thông tin từ file</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.jpg,.jpeg,.png"
                onChange={handleFileSelect}
                className="hidden"
                multiple
                data-testid="input-file-upload"
              />
              
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">File đã chọn ({selectedFiles.length}):</p>
                  {selectedFiles.map((file, index) => (
                    <div 
                      key={index}
                      className="flex items-center gap-2 p-2 border rounded-lg bg-muted/50"
                    >
                      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveFile(index)}
                        className="flex-shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div 
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover-elevate"
                onClick={() => !uploadMutation.isPending && fileInputRef.current?.click()}
                data-testid="upload-dropzone"
              >
                <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-1">
                  Click để chọn file
                </p>
                <p className="text-xs text-muted-foreground">
                  Hỗ trợ: PDF, DOC, DOCX, JPG, PNG
                </p>
              </div>

              <div className="flex gap-2">
                {!uploadMutation.isPending && (
                  <>
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="button-choose-file"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Thêm file
                    </Button>
                    {selectedFiles.length > 0 && (
                      <Button 
                        className="flex-1"
                        onClick={handleAnalyze}
                        data-testid="button-analyze"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Phân tích
                      </Button>
                    )}
                  </>
                )}
                {uploadMutation.isPending && (
                  <div className="flex-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang phân tích {selectedFiles.length} file...
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
