import { pool } from '../server/db.js';
import fs from 'fs';

const sql = fs.readFileSync('./migrations/0003_phase1_medications_labs_enhancements.sql', 'utf-8');

pool.query(sql)
  .then(() => {
    console.log('✅ Migration successful: Phase 1 - Medications & Labs enhancements');
    console.log('   - Added: form, dose_per_admin, frequency_per_day, admin_times');
    console.log('   - Added: medication_status, order_sheet_number');
    console.log('   - Added: labs array field for comprehensive lab results');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });
