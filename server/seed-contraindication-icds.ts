/**
 * Seed script: Update drug_formulary with contraindication_icds
 * Based on "Mã hóa ICD chống chỉ định.xlsx"
 */
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, "..", ".env") }); // Load .env from root

import { db } from "./db";
import { drugFormulary } from "../shared/schema";
import { eq, or, ilike } from "drizzle-orm";

// Mapping: Drug name → Contraindication ICD patterns
const CONTRAINDICATION_DATA: Record<string, string> = {
  // 1. Phong tê thấp HD
  "Phong tê thấp HD": "Z34, Z32.1, Z39.1",
  
  // 2. Diamicron MR 30
  "Diamicron MR 30": "E10, E11.11, E13.1, E14.1, Z39.1",
  "Diamicron": "E10, E11.11, E13.1, E14.1, Z39.1",
  
  // 3. Hoạt huyết dưỡng não QN
  "Hoạt huyết dưỡng não QN": "D68.3, D68.9, I21, I63, I63.0, I63.1, I63.2, I63.50, I63.81, I63.9, Z39.1",
  
  // 4. Atorvastatin
  "Atorvastatin": "Z34, Z39.1",
  
  // 5. Fordia
  "Fordia": "I50",
  
  // 6. Diệp hạ châu Caps
  "Diệp hạ châu Caps": "Z34",
  "Diệp hạ châu": "Z34",
  
  // 7. Suspengel
  "Suspengel": "N18.4, N18.5",
  
  // 8. 3BTP
  "3BTP": "J45.2, J45.3, J45.4, J45.5, J45.6, J45.7, J45.9, L20.0, L20.81, L20.82, L20.83, L20.89, L20.9, L30.0, L30.9, C34.12, C77, C80.1, C34, C37, C56.9, C38.4, C00-C14, C53, C43, C44, C25, R91.1",
  
  // 9. Vastarel MR
  "Vastarel MR": "G25.81, G20, G21, G21.3, G21.8, G21.9, G24",
  "Vastarel": "G25.81, G20, G21, G21.3, G21.8, G21.9, G24",
  
  // 10. Pracetam 1200
  "Pracetam 1200": "I61.0, I61.1, I61.2, I61.3, I61.8, I61.9",
  "Pracetam": "I61.0, I61.1, I61.2, I61.3, I61.8, I61.9",
  
  // 11. Melanov-M
  "Melanov-M": "E11.11, E13.1, J44, J44.9, J44.1, I20, I21, I22, I25, I25.1, I25.10, I25.11, I25.2, I25.5, I25.8, I25.9, I24, Z95.5, I50.0, I50.1, I50.2, I50.3, I50.4, I50.9, I73, I73.9, I72.4, I72.8, I72.9, I87.2, I74",
  "Melanov": "E11.11, E13.1, J44, J44.9, J44.1, I20, I21, I22, I25, I25.1, I25.10, I25.11, I25.2, I25.5, I25.8, I25.9, I24, Z95.5, I50.0, I50.1, I50.2, I50.3, I50.4, I50.9, I73, I73.9, I72.4, I72.8, I72.9, I87.2, I74",
  
  // 12. Dưỡng can tiêu độc
  "Dưỡng can tiêu độc": "Z34",
  
  // 13. Coversyl 5mg
  "Coversyl 5mg": "Z34",
  "Coversyl": "Z34",
};

async function seedContraindicationICDs() {
  console.log("🔄 Starting contraindication ICD seeding...\n");
  
  let updateCount = 0;
  let notFoundCount = 0;
  const notFoundDrugs: string[] = [];
  
  for (const [drugName, contraindicationIcds] of Object.entries(CONTRAINDICATION_DATA)) {
    try {
      // Find drug by trade name (case-insensitive fuzzy match)
      const drugs = await db.select()
        .from(drugFormulary)
        .where(ilike(drugFormulary.tradeName, `%${drugName}%`))
        .limit(5);
      
      if (drugs.length === 0) {
        notFoundCount++;
        notFoundDrugs.push(drugName);
        console.log(`⚠️  Not found: "${drugName}"`);
        continue;
      }
      
      // Update all matching drugs
      for (const drug of drugs) {
        await db.update(drugFormulary)
          .set({ contraindicationIcds })
          .where(eq(drugFormulary.id, drug.id));
        
        updateCount++;
        console.log(`✅ Updated: "${drug.tradeName}" (${drug.id.substring(0, 8)}...)`);
        console.log(`   Contraindication ICDs: ${contraindicationIcds.substring(0, 60)}${contraindicationIcds.length > 60 ? '...' : ''}`);
      }
      
    } catch (error: any) {
      console.error(`❌ Error updating "${drugName}":`, error.message);
    }
  }
  
  console.log("\n" + "=".repeat(70));
  console.log("📊 Summary:");
  console.log(`   ✅ Updated: ${updateCount} drug records`);
  console.log(`   ⚠️  Not found: ${notFoundCount} drug names`);
  
  if (notFoundDrugs.length > 0) {
    console.log("\n⚠️  Drugs not found in database:");
    notFoundDrugs.forEach(name => console.log(`   - ${name}`));
    console.log("\n💡 Tip: Add these drugs to the formulary first, or check spelling.");
  }
  
  console.log("\n✨ Contraindication ICD seeding completed!");
}

// Run seed
seedContraindicationICDs()
  .then(() => {
    console.log("\n🎉 All done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal error:", error);
    process.exit(1);
  });
