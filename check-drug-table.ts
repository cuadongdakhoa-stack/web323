import { config } from "dotenv";
config(); // Load .env file

import { db } from "./server/db";
import { cases } from "./shared/schema";
import { eq } from "drizzle-orm";

async function checkCaseData() {
  try {
    // Check the case that user is viewing
    const caseName = "BẠCH THỊ HUYỀN";
    
    console.log(`🔍 Checking cases for patient: ${caseName}\n`);
    
    const allCases = await db.select().from(cases);
    const matchingCases = allCases.filter(c => c.patientName?.includes(caseName));
    
    console.log(`Found ${matchingCases.length} cases:\n`);
    
    for (const c of matchingCases) {
      console.log(`📋 Case ID: ${c.id.substring(0, 8)}...`);
      console.log(`   Patient: ${c.patientName}`);
      console.log(`   Created: ${c.createdAt}`);
      console.log(`   Diagnosis Main: ${c.diagnosisMain}`);
      console.log(`   ICD Codes (jsonb):`);
      console.log(JSON.stringify(c.icdCodes, null, 2));
      console.log('');
    }
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

checkCaseData();
