/**
 * Seed ICD patterns for drugs based on BHYT regulations
 * Source: "Kiểm tra mã ICD thuốc.docx"
 * 
 * Pattern format:
 * - Exact: "K21.0", "K29.0" (chỉ khớp chính xác)
 * - Group: "K21.x", "K25.x" (khớp tất cả K21.0, K21.1, K21.2...)
 */

import { db } from "./db";
import { drugFormulary } from "../shared/schema";
import { eq, ilike } from "drizzle-orm";

// Cấu hình ICD cho từng thuốc theo BHYT
const DRUG_ICD_CONFIG: Record<string, string[]> = {
  // IPP (Thuốc ức chế bơm proton) - cho trào ngược, loét dạ dày
  "LANSOPRAZOL": ["K21.x", "K25.x", "K26.x", "K27.x", "K28.x", "K29.0", "K29.1", "K29.3", "K29.4", "K29.5", "K29.6", "B96.81"],
  "OMEPRAZOL": ["K21.x", "K25.x", "K26.x", "K27.x", "K28.x", "K29.0", "K29.1", "K29.3", "K29.4", "K29.5", "K29.6", "B96.81"],
  "ESOMEPRAZOL": ["K21.x", "K25.x", "K26.x", "K27.x", "K28.x", "K29.0", "K29.1", "K29.3", "K29.4", "K29.5", "K29.6", "B96.81"],
  "PANTOPRAZOL": ["K21.x", "K25.x", "K26.x", "K27.x", "K28.x", "K29.0", "K29.1", "K29.3", "K29.4", "K29.5", "K29.6", "B96.81"],
  "RABEPRAZOL": ["K21.x", "K25.x", "K26.x", "K27.x", "K28.x", "K29.0", "K29.1", "K29.3", "K29.4", "K29.5", "K29.6", "B96.81"],

  // Kháng sinh - Amoxicillin/Clavulanate
  "AMOXICILLIN": ["A00-B99", "J00-J99", "N00-N99"], // Nhiễm khuẩn
  "CLAVULANIC": ["A00-B99", "J00-J99", "N00-N99"],

  // NSAID - Chống viêm giảm đau
  "DICLOFENAC": ["M00-M99", "R52"], // Viêm khớp, đau
  "CELECOXIB": ["M15.x", "M19.x", "M45.x", "M46.x"], // Viêm khớp dạng thấp
  "ETORICOXIB": ["M15.x", "M19.x", "M45.x", "M46.x"],
  "PREGABALIN": ["M79.2", "G89.x"], // Đau cơ xương khớp, đau thần kinh

  // Thuốc giảm đau đơn thuần
  "PARACETAMOL": ["R50.x", "R51.x", "R52.x"], // Sốt, đau đầu, đau
  "ACETAMINOPHEN": ["R50.x", "R51.x", "R52.x"],

  // Vitamin, khoáng chất
  "CALCIUM": ["E55.x", "M80.x", "M81.x"], // Thiếu vitamin D, loãng xương
  "VITAMIN D": ["E55.x", "M80.x", "M81.x"],
  "VITAMIN B": ["E53.x"], // Thiếu vitamin B
  "THIAMINE": ["E51.x"], // Thiếu vitamin B1
  "CYANOCOBALAMIN": ["D51.x", "E53.8"], // Thiếu vitamin B12
  "PYRIDOXINE": ["E53.1"], // Thiếu vitamin B6
  "MAGNESIUM": ["E61.2"], // Thiếu magie
  "ALPHA LIPOIC": ["E10.x", "E11.x", "E14.x"], // Đái tháo đường (biến chứng thần kinh)
  "MECOBALAMIN": ["G60.x", "G62.x", "E53.8"], // Bệnh thần kinh ngoại biên
  "NYSTATIN": ["B37.x"], // Nhiễm nấm Candida
  "POLYMYXIN": ["H60.x", "H65.x", "H66.x"], // Viêm tai
  "NEOMYCIN": ["H60.x", "H65.x", "H66.x"],

  // Thuốc tim mạch
  "ATORVASTATIN": ["E78.x"], // Rối loạn lipid
  "AMLODIPINE": ["I10.x", "I11.x", "I20.x"], // Tăng huyết áp, đau thắt ngực
  "METOPROLOL": ["I10.x", "I20.x", "I48.x"], // THA, đau thắt ngực, rung nhĩ
  "PERINDOPRIL": ["I10.x", "I11.x", "I50.x"], // THA, suy tim
  "INDAPAMIDE": ["I10.x", "I11.x"], // THA

  // Thuốc đái tháo đường
  "METFORMIN": ["E11.x", "E14.x"], // Đái tháo đường type 2
  "INSULIN": ["E10.x", "E11.x", "E13.x", "E14.x"], // Tất cả loại đái tháo đường
  "VILDAGLIPTIN": ["E11.x", "E14.x"],
  "DAPAGLIFLOZIN": ["E11.x", "E14.x"],
};

async function seedDrugICD() {
  console.log("🔄 Starting ICD pattern seeding...");
  
  let updated = 0;
  let notFound = 0;
  
  for (const [activeIngredient, icdPatterns] of Object.entries(DRUG_ICD_CONFIG)) {
    try {
      // Tìm tất cả thuốc có chứa hoạt chất này
      const drugs = await db
        .select()
        .from(drugFormulary)
        .where(ilike(drugFormulary.activeIngredient, `%${activeIngredient}%`));
      
      if (drugs.length === 0) {
        console.log(`⚠️  Not found: ${activeIngredient}`);
        notFound++;
        continue;
      }
      
      // Update ICD patterns cho tất cả thuốc khớp
      for (const drug of drugs) {
        const patternsString = icdPatterns.join(",");
        await db
          .update(drugFormulary)
          .set({ icdPatterns: patternsString })
          .where(eq(drugFormulary.id, drug.id));
        
        console.log(`✅ Updated: ${drug.tradeName} (${activeIngredient}) → ${icdPatterns.length} patterns`);
        updated++;
      }
    } catch (error) {
      console.error(`❌ Error updating ${activeIngredient}:`, error);
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Updated: ${updated} drugs`);
  console.log(`   ⚠️  Not found: ${notFound} active ingredients`);
  console.log(`\n✨ ICD pattern seeding completed!`);
  
  process.exit(0);
}

// Run seeding
seedDrugICD().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
