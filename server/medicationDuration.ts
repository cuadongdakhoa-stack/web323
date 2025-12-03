/**
 * MEDICATION DURATION CALCULATOR
 * Tính toán thời gian dùng thuốc dựa trên số lượng và liều dùng
 */

export interface MedicationDuration {
  usageStartDate: string; // YYYY-MM-DD
  usageEndDate: string; // YYYY-MM-DD
  estimatedDays: number;
  isEstimated: boolean;
}

/**
 * Parse frequency to get times per day
 * Examples:
 * - "2 lần/ngày" → 2
 * - "sáng tối" → 2
 * - "sáng trưa tối" → 3
 * - "ngày 3 lần" → 3
 * - "4 viên/ngày" → 4
 */
function parseFrequencyPerDay(frequency: string): number | null {
  if (!frequency) return null;
  
  const lower = frequency.toLowerCase().trim();
  
  // Pattern: "X lần/ngày" or "ngày X lần"
  const timesMatch = lower.match(/(\d+)\s*(lần|viên|gói|ống)?\s*\/?\s*ngày/i) || 
                     lower.match(/ngày\s*(\d+)\s*(lần|viên|gói|ống)?/i);
  if (timesMatch) {
    return parseInt(timesMatch[1]);
  }
  
  // Pattern: "sáng tối" = 2, "sáng trưa tối" = 3, etc.
  const timeOfDay = ['sáng', 'trưa', 'chiều', 'tối', 'trước ngủ', 'khuya'];
  let count = 0;
  for (const time of timeOfDay) {
    if (lower.includes(time)) count++;
  }
  if (count > 0) return count;
  
  return null;
}

/**
 * Parse dose to get quantity per administration
 * Examples:
 * - "1 viên" → 1
 * - "2 viên" → 2
 * - "5ml" → 5
 * - "1/2 viên" → 0.5
 */
function parseDosePerAdmin(dose: string): number | null {
  if (!dose) return null;
  
  const lower = dose.toLowerCase().trim();
  
  // Pattern: "X viên", "X gói", "X ống", "Xml"
  const quantityMatch = lower.match(/(\d+\.?\d*)\s*(viên|gói|ống|ml|g)/i);
  if (quantityMatch) {
    return parseFloat(quantityMatch[1]);
  }
  
  // Pattern: "1/2 viên" = 0.5
  const fractionMatch = lower.match(/(\d+)\/(\d+)/);
  if (fractionMatch) {
    return parseInt(fractionMatch[1]) / parseInt(fractionMatch[2]);
  }
  
  return null;
}

/**
 * Calculate end date from quantity and frequency
 * 
 * Formula: 
 * days = quantity / (dosePerAdmin * frequencyPerDay)
 * endDate = startDate + days
 */
export function calculateMedicationDuration(
  quantity: number | null | undefined,
  dose: string | null | undefined,
  frequency: string | null | undefined,
  startDate: string // YYYY-MM-DD
): MedicationDuration {
  
  const start = new Date(startDate);
  
  // If no quantity → estimate based on frequency (default 30 days for chronic meds)
  if (!quantity || quantity <= 0) {
    // Parse frequency to determine if it's chronic medication
    const frequencyPerDay = parseFrequencyPerDay(frequency || '');
    
    if (frequencyPerDay && frequencyPerDay > 0) {
      // Has frequency → assume chronic med (30 days)
      const defaultDays = 30;
      const end = new Date(start);
      end.setDate(end.getDate() + defaultDays);
      
      return {
        usageStartDate: startDate,
        usageEndDate: end.toISOString().split('T')[0],
        estimatedDays: defaultDays,
        isEstimated: true
      };
    }
    
    // No frequency either → same date
    return {
      usageStartDate: startDate,
      usageEndDate: startDate,
      estimatedDays: 0,
      isEstimated: false
    };
  }
  
  // Parse frequency and dose
  const frequencyPerDay = parseFrequencyPerDay(frequency || '');
  const dosePerAdmin = parseDosePerAdmin(dose || '');
  
  // If can't parse → use quantity as days (fallback)
  if (!frequencyPerDay || !dosePerAdmin) {
    // Assume 1 unit per day as fallback
    const estimatedDays = Math.ceil(quantity);
    const end = new Date(start);
    end.setDate(end.getDate() + estimatedDays);
    
    return {
      usageStartDate: startDate,
      usageEndDate: end.toISOString().split('T')[0],
      estimatedDays,
      isEstimated: true
    };
  }
  
  // Calculate days
  const totalDailyDose = dosePerAdmin * frequencyPerDay;
  const estimatedDays = Math.ceil(quantity / totalDailyDose);
  
  // Calculate end date
  const end = new Date(start);
  end.setDate(end.getDate() + estimatedDays);
  
  return {
    usageStartDate: startDate,
    usageEndDate: end.toISOString().split('T')[0],
    estimatedDays,
    isEstimated: false
  };
}

/**
 * Calculate medication status based on dates
 */
export function calculateMedicationStatus(
  startDate: string,
  endDate: string,
  currentDate: string = new Date().toISOString().split('T')[0]
): 'ACTIVE' | 'COMPLETED' | 'UPCOMING' {
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  const current = new Date(currentDate);
  
  if (current < start) {
    return 'UPCOMING';
  } else if (current > end) {
    return 'COMPLETED';
  } else {
    return 'ACTIVE';
  }
}

/**
 * Format duration for display
 */
export function formatMedicationDuration(
  startDate: string,
  endDate: string,
  estimatedDays: number,
  isEstimated: boolean
): string {
  if (startDate === endDate) {
    return `Ngày ${formatDate(startDate)} (liều đơn)`;
  }
  
  const prefix = isEstimated ? 'Dự kiến' : 'Thời gian';
  return `${prefix}: ${formatDate(startDate)} → ${formatDate(endDate)} (${estimatedDays} ngày)`;
}

/**
 * Format date from YYYY-MM-DD to DD/MM/YYYY
 */
function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Example usage:
 * 
 * const result = calculateMedicationDuration(
 *   14, // quantity
 *   "1 viên", // dose
 *   "2 lần/ngày", // frequency
 *   "2025-11-16" // startDate
 * );
 * 
 * // result = {
 * //   usageStartDate: "2025-11-16",
 * //   usageEndDate: "2025-11-23",
 * //   estimatedDays: 7,
 * //   isEstimated: false
 * // }
 */
