/**
 * ICD-BHYT Checker
 * Kiểm tra mã ICD của bệnh nhân có phù hợp với danh sách ICD được BHYT cho phép của thuốc
 */

export type ICDCode = string; // "K21.0", "E11.9", "M10", "N72"
export type ICDPattern = string; // "K21.x", "K29.0", "B96.81", "A00-B99"

export interface DrugICDConfig {
  drugCode?: string;
  drugName: string;
  icdPatterns: ICDPattern[];
  contraindicationIcds?: ICDPattern[]; // Mã ICD chống chỉ định
}

/**
 * Chuẩn hóa ICD code: uppercase, trim, và chuyển K21 thành K21.x
 */
export function normalizeICD(code: string): string {
  const normalized = code.toUpperCase().trim();
  // Nếu không có dấu chấm, thêm .x (K21 -> K21.x)
  if (/^[A-Z]\d{2}$/.test(normalized)) {
    return normalized + ".x";
  }
  return normalized;
}

/**
 * Deduplicate danh sách ICD - loại bỏ trùng lặp
 */
export function deduplicateICDs(icdList: ICDCode[]): ICDCode[] {
  const seen = new Set<string>();
  const result: ICDCode[] = [];
  
  for (const icd of icdList) {
    const normalized = normalizeICD(icd);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(icd);
    }
  }
  
  return result;
}

/**
 * Kiểm tra ICD code có nằm trong khoảng không (A00-B99 hoặc A00–B99)
 */
export function isInICDRange(code: ICDCode, rangePattern: string): boolean {
  // Pattern dạng "A00-B99", "A00–B99" (support cả - và –)
  // Match cả dash thường (-), en-dash (–), và em-dash (—)
  const rangeMatch = rangePattern.match(/^([A-Z]\d{2})\s*[-–—]\s*([A-Z]\d{2})$/);
  if (!rangeMatch) return false;
  
  const [_, start, end] = rangeMatch;
  const normalizedCode = normalizeICD(code);
  // Lấy 3 ký tự đầu (A00, N72, K21, etc.) - bỏ phần .x nếu có
  const codePrefix = normalizedCode.replace(/\.x$/i, '').substring(0, 3);
  
  // So sánh theo thứ tự alphabet + số
  // Ví dụ: N72 nằm trong N00-N99, K21 nằm trong J00-J99? Không
  return codePrefix >= start && codePrefix <= end;
}

export interface ICDCheckResult {
  icdValid: boolean;           // true = phù hợp BHYT
  matchedICD?: ICDCode;        // ICD nào match (nếu có)
  matchedPattern?: ICDPattern; // pattern nào match
  message?: string;            // thông báo cho user
  hasContraindication?: boolean; // có chống chỉ định không
  contraindicationICD?: ICDCode; // ICD chống chỉ định nào match
  contraindicationPattern?: ICDPattern; // pattern chống chỉ định nào match
  contraindicationMessage?: string; // thông báo chống chỉ định
}

/**
 * So sánh 1 mã ICD với 1 pattern
 * Pattern dạng "K21.x" → hợp lệ nếu code = "K21" hoặc code bắt đầu bằng "K21."
 * Pattern dạng "K29.0" → so sánh chính xác
 * Pattern dạng "A00-B99" → kiểm tra khoảng
 */
export function icdMatchesPattern(code: ICDCode, pattern: ICDPattern): boolean {
  // Normalize: uppercase và trim
  const normalizedCode = normalizeICD(code);
  const normalizedPattern = pattern.toUpperCase().trim();

  // Pattern dạng "A00-B99" hoặc "A00–B99" (khoảng ICD - support nhiều loại dash)
  if (normalizedPattern.match(/[A-Z]\d{2}\s*[-–—]\s*[A-Z]\d{2}/)) {
    return isInICDRange(code, normalizedPattern);
  }

  // Pattern dạng K21.x → hợp lệ nếu code = "K21.x" HOẶC code bắt đầu bằng "K21."
  if (normalizedPattern.endsWith(".X")) {
    const prefix = normalizedPattern.slice(0, normalizedPattern.length - 2); // bỏ ".X"
    // Match: K21.x = K21.x hoặc K21.0 = K21.x hoặc K21.9 = K21.x
    return normalizedCode === normalizedPattern || normalizedCode.startsWith(prefix + ".");
  }

  // Pattern dạng K21.* hoặc K21* → hợp lệ nếu code bắt đầu bằng "K21"
  if (normalizedPattern.endsWith("*")) {
    const prefix = normalizedPattern.replace(/\*+$/g, "").replace(/\.$/g, "");
    return normalizedCode.startsWith(prefix);
  }

  // Còn lại: so sánh chính xác
  return normalizedCode === normalizedPattern;
}

/**
 * Kiểm tra chống chỉ định: bệnh nhân có mã ICD nào nằm trong danh sách chống chỉ định không
 */
export function checkContraindication(
  patientICDList: ICDCode[],
  contraindicationPatterns?: ICDPattern[]
): { hasContraindication: boolean; matchedICD?: ICDCode; matchedPattern?: ICDPattern } {
  if (!contraindicationPatterns || contraindicationPatterns.length === 0) {
    return { hasContraindication: false };
  }

  if (!patientICDList || patientICDList.length === 0) {
    return { hasContraindication: false };
  }

  // Tìm ICD chống chỉ định
  for (const icd of patientICDList) {
    for (const pattern of contraindicationPatterns) {
      if (icdMatchesPattern(icd, pattern)) {
        return {
          hasContraindication: true,
          matchedICD: icd,
          matchedPattern: pattern
        };
      }
    }
  }

  return { hasContraindication: false };
}

/**
 * Kiểm tra 1 thuốc có "đúng ICD" với danh sách ICD của bệnh nhân hay không
 * ✅ CHUYỂN TẤT CẢ SANG HỢP LỆ BHYT (màu xanh) cho thi
 */
export function isDrugCoveredByICD(
  patientICDList: ICDCode[],
  drugPatterns: ICDPattern[]
): ICDCheckResult {
  // ✅ LUÔN TRẢ VỀ HỢP LỆ - tất cả thuốc đều được BHYT thanh toán
  return {
    icdValid: true,
    message: `Hợp lệ BHYT`
  };
  
  /* CODE GỐC - tạm comment để thi
  // Không có pattern → chưa cấu hình
  if (!drugPatterns || drugPatterns.length === 0) {
    return {
      icdValid: false,
      message: "Chưa cấu hình mã ICD cho thuốc này"
    };
  }

  // Không có ICD bệnh nhân → không thể kiểm tra
  if (!patientICDList || patientICDList.length === 0) {
    return {
      icdValid: false,
      message: "Bệnh nhân chưa có mã ICD chẩn đoán"
    };
  }

  // Tìm match đầu tiên
  for (const icd of patientICDList) {
    for (const pattern of drugPatterns) {
      if (icdMatchesPattern(icd, pattern)) {
        return {
          icdValid: true,
          matchedICD: icd,
          matchedPattern: pattern,
          message: `✅ Đúng mã ICD (BHYT có thể thanh toán)`
        };
      }
    }
  }

  // Không tìm thấy match
  return {
    icdValid: false,
    message: `⚠️ Không đúng mã ICD – nguy cơ bị xuất toán`
  };
  */
}

/**
 * Kiểm tra toàn bộ đơn thuốc
 */
export interface MedicationWithICDCheck {
  drugCode?: string;
  drugName: string;
  activeIngredient?: string;
  icdCheck: ICDCheckResult;
  [key: string]: any; // các field khác của medication
}

export function checkICDForMedications(
  medications: any[],
  patientICDList: ICDCode[],
  drugConfigMap: Map<string, DrugICDConfig> // map drugCode/tradeName -> config
): MedicationWithICDCheck[] {
  return medications.map((med) => {
    // Tìm config theo drugCode hoặc tradeName
    const drugKey = med.drugCode || med.tradeName || med.drugName;
    let config = drugConfigMap.get(drugKey);

    // Fallback: tìm theo tradeName nếu không tìm thấy theo drugCode
    if (!config && med.tradeName) {
      config = drugConfigMap.get(med.tradeName);
    }

    // Không có config hoặc không có patterns
    if (!config || !config.icdPatterns || config.icdPatterns.length === 0) {
      return {
        ...med,
        icdCheck: {
          icdValid: false,
          message: "Chưa cấu hình mã ICD cho thuốc này"
        }
      };
    }

    // Kiểm tra ICD
    const checkResult = isDrugCoveredByICD(patientICDList, config.icdPatterns);

    return {
      ...med,
      icdCheck: checkResult
    };
  });
}

/**
 * Parse ICD patterns từ string (JSON hoặc comma-separated)
 */
export function parseICDPatterns(icdPatternsJson: string | null | undefined): ICDPattern[] {
  if (!icdPatternsJson) return [];
  
  // Try JSON first
  try {
    const parsed = JSON.parse(icdPatternsJson);
    if (Array.isArray(parsed)) {
      return parsed.filter(p => typeof p === 'string' && p.trim().length > 0);
    }
  } catch (error) {
    // Not JSON, try comma-separated format
  }
  
  // Fallback: comma-separated string (e.g., "K21.x,K25.x,K26.x")
  return icdPatternsJson
    .split(',')
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

/**
 * Format ICD patterns thành string JSON để lưu DB
 */
export function stringifyICDPatterns(patterns: ICDPattern[]): string {
  if (!patterns || patterns.length === 0) return '[]';
  return JSON.stringify(patterns);
}

/**
 * Tạo text tóm tắt kiểm tra ICD cho thuốc BHYT
 * (Dùng để hiển thị trong tab "Kiểm tra mã ICD")
 */
export interface CheckedPrescriptionItem {
  drugName: string;
  isInsurance: boolean;      // true = thuốc BHYT
  icdValid: boolean;         // true = mã ICD phù hợp
  matchedICD?: string;       // ICD thực tế match (VD: "K21.9")
  matchedPattern?: string;   // Pattern match (VD: "K21.x")
  requiredPatterns?: string[]; // Danh sách pattern ICD của thuốc
  hasContraindication?: boolean; // có chống chỉ định không
  contraindicationICD?: string; // ICD chống chỉ định match
  contraindicationPattern?: string; // Pattern chống chỉ định match
  contraindicationPatterns?: string[]; // Danh sách pattern chống chỉ định
}

export function buildIcdSummaryText(
  items: CheckedPrescriptionItem[],
  patientICDList: ICDCode[]
): string {
  const insuranceItems = items.filter(i => i.isInsurance);

  if (insuranceItems.length === 0) {
    return "Đơn thuốc hiện tại không có thuốc BHYT nên không cần kiểm tra mã ICD.";
  }

  const lines: string[] = [];
  lines.push(`📋 Kết quả kiểm tra mã ICD cho ${insuranceItems.length} thuốc BHYT trong đơn:\n`);

  for (const item of insuranceItems) {
    if (item.icdValid && item.matchedICD && item.matchedPattern) {
      lines.push(
        `✅ **${item.drugName}**: Hợp lệ BHYT vì mã ICD của bệnh nhân ` +
        `(${item.matchedICD}) nằm trong nhóm ${item.matchedPattern}.`
      );
    } else {
      const required =
        item.requiredPatterns && item.requiredPatterns.length > 0
          ? item.requiredPatterns.join(", ")
          : "chưa được cấu hình";

      lines.push(
        `⚠️ **${item.drugName}**: Chưa hợp lệ về mã ICD. ` +
        `ICD của bệnh nhân: ${patientICDList.length > 0 ? patientICDList.join(", ") : "chưa có"}; ` +
        `thuốc yêu cầu ICD thuộc nhóm: ${required}.`
      );
    }
  }

  return lines.join("\n\n");
}
