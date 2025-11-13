import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, Save } from "lucide-react";
import { Link } from "wouter";

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

  const createCaseMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/cases", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          patientAge: parseInt(data.patientAge) || 0,
          patientWeight: data.patientWeight ? parseFloat(data.patientWeight) : null,
          patientHeight: data.patientHeight ? parseFloat(data.patientHeight) : null,
          admissionDate: new Date(data.admissionDate),
          labResults: {},
        }),
      });
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
    createCaseMutation.mutate(formData);
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
                      required
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
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-2">
                  Kéo thả hoặc click để chọn file
                </p>
                <p className="text-xs text-muted-foreground">
                  Hỗ trợ: PDF, DOCX (sắp ra mắt)
                </p>
                <Button variant="outline" className="mt-4" disabled>
                  <Upload className="w-4 h-4 mr-2" />
                  Chọn file
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
