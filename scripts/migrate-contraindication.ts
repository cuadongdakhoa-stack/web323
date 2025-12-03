/**
 * Migration script to add contraindication_icds column to drug_formulary table
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is not set");
  process.exit(1);
}

async function runMigration() {
  console.log("🔄 Starting migration: add contraindication_icds column...");
  
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL not found');
    process.exit(1);
  }
  
  const sql = neon(DATABASE_URL);
  
  try {
    // Read SQL file
    const sqlFilePath = path.join(__dirname, "..", "migrations", "add-contraindication-icds.sql");
    const sqlContent = fs.readFileSync(sqlFilePath, "utf-8");
    
    // Remove comments and split by semicolon
    const statements = sqlContent
      .split("\n")
      .filter(line => !line.trim().startsWith("--") && line.trim().length > 0)
      .join("\n")
      .split(";")
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    console.log(`📝 Found ${statements.length} SQL statement(s) to execute`);
    
    // Execute each statement
    for (const statement of statements) {
      console.log(`\n⚙️  Executing:\n${statement}\n`);
      await sql(statement);
      console.log("✅ Success");
    }
    
    console.log("\n✨ Migration completed successfully!");
    
    // Verify column exists
    const result = await sql(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'drug_formulary' 
      AND column_name = 'contraindication_icds'
    `);
    
    if (result.length > 0) {
      console.log("\n✅ Verified: contraindication_icds column exists");
      console.log(`   Type: ${result[0].data_type}`);
    } else {
      console.log("\n⚠️  Warning: Could not verify column existence");
    }
    
  } catch (error: any) {
    console.error("\n❌ Migration failed:", error.message);
    if (error.code === "42701") {
      console.log("ℹ️  Column already exists (this is OK)");
    } else {
      throw error;
    }
  }
}

runMigration()
  .then(() => {
    console.log("\n🎉 All done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal error:", error);
    process.exit(1);
  });
