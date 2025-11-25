import { checkMedicationOverlap, detectMedicationSwitching, validateDrugInteraction } from '../server/medicationTimeline';
import type { Medication } from '@shared/schema';

// Test case 1: BÙI THỊ TÂM - Lovastatin → Atorvastatin (medication switching)
const lovastatin: Medication = {
  id: 1,
  caseId: 1,
  drugName: "Lovastatin DWP 10mg",
  prescribedDose: "10mg",
  prescribedRoute: "Uống",
  prescribedFrequency: "Tối 1 viên",
  indication: "Rối loạn chuyển hóa lipid",
  usageStartDate: "2025-10-23",
  usageEndDate: "2025-10-27",
  createdAt: new Date(),
  updatedAt: new Date()
};

const atorvastatin: Medication = {
  id: 2,
  caseId: 1,
  drugName: "Atorvastatin TP 10mg",
  prescribedDose: "20mg",
  prescribedRoute: "Uống",
  prescribedFrequency: "Tối 2 viên",
  indication: "Rối loạn chuyển hóa lipid",
  usageStartDate: "2025-10-28",
  usageEndDate: "2025-11-04",
  createdAt: new Date(),
  updatedAt: new Date()
};

// Test case 2: Overlapping medications
const aspirin: Medication = {
  id: 3,
  caseId: 1,
  drugName: "Aspirin 75mg",
  prescribedDose: "75mg",
  prescribedRoute: "Uống",
  prescribedFrequency: "Sáng 1 viên",
  indication: "Chống kết tập tiểu cầu",
  usageStartDate: "2025-10-23",
  usageEndDate: "2025-11-04",
  createdAt: new Date(),
  updatedAt: new Date()
};

const plavix: Medication = {
  id: 4,
  caseId: 1,
  drugName: "Plavix 75mg",
  prescribedDose: "75mg",
  prescribedRoute: "Uống",
  prescribedFrequency: "Sáng 1 viên",
  indication: "Chống kết tập tiểu cầu",
  usageStartDate: "2025-10-25",
  usageEndDate: "2025-11-01",
  createdAt: new Date(),
  updatedAt: new Date()
};

// Test case 3: Ceftazidime → Ceftriaxone (antibiotic switching)
const ceftazidime: Medication = {
  id: 5,
  caseId: 1,
  drugName: "Ceftazidime 1000mg",
  prescribedDose: "1g",
  prescribedRoute: "Tiêm tĩnh mạch",
  prescribedFrequency: "8h-20h",
  indication: "Viêm phổi",
  usageStartDate: "2025-10-27",
  usageEndDate: "2025-11-03",
  createdAt: new Date(),
  updatedAt: new Date()
};

const ceftriaxone: Medication = {
  id: 6,
  caseId: 1,
  drugName: "Ceftriaxone 1g",
  prescribedDose: "1g",
  prescribedRoute: "Tiêm tĩnh mạch",
  prescribedFrequency: "Ngày 1 lần",
  indication: "Viêm phổi",
  usageStartDate: "2025-11-04",
  usageEndDate: "2025-11-10",
  createdAt: new Date(),
  updatedAt: new Date()
};

console.log("=".repeat(80));
console.log("TEST MEDICATION SWITCHING & OVERLAP DETECTION");
console.log("=".repeat(80));

console.log("\n[TEST 1] Lovastatin → Atorvastatin (Statin switching)");
console.log("-".repeat(80));
console.log("Lovastatin: 2025-10-23 → 2025-10-27");
console.log("Atorvastatin: 2025-10-28 → 2025-11-04");
console.log();
const overlap1 = checkMedicationOverlap(lovastatin, atorvastatin);
const switching1 = detectMedicationSwitching(lovastatin, atorvastatin);
const validation1 = validateDrugInteraction(lovastatin, atorvastatin, "Statin-statin interaction");
console.log(`✓ Overlap: ${overlap1} (Expected: false)`);
console.log(`✓ Switching detected: ${switching1} (Expected: true)`);
console.log(`✓ Interaction valid: ${validation1.isValid} (Expected: false)`);
console.log(`✓ Reason: ${validation1.reason || 'N/A'}`);
console.log(overlap1 === false && switching1 === true && !validation1.isValid ? "✅ PASSED" : "❌ FAILED");

console.log("\n[TEST 2] Aspirin + Plavix (Overlapping dual antiplatelet)");
console.log("-".repeat(80));
console.log("Aspirin: 2025-10-23 → 2025-11-04");
console.log("Plavix: 2025-10-25 → 2025-11-01");
console.log();
const overlap2 = checkMedicationOverlap(aspirin, plavix);
const switching2 = detectMedicationSwitching(aspirin, plavix);
const validation2 = validateDrugInteraction(aspirin, plavix, "Dual antiplatelet - increased bleeding risk");
console.log(`✓ Overlap: ${overlap2} (Expected: true)`);
console.log(`✓ Switching detected: ${switching2} (Expected: false)`);
console.log(`✓ Interaction valid: ${validation2.isValid} (Expected: true)`);
console.log(overlap2 === true && switching2 === false && validation2.isValid ? "✅ PASSED" : "❌ FAILED");

console.log("\n[TEST 3] Ceftazidime → Ceftriaxone (Antibiotic switching)");
console.log("-".repeat(80));
console.log("Ceftazidime: 2025-10-27 → 2025-11-03");
console.log("Ceftriaxone: 2025-11-04 → 2025-11-10");
console.log();
const overlap3 = checkMedicationOverlap(ceftazidime, ceftriaxone);
const switching3 = detectMedicationSwitching(ceftazidime, ceftriaxone);
const validation3 = validateDrugInteraction(ceftazidime, ceftriaxone, "Cephalosporin interaction");
console.log(`✓ Overlap: ${overlap3} (Expected: false)`);
console.log(`✓ Switching detected: ${switching3} (Expected: true)`);
console.log(`✓ Interaction valid: ${validation3.isValid} (Expected: true - different antibiotics)`);
console.log(overlap3 === false && switching3 === true ? "✅ PASSED" : "❌ FAILED");

console.log("\n[TEST 4] Lovastatin + Atorvastatin (Force overlap - hypothetical)");
console.log("-".repeat(80));
const lovastatinOverlap: Medication = { ...lovastatin, usageEndDate: "2025-10-30" };
const atorvastatinOverlap: Medication = { ...atorvastatin, usageStartDate: "2025-10-28" };
console.log("Lovastatin: 2025-10-23 → 2025-10-30");
console.log("Atorvastatin: 2025-10-28 → 2025-11-04");
console.log();
const overlap4 = checkMedicationOverlap(lovastatinOverlap, atorvastatinOverlap);
const switching4 = detectMedicationSwitching(lovastatinOverlap, atorvastatinOverlap);
const validation4 = validateDrugInteraction(lovastatinOverlap, atorvastatinOverlap, "Statin-statin interaction");
console.log(`✓ Overlap: ${overlap4} (Expected: true - 28-30/10)`);
console.log(`✓ Switching detected: ${switching4} (Expected: false - still overlapping)`);
console.log(`✓ Interaction valid: ${validation4.isValid} (Expected: true - real overlap)`);
console.log(overlap4 === true && !switching4 && validation4.isValid ? "✅ PASSED" : "❌ FAILED");

console.log("\n" + "=".repeat(80));
console.log("ALL TESTS COMPLETED");
console.log("=".repeat(80));
