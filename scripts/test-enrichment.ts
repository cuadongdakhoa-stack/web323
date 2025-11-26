import { db } from './db';
import { drugFormulary } from '../shared/schema';
import { or, ilike } from 'drizzle-orm';

// Test enrichment logic
async function testEnrichment() {
  console.log("=== TEST ENRICHMENT LOGIC ===\n");

  // Test data giống như AI extract
  const medications = [
    { drugName: "Aspirin tab DWP 75mg", dose: "1 viên", frequency: "1 lần/ngày" },
    { drugName: "3BTP", dose: "1 viên", frequency: "1 lần/ngày" },
    { drugName: "A.T Esomeprazol 20 inj", dose: "1 lọ", frequency: "1 lần/ngày" },
  ];

  for (const med of medications) {
    console.log(`\n--- Testing: ${med.drugName} ---`);
    
    // Clean name (giống logic trong enrichMedicationsWithActiveIngredients)
    const cleanName = med.drugName
      .replace(/\s+\d+\s*(mg|g|ml|mcg|µg|IU|%)\b.*/i, '')
      .replace(/\s+(viên|ống|chai|lọ|túi|gói)\b.*/i, '')
      .replace(/\s+(uống|tiêm|bôi|nhỏ)\b.*/i, '')
      .trim();
    
    console.log(`  Original: "${med.drugName}"`);
    console.log(`  Cleaned:  "${cleanName}"`);

    // Search in database
    const foundDrugs = await db
      .select()
      .from(drugFormulary)
      .where(
        or(
          ilike(drugFormulary.tradeName, `%${cleanName}%`),
          ilike(drugFormulary.tradeName, cleanName)
        )
      )
      .limit(1);

    if (foundDrugs.length > 0) {
      console.log(`  ✅ MATCH FOUND:`);
      console.log(`     Trade Name: ${foundDrugs[0].tradeName}`);
      console.log(`     Active Ingredient: ${foundDrugs[0].activeIngredient}`);
      console.log(`     Strength: ${foundDrugs[0].strength}`);
      console.log(`     Unit: ${foundDrugs[0].unit}`);
    } else {
      console.log(`  ❌ NO MATCH - drug will use drugName as fallback`);
    }
  }
}

testEnrichment()
  .then(() => {
    console.log("\n=== TEST COMPLETED ===");
    process.exit(0);
  })
  .catch(err => {
    console.error("ERROR:", err);
    process.exit(1);
  });
