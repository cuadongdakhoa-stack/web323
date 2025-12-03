/**
 * Script kiểm tra dữ liệu ICD trong database
 */
import { db } from "../server/db";
import { cases } from "../shared/schema";
import { sql } from "drizzle-orm";

async function checkICDData() {
  console.log("🔍 Checking ICD data in database...\n");
  
  try {
    // Get first 5 cases with ICD info
    const caseSamples = await db
      .select({
        id: cases.id,
        patientName: cases.patientName,
        diagnosis: cases.diagnosis,
        diagnosisMain: cases.diagnosisMain,
        diagnosisSecondary: cases.diagnosisSecondary,
        icdCodes: cases.icdCodes,
      })
      .from(cases)
      .limit(5);
    
    if (caseSamples.length === 0) {
      console.log("❌ No cases found in database");
      process.exit(0);
    }
    
    console.log(`Found ${caseSamples.length} cases:\n`);
    
    for (const c of caseSamples) {
      console.log(`📋 Case: ${c.patientName} (ID: ${c.id.substring(0, 8)}...)`);
      console.log(`   Diagnosis: ${c.diagnosis?.substring(0, 50) || 'N/A'}`);
      console.log(`   Main diagnosis: ${c.diagnosisMain || 'N/A'}`);
      console.log(`   Secondary: ${c.diagnosisSecondary?.join(', ') || 'N/A'}`);
      console.log(`   ICD Codes (jsonb): ${JSON.stringify(c.icdCodes) || 'N/A'}`);
      console.log('');
    }
    
    console.log("\n✅ Check completed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

checkICDData();
