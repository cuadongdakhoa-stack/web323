import { db } from "../server/db";
import { medications } from "../shared/schema";
import { isNotNull } from "drizzle-orm";

async function checkMedicationDates() {
  try {
    console.log("Checking medications with dates...\n");
    
    // Get medications with usageStartDate
    const withDates = await db
      .select()
      .from(medications)
      .where(isNotNull(medications.usageStartDate))
      .limit(10);
    
    console.log(`Found ${withDates.length} medications with usageStartDate:`);
    withDates.forEach((med: any) => {
      console.log(`\n- ${med.drugName}`);
      console.log(`  Start: ${med.usageStartDate}`);
      console.log(`  End: ${med.usageEndDate}`);
      console.log(`  Case ID: ${med.caseId}`);
    });
    
    // Get total count
    const all = await db.select().from(medications).limit(5);
    console.log(`\n\nSample of all medications (first 5):`);
    all.forEach((med: any) => {
      console.log(`\n- ${med.drugName}`);
      console.log(`  Start: ${med.usageStartDate || 'NULL'}`);
      console.log(`  End: ${med.usageEndDate || 'NULL'}`);
    });
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    process.exit(0);
  }
}

checkMedicationDates();
