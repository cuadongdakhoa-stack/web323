import { useState, useRef } from "react";
import { useLocation, Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, Save, Plus, Trash2, FileText, Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Medication {
  id: string;
  drugName: string;
  prescribedDose: string;
  prescribedFrequency: string;
  prescribedRoute: string;
  indication: string;
}

export default function NewCase() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    patientName: "",
    patientAge: "",
    patientGender: "",
    patientWeight: "",
    patientHeight: "",
    admissionDate: new Date().toISOString().split('T')[0],
    diagnosis: "",
    medicalHistory: "",
    allergies: "",
    status: "draft",
  });

  const [medications, setMedications] = useState<Medication[]>([]);
  const [showMedForm, setShowMedForm] = useState(false);
  const [currentMed, setCurrentMed] = useState<Medication>({
    id: "",
    drugName: "",
    prescribedDose: "",
    prescribedFrequency: "",
    prescribedRoute: "Uống",
    indication: "",
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/cases/extract', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setFormData(prev => ({
        ...prev,
        patientName: data.patientName || prev.patientName,
        patientAge: data.patientAge?.toString() || prev.patientAge,
        patientGender: data.patientGender || prev.patientGender,
        patientWeight: data.patientWeight?.toString() || prev.patientWeight,
        patientHeight: data.patientHeight?.toString() || prev.patientHeight,
        diagnosis: data.diagnosis || prev.diagnosis,
        medicalHistory: data.medicalHistory || prev.medicalHistory,
        allergies: data.allergies || prev.allergies,
      }));

      if (data.medications && Array.isArray(data.medications)) {
        const extractedMeds = data.medications.map((med: any, idx: number) => ({
          id: `extracted-${idx}`,
          drugName: med.drugName || '',
          prescribedDose: med.dose || '',
          prescribedFrequency: med.frequency || '',
          prescribedRoute: med.route || 'Uống',
          indication: '',
        }));
        setMedications(extractedMeds);
      }

      setSelectedFile(null);
      toast({
        title: "Trích xuất thành công",
        description: `Đã điền tự động ${data.medications?.length || 0} loại thuốc`,
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
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      uploadMutation.mutate(file);
    }
  };

  const createCaseMutation = useMutation({
    mutationFn: async (data: { caseData: any; medications: Medication[] }) => {
      const caseResponse = await apiRequest("/api/cases", {
        method: "POST",
        body: JSON.stringify({
          ...data.caseData,
          patientAge: parseInt(data.caseData.patientAge) || 0,
          patientWeight: data.caseData.patientWeight ? parseFloat(data.caseData.patientWeight) : null,
          patientHeight: data.caseData.patientHeight ? parseFloat(data.caseData.patientHeight) : null,
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
            orderIndex: i,
          }),
        });
      }
      
      return caseResult;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      toast({
        title: "Tạo ca bệnh thành công",
        description: "Ca bệnh đã được lưu vào hệ thống",
      });
      setLocation(`/cases/${data.id}`);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: error.message || "Không thể tạo ca bệnh",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createCaseMutation.mutate({ caseData: formData, medications });
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addMedication = () => {
    if (!currentMed.drugName || !currentMed.prescribedDose) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Vui lòng nhập tên thuốc và liều dùng",
      });
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
    });
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
        <h1 className="text-3xl font-semibold mb-2">Tạo ca bệnh mới</h1>
        <p className="text-muted-foreground">
          Nhập thông tin bệnh nhân hoặc upload file PDF/Word
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Thông tin bệnh nhân</CardTitle>
                <CardDescription>Nhập đầy đủ thông tin cơ bản của bệnh nhân</CardDescription>
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
                    <Label htmlFor="patientWeight">Cân nặng (kg)</Label>
                    <Input
                      id="patientWeight"
                      data-testid="input-patient-weight"
                      type="number"
                      step="0.1"
                      value={formData.patientWeight}
                      onChange={(e) => handleChange("patientWeight", e.target.value)}
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
                <CardTitle>Thông tin lâm sàng</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="diagnosis">Chẩn đoán <span className="text-destructive">*</span></Label>
                  <Textarea
                    id="diagnosis"
                    data-testid="textarea-diagnosis"
                    value={formData.diagnosis}
                    onChange={(e) => handleChange("diagnosis", e.target.value)}
                    rows={3}
                    required
                  />
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
                <CardTitle>Đơn thuốc</CardTitle>
                <CardDescription>
                  Danh sách thuốc đang dùng ({medications.length} loại)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {medications.length > 0 && (
                  <Table className="mb-4">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tên thuốc</TableHead>
                        <TableHead>Liều dùng</TableHead>
                        <TableHead>Tần suất</TableHead>
                        <TableHead>Đường dùng</TableHead>
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
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="prescribedDose">Liều dùng *</Label>
                        <Input
                          id="prescribedDose"
                          data-testid="input-prescribed-dose"
                          value={currentMed.prescribedDose}
                          onChange={(e) => handleMedChange("prescribedDose", e.target.value)}
                          placeholder="Ví dụ: 500mg"
                        />
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
                {createCaseMutation.isPending ? "Đang lưu..." : "Lưu ca bệnh"}
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
            <CardContent>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="input-file-upload"
              />
              
              <div 
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover-elevate"
                onClick={() => fileInputRef.current?.click()}
                data-testid="upload-dropzone"
              >
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="w-12 h-12 mx-auto text-primary mb-4 animate-spin" />
                    <p className="text-sm font-medium mb-2">Đang trích xuất dữ liệu...</p>
                    <p className="text-xs text-muted-foreground">
                      AI đang phân tích nội dung tài liệu
                    </p>
                  </>
                ) : selectedFile ? (
                  <>
                    <FileText className="w-12 h-12 mx-auto text-green-600 mb-4" />
                    <p className="text-sm font-medium mb-2">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </>
                ) : (
                  <>
                    <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Kéo thả hoặc click để chọn file
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Hỗ trợ: PDF, DOCX
                    </p>
                  </>
                )}
              </div>

              {!uploadMutation.isPending && (
                <Button 
                  variant="outline" 
                  className="w-full mt-4"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-choose-file"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Chọn file
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
