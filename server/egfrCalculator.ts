/**
 * eGFR Calculator using CKD-EPI formula (2021 version without race)
 * Based on serum creatinine, age, and gender
 */

interface EGFRInput {
  creatinine: number; // mg/dL
  age: number; // years
  gender: string; // "Nam" or "Nữ"
}

interface EGFRResult {
  egfr: number; // mL/min/1.73m²
  egfrCategory: string; // G1-G5
  renalFunction: string; // Vietnamese description
}

/**
 * Calculate eGFR using CKD-EPI formula (2021)
 */
export function calculateEGFR(input: EGFRInput): EGFRResult | null {
  const { creatinine, age, gender } = input;

  // Validate inputs
  if (!creatinine || creatinine <= 0 || !age || age <= 0 || !gender) {
    return null;
  }

  let egfr: number;

  // CKD-EPI formula based on gender
  if (gender === "Nữ" || gender.toLowerCase() === "female") {
    if (creatinine <= 0.7) {
      // Female, SCr ≤ 0.7
      egfr = 144 * Math.pow(creatinine / 0.7, -0.329) * Math.pow(0.993, age);
    } else {
      // Female, SCr > 0.7
      egfr = 144 * Math.pow(creatinine / 0.7, -1.209) * Math.pow(0.993, age);
    }
  } else {
    // Male
    if (creatinine <= 0.9) {
      // Male, SCr ≤ 0.9
      egfr = 141 * Math.pow(creatinine / 0.9, -0.411) * Math.pow(0.993, age);
    } else {
      // Male, SCr > 0.9
      egfr = 141 * Math.pow(creatinine / 0.9, -1.209) * Math.pow(0.993, age);
    }
  }

  // Round to 1 decimal place
  egfr = Math.round(egfr * 10) / 10;

  // Determine category and function description
  const { egfrCategory, renalFunction } = classifyRenalFunction(egfr);

  return {
    egfr,
    egfrCategory,
    renalFunction,
  };
}

/**
 * Classify renal function based on eGFR value
 */
function classifyRenalFunction(egfr: number): { egfrCategory: string; renalFunction: string } {
  if (egfr >= 90) {
    return {
      egfrCategory: "G1",
      renalFunction: "Chức năng thận bình thường hoặc tăng",
    };
  } else if (egfr >= 60) {
    return {
      egfrCategory: "G2",
      renalFunction: "Giảm nhẹ chức năng thận",
    };
  } else if (egfr >= 45) {
    return {
      egfrCategory: "G3a",
      renalFunction: "Suy thận mạn giai đoạn 3a - Giảm nhẹ đến trung bình",
    };
  } else if (egfr >= 30) {
    return {
      egfrCategory: "G3b",
      renalFunction: "Suy thận mạn giai đoạn 3b - Giảm trung bình đến nặng",
    };
  } else if (egfr >= 15) {
    return {
      egfrCategory: "G4",
      renalFunction: "Suy thận mạn giai đoạn 4 - Giảm nặng",
    };
  } else {
    return {
      egfrCategory: "G5",
      renalFunction: "Suy thận mạn giai đoạn 5 - Suy thận rất nặng/giai đoạn cuối",
    };
  }
}

/**
 * Extract creatinine value from labResults object
 * Supports various formats and field names, including nested structures
 */
export function extractCreatinine(labResults: any): number | null {
  if (!labResults || typeof labResults !== 'object') {
    console.log('[eGFR] labResults is null or not an object:', typeof labResults);
    return null;
  }

  console.log('[eGFR] labResults received:', JSON.stringify(labResults, null, 2));

  // Try common field names (case-insensitive)
  const possibleKeys = [
    'creatinine',
    'creatinin',
    'scr',
    'serum_creatinine',
    'creat',
    'Creatinine',
    'Creatinin',
    'SCr',
    'sCr',
  ];

  // First, try top-level keys
  for (const key of Object.keys(labResults)) {
    const lowerKey = key.toLowerCase();
    if (possibleKeys.some(pk => pk.toLowerCase() === lowerKey)) {
      const value = labResults[key];
      const numValue = typeof value === 'number' ? value : parseFloat(value);
      if (!isNaN(numValue) && numValue > 0) {
        // Basic unit validation: creatinine in mg/dL should be 0.1-20
        if (numValue > 0.1 && numValue < 20) {
          console.log(`[eGFR] Found creatinine at top-level key "${key}":`, numValue);
          return numValue;
        }
      }
    }
  }

  // If not found at top level, search nested objects/arrays
  for (const key of Object.keys(labResults)) {
    const value = labResults[key];
    
    // If value is an object, recursively search
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = extractCreatinine(value);
      if (nested !== null) {
        return nested;
      }
    }
    
    // If value is an array, search each item
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object') {
          const nested = extractCreatinine(item);
          if (nested !== null) {
            return nested;
          }
        }
      }
    }
  }

  console.log('[eGFR] Creatinine not found in labResults');
  return null;
}
