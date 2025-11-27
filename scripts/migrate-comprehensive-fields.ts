import { pool } from '../server/db.js';
import fs from 'fs';

const sql = fs.readFileSync('./migrations/0002_add_comprehensive_fields.sql', 'utf-8');

pool.query(sql)
  .then(() => {
    console.log('✅ Migration successful: Added comprehensive fields (phone, address, chief_complaint, etc.)');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });
