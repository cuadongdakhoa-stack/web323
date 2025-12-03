/**
 * ICD-10 MAPPING TABLE
 * Chuẩn hóa tên bệnh tiếng Việt → Mã ICD-10
 */

export interface ICD10Mapping {
  vietnameseName: string[];
  icdCode: string;
  englishName: string;
}

/**
 * Bảng mapping ICD-10 chuẩn
 * Tham khảo: WHO ICD-10 Classification
 */
export const ICD10_MAPPING: ICD10Mapping[] = [
  // B: Infectious and parasitic diseases
  {
    vietnameseName: ['viêm âm đạo do candida', 'nấm candida âm đạo', 'candida vaginitis'],
    icdCode: 'B37.3',
    englishName: 'Candidiasis of vulva and vagina'
  },
  {
    vietnameseName: ['h. pylori', 'vi khuẩn hp', 'helicobacter pylori', 'h pylori là căn nguyên gây bệnh'],
    icdCode: 'B96.81',
    englishName: 'Helicobacter pylori as the cause of diseases'
  },
  
  // E: Endocrine, nutritional and metabolic diseases
  {
    vietnameseName: ['hạ calci huyết', 'giảm canxi máu', 'hypocalcemia'],
    icdCode: 'E83.41',
    englishName: 'Hypocalcemia'
  },
  {
    vietnameseName: ['hạ magnesi huyết', 'giảm magiê máu', 'hypomagnesemia'],
    icdCode: 'E83.42',
    englishName: 'Hypomagnesemia'
  },
  {
    vietnameseName: ['rối loạn chuyển hóa kali', 'rối loạn kali máu'],
    icdCode: 'E83.5',
    englishName: 'Disorders of calcium metabolism'
  },
  {
    vietnameseName: ['hạ kali máu', 'giảm kali máu', 'hypokalemia'],
    icdCode: 'E83.51',
    englishName: 'Hypokalemia'
  },
  {
    vietnameseName: ['tăng kali máu', 'hyperkalemia'],
    icdCode: 'E83.52',
    englishName: 'Hyperkalemia'
  },
  
  // G: Diseases of the nervous system
  {
    vietnameseName: ['động kinh', 'epilepsy'],
    icdCode: 'G40',
    englishName: 'Epilepsy'
  },
  {
    vietnameseName: ['hội chứng chèn ép thần kinh', 'hội chứng ống cổ tay', 'hội chứng chèn ép dây thần kinh ngoại biên', 'carpal tunnel syndrome'],
    icdCode: 'G56',
    englishName: 'Mononeuropathies of upper limb'
  },
  {
    vietnameseName: ['tổn thương dây thần kinh ngoại biên', 'bệnh thần kinh ngoại biên'],
    icdCode: 'G57',
    englishName: 'Mononeuropathies of lower limb'
  },
  
  // K: Diseases of the digestive system
  {
    vietnameseName: ['trào ngược dạ dày thực quản có viêm', 'gerd có viêm', 'gerd with esophagitis'],
    icdCode: 'K21.0',
    englishName: 'Gastro-oesophageal reflux disease with esophagitis'
  },
  {
    vietnameseName: ['trào ngược dạ dày thực quản không đặc hiệu', 'gerd không đặc hiệu', 'gerd'],
    icdCode: 'K21.9',
    englishName: 'Gastro-oesophageal reflux disease without esophagitis'
  },
  {
    vietnameseName: ['loét dạ dày', 'gastric ulcer'],
    icdCode: 'K25',
    englishName: 'Gastric ulcer'
  },
  {
    vietnameseName: ['loét tá tràng', 'duodenal ulcer'],
    icdCode: 'K26',
    englishName: 'Duodenal ulcer'
  },
  {
    vietnameseName: ['loét peptic không xác định vị trí', 'loét peptit'],
    icdCode: 'K27',
    englishName: 'Peptic ulcer, site unspecified'
  },
  {
    vietnameseName: ['loét dạ dày tá tràng do nguyên nhân khác', 'loét gastrojejunal'],
    icdCode: 'K28',
    englishName: 'Gastrojejunal ulcer'
  },
  {
    vietnameseName: ['viêm dạ dày cấp có xuất huyết', 'viêm dày cấp chảy máu'],
    icdCode: 'K29.0',
    englishName: 'Acute hemorrhagic gastritis'
  },
  {
    vietnameseName: ['viêm dạ dày cấp khác', 'viêm dày cấp'],
    icdCode: 'K29.1',
    englishName: 'Other acute gastritis'
  },
  {
    vietnameseName: ['viêm dạ dày mạn nặng', 'viêm dày mạn teo'],
    icdCode: 'K29.3',
    englishName: 'Chronic atrophic gastritis'
  },
  {
    vietnameseName: ['viêm dạ dày mạn khác', 'viêm dày mạn'],
    icdCode: 'K29.4',
    englishName: 'Other chronic gastritis'
  },
  {
    vietnameseName: ['viêm dạ dày thể chưa rõ nguyên nhân', 'viêm dày không xác định'],
    icdCode: 'K29.5',
    englishName: 'Chronic gastritis, unspecified'
  },
  {
    vietnameseName: ['viêm dạ dày tá tràng khác', 'viêm dày tá tràng'],
    icdCode: 'K29.6',
    englishName: 'Other gastritis'
  },
  
  // M: Diseases of the musculoskeletal system
  {
    vietnameseName: ['viêm xương khớp đa khớp', 'thoái hóa đa khớp', 'polyarthrosis'],
    icdCode: 'M15',
    englishName: 'Polyarthrosis'
  },
  {
    vietnameseName: ['viêm xương khớp khớp háng', 'thoái hóa khớp háng', 'coxarthrosis'],
    icdCode: 'M16',
    englishName: 'Coxarthrosis (arthrosis of hip)'
  },
  {
    vietnameseName: ['viêm xương khớp gối', 'thoái hóa khớp gối', 'gonarthrosis'],
    icdCode: 'M17',
    englishName: 'Gonarthrosis (arthrosis of knee)'
  },
  {
    vietnameseName: ['viêm xương khớp bàn ngón tay', 'thoái hóa khớp tay'],
    icdCode: 'M18',
    englishName: 'Arthrosis of first carpometacarpal joint'
  },
  {
    vietnameseName: ['viêm xương khớp không đặc hiệu', 'thoái hóa khớp', 'osteoarthritis', 'arthrosis'],
    icdCode: 'M19',
    englishName: 'Other arthrosis'
  },
  {
    vietnameseName: ['thoái hóa cột sống', 'thoái hóa đốt sống', 'spondylosis'],
    icdCode: 'M47',
    englishName: 'Spondylosis'
  },
  {
    vietnameseName: ['hẹp ống sống', 'thoái hóa phức hợp cột sống', 'bệnh lý cột sống khác'],
    icdCode: 'M48',
    englishName: 'Other spondylopathies'
  },
  {
    vietnameseName: ['thoái hóa đĩa đệm cột sống cổ', 'thoát vị đĩa đệm cổ'],
    icdCode: 'M50',
    englishName: 'Cervical disc disorders'
  },
  {
    vietnameseName: ['thoái hóa đĩa đệm cột sống thắt lưng', 'thoát vị đĩa đệm thắt lưng'],
    icdCode: 'M51',
    englishName: 'Other intervertebral disc disorders'
  },
  {
    vietnameseName: ['đau cổ lan xuống tay', 'hội chứng cổ vai cánh tay', 'cervicobrachial syndrome'],
    icdCode: 'M54.1',
    englishName: 'Radiculopathy'
  },
  {
    vietnameseName: ['đau thần kinh tọa', 'sciatica'],
    icdCode: 'M54.3',
    englishName: 'Sciatica'
  },
  {
    vietnameseName: ['đau thắt lưng lan xuống chân', 'đau lưng xuống chân'],
    icdCode: 'M54.4',
    englishName: 'Lumbago with sciatica'
  },
  {
    vietnameseName: ['viêm bao gân', 'tenosynovitis'],
    icdCode: 'M65',
    englishName: 'Synovitis and tenosynovitis'
  },
  {
    vietnameseName: ['viêm phần mềm do quá tải', 'bệnh phần mềm liên quan nghề nghiệp'],
    icdCode: 'M70',
    englishName: 'Soft tissue disorders related to use, overuse and pressure'
  },
  {
    vietnameseName: ['đau xương', 'bone pain'],
    icdCode: 'M79.0',
    englishName: 'Rheumatism, unspecified'
  },
  {
    vietnameseName: ['đau cơ', 'myalgia'],
    icdCode: 'M79.1',
    englishName: 'Myalgia'
  },
  {
    vietnameseName: ['đau thần kinh', 'neuralgia'],
    icdCode: 'M79.2',
    englishName: 'Neuralgia and neuritis, unspecified'
  },
  
  // N: Diseases of the genitourinary system
  {
    vietnameseName: ['viêm cổ tử cung không đặc hiệu', 'viêm cổ tử cung', 'cervicitis'],
    icdCode: 'N72',
    englishName: 'Inflammatory disease of cervix uteri'
  },
  {
    vietnameseName: ['viêm âm đạo và âm hộ không đặc hiệu', 'viêm âm đạo âm hộ'],
    icdCode: 'N76.0',
    englishName: 'Acute vaginitis'
  },
  {
    vietnameseName: ['viêm âm hộ âm đạo cấp', 'viêm vulvovaginal cấp'],
    icdCode: 'N76.2',
    englishName: 'Acute vulvitis'
  },
  {
    vietnameseName: ['viêm âm hộ âm đạo mạn', 'viêm vulvovaginal mạn'],
    icdCode: 'N76.3',
    englishName: 'Subacute and chronic vulvitis'
  },
  {
    vietnameseName: ['viêm âm hộ âm đạo không xác định', 'viêm vulvovaginal'],
    icdCode: 'N76.4',
    englishName: 'Abscess of vulva'
  },
  
  // Z: Factors influencing health status
  {
    vietnameseName: ['khám và xét nghiệm phụ khoa đặc biệt', 'khám phụ khoa'],
    icdCode: 'Z01.4',
    englishName: 'Gynecological examination'
  },
  {
    vietnameseName: ['dụng cụ tử cung', 'đặt vòng', 'đặt điều chỉnh vòng tránh thai'],
    icdCode: 'Z30.2',
    englishName: 'Encounter for sterilization'
  },
  {
    vietnameseName: ['chăm sóc tránh thai khác', 'tư vấn tránh thai', 'thủ thuật can thiệp tránh thai'],
    icdCode: 'Z30.09',
    englishName: 'Encounter for other general counseling and advice on contraception'
  }
];

/**
 * Normalize Vietnamese text for comparison
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?]/g, '');
}

/**
 * Map diagnosis name to ICD-10 code
 */
export function mapDiagnosisToICD(diagnosisText: string): string {
  if (!diagnosisText) return '';
  
  const normalized = normalizeText(diagnosisText);
  
  // Find exact match or partial match
  for (const mapping of ICD10_MAPPING) {
    for (const name of mapping.vietnameseName) {
      const normalizedName = normalizeText(name);
      
      // Exact match
      if (normalized === normalizedName) {
        return mapping.icdCode;
      }
      
      // Partial match (contains)
      if (normalized.includes(normalizedName) || normalizedName.includes(normalized)) {
        return mapping.icdCode;
      }
    }
  }
  
  // No match found
  return '';
}

/**
 * Map array of diagnoses to ICD codes
 */
export function mapDiagnosesArrayToICD(diagnoses: string[]): string[] {
  if (!Array.isArray(diagnoses)) return [];
  
  return diagnoses.map(diagnosis => mapDiagnosisToICD(diagnosis));
}

/**
 * Get ICD info by code
 */
export function getICDInfoByCode(icdCode: string): ICD10Mapping | undefined {
  return ICD10_MAPPING.find(m => m.icdCode === icdCode);
}

/**
 * Validate ICD-10 code format
 */
export function isValidICDCode(code: string): boolean {
  // ICD-10 format: A00-Z99 with optional .X suffix
  return /^[A-Z]\d{2}(\.\d{1,2})?(\*)?$/.test(code);
}
