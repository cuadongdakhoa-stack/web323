/**
 * Migration script to add variable_dosing and self_supplied columns to medications table
 * Run: npx tsx scripts/add-medication-columns.ts
 */

import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function addMedicationColumns() {
  try {
    console.log("Adding variable_dosing and self_supplied columns to medications table...");
    
    // Add variable_dosing column
    await db.execute(sql`
      ALTER TABLE medications 
      ADD COLUMN IF NOT EXISTS variable_dosing BOOLEAN DEFAULT false
    `);
    
    console.log("✅ Added variable_dosing column");
    
    // Add self_supplied column
    await db.execute(sql`
      ALTER TABLE medications 
      ADD COLUMN IF NOT EXISTS self_supplied BOOLEAN DEFAULT false
    `);
    
    console.log("✅ Added self_supplied column");
    
    console.log("\n✅ Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

addMedicationColumns();
