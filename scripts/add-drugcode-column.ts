import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function addDrugCodeColumn() {
  try {
    console.log("Adding drug_code column to drug_formulary table...");
    
    // Check if column exists
    const result = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'drug_formulary' 
      AND column_name = 'drug_code'
    `);
    
    if (result.rows.length > 0) {
      console.log("✓ Column drug_code already exists!");
      return;
    }
    
    // Add column
    await db.execute(sql`
      ALTER TABLE drug_formulary 
      ADD COLUMN drug_code TEXT
    `);
    
    console.log("✓ Successfully added drug_code column!");
    console.log("You can now re-upload DMT file to populate this field.");
    
  } catch (error) {
    console.error("Error adding column:", error);
    throw error;
  } finally {
    process.exit(0);
  }
}

addDrugCodeColumn();
