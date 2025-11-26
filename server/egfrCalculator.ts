/**
 * CrCl Calculator using Cockcroft-Gault formula
 * Based on serum creatinine, age, gender, and weight
 * 
 * IMPORTANT: Cockcroft-Gault calculates CrCl (Creatinine Clearance), NOT eGFR.
 * - CrCl (Cockcroft-Gault) estimates glomerular filtration using patient weight
 * - eGFR (MDRD/CKD-EPI) is normalized to body surface area (1.73 m²)
 * 
 * This function implements Cockcroft-Gault and should be labeled as "CrCl (Cockcroft-Gault)"
 */

interface EGFRInput {
  creatinine: number; // mg/dL or micromol/L (will be converted)
  creatinineUnit?: string; // "mg/dL" or "micromol/L"
  age: number; // years
  gender: string; // "Nam" or "Nữ"
  weight?: number; // kg (optional - uses assumed value if not provided)
}

interface EGFRResult {
  egfr: number; // mL/min (CrCl from Cockcroft-Gault, not normalized to BSA)
  egfrCategory: string; // G1-G5
  renalFunction: string; // Vietnamese description
  label: string; // "CrCl (Cockcroft-Gault)" to distinguish from eGFR methods
  metadata?: { // Calculation inputs for transparency
    creatinineValue: number;
    creatinineUnit: string;
    age: number;
    weight: number;
    gender: string;
  };
}

/**
 * Calculate CrCl using Cockcroft-Gault formula
 * Supports both mg/dL and micromol/L units for creatinine
 * Formula:
 *   Males: CrCl = ((140 - age) × weight) / (72 × SCr)
 *   Females: CrCl = ((140 - age) × weight × 0.85) / (72 × SCr)
 * Where SCr is in mg/dL
 * 
 * IMPORTANT: Weight is REQUIRED and must be a positive number.
 * Returns null if weight is missing or ≤0 (no silent defaults for clinical safety).
 */
export function calculateEGFR(input: EGFRInput): EGFRResult | null {
  const { creatinine, creatinineUnit = "mg/dL", age, gender, weight: providedWeight } = input;

  // Validate required inputs
  if (!creatinine || creatinine <= 0 || !age || age <= 0 || !gender) {
    return null;
  }

  // Validate weight - reject if missing or non-positive (fail fast, no silent defaults)
  if (!providedWeight || providedWeight <= 0) {
    return null;
  }

  const weight = providedWeight;

  // Convert micromol/L to mg/dL if needed
  // Conversion factor: 1 mg/dL = 88.4 micromol/L (per Cockcroft-Gault reference)
  let creatinineInMgDL = creatinine;
  if (creatinineUnit === "micromol/L") {
    creatinineInMgDL = creatinine / 88.4;
  }

  let egfr: number;

  // Cockcroft-Gault formula based on gender (using converted mg/dL value)
  if (gender === "Nữ" || gender.toLowerCase() === "female") {
    // Female: CrCl = ((140 - age) × weight × 0.85) / (72 × SCr)
    egfr = ((140 - age) * weight * 0.85) / (72 * creatinineInMgDL);
  } else {
    // Male: CrCl = ((140 - age) × weight) / (72 × SCr)
    egfr = ((140 - age) * weight) / (72 * creatinineInMgDL);
  }

  // Round to 1 decimal place
  egfr = Math.round(egfr * 10) / 10;

  // Determine category and function description
  const { egfrCategory, renalFunction } = classifyRenalFunction(egfr);

  return {
    egfr,
    egfrCategory,
    renalFunction,
    label: "CrCl (Cockcroft-Gault)", // ✅ Correct labeling
    metadata: {
      creatinineValue: creatinine,
      creatinineUnit: creatinineUnit,
      age,
      weight,
      gender,
    },
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
