import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import type { ConsultationReport } from '@shared/schema';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function generatePDF(report: ConsultationReport, patientData: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ 
        size: 'A4',
        margin: 50,
        bufferPages: true
      });

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const fontPath = path.join(__dirname, 'fonts');
      doc.registerFont('NotoSans', path.join(fontPath, 'NotoSans-Regular.ttf'));
      doc.registerFont('NotoSans-Bold', path.join(fontPath, 'NotoSans-Bold.ttf'));
      doc.font('NotoSans');

      const content = report.reportContent as any;
      const leftMargin = 70;
      let y = 50;

      doc.font('NotoSans-Bold').fontSize(18).text('PHIẾU TƯ VẤN SỬ DỤNG THUỐC', { align: 'center' });
      doc.font('NotoSans');
      y += 40;

      doc.fontSize(12);
      
      if (content.consultationDate) {
        doc.text(`Ngày tư vấn: ${new Date(content.consultationDate).toLocaleDateString('vi-VN')}`, leftMargin, y);
        y += 20;
      }

      if (content.pharmacistName) {
        doc.text(`Dược sĩ phụ trách: ${content.pharmacistName}`, leftMargin, y);
        y += 30;
      }

      if (patientData) {
        doc.font('NotoSans-Bold').fontSize(14).text('THÔNG TIN BỆNH NHÂN', leftMargin, y, { underline: true });
        doc.font('NotoSans').fontSize(11);
        y += 25;
        
        if (patientData.name) {
          doc.text(`Họ và tên: ${patientData.name}`, leftMargin, y);
          y += 18;
        }
        
        const ageGender = [];
        if (patientData.age) ageGender.push(`Tuổi: ${patientData.age}`);
        if (patientData.gender) ageGender.push(`Giới tính: ${patientData.gender}`);
        if (ageGender.length > 0) {
          doc.text(ageGender.join('  |  '), leftMargin, y);
          y += 18;
        }

        if (content.patientInfo?.diagnosisMain) {
          doc.text(`Chẩn đoán chính: ${content.patientInfo.diagnosisMain}`, leftMargin, y);
          if (content.patientInfo.diagnosisMainIcd) {
            doc.text(` (${content.patientInfo.diagnosisMainIcd})`, { continued: true });
          }
          y += 18;
        }

        y += 15;
      }

      if (content.clinicalAssessment) {
        doc.font('NotoSans-Bold').fontSize(14).text('ĐÁNH GIÁ LÂM SÀNG', leftMargin, y, { underline: true });
        doc.font('NotoSans').fontSize(11);
        y += 25;
        doc.text(content.clinicalAssessment, leftMargin, y, { align: 'justify', width: 480 });
        y = doc.y + 20;
      }

      if (content.recommendations?.length > 0) {
        doc.font('NotoSans-Bold').fontSize(14).text('KHUYẾN NGHỊ', leftMargin, y, { underline: true });
        doc.font('NotoSans').fontSize(11);
        y += 25;
        content.recommendations.forEach((rec: string, idx: number) => {
          doc.text(`${idx + 1}. ${rec}`, leftMargin, y, { align: 'justify', width: 480 });
          y = doc.y + 10;
        });
        y += 10;
      }

      if (content.monitoring?.length > 0) {
        doc.font('NotoSans-Bold').fontSize(14).text('THEO DÕI', leftMargin, y, { underline: true });
        doc.font('NotoSans').fontSize(11);
        y += 25;
        content.monitoring.forEach((item: string, idx: number) => {
          doc.text(`${idx + 1}. ${item}`, leftMargin, y, { align: 'justify', width: 480 });
          y = doc.y + 10;
        });
        y += 10;
      }

      if (content.patientEducation?.length > 0) {
        doc.font('NotoSans-Bold').fontSize(14).text('HƯỚNG DẪN BỆNH NHÂN', leftMargin, y, { underline: true });
        doc.font('NotoSans').fontSize(11);
        y += 25;
        content.patientEducation.forEach((item: string, idx: number) => {
          doc.text(`${idx + 1}. ${item}`, leftMargin, y, { align: 'justify', width: 480 });
          y = doc.y + 10;
        });
        y += 10;
      }

      if (content.followUp) {
        doc.font('NotoSans-Bold').fontSize(14).text('KẾ HOẠCH TÁI KHÁM', leftMargin, y, { underline: true });
        doc.font('NotoSans').fontSize(11);
        y += 25;
        doc.text(content.followUp, leftMargin, y, { align: 'justify', width: 480 });
        y = doc.y + 20;
      }

      doc.fontSize(9).fillColor('#666')
        .text(`Tạo lúc: ${new Date(report.createdAt).toLocaleString('vi-VN')}`, leftMargin, y + 30);

      if (report.approved && report.approvedAt) {
        doc.text(`Phê duyệt: ${new Date(report.approvedAt).toLocaleString('vi-VN')}`, leftMargin, y + 45);
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export async function generateDOCX(report: ConsultationReport, patientData: any): Promise<Buffer> {
  const content = report.reportContent as any;
  
  const children: any[] = [];

  children.push(
    new Paragraph({
      text: 'PHIẾU TƯ VẤN SỬ DỤNG THUỐC',
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 }
    })
  );

  if (content.consultationDate) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Ngày tư vấn: ${new Date(content.consultationDate).toLocaleDateString('vi-VN')}`,
            size: 24
          })
        ],
        spacing: { after: 200 }
      })
    );
  }

  if (content.pharmacistName) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Dược sĩ phụ trách: ${content.pharmacistName}`,
            size: 24
          })
        ],
        spacing: { after: 300 }
      })
    );
  }

  if (patientData) {
    children.push(
      new Paragraph({
        text: 'THÔNG TIN BỆNH NHÂN',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 200 }
      })
    );

    if (patientData.name) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `Họ và tên: ${patientData.name}`, size: 22 })
          ],
          spacing: { after: 150 }
        })
      );
    }

    const ageGender = [];
    if (patientData.age) ageGender.push(`Tuổi: ${patientData.age}`);
    if (patientData.gender) ageGender.push(`Giới tính: ${patientData.gender}`);
    if (ageGender.length > 0) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: ageGender.join('  |  '), size: 22 })
          ],
          spacing: { after: 150 }
        })
      );
    }

    if (content.patientInfo?.diagnosisMain) {
      let diagnosisText = `Chẩn đoán chính: ${content.patientInfo.diagnosisMain}`;
      if (content.patientInfo.diagnosisMainIcd) {
        diagnosisText += ` (${content.patientInfo.diagnosisMainIcd})`;
      }
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: diagnosisText, size: 22 })
          ],
          spacing: { after: 200 }
        })
      );
    }
  }

  if (content.clinicalAssessment) {
    children.push(
      new Paragraph({
        text: 'ĐÁNH GIÁ LÂM SÀNG',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 200 }
      })
    );
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: content.clinicalAssessment, size: 22 })
        ],
        spacing: { after: 200 }
      })
    );
  }

  if (content.recommendations?.length > 0) {
    children.push(
      new Paragraph({
        text: 'KHUYẾN NGHỊ',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 200 }
      })
    );
    content.recommendations.forEach((rec: string, idx: number) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${idx + 1}. ${rec}`, size: 22 })
          ],
          spacing: { after: 150 }
        })
      );
    });
  }

  if (content.monitoring?.length > 0) {
    children.push(
      new Paragraph({
        text: 'THEO DÕI',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 200 }
      })
    );
    content.monitoring.forEach((item: string, idx: number) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${idx + 1}. ${item}`, size: 22 })
          ],
          spacing: { after: 150 }
        })
      );
    });
  }

  if (content.patientEducation?.length > 0) {
    children.push(
      new Paragraph({
        text: 'HƯỚNG DẪN BỆNH NHÂN',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 200 }
      })
    );
    content.patientEducation.forEach((item: string, idx: number) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${idx + 1}. ${item}`, size: 22 })
          ],
          spacing: { after: 150 }
        })
      );
    });
  }

  if (content.followUp) {
    children.push(
      new Paragraph({
        text: 'KẾ HOẠCH TÁI KHÁM',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 200 }
      })
    );
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: content.followUp, size: 22 })
        ],
        spacing: { after: 200 }
      })
    );
  }

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Tạo lúc: ${new Date(report.createdAt).toLocaleString('vi-VN')}`,
          size: 18,
          color: '666666'
        })
      ],
      spacing: { before: 400 }
    })
  );

  if (report.approved && report.approvedAt) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Phê duyệt: ${new Date(report.approvedAt).toLocaleString('vi-VN')}`,
            size: 18,
            color: '666666'
          })
        ],
        spacing: { before: 100 }
      })
    );
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children
    }]
  });

  return await Packer.toBuffer(doc);
}
