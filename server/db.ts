import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure pool with proper settings
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum number of connections in the pool
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 10000, // Connection timeout 10 seconds
});

// Handle pool errors to prevent crashes
pool.on('error', (err) => {
  console.error('[DB Pool] Unexpected error on idle client', err);
  // Don't exit the process, just log the error
});

// Graceful shutdown handler
let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log(`\n[DB] Received ${signal}, closing database connections...`);
  
  try {
    await pool.end();
    console.log('[DB] Database pool closed successfully');
    process.exit(0);
  } catch (err) {
    console.error('[DB] Error during pool shutdown:', err);
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('beforeExit', () => {
  if (!isShuttingDown) {
    console.log('[DB] Process beforeExit, closing pool...');
    pool.end().catch(console.error);
  }
});

export const db = drizzle({ client: pool, schema });

// Test database connection with retry logic
async function testConnection(retries = 3, delay = 2000): Promise<boolean> {
  console.log('[DB] Testing connection to:', process.env.DATABASE_URL?.substring(0, 30) + '...');
  for (let i = 0; i < retries; i++) {
    try {
      const result = await pool.query('SELECT NOW()');
      console.log(`[DB] Connection successful at ${result.rows[0].now}`);
      return true;
    } catch (err: any) {
      console.error(`[DB] Connection attempt ${i + 1}/${retries} failed:`);
      console.error(`[DB] Error code: ${err.code}`);
      console.error(`[DB] Error message: ${err.message}`);
      console.error(`[DB] Error stack:`, err.stack);
      if (i < retries - 1) {
        console.log(`[DB] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  return false;
}

// Initialize connection test (don't await, let it run async)
testConnection().then(success => {
  if (!success) {
    console.error('[DB] Failed to connect to database after all retries');
    // Don't exit immediately in production, might recover
    if (process.env.NODE_ENV === 'development') {
      process.exit(1);
    }
  }
}).catch(err => {
  console.error('[DB] Unexpected error during connection test:', err);
});

export { testConnection };
